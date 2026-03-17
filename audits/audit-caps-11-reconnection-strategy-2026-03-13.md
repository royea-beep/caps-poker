# Audit — VAMOS CAPS 11: Reconnection Strategy Audit + Safe Rejoin Plan
**Date:** 2026-03-13

## Scope
Design audit for reconnection/rejoin strategy. No code changes — analysis and plan only.

---

## A — Current Reconnection Readiness

### What Already Exists That Helps

| Component | Status | Detail |
|-----------|--------|--------|
| **Stable device identity** | READY | `getDeviceId()` returns persistent 12-char hex from AsyncStorage. Same player = same ID across reconnects. |
| **Presence key = device ID** | READY | Both server and client use `{ presence: { key: playerId } }`. Supabase replaces (not duplicates) on re-track. |
| **Server client map persists** | READY | `clients: Map<string, RealtimeConnectedClient>` keeps disconnected entries with `connected: false`. Seat, name, all preserved. |
| **Seat preserved on reconnect** | READY | `syncClientsFromPresence` checks `this.clients.has(p.id)` — if true, only updates `connected = true` and `name`. Seat is NOT reassigned. |
| **ACK + retry for CARDS_DEALT** | PARTIAL | Server retries 5x every 2s = 10s window. If guest reconnects within 10s of deal, they auto-receive cards. |
| **ACK + retry for HAND_COMPLETE** | PARTIAL | Same 10s window. |
| **Auto-ready on disconnect** | READY | CAPS 10: server auto-readies disconnected guests so hands don't hang. |
| **Host-alive monitoring** | READY | CAPS 10: 5s grace presence monitor on client. |
| **ROOM_STATE broadcast** | READY | CAPS 09: server broadcasts authoritative seat mapping after every presence sync — a reconnecting guest receives this automatically. |
| **Channel name is deterministic** | READY | `caps-room-${roomCode}` — same room code = same channel. |

### What Is Missing

| Gap | Severity | Detail |
|-----|----------|--------|
| **No explicit catch-up message** | HIGH | Server has no way to re-send full game state to a reconnecting guest. After ACK retry window (10s) closes, game state is lost for that player. |
| **No auto-reconnect loop** | HIGH | Client has no retry mechanism — `onDisconnected` fires and the user gets an alert. No silent rejoin attempt. |
| **No "last hand snapshot"** | MEDIUM | `clearAllPendingDeliveries()` on new hand wipes all pending messages. If guest reconnects during reveal/results, previous hand data is gone. |
| **No server-side game phase tracking** | MEDIUM | Server doesn't expose which phase the game is in (lobby, arranging, waiting, reveal). A reconnecting guest doesn't know what state to enter. |
| **No reconnect method on RealtimeClient** | MEDIUM | `connect()` creates a fresh channel from scratch. No `reconnect()` that re-uses existing state. |
| **Fallback device ID is unstable** | LOW | If AsyncStorage fails: `'anon-' + Date.now().toString(36)` — each restart gets a new ID. Rare but breaks identity. |

---

## B — Safe Rejoin Model

### Recommended: "Lobby Rejoin + Mid-Hand Catch-Up"

**Scope:** A disconnected guest can rejoin the same room by re-entering the room code. If a hand is in progress, the server sends a GAME_STATE_SNAPSHOT that lets the guest re-enter the game screen. If the hand has advanced past the point of recovery (reveal/results), the guest waits for next hand.

**What this model supports:**
1. Guest disconnects and manually re-enters room code
2. Server recognizes the same device ID, restores seat
3. If hand is in arranging phase: server re-sends CARDS_DEALT, guest enters game screen
4. If hand is in waiting phase (all ready submitted): guest waits for HAND_COMPLETE which is still being tracked
5. If hand is in results/reveal: guest waits for next hand to be dealt
6. If in lobby (pre-game): seamless re-join, same as first join

**What this model does NOT support:**
- Automatic silent reconnection (guest must manually rejoin)
- Recovering mid-reveal animation state
- Recovering partial card arrangements (guest gets fresh CARDS_DEALT)
- Host reconnection (if host drops, game is over — host IS the server)

**Why this level is safe:**
- Server state is authoritative and already persists client entries
- Presence-based re-identification is already proven
- ROOM_STATE broadcast already fires on presence sync
- The only new mechanism needed: a GAME_STATE_SNAPSHOT message type
- No changes to game screens required (they already accept route params)
- The internet-join.tsx flow already handles the connect → callback → navigate pipeline

