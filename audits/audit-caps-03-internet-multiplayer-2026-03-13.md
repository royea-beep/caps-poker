# Audit — VAMOS CAPS 03: Internet Multiplayer Crash Audit + Fix Plan
**Date:** 2026-03-13

---

## A. Current Multiplayer Architecture

Two parallel multiplayer systems exist:

### 1. Local WiFi Multiplayer (WORKING — complete implementation)
```
lobby/host.tsx → GameServer (TCP sockets) → multiplayer-game.tsx → results.tsx
lobby/join.tsx → GameClient (TCP sockets) → multiplayer-game.tsx → results.tsx
```
- GameServer has full game logic: `dealNewHand`, `startGame`, `runRevealSequence`, `setHostReady`, `updateCallbacks`, `getDealtCards`, `getClients`, `getBoards`, `requestNextHand`, `sendBoardReveal`, `sendHandComplete`, `sendReady` (via socket messages)
- GameClient has: `updateCallbacks`, `sendReady`, `getPlayerId`, `sendNextHandRequest`
- This is a rich protocol with message-based pub/sub over TCP sockets

### 2. Internet Multiplayer (BROKEN — thin transport layer only)
```
lobby/internet-host.tsx → RealtimeServer (Supabase channels) → multiplayer-game.tsx → CRASH
lobby/internet-join.tsx → RealtimeClient (Supabase channels) → multiplayer-game.tsx → CRASH
```
- RealtimeServer has: `start`, `broadcastToAll`, `sendToPlayer`, `onMessage`, `onPresenceChange`, `getRoomCode`, `isStarted`, `stop`
- RealtimeClient has: `connect`, `send`, `onMessage`, `onPresenceChange`, `getPlayerId`, `isConnected`, `disconnect`
- This is a **raw message transport** — no game logic, no callbacks, no state management

### Key Files
| File | Role |
|------|------|
| `utils/realtimeMultiplayer.ts` | RealtimeServer + RealtimeClient (thin Supabase channel wrappers) |
| `utils/gameServer.ts` | GameServer (full TCP server with game logic) |
| `utils/gameClient.ts` | GameClient (full TCP client with callback routing) |
| `constants/networkConfig.ts` | Shared message types and payload interfaces |
| `app/lobby/internet-host.tsx` | Internet host lobby screen |
| `app/lobby/internet-join.tsx` | Internet guest lobby screen |
| `app/multiplayer-game.tsx` | Game screen (shared by both WiFi and internet) |
| `app/results.tsx` | Results screen (shared by both, next-hand logic uses mpServer/mpClient) |
| `utils/deck.ts` | Card dealing for multiplayer |
| `store/gameStore.ts` | Zustand store — `mpServer` and `mpClient` are typed as `any` |

---

## B. Verified Mismatch Map

### Methods called on `mpServer` (stored in Zustand as `any`)

| Caller File | Method/Property Called | Where (line) | GameServer | RealtimeServer | Impact |
|---|---|---|---|---|---|
| multiplayer-game.tsx | `mpServer.updateCallbacks({...})` | L114 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.runRevealSequence(config)` | L118 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.getBoards()` | L119 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.getClients()` | L120 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.sendBoardReveal(...)` | L132 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.sendHandComplete(...)` | L154 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpServer.setHostReady(assignments)` | L355, L425 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpServer.updateCallbacks({...})` | L154 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpServer.getDealtCards()` | L156 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpServer.getClients()` | L162 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpServer.requestNextHand(config)` | L166 | EXISTS ✓ | MISSING ✗ | **CRASH** |

### Methods called on `mpClient` (stored in Zustand as `any`)

