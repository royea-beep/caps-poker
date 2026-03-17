# Checkpoint — VAMOS CAPS 05: Internet Multiplayer E2E Test Plan + Hardening Audit
**Date:** 2026-03-13

## Summary
Comprehensive end-to-end test plan and hardening audit for the internet multiplayer path repaired in CAPS 04. Identified 12 hardening gaps, 7 highest-risk runtime failure points, and recommended 10-step implementation order.

## Key Findings
- **CRITICAL:** `client.connect()` always returns true — no room validation
- **CRITICAL:** CARDS_DEALT is fire-and-forget — dropped message = permanent guest stuck state
- **HIGH:** BOARD_REVEAL / HAND_COMPLETE delivery ordering — tight sync loop with no sequencing
- **HIGH:** Host receives own broadcasts (safe by coincidence, not by design)
- **HIGH:** Seat assignment diverges between server (getNextSeat) and lobby (array index)

## Best Next Step
ACK + retry for CARDS_DEALT — highest-impact single fix, establishes reusable pattern.

## Files Audited
| File | Status |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Full analysis — 7 issues found |
| `app/lobby/internet-host.tsx` | Full analysis — seat sync issue |
| `app/lobby/internet-join.tsx` | Full analysis — race condition, connect validation |
| `app/multiplayer-game.tsx` | Full analysis — no timeout on waiting states |
| `app/results.tsx` | Full analysis — stale seat lookup, no leave notification |
| `constants/networkConfig.ts` | Reference — payload types verified |

## Status
Audit complete. No code changes made. Ready for CAPS 06 implementation.
