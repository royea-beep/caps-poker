# Checkpoint — VAMOS CAPS ECONOMY 06: Daily Reward + Free Refill UI
**Date:** 2026-03-13

## Summary
Wired daily reward and free refill UI on home screen behind flags. Added 3 economy state setters to store. Daily reward: claim check, streak calc, chip grant, Alert feedback. Free refill: cooldown check, chip grant, Alert feedback. When freeRefillEnabled is off, "Reset Chips" remains. When dailyRewardEnabled is off, no reward button rendered. Flags off = zero behavior change.

## Files Changed
| File | Action |
|------|--------|
| `store/gameStore.ts` | Added setLastDailyRewardClaim, setDailyRewardStreak, setLastFreeRefill |
| `app/index.tsx` | Economy selectors, handlers, conditional UI |

## Status
Economy UI wiring complete. All flags off = identical launch behavior. Ready for ECONOMY 07+ (enable flags and tune).
