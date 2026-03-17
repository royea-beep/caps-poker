# Audit — VAMOS CAPS 12: Manual Rejoin with Server Catch-Up
**Date:** 2026-03-13

## Scope
Implement the safe limited reconnection model from CAPS 11: manual rejoin with server-side game state snapshot.

## Changes Made

### utils/realtimeMultiplayer.ts

**New types (exported):**
- `GamePhase = 'lobby' | 'arranging' | 'waiting' | 'complete'`
- `GameStateSnapshot` — all data needed to restore a reconnecting guest

**Server: game phase tracking:**
- `private gamePhase: GamePhase = 'lobby'`
- Transitions: `startGame()` → `'arranging'`, `checkAllReady()` → `'waiting'`, `sendHandComplete()` → `'complete'`, `stop()` → `'lobby'`
- Exposed via `getGamePhase()` public method

**Server: `sendGameStateSnapshot(playerId)`:**
- Builds snapshot from current server state: boards, playerHands[seatIndex], handId, gameConfig, phase, alreadyReady
- Sends via `sendToPlayer()` — targeted, not broadcast
- Logs: phase, handId, seat, alreadyReady

**Server: reconnect detection in `syncClientsFromPresence()`:**
- Tracks `reconnectedIds[]` — players transitioning from `connected: false` → `true`
- After presence sync: sends `GAME_STATE_SNAPSHOT` to each reconnected guest (if `gamePhase !== 'lobby'`)

**Client: `onGameStateSnapshot` callback:**
- Added to `RealtimeClientCallbacks`
- Handler in `handleIncomingMessage()`: stale-handId guard (rejects if `handId < lastProcessedHandId`), updates dedup tracking, logs, routes to callback

### app/lobby/internet-join.tsx

**Prefill room code on rejoin:**
- Accepts `prefillCode` route param via `useLocalSearchParams`
- Initializes `code` state with `prefillCode || ''`

**Mid-game rejoin via snapshot:**
- `onGameStateSnapshot` callback registered before `connect()`
- If phase is `arranging` or `waiting`: navigates to `/multiplayer-game` with snapshot data
- Passes `rejoinPhase` param — `'waiting'` if alreadyReady, else snapshot phase
- If phase is `complete`: stays in lobby, waits for next `CARDS_DEALT`

### app/multiplayer-game.tsx

**Accept `rejoinPhase` param:**
- If `rejoinPhase === 'waiting'`: starts in waiting phase (skips arranging)
- Player was auto-readied on disconnect (CAPS 10), so this is safe

**Rejoin option in disconnect alerts (guest only):**
- "Connection Lost" alert: now offers "Leave" + "Rejoin"
- "Rejoin" navigates to `internet-join` with `prefillCode`
- "Host Disconnected": no rejoin (host is gone)
- Waiting timeout: adds "Rejoin" option for guest

**Room code from store:**
- Reads `storeRoomCode` for prefill

### app/results.tsx

**Rejoin option in disconnect alert (guest):**
- `onDisconnected` alert: "Leave" + "Rejoin"
- "Rejoin" navigates to `internet-join` with `prefillCode`
- `onHostLost`: no rejoin (host is gone)

## Phase Handling Rules

| Phase | Snapshot sent? | Guest rejoins to |
|-------|---------------|-----------------|
| `lobby` | No | Normal lobby flow (presence sync handles it) |
| `arranging` | Yes | `/multiplayer-game` with fresh cards + full timer |
| `waiting` (already ready) | Yes, `alreadyReady: true` | `/multiplayer-game` in waiting phase (skips arranging) |
| `waiting` (not ready, edge case) | Yes, `alreadyReady: false` | `/multiplayer-game` in arranging phase |
| `complete` | No snapshot useful | Stays in lobby, waits for next `CARDS_DEALT` |

## Stale Message Safety

- `GAME_STATE_SNAPSHOT` handler checks `handId < lastProcessedHandId` — rejects stale snapshots
- On valid snapshot: sets `lastProcessedHandId = snapshot.handId` — prevents CARDS_DEALT retry from double-processing
- Existing CARDS_DEALT dedup (CAPS 06) still active — if both snapshot and retry arrive, first one wins

## Risk Assessment
- **WiFi path:** Zero impact
- **Single player:** Zero impact — all code gated by multiplayer state
- **Existing game flow:** Preserved — snapshot only fires for reconnected players
- **Reveal phase:** NOT supported for rejoin — guest waits for next hand (safe)
- **Host reconnection:** NOT supported — host IS the server (architectural constraint)
