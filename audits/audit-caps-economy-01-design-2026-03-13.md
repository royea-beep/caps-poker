# Audit — VAMOS CAPS ECONOMY 01: Economy Infrastructure Design
**Date:** 2026-03-13

## Scope
Design-only audit. No code changes. Define economy model, feature flags, data model, implementation order.

## Current State Assessment

### Already Exists
- `chips` as persisted balance in Zustand store (gameStore.ts)
- `addChips(amount)` / `setChips(chips)` actions
- `potPerBoard` × `boardCount` = buy-in (computed in settings.tsx)
- `ChipsDisplay` component for rendering balances
- `startingChips` config (1000 default)
- Game Over screen triggers at 0 chips
- "Reset Chips" button on home screen
- AsyncStorage persistence via Zustand persist middleware
- `getDeviceId()` for persistent player identity
- Leaderboard sync to Supabase (pattern reusable for wallet)

### Missing
- Feature flags infrastructure
- Economy config constants file
- Daily reward system (no timestamp tracking)
- Match cost pre-deduction (chips only change on results)
- Free refill with cooldown
- Economy utility functions
- Lifetime stats (totalChipsEarned / totalChipsSpent)

## Design Decisions

### Single Currency: Chips
No second currency. Chips are earned, spent, displayed. Dual currency adds complexity with no benefit until real monetization.

### Economy Loop
```
Daily Login → Free Chips (200 base + streak bonus)
Play Hand → Buy-in deducted before cards dealt (when enabled)
Win → Chips added (existing behavior)
Lose → Buy-in was already taken
Bankrupt → Free Refill (500 chips, unlimited for now)
(Future) Ad → Bonus chips
(Future) IAP → Buy chip packs
```

### Feature Flags (all false at launch)
- `matchCostEnabled` — deduct buy-in before dealing
- `dailyRewardEnabled` — show claim button on home
- `freeRefillEnabled` — replace "Reset Chips" when bankrupt
- `walletSyncEnabled` — sync to Supabase (future)
- `adRewardEnabled` — ad-for-chips button (future)

### Economy Values
- `dailyRewardBase`: 200
- `dailyRewardStreakBonus`: 50/day (cap 7 = max 550/day)
- `freeRefillAmount`: 500
- `freeRefillCooldownMs`: 0 (unlimited)
- Match cost = existing `potPerBoard × boardCount`

### New Store Fields (persisted)
- `lastDailyRewardClaim: string | null`
- `dailyRewardStreak: number`
- `lastFreeRefill: string | null`
- `totalChipsEarned: number`
- `totalChipsSpent: number`

### New Files
- `constants/economyConfig.ts` — flags + values
- `utils/economy.ts` — pure functions (daily reward calc, refill, buy-in check)

## Implementation Roadmap

| Step | VAMOS | Scope | Risk |
|------|-------|-------|------|
| 1 | ECONOMY 02 | Config file + store fields | Zero |
| 2 | ECONOMY 03 | Pure utility functions | Zero |
| 3 | ECONOMY 04 | Single-player match cost (flagged off) | Low |
| 4 | ECONOMY 05 | Multiplayer match cost (flagged off) | Medium |
| 5 | ECONOMY 06 | Home screen daily reward + refill UI (flagged off) | Low |
| 6 | ECONOMY 07+ | Enable flags, tune values | Tuning |

## NOT Building
- IAP, ad SDK, shop screen, coin animations, second currency, subscriptions, anti-cheat, server-authoritative wallet, cross-device sync

## Risk Assessment
- **Existing gameplay:** Zero impact — all flags default to false
- **Persistence:** Zustand persist already handles chips; adding fields is additive
- **Multiplayer:** Match cost in multiplayer (ECONOMY 05) needs careful handling — server must deduct/refund
