# Checkpoint — VAMOS CAPS 09: Seat Assignment Hardening + Numeric Room Codes
**Date:** 2026-03-13

## Summary
Server is now single source of truth for seat assignments. Host lobby reads from `server.getClients()`, guest lobby receives `ROOM_STATE` broadcast with authoritative seat data. Room codes switched to 6-digit numeric with number-pad keyboard. Presence-array-index-as-seat bug eliminated.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Added `onRoomState` client callback, `broadcastRoomState()` on presence sync, `ROOM_STATE` client handler, `generateOnlineRoomCode()` → numeric-only |
| `app/lobby/internet-host.tsx` | Replaced presence-index seat mapping with `server.getClients()` authoritative seats |
| `app/lobby/internet-join.tsx` | Added `onRoomState` callback for Zustand seats, switched to number-pad input, numeric validation regex, stripped `toUpperCase`/`autoCapitalize` |

## Status
Seat assignment unified. Room codes numeric. Both lobbies write correct seats to Zustand store.
