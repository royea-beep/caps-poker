# Audit — VAMOS CAPS ECONOMY 02: Economy Config + Store Fields
**Date:** 2026-03-13

## Scope
Zero-risk scaffolding: create centralized economy config with feature flags and tuning values, extend gameStore with economy-related persisted fields.

## Files Changed

| File | Action |
|------|--------|
| `constants/economyConfig.ts` | **Created** — ECONOMY_FLAGS (5 booleans, all false) + ECONOMY_VALUES (5 tuning constants) |
| `store/gameStore.ts` | **Modified** — added 5 economy fields to interface, defaults, and partialize |

## New Flags (all `false`)

| Flag | Purpose |
|------|---------|
| `matchCostEnabled` | Deduct buy-in before dealing |
| `dailyRewardEnabled` | Show daily reward on home screen |
| `freeRefillEnabled` | Show free refill when bankrupt |
| `walletSyncEnabled` | Sync wallet to Supabase |
| `adRewardEnabled` | Show ad-for-chips button |

## New Values

| Value | Default | Purpose |
|-------|---------|---------|
| `dailyRewardBase` | 200 | Base daily chips |
| `dailyRewardStreakBonus` | 50 | Extra per streak day |
| `dailyRewardStreakCap` | 7 | Max streak multiplier |
| `freeRefillAmount` | 500 | Chips on free refill |
| `freeRefillCooldownMs` | 0 | Cooldown (0 = unlimited) |

## New Store Fields (all persisted)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `lastDailyRewardClaim` | `string \| null` | `null` | ISO date of last claim |
| `dailyRewardStreak` | `number` | `0` | Consecutive claim days |
| `lastFreeRefill` | `string \| null` | `null` | ISO date of last refill |
| `totalChipsEarned` | `number` | `0` | Lifetime earned stat |
| `totalChipsSpent` | `number` | `0` | Lifetime spent stat |

## Zero-Risk Verification
- All flags are `false` — no feature is enabled
- New store fields default to `null`/`0` — safe for existing saved state (Zustand merge handles missing keys)
- No imports of economyConfig.ts anywhere yet — dead code until wired
- No UI changes, no behavior changes
- TypeScript compiles cleanly (`npx tsc --noEmit` = 0 errors)
- Fully reversible: delete the file + revert store edits
