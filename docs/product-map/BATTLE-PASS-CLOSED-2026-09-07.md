# The battle pass is closed — redirect, not delete

**Date** 2026-09-07 · Route `app/battle-pass.tsx` · Screen kept at `components/BattlePassScreen.tsx`

---

## What changed, and what it is proven by

`/battle-pass` now redirects to Home. Proven by visiting the URL in a rebuilt web bundle rather
than by reading the source:

```
FINAL URL : http://localhost:8957/
ON SCREEN : 👤 Player 1 💰 2,000 chips … CAPS POKER … 🎮 Play Online …
COUNTDOWN VISIBLE: false
```

No season, no tier track, no premium button.

## The numbers that decided it, each measured today

| | |
|---|---|
| The premium button asks | **5,000 chips** |
| Richest balance in the entire database | **3,250 chips** |
| Devices that could pay it | **0 of 393** |
| Reward ids that resolve to anything | **0 of 60** |
| Battle-pass events ever recorded | **0** |
| What `claimFreeReward` / `claimPremiumReward` credit | **nothing** — a tier number into local storage |
| What `upgradeToPremium` charges | **nothing** |

The offer was unacceptable as well as unbacked: even a player who wanted the premium track could
not have bought it.

⚠️ **And it got worse on its own.** The countdown was running — "55d 23h remaining" — in a game
with no seasons and no rollover. Left alone, the first tester to type the URL would have met an
expired season.

## What was kept

| Kept | Where |
|---|---|
| The screen, intact | `components/BattlePassScreen.tsx` (700 lines, moved out of the router directory) |
| The store | `stores/battlePassStore.ts` |
| The config, all 60 rewards | `constants/battlePassConfig.ts` |
| The season and tier maths | `utils/battlePass.ts` |

The move is import-safe by construction: every import in the screen is `../x`, and `components/`
sits at the same depth as `app/`, so not one path changed. Typecheck clean.

⚠️ **Reopening is one line** — return `<BattlePassScreen />` instead of the redirect.

## The reopen note, and why there is one

A closed door with no note becomes a mystery somebody reopens blind. `app/battle-pass.tsx` records
what has to be true first:

1. **Real players.** 25 devices have ever played a hand; no room has ever reached `playing`.
2. **A calibrated economy.** A premium tier priced above every balance in the database is a wall,
   not a price.
3. **Rewards that resolve.** All 60 ids must map to something grantable, and claiming must credit
   through `chip_transactions` like every other economy write.
4. **A season that rolls over.** A countdown needs something on the other side of zero.

## ⚠️ XP was not touched, and that distinction is the whole point

XP is the half that works. `results.tsx` calls `addXP()` after every hand, tiers advance, and the
XP bar on the **results screen** renders it. Only the rewards were hollow. Nothing a player has
earned is lost.

**One honest caveat about "displays wherever it already does".** Home imports `XPBar` and computes
`bpCurrentTier`, `bpProgress`, `bpXpInTier` and `bpXpNeeded` at `app/(tabs)/index.tsx:629-638` —
and **renders none of them**. That is pre-existing dead code, not something this change broke, and
it is left alone because the brief's line is not to touch XP. So the accurate statement is: XP
accrues everywhere it did, and displays on the results screen, which is the only place it ever
displayed outside the battle-pass screen itself.

## The season clock has exactly one reader

`getSeasonTimeRemaining()` is called from **one** place: the screen that is now behind the
redirect. Nothing else — no home widget, no notification, no computed tier — reads the season
date, so nothing anywhere can show an expired season. `tests/battle-pass-closed.test.ts` walks
`app/`, `components/`, `utils/`, `stores/` and `constants/` and fails if a second consumer ever
appears.

## §4 — Is anything else reachable-but-hollow?

Walked all 33 routes, focusing on every screen that makes a **quantified promise**.

| Screen | Promise | Verdict |
|---|---|---|
| `/battle-pass` | 60 rewards, a 5,000-chip premium tier | **Was hollow. Now closed.** |
| `/referral` | "You get 300, they get 100" | ⚠️ **Real, but never exercised** — see below |
| `/shop`, `/chip-store` | — | **Honest.** It says "Shop is empty right now." Payments are off and the screen admits it. |
| `/gameover` | A free refill | **Real.** `emergency_chips_enabled`, 200 a day. Paid 0 times only because nobody has hit zero. |
| `/achievements` | Chip rewards | **Real where earned.** 160 unlocked; 3 have credited 200 chips each through the ledger. |
| `/leaderboard`, `/stats`, `/rank`, `/coaching`, `/cups` | — | **Honest empty states** gated on play: "No players yet", "No stats yet", "No rank yet", "No coaching yet", "0/0 cups". |
| `/lobby`, `/lobby/table` | Tables against real people | **Honest.** The seated table says "Online multiplayer is unavailable right now." |

⚠️ **A correction I owe on the referral screen.** I first read `redeem_referral` as crediting
nothing, because its own body never mentions `chip_transactions` or `leaderboard`. That was wrong:
it **delegates** to `record_reward(...300, 'referral_joined')`, and `record_reward` does write the
ledger and move the balance. Reading the function body rather than pattern-matching it is what
caught that, and it is the difference between a real finding and a false accusation.

The true state of referral is **untested, not hollow**: 1,884 links minted, **0 clicks, 0
conversions**, and the only two rows in `referral_redemptions` are `NEG-REFERRER-A` and
`NEG-REFERRER-C` — negative-test probes from an earlier security sprint, since purged. No real
player has ever redeemed one, so the 300/100 path has never run in anger. Worth exercising during
the tester round; not worth closing.

**Nothing else is reachable-but-hollow.** The battle pass was the only screen advertising a
quantity the product could not deliver.
