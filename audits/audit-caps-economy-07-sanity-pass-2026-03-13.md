# Audit — VAMOS CAPS ECONOMY 07: Sanity Pass + Flag Matrix Review
**Date:** 2026-03-13

## Scope
Consistency audit of the complete economy scaffolding (ECONOMY 02–06). Verify flag matrix, state tracking, flow consistency, hidden problems.

## Cleanup Applied
- Removed unused `ECONOMY_FLAGS` import from `results.tsx` (dead import from ECONOMY 04)

## Flag Matrix

### All flags OFF (current launch default)

| Area | Behavior | Verified? |
|------|----------|-----------|
| Home screen | Identical to pre-economy: no reward button, "Reset Chips" visible | Yes |
| Single-player start | No affordability gate, buy-in deducted as before | Yes |
| Multiplayer start | No affordability gate, chipDeltas applied as before | Yes |
| Results / next hand | `canAffordMatch()` used — mathematically identical to old inline check | Yes |
| Game over | `setChips(startingChips)` — unchanged | Yes |
| Stats tracking | `totalChipsSpent` / `totalChipsEarned` both stay at 0 | Yes |

### matchCostEnabled = true (others off)

| Area | Behavior | Issue? |
|------|----------|--------|
| Home screen | "NEW HAND" checks affordability, shows Alert if insufficient | None |
| SP game start | Buy-in deducted (same as before) + `trackChipsSpent(buyIn)` called | None |
| MP host lobby | Affordability gate before `startGame()` | None |
| MP game complete | `trackChipsSpent()` called for host + guest | None |
| Game winnings | `addChips(playerChipsWon)` runs but `trackChipsEarned` NOT called | Gap (see findings) |
| "Reset Chips" | Still visible (freeRefillEnabled is off) — resets balance, no tracking | Gap (see findings) |
| Game over "Play Again" | Resets to `startingChips`, no tracking | Gap (see findings) |

### dailyRewardEnabled = true (others off)

| Area | Behavior | Issue? |
|------|----------|--------|
| Home screen | "CLAIM DAILY REWARD" button appears above menu | None |
| Claim flow | Streak calc → reward calc → addChips + trackChipsEarned + update timestamps | None |
| Already claimed | Button shows "REWARD CLAIMED" (ghost, disabled) | None |
| "Reset Chips" | Still visible (freeRefillEnabled is off) | None |
| No match cost | Game plays exactly as before (free) | None |

### freeRefillEnabled = true (others off)

| Area | Behavior | Issue? |
|------|----------|--------|
| Home screen | "Reset Chips" replaced by "FREE REFILL" / "REFILL USED" | None |
| Refill flow | `addChips(500)` + `trackChipsEarned(500)` + timestamp | None |
| Cooldown 0 | Always available (current config) — effectively unlimited refills | None |
| No match cost | Game plays exactly as before (free) | None |

### matchCostEnabled + dailyRewardEnabled (likely first real combo)

| Area | Behavior | Issue? |
|------|----------|--------|
| Can't afford match | Alert blocks game start, daily reward button available | None |
| Claim reward → play | Balance increases → affordability check passes | None |
| Stats | Spent tracked on match, earned tracked on reward. Game winnings untracked. | Gap |

### All flags ON

| Area | Behavior | Issue? |
|------|----------|--------|
| Home screen | Daily reward + main buttons + free refill (replaces Reset Chips) | None |
| Game flow | Buy-in gated + tracked, rewards tracked | None |
| Game over | "Play Again" resets to startingChips — bypasses economy | Gap |

## Findings

### Finding 1: `trackChipsEarned` not called for game winnings (LOW priority)
- `game.tsx:179` calls `addChips(results.playerChipsWon)` but never `trackChipsEarned`
- `multiplayer-game.tsx:312,394` call `addChips(myDelta)` but never `trackChipsEarned`
- **Impact:** `totalChipsEarned` only reflects rewards/refills, not game winnings
- **Severity:** LOW — this is a stats gap, not a gameplay bug. Could be intentional (track only "granted" chips vs "won" chips)
- **Recommendation:** Decide whether `totalChipsEarned` should include game winnings. If yes, wire it. If no, rename to `totalChipsGranted` for clarity.

### Finding 2: Game over "Play Again" bypasses economy (LOW priority)
- `gameover.tsx:56` calls `setChips(config.startingChips)` — a full balance reset
- Not tracked as earned, not gated by any flag
- **Impact:** When matchCostEnabled is on, this is a free "bailout" that bypasses economy tracking
- **Severity:** LOW — only reachable when player has 0 chips, and the game is supposed to remain free-friendly
- **Recommendation:** When flags are enabled, consider replacing with a refill flow. For now, leave as-is (supports free launch).

### Finding 3: Dead import removed (FIXED)
- `results.tsx` imported `ECONOMY_FLAGS` but never used it
- **Fixed:** Removed in this audit step

### Finding 4: No double-counting detected
- SP: buy-in deducted once (game.tsx mount), winnings added once (game.tsx navigate)
- MP: net delta applied once (multiplayer-game.tsx hand-complete), no separate deduction
- `trackChipsSpent` called exactly once per game in each flow
- `trackChipsEarned` called exactly once per reward claim

### Finding 5: No dead buttons or unreachable paths
- All conditional renders properly short-circuit when flags are false
- Button disabled states correctly tied to eligibility checks
- Alert text is neutral (no final currency naming)

### Finding 6: "Free launch" remains safe
- All flags default to false
- "Reset Chips" always available unless freeRefillEnabled replaces it
- Even with freeRefillEnabled, refill is unlimited (cooldown=0)
- Game over "Play Again" always works
- No accidental paywall or restrictive behavior possible

## State Consistency Summary

| Field | Mutated By | Consistent? |
|-------|-----------|-------------|
| `chips` | `addChips`, `setChips` | Yes — universal balance |
| `totalChipsSpent` | `trackChipsSpent` (flag-gated, 3 call sites) | Yes |
| `totalChipsEarned` | `trackChipsEarned` (2 call sites: reward + refill) | Yes (but incomplete — no game winnings) |
| `lastDailyRewardClaim` | `setLastDailyRewardClaim` (1 call site) | Yes |
| `dailyRewardStreak` | `setDailyRewardStreak` (1 call site) | Yes |
| `lastFreeRefill` | `setLastFreeRefill` (1 call site) | Yes |

All 5 economy fields properly persisted in `partialize`.
