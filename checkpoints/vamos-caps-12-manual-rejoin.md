# Checkpoint — VAMOS CAPS 12: Manual Rejoin with Server Catch-Up
**Date:** 2026-03-13

## Summary
Server tracks game phase. When a known guest reconnects via presence, server sends GAME_STATE_SNAPSHOT with current hand state. Guest lobby routes snapshot to game screen. Game screen accepts rejoinPhase param to skip to waiting if already ready. Disconnect alerts offer "Rejoin" option with pre-filled room code. Stale snapshots rejected via handId guard.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | GamePhase type, GameStateSnapshot interface (exported), server phase tracking + transitions, sendGameStateSnapshot() method, reconnect detection in syncClientsFromPresence, client GAME_STATE_SNAPSHOT handler with stale guard |
| `app/lobby/internet-join.tsx` | prefillCode route param, onGameStateSnapshot callback for mid-game rejoin |
| `app/multiplayer-game.tsx` | rejoinPhase route param, initial phase from param, "Rejoin" option in disconnect/timeout alerts |
| `app/results.tsx` | storeRoomCode, "Rejoin" option in onDisconnected alert |

## Status
Manual rejoin implemented. Guest can re-enter room code (pre-filled) and resume in correct game phase.
