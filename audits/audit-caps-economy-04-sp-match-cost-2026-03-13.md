# Audit — VAMOS CAPS ECONOMY 04: Single-Player Match Cost Wiring
**Date:** 2026-03-13

## Scope
Wire single-player game start flow to economy utilities behind `matchCostEnabled` flag. Track lifetime spending stats. No behavior change when flag is off.

## Files Changed

| File | Action |
|------|--------|
| `store/gameStore.ts` | Added `trackChipsSpent` and `trackChipsEarned` actions to interface + implementation |
| `app/game.tsx` | Import economy utils, use `getMatchCost()` for buy-in calc, track spending when flag enabled |
| `app/index.tsx` | Import economy utils, add affordability gate on "NEW HAND" button (only when flag enabled) |
| `app/results.tsx` | Import economy utils, use `getMatchCost()` + `canAffordMatch()` for next-hand affordability check |

## What Each Change Does

### store/gameStore.ts
- `trackChipsSpent(amount)`: increments `totalChipsSpent` (clamped ≥ 0)
- `trackChipsEarned(amount)`: increments `totalChipsEarned` (clamped ≥ 0)
- Neither action is called unless economy flag is enabled

### app/game.tsx
- Buy-in deduction now uses `getMatchCost()` instead of inline `config.potPerBoard * boardCount`
- When `matchCostEnabled`: also calls `trackChipsSpent(buyIn)`
- When flag is off: identical behavior to before (deduct only, no stat tracking)

### app/index.tsx
- "NEW HAND" button now calls `handleNewHand` instead of direct `router.push`
- When `matchCostEnabled`: checks `canAffordMatch()` first, shows Alert if insufficient
- When flag is off: navigates directly (identical to before)

### app/results.tsx
- Single-player next-hand check now uses `getMatchCost()` + `canAffordMatch()` instead of inline comparison
- Behavior is identical — just using the utility function now

## Behavior Matrix

| matchCostEnabled | Home Screen | Game Start | Next Hand | Stats |
|-----------------|-------------|------------|-----------|-------|
| `false` (current) | No gate | Deducts buy-in (unchanged) | Checks affordability (unchanged logic, new function) | No tracking |
| `true` (future) | Alert if can't afford | Deducts buy-in + tracks spend | Same | Tracks totalChipsSpent |

## Zero-Risk Verification
- `ECONOMY_FLAGS.matchCostEnabled` is `false` — all new code paths are unreachable
- results.tsx change: replaced `chips >= config.potPerBoard * boardCount` with `canAffordMatch(chips, getMatchCost(...))` — mathematically identical
- game.tsx: buy-in deduction line unchanged in behavior (same formula via utility)
- TypeScript compiles cleanly (0 errors)
- Multiplayer paths untouched