| Caller File | Method/Property Called | Where (line) | GameClient | RealtimeClient | Impact |
|---|---|---|---|---|---|
| multiplayer-game.tsx | `mpClient.updateCallbacks({...})` | L166 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| multiplayer-game.tsx | `mpClient.sendReady(assignments)` | L357, L427 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpClient.getPlayerId()` | L169 | EXISTS ✓ | EXISTS ✓ | OK |
| results.tsx | `mpClient.updateCallbacks({...})` | L171 | EXISTS ✓ | MISSING ✗ | **CRASH** |
| results.tsx | `mpClient.sendNextHandRequest()` | L176 | EXISTS ✓ | MISSING ✗ | **CRASH** |

### Lobby-level mismatches

| Caller File | Call | Expected | Actual | Impact |
|---|---|---|---|---|
| internet-host.tsx | `server.sendToPlayer(id, 'cards_dealt', {...})` | Sends typed payload | Sends raw broadcast — message type is `'cards_dealt'` (lowercase) not `'CARDS_DEALT'` (MessageType) | **Broken feature** — works by accident since onMessage is string-matched, but bypasses protocol |
| internet-host.tsx | Deals cards via `dealCardsMultiplayer()` | Same deal as GameServer | Uses `deck.ts` directly, not `gameLogic.ts` — different function, different board structure | **Data mismatch** — board structure may differ from what multiplayer-game.tsx expects |
| internet-join.tsx | `client.onMessage('cards_dealt', ...)` | Receives cards from host | Listens for lowercase `'cards_dealt'` — matches host's send | OK (consistent within internet path) |
| internet-host.tsx | Navigate params include `closedCardCount` | multiplayer-game.tsx reads `closedCards` | Lobby sends `closedCardCount` (number), game screen does `b.closedCards` (expects array) | **Broken feature** — boards will have empty closedCards |

---

## C. Crash Path Analysis

### Earliest Crash Point: Host presses READY during internet game

**Path:**
1. Host starts room in `internet-host.tsx` → creates `RealtimeServer` → stores in Zustand as `mpServer`
2. Guest joins in `internet-join.tsx` → creates `RealtimeClient` → stores as `mpClient`
3. Host presses "START GAME" → `internet-host.tsx` deals cards locally, navigates to `/multiplayer-game`
4. `multiplayer-game.tsx` mounts, reads `mpServer` from store
5. **Line 114**: `mpServer.updateCallbacks({onAllPlayersReady: ...})` → `RealtimeServer` has no `updateCallbacks` method → **TypeError: mpServer.updateCallbacks is not a function** → **CRASH**

This crash happens **immediately on game screen mount**, before any gameplay begins.

### Guest crash path (parallel):
1. Guest receives `cards_dealt` message, navigates to `/multiplayer-game`
2. `multiplayer-game.tsx` mounts, reads `mpClient` from store
3. **Line 166**: `mpClient.updateCallbacks({...})` → `RealtimeClient` has no `updateCallbacks` method → **CRASH**

### If crashes were somehow bypassed:
- Host pressing READY calls `mpServer.setHostReady(assignments)` — CRASH
- Guest pressing READY calls `mpClient.sendReady(assignments)` — CRASH
- All-ready triggers `mpServer.runRevealSequence(config)` — CRASH
- Next hand in results.tsx calls `mpServer.requestNextHand(config)` — CRASH

**Every single game-flow interaction crashes.** The internet path is 100% non-functional.

---

## D. Missing Pieces vs Broken Wiring

### Actually Missing (RealtimeServer needs but does not have):
1. `updateCallbacks()` — callback mutation pattern
2. `runRevealSequence(config)` — server-side game evaluation
3. `getBoards()` — board state storage
4. `getClients()` — client list with seat/ready/connected state
5. `getDealtCards()` — access to dealt hands
6. `setHostReady(assignments)` — host ready signal
7. `sendBoardReveal(...)` — typed reveal broadcast
8. `sendHandComplete(...)` — typed result broadcast
9. `requestNextHand(config)` — next hand orchestration
10. `startGame(config)` — deal and distribute cards
11. All internal game state (boards, playerHands, client tracking with seats)

### Actually Missing (RealtimeClient needs but does not have):
1. `updateCallbacks()` — callback mutation pattern
2. `sendReady(assignments)` — typed ready message
3. `sendNextHandRequest()` — next hand request

### Broken Wiring (exists but connected wrong):
1. **Lobby card dealing**: `internet-host.tsx` deals cards using `deck.ts` `dealCardsMultiplayer()` directly, but `multiplayer-game.tsx` expects the server object to manage game state (boards, player hands). The lobby bypasses the server entirely.
2. **Message type casing**: Lobby uses lowercase `'cards_dealt'`, protocol defines uppercase `'CARDS_DEALT'`
3. **Board data shape**: Lobby sends `{closedCardCount: N}` but game screen expects `{closedCards: Card[]}`
4. **Store typing**: `mpServer: any` and `mpClient: any` in Zustand means TypeScript cannot catch any of these mismatches

---

## E. Best Repair Strategy

### Verdict: Patch the current architecture — DO NOT rewrite

The architecture is sound. The design intent is clear:
- `GameServer` / `GameClient` = TCP transport + game logic (WiFi)
- `RealtimeServer` / `RealtimeClient` = Supabase transport + game logic (internet)
- Both should present the **same interface** to `multiplayer-game.tsx` and `results.tsx`

The problem is that `RealtimeServer`/`RealtimeClient` were built as thin transport wrappers and never received the game logic layer that `GameServer`/`GameClient` have.

### Strategy: Adapter/facade pattern

**Option A (RECOMMENDED): Add game logic methods to RealtimeServer/RealtimeClient**
- Give RealtimeServer the same public API as GameServer (the methods that screens actually call)
- Give RealtimeClient the same public API as GameClient (the methods that screens actually call)
- Reuse the same game logic functions from `utils/gameLogic.ts`
- Keep the Supabase channel as the transport under the hood

**Option B (alternative): Extract shared interface, build adapters**
- Define a `IMultiplayerServer` / `IMultiplayerClient` TypeScript interface
- Make both GameServer and RealtimeServer implement it
- More architecturally clean but higher scope / more files

**Recommendation: Option A** — directly add the missing methods to RealtimeServer/RealtimeClient. This is surgical, low-risk, and doesn't require changing GameServer/GameClient or multiplayer-game.tsx at all.

### Where thin adapters could help:
Not needed. The cleanest fix is to make RealtimeServer/RealtimeClient API-compatible with GameServer/GameClient. The screens already use `any` typing, so duck-typing works.

### Where type/interface contracts should be introduced:
After the methods exist, add a shared interface type and remove `any` from the store. This is a **follow-up step**, not a blocker.

---

## F. Recommended Repair Steps

### Step 1: Add game state + logic to RealtimeServer
- **What:** Add `boards`, `playerHands`, `clients` Map, `gameConfig` storage. Add methods: `updateCallbacks`, `startGame`, `getDealtCards`, `getBoards`, `getClients`, `setHostReady`, `runRevealSequence`, `sendBoardReveal`, `sendHandComplete`, `requestNextHand`. Reuse `dealNewHand`, `evaluateAllBoards`, `calculateChipDeltas` from gameLogic.ts.
- **Why first:** This is where 11 of 15 crash points originate. Host-side fix unblocks the entire flow.
- **Impact:** Host can start game, evaluate hands, manage reveal sequence over Supabase.
- **Risk:** Low — additive only, no changes to existing files.

### Step 2: Add game methods to RealtimeClient
- **What:** Add `updateCallbacks`, `sendReady`, `sendNextHandRequest`. Wire incoming broadcast messages to callbacks matching GameClient's callback interface.
- **Why second:** Depends on Step 1 (server must send correctly formatted messages for client to receive).
- **Impact:** Guest can send ready, receive reveals, request next hand.
- **Risk:** Low — additive only.

### Step 3: Fix internet-host.tsx lobby to use server.startGame()
- **What:** Replace direct `dealCardsMultiplayer()` call with `server.startGame(config)`. Remove manual `sendToPlayer` card distribution. Let the server handle dealing and distribution (same as GameServer does).
- **Why third:** With Steps 1-2 done, the server has the `startGame` method. The lobby should use it instead of bypassing.
- **Impact:** Eliminates board data shape mismatch, message casing mismatch, and the deal-distribution split.
- **Risk:** Medium — changes lobby flow, but simplifies it.

### Step 4: Fix internet-join.tsx to use client callbacks
- **What:** Replace `client.onMessage('cards_dealt', ...)` with `client.updateCallbacks({onCardsDealt: ...})`. The client should receive CARDS_DEALT through the standard callback, not raw message listener.
- **Why fourth:** Depends on Steps 1-3 (server now sends CARDS_DEALT through proper channel).
- **Impact:** Guest lobby uses the same flow as WiFi lobby.
- **Risk:** Low.

### Step 5: Add message routing in RealtimeServer/RealtimeClient
- **What:** In RealtimeServer, when a guest sends `PLAYER_READY`, parse it and update client state (same as GameServer's handleMessage). In RealtimeClient, when server sends `CARDS_DEALT`, `BOARD_REVEAL`, `HAND_COMPLETE`, `ALL_READY`, route them to the appropriate callbacks.
- **Why fifth:** This is the glue that makes the Supabase messages act like the TCP message handler.
- **Impact:** Full message routing works end-to-end.
- **Risk:** Medium — must match message shapes exactly.

### Step 6 (follow-up): Type the store and add shared interface
- **What:** Define `IGameServer` and `IGameClient` interfaces. Type `mpServer: IGameServer | null` and `mpClient: IGameClient | null` in the store. Both GameServer and RealtimeServer implement `IGameServer`.
- **Why last:** Polish step. Makes future mismatches compile-time errors instead of runtime crashes.
- **Impact:** Prevents this class of bug from recurring.
- **Risk:** Low.

---

## G. Implementation Readiness Verdict

**The CAPS internet multiplayer needs one focused implementation pass (Steps 1-5) before it can work.** There is no ambiguity about what to build — the target API is fully defined by GameServer/GameClient. The repair is mechanical: copy the method signatures and game logic patterns from GameServer into RealtimeServer, using Supabase broadcast instead of TCP sockets.

**No separate contract/alignment pass is needed first.** The contract already exists implicitly in GameServer's public API. Steps 1-5 can proceed directly as implementation.

**Estimated scope:** ~200-300 lines added to realtimeMultiplayer.ts, ~20-30 lines changed in each lobby screen. Zero changes to multiplayer-game.tsx or results.tsx (the callers).

---

## H. Save Summary

| File | Location |
|------|----------|
| Full audit | `audits/audit-caps-03-internet-multiplayer-2026-03-13.md` |
| Checkpoint | `checkpoints/vamos-caps-03-multiplayer-audit.md` |
| Memory update | `project_caps_state.md` updated with VAMOS CAPS 03 |
