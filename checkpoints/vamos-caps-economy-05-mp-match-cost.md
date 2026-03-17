# Checkpoint — VAMOS CAPS ECONOMY 05: Multiplayer Match Cost Wiring
**Date:** 2026-03-13

## Summary
Wired multiplayer match cost through economy utilities behind matchCostEnabled flag. Host lobbies (internet + WiFi) gate affordability before game start. Both host and guest track totalChipsSpent on hand complete. No separate buy-in deduction needed — chipDeltas already zero-sum. Flag off = zero behavior change.

## Files Changed
| File | Action |
|------|--------|
| `app/lobby/internet-host.tsx` | Affordability gate in handleStart |
| `app/lobby/host.tsx` | Affordability gate in handleStartGame |
| `app/multiplayer-game.tsx` | trackChipsSpent for host + guest |

## Status
Multiplayer match cost plumbing complete. Flag off = identical behavior. Ready for ECONOMY 06 (daily reward + refill UI).
