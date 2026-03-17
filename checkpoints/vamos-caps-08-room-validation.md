# Checkpoint — VAMOS CAPS 08: Room Validation + Connect Safety
**Date:** 2026-03-13

## Summary
Hardened the internet multiplayer entry path. Server and client now properly validate subscription success with timeouts. Client verifies host presence before reporting "connected". Callbacks registered before connect to eliminate race window. Failed connections are cleaned up. Room code format is validated.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Server: subscribe-with-timeout, cleanup on failure. Client: subscribe-with-timeout, host presence polling, cleanupChannel helper. Connection config constants. |
| `app/lobby/internet-join.tsx` | Moved updateCallbacks before connect, room code regex validation, client cleanup on failure, better error message |
| `app/lobby/internet-host.tsx` | Cancelled-guard on async, server cleanup on failure, catch for unhandled rejections, context-aware error message |

## Status
Entry path is now validated. connect() returns false for: no Supabase, subscribe timeout, subscribe error, no host in room.
