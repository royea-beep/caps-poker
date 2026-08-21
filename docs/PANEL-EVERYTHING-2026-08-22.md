# CAPS — the eight promises lowered, and a full panel (2026-08-22)

**Answer up front: yes for a small invited round, after three cheap fixes. Not for strangers, not
for an app store** — and nothing below says otherwise.

---

## 1. The eight promises: lowered

`record_reward` clamps a single grant at 2,000. Eight definitions promised more, so they would have
paid 2,000 while the tile advertised up to 25,000.

| id | was | now | depth |
|---|---:|---:|---|
| `cup_collector` | 25,000 | **2,000** | all 5 cups |
| `cup_diamond` | 10,000 | **1,800** | 5 cups |
| `cup_platinum` | 5,000 | **1,500** | 4 cups |
| `level_20` | 5,000 | **1,500** | level 20 |
| `sng_win_20` | 5,000 | **1,500** | 20 SNG wins |
| `cup_gold` | 2,500 | **1,200** | 3 cups |
| `win_100` | 2,500 | **1,200** | 100 wins |
| `play_500` | 2,500 | **1,200** | 500 hands |

**Why these numbers.** The eight sat in four bands — 25000 > 10000 > 5000×3 > 2500×3. Flattening
them all to 2,000 would pay a 3-cup player the same as one who collected all five. The four bands
are preserved and scaled under the cap (**2000 > 1800 > 1500×3 > 1200×3**), so every original rank
survives. 1800 and 1200 are new rungs on a ladder otherwise using 100/200/300/500/1000/1500/2000 —
the price of keeping four bands under a 2,000 ceiling.

**Verified:** zero definitions above the clamp; max `chips_reward` anywhere is now exactly 2,000.
**Clamped flag silent — proven live, not asserted:** `record_reward` called at the new maximum
returned `{ok:true, clamped:false, granted:2000}`. Since max == cap, `LEAST(x,2000)` is the identity
and the flag is now mathematically unreachable.

**Economy effect:** deep tier **57,500 → 11,900** chips (−79%), the right direction for a 157:1
economy. `record_reward`, its clamp, and every economy guard are untouched. Data change only.

*Not changed:* `streak_30` already sits at 2,000 and is not one of the eight, so it now ties
`cup_collector` at the top. A 30-day streak is defensibly the hardest sustained thing in the game,
so it is left alone rather than silently editing a ninth definition.

## 2. The panel

### Product
- **Block:** nothing.
- **Accept:** the practice hand works end to end on both engines (h86) and **it is the product**.
- **Cut:** `/spectate` — one tap from the side menu, four lines, an error triangle, zero working
  controls (h87).

> **Correction to h87.** Its "the tutorial re-shows after a completed hand", ranked there as *the
> single most likely thing to make a tester think the app is broken*, **did not reproduce today**.
> Two fresh devices, full hand played, back to home: normal home screen, no SKIP, no Continue. The
> seen-flag is persisted and honoured. I could not confirm the in-app HOME path (my selector missed
> the control), so that path stays unverified — but the reload path is the stricter test and it
> passes. **Do not spend the 1–2 hours.**

### Game design
- **Block:** nothing.
- **Accept:** the reveal and its winner cue — gold 3px won / mint 2px field / black-22% 1px neutral,
  captured in **one frame** (h86). In greyscale the **width** carries the cue, not the colour.
- **Cut:** nothing — but name the open question: a stranger's first act is placing **twelve cards**
  (3-player default). We cannot separate "they don't understand the rules" from "the volume is too
  high" because a 2-player first hand has never shipped. ~1 hour of config, and it **must be decided
  before the round** or the round cannot answer it.

### Economy
- **Block:** nothing for an invited round.
- **Accept:** **wagering already exists and works** (h80) — every MP room+hand sums to exactly zero
  across players plus rake, server-settled, idempotent via `uq_hand_net_ref`. The hardest part is
  done, and was nearly rebuilt by mistake.
