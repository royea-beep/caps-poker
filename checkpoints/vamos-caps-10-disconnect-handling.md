# Checkpoint — VAMOS CAPS 10: Host-Alive Detection + Mid-Game Disconnect Handling
**Date:** 2026-03-13

## Summary
Host-alive detection via presence monitoring with 5s grace period. Guest disconnect auto-readies during active hand. Channel error monitoring. 60s waiting-state timeouts on game screen and results. Disconnect banners and alerts with safe navigation home. Lobby host-lost detection for guests.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Host-alive monitoring (checkHostAlive, grace timer), guest auto-ready on disconnect, channel error listeners, onHostLost/onDisconnected callbacks, WAITING_STATE_TIMEOUT_MS export |
| `app/multiplayer-game.tsx` | Disconnect banner UI, host-lost + channel error callbacks, 60s waiting-state timeout |
| `app/results.tsx` | Host-lost + channel error callbacks during next-hand wait, 60s timeout, disconnect message inline UI |
| `app/lobby/internet-join.tsx` | Host-lost + channel error callbacks in lobby, cleanup + error state |

## Status
All 6 disconnect scenarios handled. No silent dead-session states remain for detectable disconnects. Full reconnection not implemented — that requires a separate VAMOS.
