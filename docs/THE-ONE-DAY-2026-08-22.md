# CAPS — the panel's one day, done (2026-08-22)

All three items shipped plus the two removals, verified on the live site, both engines.

---

## 1. The front door — exposed controls, before → after

Measured on the live bundle **before**, then again after the deploy landed. Identical on
webkit/430 and chromium/393 in both passes.

| surface | before | after |
|---|---|---|
| first-run overlay | 12 exposed / 16 unexposed | **26 exposed / 1 unexposed** |
| side menu | 12 exposed / 16 unexposed | **26 exposed / 1 unexposed** |
| `/theme-pick` | **0 exposed** / 2 unexposed | **2 exposed / 0 unexposed** |

**The number that matters is not 12 → 26. It is *which* twelve.** Before, every one of the twelve
"exposed" controls was **behind** the overlay — Open chip shop, Open menu, Play, the five tabs —
and the overlay's own SKIP and Continue exposed nothing. A screen-reader user was handed twelve
controls, all of them the wrong ones. After, the overlay's five (*Skip the tutorial*, *Step 1/2/3
of 3*, *Continue, step 1 of 3*) and the menu's nine are all named.

The single remaining unexposed node is an unlabelled decorative wrapper, not a control. The menu is
**9** entries now, not 10 — SPECTATOR is gone.

### Focus cannot reach behind the overlay — proven with the real Tab key, 16 presses

```
BEFORE  SKIP ✕ · DIV · DIV · DIV · Continue · DIV · 🎮PLAY ONLINE · ⚔️BATTLE PASS
        → focus walked out of the tutorial into the side menu behind it

AFTER   Skip the tutorial · Step 1 of 3 · Step 2 of 3 · Step 3 of 3 ·
        Continue, step 1 of 3 · Skip the tutorial · … for all 16 presses
        → it never leaves
```

`accessibilityViewIsModal` alone does **not** do this — it hides the background from a screen
reader but does not stop Tab. That is exactly why a web focus trap was needed on top of it.

> **Instrument correction, caught before publishing.** My first escape test used a substring regex
> containing `/TUTORIAL/i` — and the overlay's *new* label is *"Skip the tutorial"*. It reported an
> escape the 16-step walk plainly disproved. Anchored to exact control names. Fifth instrument
> false-positive in this project; third caught before filing.

## 2. Stop losing a played hand

**Fix:** [utils/handOutbox.ts](utils/handOutbox.ts). The hand is written to AsyncStorage **before**
the network call, then sent; the entry is removed only on a confirmed response, and
[app/_layout.tsx](app/_layout.tsx) re-sends anything queued at every app start.

**What happens if the player navigates during the write** — the case that loses rows today: the
in-flight request is **still cancelled**, exactly as before. The difference is that the entry is
already on disk, so the next launch re-sends it. **The hand is delayed, never lost.** Nothing tries
to keep the request alive, because that is not reliably possible from a page being torn down.

A retry is only safe because the write is now idempotent: `record_hand_result_d` gained
`p_client_hand_id`, backed by the partial unique index `uq_hand_history_client_ref` on
`(device_id, client_hand_id)` — the same shape as `uq_hand_net_ref`. **Without that key the outbox
would have traded a lost hand for a double-counted one**, and achievements count `hand_history` rows.

> ⚠️ **One real hazard, caught and fixed in the same session.** Adding a defaulted parameter created
> an **overload** rather than replacing the function, so `record_hand_result_d` briefly existed with
> 5 *and* 6 arguments. PostgREST resolves by argument name and the live client sends exactly the old
> five — which both signatures satisfy. That is a PGRST203 ambiguity on every solo/practice hand.
> Caught on the next query; the 5-arg signature was dropped. One function now, anon-granted.

### Proof — the test deliberately loses the race, navigating away with **zero dwell**

| engine | played | rows | distinct keys |
|---|---|---|---|
| webkit/430 | 4 | **4** | 4 |
| chromium/393 | 5 | **5** | 5 |

**9 of 9 survived.** `rows == distinct keys`, so no duplicates. Local queue drained to 0 on both.
Achievements fired correctly off those hands (1 and 2 unlocks, matching chip rows exactly). The
webkit run was cut short at trial 5 by a browser crash — 4 trials completed and are reported as 4,
not 5.

DB-level control first: the same id twice → `{duplicate:true}` and no second row; a call with **no**
key → still works, so any caller that never sends one is unaffected.

## 3. The twelve that can never fire — retired