---

## C — State Restoration Requirements

### What a reconnecting guest needs, by game phase:

**Phase: Lobby (pre-game)**
- Nothing extra — presence sync + ROOM_STATE handles everything
- Guest sees players, waits for host to start

**Phase: Arranging (cards dealt, timer running)**
| Data | Source | Available? |
|------|--------|-----------|
| yourCards | `this.playerHands[seatIndex]` | YES — server holds all hands |
| boards (open cards, closed count) | `this.boards` | YES |
| playerIndex | `client.seat` from clients map | YES |
| playerCount | `this.clients.size` | YES |
| handId | `this.handId` | YES |
| timeLimit | `this.gameConfig.arrangementTime` | YES |
| cardsPerBoard | `CARDS_PER_BOARD` constant | YES |
| boardCount | `this.boards.length` | YES |

All data needed to re-enter `/multiplayer-game` exists on the server. The guest would receive a fresh timer (not the remaining time from the original deal, which is a minor UX trade-off).

**Phase: Waiting (all players ready, or this player already submitted)**
- Guest was auto-readied on disconnect (CAPS 10)
- If reveal hasn't happened yet: guest can re-enter game screen in `waiting` phase
- Needs: same data as arranging, plus indication that they are already ready

**Phase: Reveal / Results**
- Cannot meaningfully restore — reveal animations are client-local
- Best behavior: wait for next hand
- If HAND_COMPLETE is still pending (within 10s retry window): guest receives it normally

### New message type needed: `GAME_STATE_SNAPSHOT`

```typescript
{
  type: 'GAME_STATE_SNAPSHOT',
  data: {
    phase: 'lobby' | 'arranging' | 'waiting' | 'reveal',
    handId: number,
    yourCards: Card[],
    boards: { boardIndex: number, openCards: Card[], closedCardCount: number }[],
    playerIndex: number,
    playerCount: number,
    cardsPerBoard: number,
    timeLimit: number,
    boardCount: number,
    alreadyReady: boolean,  // true if player was auto-readied on disconnect
  }
}
```

---

## D — Risks / Failure Modes

### 1. Double-join: same player in room twice
**Risk:** If presence removal is slow (~30s Supabase grace), a reconnecting guest could briefly appear as two entries.
**Mitigation:** Server already uses `this.clients.has(p.id)` — duplicate presence with same key gets merged, not duplicated. Supabase presence key uniqueness handles this.

### 2. Stale CARDS_DEALT after reconnect
**Risk:** Guest reconnects and receives a retried CARDS_DEALT from a previous hand (handId mismatch).
**Mitigation:** Client already deduplicates via `lastProcessedHandId`. A stale CARDS_DEALT would be ignored. GAME_STATE_SNAPSHOT should include current handId.

### 3. Guest reconnects during reveal sequence
**Risk:** Server has already sent BOARD_REVEAL (fire-and-forget, no ACK) and HAND_COMPLETE. Guest missed both.
**Mitigation:** HAND_COMPLETE has ACK + retry (10s window). If within window, guest gets it. If outside window, guest must wait for next hand. This is acceptable — reveal is a ~5s animation.

### 4. Guest reconnects and timer has expired
**Risk:** Server dealt cards 90s ago, timer was 60s. Guest enters arranging phase with a fresh timer but server expects them to be ready.
**Mitigation:** Server already auto-readied the guest on disconnect (CAPS 10). The GAME_STATE_SNAPSHOT should indicate `alreadyReady: true` — guest enters waiting phase directly, not arranging.

### 5. Host reconnection
**Risk:** Host IS the server. If host's app crashes, all server state is lost.
**Mitigation:** NOT SUPPORTED. If host drops, game ends. This is a fundamental architectural constraint of the current peer-hosted model. Full host migration would require a server-side game state store (Supabase DB), which is a different architecture.

### 6. Race between reconnect and new hand deal
**Risk:** Guest reconnects at the exact moment a new hand is being dealt. They could receive both GAME_STATE_SNAPSHOT and CARDS_DEALT.
**Mitigation:** handId deduplication already handles this. Both messages would carry the same handId. Client processes whichever arrives first, ignores the duplicate.

### 7. Multiple rapid disconnects/reconnects
**Risk:** Guest connection flaps rapidly, creating multiple pending deliveries and presence churn.
**Mitigation:** Delivery tracking uses composite keys (`CARDS_DEALT:playerId`) — only one pending delivery per type per player. New delivery replaces old. Presence sync is idempotent.

---

