# Audit — VAMOS CAPS 04: Internet Multiplayer Repair
**Date:** 2026-03-13

## Scope
Implemented the 5-step repair plan from VAMOS CAPS 03 to make internet multiplayer functional.

## Changes Made

### 1. utils/realtimeMultiplayer.ts — FULL REWRITE
**RealtimeServer** — added game state + 9 missing methods:
- Internal state: `clients` Map, `boards`, `playerHands`, `gameConfig`, `nextHandRequests`, `callbacks`
- `updateCallbacks(partial)` — merge partial callbacks
- `startGame(config)` — deal cards via gameLogic, store state, broadcast CARDS_DEALT to each guest
- `getDealtCards()` — return {boards, playerHands}
- `getBoards()` — return boards array
- `getClients()` — return clients sorted by seat (same shape as GameServer)
- `setHostReady(assignments)` — mark host ready, check all-ready
- `runRevealSequence(config)` — collect assignments, evaluate via evaluateAllBoards + calculateChipDeltas
- `sendBoardReveal(...)` — typed broadcast
- `sendHandComplete(...)` — typed broadcast
- `requestNextHand(config)` — host next-hand orchestration
- Added `syncClientsFromPresence()` — maps Supabase presence into ConnectedClient-style objects with seats
- Added incoming message handler for PLAYER_READY and NEXT_HAND_REQUEST from guests
- Added `checkAllReady()` and `checkNextHandReady()` logic (mirrors GameServer)

**RealtimeClient** — added callback system + 3 missing methods:
- `updateCallbacks(partial)` — merge partial callbacks
- `sendReady(boardAssignments)` — send PLAYER_READY message
- `sendNextHandRequest()` — send NEXT_HAND_REQUEST message
- Added incoming message router: CARDS_DEALT → onCardsDealt, ALL_READY → onAllReady, BOARD_REVEAL → onBoardReveal, HAND_COMPLETE → onHandComplete

**Exported types:** `RealtimeConnectedClient`, `RealtimeServerCallbacks`, `RealtimeClientCallbacks`

### 2. app/lobby/internet-host.tsx
- Removed direct `dealCardsMultiplayer()` call and manual card distribution
- Now uses `server.startGame(config)` + `server.getDealtCards()` for server-driven flow
- Added `setConnectedPlayers` store sync from presence data
- Removed unused `getBoardCount` and `dealCardsMultiplayer` imports

### 3. app/lobby/internet-join.tsx
- Replaced raw `client.onMessage('cards_dealt', ...)` with `client.updateCallbacks({onCardsDealt: ...})`
- Guest now receives CARDS_DEALT through standard callback routing (uppercase, proper payload shape)
- Server includes `playerIndex` in targeted CARDS_DEALT so guest knows their seat
- Added `setConnectedPlayers` store sync from presence data

### 4. Game screens — ZERO CHANGES
- multiplayer-game.tsx: unchanged
- results.tsx: unchanged

## Verification
All 16 method calls from multiplayer-game.tsx and results.tsx now have matching implementations:
- 11 RealtimeServer methods: all present
- 5 RealtimeClient methods: all present (including getPlayerId which already existed)

## Message Flow (end-to-end)
```
Host lobby → server.startGame(config) → deals cards → broadcasts CARDS_DEALT to guests
Guest lobby → receives CARDS_DEALT via onCardsDealt callback → navigates to game
Game screen → host/guest arrange cards → setHostReady / sendReady
Server → checkAllReady → broadcasts ALL_READY → callbacks.onAllPlayersReady
Host → runRevealSequence → sendBoardReveal → sendHandComplete
Guest → receives via onBoardReveal / onHandComplete callbacks
Results → requestNextHand / sendNextHandRequest → server deals new hand → onNewHandDealt / onCardsDealt
```

## Risk Assessment
- **Native WiFi path:** Zero impact — GameServer/GameClient untouched
- **Internet path:** Should now function end-to-end for the first time
- **Store typing:** Still `any` — follow-up recommended but not blocking