| condition | ids | why it cannot fire |
|---|---|---|
| bluffs | `bluff_1`, `bluff_10`, `bluff_25` | `is_bluff` false on all 243 rows |
| all-ins | `allin_1`, `allin_10` | `is_all_in` false on all 243 rows |
| level | `level_5`, `level_10`, `level_20` | `player_levels`: 1 row, dead since 2026-04-14 |
| SNG | `sng_win_1`, `sng_win_5`, `sng_win_20` | no SNG result recorded anywhere |
| social | `challenge_1` | no challenge-sent signal persisted |

`share_1` **stays** — it reads `chip_transactions` and works.

**Deactivated (`is_active=false`), not deleted.** Both list RPCs already filter on it, so the tiles
vanish while the definitions, titles and reward values survive for whenever the instrumentation
exists. Deleting would throw that away and leave dangling `achievement_id` references.

**Counter reads n/24:** confirmed live on both engines — *"0/24 unlocked"*, 24 tiles, and **zero**
of the retired twelve appear.

**Historical unlocks untouched — 47 rows intact.** Exactly one references any of the twelve
(`level_5`), and it belongs to `device_id = 'unknown'` — the literal placeholder the *old*
`check_achievements` produced via `COALESCE(p_device_id, …, 'unknown')`. It has 0 analytics events,
no leaderboard row, no balance: an orphan of the April breakage, not a person. **No real player
loses a tile.** Had it been a real device the row would still exist but would not render — which is
precisely why this was checked before running rather than after.

## 4. The two removals

- **`/spectate`** — the SideMenu entry is gone; the route stays on disk because it works with a real
  room code. Verified live, both engines: 9 menu entries, SPECTATOR absent, 0 page errors, nothing
  else changed.
- **`/debug`** — redirects to `/` on a production build (a `__DEV__` check only; DEVELOPER and the
  7-tap gate are **not** involved and **not** touched). Verified live on both engines. Unchanged in
  a dev build, where it is genuinely useful.

## Battle-pass: hide vs leave — costed, not decided

**HIDE — cost: minutes.** It is one MenuItem, exactly like `/spectate`. The XP machinery is **not**
coupled to the screen: `useBattlePassStore` is consumed by `index.tsx`, `results.tsx` and
`missions.tsx`, and `BATTLE_PASS_CONFIG` by `BoardReveal.tsx` and `results.tsx`. All of that keeps
working untouched.

> **The real cost of hiding, and it is not zero:** the results screen shows *"Tier 1 · 75/100 XP"*
> after every hand. Hide the screen and that line points at a destination the player cannot reach —
> an orphaned reference on the busiest screen in the game. Hiding it properly means also suppressing
> the tier line, which is a judgement about what the results screen promises.

**LEAVE — cost: zero work.** The screen is real and its tiers now work (handoff 90 fixed the
`Alert.alert`-on-web muteness). The cost is *attention*: a second progression system layered on one
nobody has tested, on a results screen already carrying 34 lines.

**Not decided — Roye's call, as instructed.**

## Verification / CI

`tsc` clean on every changed file. Web Deploy `completed:success` on `0b9b593` **before** the
after-runs; the iOS smoke test was still in progress at the time of writing and is the outstanding
CI signal. Local jest is not producing a trustworthy verdict (suite counts vary run to run); across
four runs every test that executed passed, and one transient single failure did not reproduce in
three subsequent runs. **CI is the verdict.**

## Cleanup

18 devices, all machine-paced (spans 0.3s–4m02s; the real player's signature is 13 placements over
**18 minutes**). Zero leftovers across `analytics_events`, `chip_transactions`, `achievements`,
`hand_history`, `daily_rewards`, `leaderboard`, `user_missions`, `device_identity`. `purchases` 0 ·
0 `test-` devices · `achievements` back to its **47** historical rows · `hand_history` back to
**243** · real bindings **3 of 1,051** · real player `6956-24d1-5ee4` untouched, 59 events intact.

Throwaway probes deleted; [tests/front-door-a11y.mjs](tests/front-door-a11y.mjs) and
[tests/hand-race.mjs](tests/hand-race.mjs) kept — both should be repeatable.

**Nothing else changed:** no time spent on the tutorial re-show · first-hand player count unchanged ·
`record_reward`, its clamp and every economy guard untouched · the twelve **not** wired and no dead
table revived · `delete_user_account` grant not restored · DEVELOPER and the 7-tap gate untouched ·
no C5, stake tiers, stakes UI or tournaments · MP prompt untouched · `game`, `multiplayer-game`,
`lobby/table`, `gameover` not started.

*(handoff: `vamos_handoffs` id 94 · shipped `main 0b9b593`)*