## E — Best Recommendation

**Implement: Manual Rejoin with Server Catch-Up**

This is the right level for CAPS right now because:

1. **Infrastructure is 80% there** — device ID, persistent client map, seat stability, presence-based re-identification, ACK/retry — all exist and work
2. **The missing 20% is small** — one new message type (GAME_STATE_SNAPSHOT), one new server method, one new client handler, minor lobby flow adjustment
3. **Auto-reconnect is premature** — it requires connection state monitoring, exponential backoff, and careful handling of the Supabase channel lifecycle. It's a meaningful complexity step that can come later
4. **The UX is acceptable** — "Your connection was lost. Enter the room code again to rejoin" is clear, expected behavior for a mobile card game
5. **Host reconnection is NOT feasible** without migrating to server-authoritative architecture (Supabase Edge Functions or a persistent backend). Not worth the complexity for the current scope

**What I would NOT do:**
- Auto-reconnect loop (too much complexity, Supabase channel lifecycle edge cases)
- Host migration (requires server-side state persistence)
- Resuming mid-reveal animation (too fragile, low value)
- Session tokens / JWT auth (device ID is sufficient for this use case)

---

## F — Implementation Plan

### Step 1: Server — Add game phase tracking
- Add `private gamePhase: 'lobby' | 'arranging' | 'waiting' | 'reveal' = 'lobby'` to RealtimeServer
- Set phase transitions: `startGame()` → `'arranging'`, `onAllPlayersReady` → `'waiting'`/`'reveal'`, `startNewHand()` → `'arranging'`
- Expose via `getGamePhase()` method

### Step 2: Server — Add GAME_STATE_SNAPSHOT method
- New method: `sendGameStateSnapshot(playerId: string): void`
- Builds snapshot from current server state (boards, playerHands, handId, gameConfig, phase)
- Uses `sendToPlayer()` to send only to the reconnecting guest
- Includes `alreadyReady` flag based on client's `isReady` state

### Step 3: Server — Trigger snapshot on reconnect detection
- In `syncClientsFromPresence()`: when an existing client transitions from `connected: false` → `connected: true` AND `gamePhase !== 'lobby'`
- Call `sendGameStateSnapshot(playerId)` for that player
- Log the reconnection event

### Step 4: Client — Handle GAME_STATE_SNAPSHOT
- Add `onGameStateSnapshot` callback to `RealtimeClientCallbacks`
- In `handleIncomingMessage()`: route `GAME_STATE_SNAPSHOT` to callback
- Reset `lastProcessedHandId` to match snapshot's handId (prevent dedup blocking)

### Step 5: Guest lobby (internet-join.tsx) — Handle mid-game rejoin
- Register `onGameStateSnapshot` callback alongside `onCardsDealt`
- On snapshot received: navigate to `/multiplayer-game` with snapshot data
- If `alreadyReady`: enter waiting phase (skip arranging)

### Step 6: Guest disconnect flow — Navigate to rejoin instead of home
- In multiplayer-game.tsx and results.tsx: change "Leave" to "Rejoin" option in disconnect alerts
- "Rejoin" navigates to internet-join.tsx with room code pre-filled
- "Leave" still does full `resetMultiplayer()` + home

### Step 7: Testing scenarios
- Guest disconnect in lobby → rejoin: seamless
- Guest disconnect during arranging → rejoin within 10s: gets CARDS_DEALT retry + snapshot
- Guest disconnect during arranging → rejoin after 10s: gets snapshot only
- Guest disconnect during waiting → rejoin: enters waiting phase via snapshot
- Guest disconnect during reveal → rejoin: waits for next hand deal
- Host disconnect → game over (no recovery)

### Estimated scope
- ~40 lines in realtimeMultiplayer.ts (phase tracking, snapshot method, reconnect detection)
- ~10 lines in internet-join.tsx (snapshot callback)
- ~15 lines in multiplayer-game.tsx + results.tsx (rejoin option in alerts)
- Zero changes to game logic, reveal logic, or scoring

---

## G — File Save Verification

All CAPS files saved under `C:\Projects\Caps\`:
- `audits/audit-caps-11-reconnection-strategy-2026-03-13.md` (this file)
- `checkpoints/vamos-caps-11-reconnection-audit.md` (checkpoint)

Memory file at `C:\Users\royea\.claude\projects\C--Projects-MYCLICKER\memory\project_caps_state.md` — this is correct because the Claude Code working directory is MYCLICKER, and the memory system is scoped to that project directory.
