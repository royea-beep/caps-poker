# Audit — VAMOS CAPS ECONOMY 05: Multiplayer Match Cost Wiring
**Date:** 2026-03-13

## Scope
Wire multiplayer match cost through economy utilities behind `matchCostEnabled` flag. Host affordability gate on game start. Track spending for both host and guest. No behavior change when flag is off.

## Files Changed

| File | Action |
|------|--------|
| `app/lobby/internet-host.tsx` | Import economy utils, affordability gate in `handleStart` (flag-gated) |
| `app/lobby/host.tsx` | Import economy utils, affordability gate in `handleStartGame` (flag-gated) |
| `app/multiplayer-game.tsx` | Import economy utils, `trackChipsSpent` for host + guest hand-complete paths (flag-gated) |

## Key Architecture Decision: No Separate Buy-In Deduction

Multiplayer chip flow is already zero-sum via `chipDeltas[]` in `gameLogic.ts`:
- Line 376-378: `chipDeltas[p] -= totalPaid` (buy-in deducted per player)
- Line 383: winner gets entire board pot
- `addChips(myDelta)` in multiplayer-game.tsx applies the net result

Unlike single-player (where buy-in is deducted on mount, winnings added on results), multiplayer applies a single net delta. **No additional deduction needed** — the buy-in is already embedded in the delta.

## What Each Change Does

### internet-host.tsx
- When `matchCostEnabled`: computes `getMatchCost(potPerBoard, boardCount)` before `server.startGame()`
- If host can't afford: shows Alert, blocks game start
- When flag off: no change

### host.tsx (WiFi)
- Same pattern: affordability check before `serverRef.current.startGame(config)`
- When flag off: no change

### multiplayer-game.tsx
- Added `trackChipsSpent` store selector
- Host path (`buildRevealDataAndNavigate`): after `addChips(myDelta)`, tracks `getMatchCost()` as spent (flag-gated)
- Guest path (`buildGuestRevealDataAndNavigate`): same pattern
- Updated dependency arrays for both callbacks

## Behavior Matrix

| matchCostEnabled | Host Lobby | Game Chip Delta | Stats |
|-----------------|------------|-----------------|-------|
| `false` (current) | No gate | Net delta applied (unchanged) | No tracking |
| `true` (future) | Alert if can't afford | Net delta applied (unchanged) | Tracks totalChipsSpent |

## Why Guest Affordability Is Not Gated

Guests don't control game start — the host does. If the host can afford to start, all players participate. Guest affordability gating would require server-side balance awareness, which is out of scope. The host-only gate is sufficient for the current local-wallet model.

## Zero-Risk Verification
- `ECONOMY_FLAGS.matchCostEnabled` is `false` — all new code paths are unreachable
- Chip delta math in gameLogic.ts is untouched
- Existing `addChips(myDelta)` calls are unchanged
- TypeScript compiles cleanly (0 errors)
- No server-side changes (realtimeMultiplayer.ts untouched)
