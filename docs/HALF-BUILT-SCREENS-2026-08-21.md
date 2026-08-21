# CAPS — the five "half-built" screens: three were my instrument (2026-08-21)

Five screens were filed as *looks finished, isn't*. Reading them before touching anything showed
**three of those findings were artifacts of my own enumerator.** The two that were real are fixed —
and one of the fixes surfaced a data bug much bigger than the label it started as.

---

## Corrections to handoff 88, with evidence

### 1. `friends` is real and correctly built

`createClub` / `joinClub` exist ([friends.tsx:69,88](app/(tabs)/friends.tsx:69)) and call **five
granted RPCs** (`create_club`, `join_club`, `my_clubs`, `club_leaderboard`, `record_club_game`) over
three tables that already hold **one real club**. The buttons are
`disabled={!newName.trim() || busy}` — **correctly disabled until you type**, which is exactly why my
probe saw "no effect".

My line — *"four controls, none of which work and none of which show an error"* — described **working
validation**.

### 2. `leaderboard`'s tabs are real and accessible

[leaderboard.tsx:152,155](app/leaderboard.tsx:152) — `TouchableOpacity` with
`accessibilityRole="tab"`, labels *"Sort by chips"* / *"Sort by win rate"*, `accessibilityState`,
44pt `minHeight` and hitSlop. **My enumerator's selector never included `role="tab"`**, so it
reported one control where there are three — the same mistake shape as the emoji reader that matched
card suits: I looked for a guessed subset instead of declared roles.

### 3. `battle-pass` is not a shell

Real `TIER_REWARDS`, `currentTier`, `claimFreeReward`/`claimPremiumReward`, XP progress. **The ten
tier buttons were never inert — they were mute.** Every branch of `handleTierPress` went through
`Alert.alert`, a no-op on web. **Third instance of this bug in three sprints** (Reset, the
delete-failure message, now here).

## Fixed

| screen | what | verified |
|---|---|---|
| **referral** | the `""` control was the redeem **TextInput** with no accessible name; labelled, and the two adjacent `Pressable`s given the `button` role they lacked | both engines: **3 → 4** controls, the `""` gone, every control named |
| **achievements** | tiles had no role and no label, so every locked one announced itself as its emoji + a padlock; they now name the achievement, state and progress from data already on the item. Category tabs given `role="tab"` + labels | tabs read *"Filter achievements by Skill"*; tiles read *"יד ראשונה, locked"* |
| **battle-pass** | `handleTierPress` and `handleUnlockPremium` branch to `window.alert`/`window.confirm` on web via **one hoisted pair of helpers** — the shape already applied twice, not a fourth invention. `TierCircle` given a label naming tier **and track** | both engines: *"Free tier 1, current"* / *"Premium tier 1, locked"* — the `1 1 2 2 3 3` duplication gone — and a tier tap now reports `DIALOG alert: Tier 1 — Reach tier 1 to unlock: 500 Chips` |
| **leaderboard** | **nothing in the app.** The instrument was fixed: the selector now includes `tab, link, menuitem, combobox, a, textarea, select` | **1 → 3** controls; *"Sort by win rate"* changes the list |

## The bug the accessibility label surfaced

My new achievements label came out reading **just "locked"** — `item.name` was undefined.

Measured on the live RPC: `get_achievements_list_d` returns **`title` / `earned` / `chips` / `xp`**,
while `AchievementItem` declares **`name` / `is_earned` / `chips_reward` / `xp_reward`**. **They have
never agreed.**

**Consequence:** `is_earned` was *always* `undefined`, so **every tile rendered locked even when
earned**, and the header counter — `earnedCount` filters on `is_earned` — **could only ever say
"0/36 unlocked"**. The achievements screen could not show progress at all.

**Fixed at the single fetch boundary** so all 13 read sites keep working unchanged, accepting both
key spellings so the user-scoped variant — which I did **not** re-verify — cannot break if it already
returns the declared shape.

## Also observed, not fixed

Achievement titles come back from the DB in **Hebrew** (*"יד ראשונה"*, *"10 ידות"*) while `CLAUDE.md`
records the UI language as English. A tester on an English UI sees Hebrew achievement names. Out of
scope here; recorded so it is not lost.

## A real player I nearly deleted

Cleanup by the standing window rule would have taken device `6956-24d1-5ee4`. Checked first: it has
**`card_placed` ×13 and `hand_dealt` ×4 spread over 18 minutes** on a Windows Chrome UA. My
enumerator never places cards, and my runs in that window were settings / leaderboard / referral /
battle-pass / achievements — none of which deal a hand. **That is a real person playing**, almost
certainly Roye. **Left alone.**

Correcting a number I have carried for several sprints: **real bindings are now three, not two.**

## Standing checks

**Dialog handler registered before operating: confirmed** — it is the only reason the battle-pass fix
is observable, and its absence caused two earlier false "dead control" findings.

**Still never operated — list confirmed accurate, nothing fell off:** `game`, `multiplayer-game`,
`lobby/table`, `gameover`, `rank`, `replay`, `heatmap`, `coaching`, `hand-history`, `theme-pick`.
The game screens need a live hand per control — their own sprint.

**Cleanup:** 22 chip_transactions, 11 leaderboard rows, 8 bindings, 24 rate counters, 11 streaks, 11
daily_rewards, 75 analytics events, plus the `probe-keys-only` row. `purchases` 0, 0 test devices,
the real player's binding untouched.

**Nothing else changed:** `delete_user_account` grant not restored · DEVELOPER and the 7-tap gate
untouched · no C5, stake tiers, stakes UI or tournaments · MP prompt untouched · first-hand player
count unchanged · none of the ten never-operated screens started · no keys.

*(handoff: `vamos_handoffs` id 90)*