- **Measured today:** credited **1,129,043** · true destruction **7,204 ever** = **157:1** · float
  **2,495,094** across 1,051 devices.
- **Cut:** the `daily_streak` curve — 86% of everything ever created (h81). No sink can outrun it.
  Not for this round.

### Security
- **Block:** nothing a small *invited* round exposes.
- **The one number, re-measured today: binding covers 3 of 1,051 devices — 0.29%.** h81 found this
  and it has not moved. The guards on `record_hand_net` and the two big faucets are correctly wired
  and free, but `econ_bind_ok` returns true for an unbound device, so for **99.7%** of devices the
  only real ceiling is the 20,000/device/day cap and the unique index. **The guards were verified to
  exist and never measured for coverage** — the recurring error class in this project.
- **Cut:** nothing. Closing it means binding on first sight, which is a land-grab risk on real
  players' devices. Still Roye's call.

### Accessibility
- **Block: the first screen.** Measured live today: the overlay's `SKIP ✕` and `Continue` are
  `tabindex=0` with **no role**. And the whole side menu is the same shape — PLAY ONLINE, BATTLE
  PASS, STATS, HAND HISTORY, COACHING, SPECTATOR, SETTINGS, TUTORIAL, LANGUAGE, SIGN IN. **Twelve
  unexposed controls, two of them on the very first screen a person meets.**
- **Improved since h87:** `aria-hidden` *is* now present on the background; h87 reported none.
- **Accept:** everything fixed in h88–h92 — referral, achievement tiles, leaderboard tabs,
  battle-pass tiers, the ten `accessibilityLanguage` sites, cups.
- **Cut:** nothing. ~2 hours, and it is **the highest-value fix in this report**.

### Performance
- **Block:** nothing — no measurement contradicts readiness.
- **Accept:** reveal timing tuned from measured values (14000 → 8000 against a measured 13.8s);
  long-press skip-all saves 26.3s.
- **Unmeasured, stated plainly:** no Lighthouse/CWV run, no bundle budget check, no MP load test.
  **This is the least evidenced seat in the report.**

### QA / test
- **Block: the `hand_history` race.** A fire-and-forget `void (async () => …)` in `results.tsx`; a
  fast navigate loses the row (measured: **1 of 2 hands lost**, h92). Hand history *and* achievements
  both inherit it. A tester who plays three hands and sees two is the most corrosive possible bug —
  it makes everything else look untrustworthy.
- **Accept:** 2,632 tests green; the harness plays a real hand to `/results` on both engines (h86);
  the five-criteria achievement proof passed on both (h92).
- **Count the instrument failures honestly:** across h86–h92 there were **four** false "dead control"
  findings and **three** screens filed as broken that were my own enumerator. More filed defects have
  turned out to be measurement errors than real. Weight unverified backlog items accordingly.

### Simplicity advocate (veto seat)
*This seat took Settings 42 → 23 (h89) and has been right every time it has been applied.*

- **Remove, don't fix:** `/spectate` · `/debug` (an AUTO-DEBUG dump with no back button that should
  not answer on a public build) · **the 12 unfireable achievements** — delete them from the catalogue
  rather than leaving twelve permanent locks a tester reads as broken progression. One data change
  versus weeks of bluff/all-in/SNG/level instrumentation.
- **Fix, don't remove:** the twelve unexposed controls (the front door) · the `hand_history` race
  (correctness) · the eight promises (done today).
- **Neutral:** `battle-pass`. Its tiers work now (h90), but it is a second progression system layered
  on one nobody has tested. For a small round, **hide it rather than explain it**.

## 3. Cited

h80 economy map · h81 integrity gap + binding coverage · h86 harness + winner cue · h87 scope panel,
first-run a11y, reachability · h88 control enumeration · h89 settings 42→23 · h90 three of five were
the instrument · h91 six Hebrew-first RPCs · h92 achievements wired.
`docs/SCREEN-VISUAL-AUDIT.md` — 8 of 22 reviewed, **14 remaining**, ~4 sessions at the honest rate.
`docs/PRE-TESTER-BACKLOG.md` — **6 OPEN**: A7, C2, C4, C5, E2, E4.

## 4. Still unmeasured — the honest half

- `game`, `multiplayer-game`, `lobby/table`, `gameover`: **never operated control by control**. Two
  of them are where the product actually lives.
- The visual audit's remaining **14** screens.
- **Copyability: never assessed at all.** Nobody has asked whether a competitor could clone this.
- **MP under real load:** concurrent rooms, more than two live devices, a player dropping mid-hand.
- **Native anything.** Every measurement in twelve sprints is web. Last known production iOS build is
  **507** by device truth.
- **Achievements with a real player:** 47 unlocks ever, **zero since the wiring shipped**, because no
  human has played a hand since. Proven by my tests, not by a person.
- The in-app HOME path for the tutorial re-show.
- The **26 devices below 50 chips** — the rescue shipped in h81, 21 sit at exactly 0 today, unchanged.
  **Nobody has ever claimed it.** Wired but unexercised.

## 5. Ranked by what a tester actually hits, in first-session order

| # | when | item | call |
|---|---|---|---|
| 1 | second 0 | first-run overlay: 2 controls invisible to AT | **fix ~2h** (with #2) |
| 2 | second 5 | side menu: 10 more invisible controls | same fix |
| 3 | second 30 | first act is placing **twelve** cards | **decide before the round** (~1h) |
| 4 | minute 2 | `hand_history` race — a played hand can vanish | **fix**, correctness |
| 5 | minute 3 | results density, 34 competing lines | defer, ~half a day, taste |
| 6 | minute 5 | 12 of 36 achievements can never unlock | **remove**, minutes |
| 7 | minute 6 | `/spectate` dead end | **remove**, minutes |
| 8 | minute 10 | battle-pass, a second untested progression | **hide** for a small round |
| 9 | later | zero-chip trap: 26 devices already stuck | fix later |
| 10 | later | economy at 157:1 | defer, design |
| 11 | not this round | binding coverage 0.29% | scale/stranger problem |
| 12 | unknown | MP load, native, the 14 screens, copyability | unmeasured |

## 6. Simplicity verdict per item

| item | cheaper to | why |
|---|---|---|
| first-run + menu a11y | **fix** | it is the front door; removing it removes the product |
| 12 dead achievements | **remove** | one data change vs weeks of instrumentation |
| `/spectate` | **remove** | one MenuItem; nothing depends on it |
| `/debug` | **remove** | should not answer on a public build |
| `hand_history` race | **fix** | correctness; nothing to remove |
| results density | fix later | real, but taste is not a blocker |
| battle-pass | **remove (hide)** | cheaper than explaining it |
| 12-card first hand | **decide** | a default, not a feature |
| zero-chip trap | fix later | 26 devices; the mechanism exists |
| binding coverage | **neither** | Roye's call — land-grab risk either way |
| economy ratio | defer | design, not code |

## 7. The one sentence

> **Expose twelve controls, stop losing a played hand, and delete the twelve achievements that can
> never fire — about one day of work — and CAPS is ready for a small invited round today; everything
> else on this list is either a scale problem an invited round will not reach, or taste.**

---

**Nothing else changed:** only the eight `chips_reward` values · `record_reward` and its clamp
untouched · no economy guard touched · the 12 unfireable achievements **not** wired and no dead table
revived · `delete_user_account` grant not restored · DEVELOPER and the 7-tap gate untouched · no C5,
stake tiers, stakes UI or tournaments · MP prompt untouched · no keys · `game`, `multiplayer-game`,
`lobby/table`, `gameover` not started.

**Cleaned:** 2 probe devices, all rows removed including the 2 `device_identity` bindings they
created. Real bindings back to **3 of 1,051**. `purchases` 0. 0 `test-` devices. `achievements` at
its 47 historical rows. Real player `6956-24d1-5ee4` untouched, 59 events intact.

*(handoff: `vamos_handoffs` id 93)*
