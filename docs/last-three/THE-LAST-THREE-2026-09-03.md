# VAMOS CAPS — THE-LAST-THREE (2026-09-03)

The three things that did not need Roye: the audit leftovers, the landing page, the migration
history. Branch `claude/vamos-caps-align-celebration-flppo0`. **Nothing merged, no bump, production
schema and flags untouched.**

> **MAP, carried forward and re-verified against the DB before starting (Iron Rule 9).** The brief's
> map did not match production on three points, so they are restated here rather than inherited:
> **S1 is NOT closed** — live `econ_bind_ok` still carries `OR v_uid IS NULL THEN RETURN true`, no
> `service_role` bypass, no `refused_no_session` marker. **Nothing is merged** — `origin/main` is
> `e3d7d5e`; this branch is not an ancestor. **Referral conversions are 0** — the "0 → 2
> redemptions" were my own test rows from the previous sprint, since deleted.

---

# §1 — THE AUDIT LEFTOVERS

## 1.1 Tie in hand history — ALREADY FIXED. Reported, not re-fixed.

`app/hand-history.tsx` was already correct before this sprint, so the fix would have been a
re-fix of something working. What is actually there:

```ts
const outcome: 'win' | 'loss' | 'tie' =
  playerWins > botWins ? 'win' : playerWins < botWins ? 'loss' : 'tie';
```

- A distinct `handCardTie` style, not a loss style.
- The tied count is printed: `{tally.hasTie && <Text style={styles.scoreTied}> ={tally.tied}</Text>}`.
- Net renders as `±0` in `textDim`, not as a red loss.

**The writer agrees end-to-end.** `utils/handOutbox.ts:113` sends
`p_won: h.outcome === 'tie' ? null : h.outcome === 'win'`, and `record_hand_result_d` stores
`'tied'`. Production `hand_history`: **58 won / 14 lost / 4 tied**, first tie 2026-08-28.

⚠️ **Rows written BEFORE that fix are still mislabelled in the table.** No backfill was performed —
the brief forbids it and the arithmetic is untouched, as instructed.

**Rendered proof, and its boundary.** `/results` was reached by playing real practice hands.
Seed 4 prints `2 — 1` with `2 WON · 1 TIED · 1 LOST` — four boards, and the tie is neither a win
nor a loss. `/hand-history` could NOT be exercised in the rig: practice hands are economy-neutral
and are not recorded, and the harness's practice-only guard forbids reaching a scored hand. The
hand-history evidence above is a code read; the results-screen tie is measured.

## 1.2 English leaks — consistency only. NOTHING newly translated.

**The map first, because the shape of the problem was not what the brief assumed.** Measured across
every screen (`t()` calls vs English-only text nodes):

| screen | `t()` | English-only nodes |
|---|---:|---:|
| `app/results.tsx` | 89 | 0 real (1 regex artefact) |
| `components/BoardReveal.tsx` | 23 | 1 |
| `components/BoardResultCard.tsx` | 21 | 0 |
| `components/Board.tsx` | 14 | 1 dead (`{false && …}`) |
| `app/game.tsx` | 13 | 2 |
| `components/EquityBar.tsx` | 13 | 0 |
| `app/(tabs)/profile.tsx` | 10 | 5 |
| `components/SideMenu.tsx` | 10 | 0 |
| `app/(tabs)/play.tsx` | 8 | 7 |
| **`app/(tabs)/index.tsx` (Home)** | **5** | **26** |
| `app/settings.tsx` | 5 | 44 |

**Home is the sharpest case and it is not what the brief's two examples suggest.** Home's *modals*
(sign-in nudge, referral toast, daily-reward modal, alerts) are fully bilingual via an inline
`isHE ? … : …` pattern — 18 sites. Home's *body* has exactly **five** translated strings (the Play
Online card, the Practice button, the teaching line) and **26** English-only ones around them. A
Hebrew visitor sees two Hebrew buttons in an otherwise English screen. That is the half-state.

**What was fixed, and why only three things.** The brief is explicit: *consistency, not translation;
do not translate anything new.* Every English string on Home and Settings needs NEW Hebrew, which is
banned. So the fix was restricted to leaks where a key **already exists in both tables with
byte-identical English** — a pure wiring change that adds no translation and changes no English:

| file | was | now | key |
|---|---|---|---|
| `components/InteractiveTutorial.tsx:206` | `WIN` | `{t().winShort}` | `winShort` — `'WIN'` / `'ניצחת'`, already used by `Board.tsx` and `BoardResultCard.tsx` |
| `app/(tabs)/play.tsx:51` | `PLAY` | `{t().play}` | `play` — `'PLAY'` / `'שחק'` |
| `app/(tabs)/index.tsx:1923` | `Cancel` ×2 (label + a11y) | `{t().cancel}` | `cancel` — `'Cancel'` / `'ביטול'` |

`InteractiveTutorial.tsx` is the clearest of the three: 16 bilingual sites and exactly two English
literals, one of which had a ready key sitting unused.

**Reported, NOT fixed — every one needs new Hebrew:**
- `components/BoardReveal.tsx:1014` — `COMPLETE!` (23 `t()` calls around it). The nearest keys are
  `completeAllBoards` (`'COMPLETE! ALL BOARDS!'`) and `complete` (`'Round Complete! 🏆'`); neither is
  the same string, and swapping either changes the English and the banner width.
- `app/game.tsx:1417` — `Calculating results...`; `app/game.tsx:1458` — `🤖 Practice · no chips`
  (visible in the Hebrew hero shot taken this sprint: an English chip on an otherwise Hebrew screen).
- `components/CompleteBanner.tsx:59` — `+{n} bonus chips!`
- `app/(tabs)/profile.tsx` — `PROFILE`, `HANDS`, `WIN RATE`, `STREAK`, `CHIPS 💰`.
- `app/(tabs)/play.tsx` — `Single Player`, `Multiplayer Lobby`, `Quick Private Table` and their
  three subtitles. Seven leaks against eight `t()` calls: the most literally half-translated screen.
- `components/InteractiveTutorial.tsx:217` — `🏆 COMPLETE +50%`. Note COMPLETE is a deliberate
  loanword: the Hebrew table itself keeps it (`'COMPLETE! כל הבורדים!'`, `xpLabelComplete: 'COMPLETE'`),
  as hand-rank names stay English on purpose.

**⚠️ A decision only Roye can take.** Home cannot be made consistent inside this sprint's rules.
Two doors, both lossy:
1. **Translate Home's 26 body strings** — forbidden here, and it is a real translation project.
2. **Un-translate Home's 5** — consistent, adds nothing, but removes Hebrew that shipped
   deliberately on 2026-09-02.
Recommendation: door 1, as its own sprint, scoped to Home + Play + Profile (the three screens a
Hebrew player actually lands on). Do NOT take door 2 by default.

## 1.3 Gold on secondary buttons — 16 rendered hits → 0.

`#FFD700` is the WON cue (`components/Card.tsx`). The count below is **measured in a browser from
computed styles**, not grepped, and it matches the rgb triple at any alpha — `rgba(255,215,0,0.12)`
is the same cue turned down.

**BEFORE — 16 rendered hits** (2 engines × 4 widths × the 2 screens carrying them), from
10 distinct source sites:

| site | what it was |
|---|---|
| `components/ShareSection.tsx` `shareGameBtn` / `shareGameBtnText` | gold fill + gold text, while `bigShareBtn` two lines below was already mint |
| `components/BoardResultCard.tsx` `shareBtn` | gold Pressable sitting beside `boardResultWin` (`#FFD700`) in the same card |
| `app/(tabs)/index.tsx` `dailyPill` | a Pressable when the bonus is claimable; gold fill/border against its own `#e8c96a` text |
| `app/replay.tsx` `coachingBtn` | gold fill under a `COLORS.gold` (`#c9a84c`) border |
| `app/settings.tsx` `tileLabelActive` | gold label on a tile whose active border and ✓ are already mint |
| `app/theme-pick.tsx` `selectBtnFiveo` | a **solid `#FFD700`** SELECT button |
| `app/theme-pick.tsx` `fiveoCard` + preview + name + tag | gold on the whole Pressable card |
| `app/settings.tsx` FIVE-O `accent` | gold on the Pressable tile |
| `components/DealMeInButton.tsx` | solid `#FFD700`, and **dead** — zero imports |

**AFTER — 0**, in chromium and webkit, at 320/375/393/430, on home / play / settings / theme-pick,
and 0 on `/results` reached by playing real hands.

**The FIVE-O swatch is the find, and it changes what the fix should be.** Its accent was `#FFD700`
on a Pressable. Checked against what the theme actually paints
(`constants/paintThemes.ts` `visual.fiveo`):

```
accent #4FD6A8   surface #1A1A2E   boardGold #c9a84c   goldLight #e8c96a
```

**FIVE-O renders no `#FFD700` anywhere.** The swatch was advertising a colour the theme does not
have, and that colour happened to be the one reserved for WON. It now uses the theme's own accent.

⚠️ **Still wrong, deliberately left for a decision:** the FIVE-O preview box is `#5c0000` and the
copy says *"Red felt / Bold action"*, while `visual.fiveo` paints a navy `#1A1A2E` surface. Same
class of error as the maroon-felt line corrected in `CLAUDE.md` — a swatch describing an app that no
longer exists. Not changed here because rewriting product copy is outside a gold-on-controls pass.

**Three hits remain in the scanner and are NOT controls.** `components/ShareCard.tsx` `ctaPill` /
`ctaText` / `ctaUrl` are drawn into the exported share IMAGE; the file contains zero `Pressable` and
zero `onPress`. Named like buttons, painted into a picture. Stated rather than quietly filtered.

**Two of the fixes are native-only and could not be render-verified.** `ShareSection.shareGameBtn`
and `BoardResultCard.shareBtn` both sit behind `Platform.OS !== 'web'`, so the web loop cannot draw
them by construction. Their evidence is source-level plus the fact that the mint values they now
take are the exact values `bigShareBtn` already ships in the same file.

## 1.4 The battle-pass entry — HIDDEN. And the brief's premise needs one correction.

**The flag is dead, not off.** `app_config.battle_pass_enabled = false` since 2026-03-27, and **no
client code reads it** — the constant was dropped from `constants/economyConfig.ts` on 2026-08-31
because nothing consumed it. So the flag could never have gated the link, and turning it on would
change nothing.

**Why the entry comes off, measured rather than assumed:**

| check | result |
|---|---|
| `claimFreeReward(tier)` / `claimPremiumReward(tier)` | append the tier number to a local AsyncStorage array. **No chips credited. No cosmetic unlocked.** Tier 1 advertises "500 chips" and pays zero |
| `upgradeToPremium()` | asks *"Spend 5,000 chips to unlock the Premium track?"* and **charges nothing** |
| the 60 reward ids in `constants/battlePassConfig.ts` | **0 resolve anywhere in the app.** `ocean` / `emerald` exist in `constants/homeThemes.ts` as HOME BACKGROUNDS — a different namespace no claim path touches. Every other match is the battle-pass unit test |
| store | `stores/battlePassStore.ts`, entirely device-local (zustand + AsyncStorage) |
| Home surface | `bpCurrentTier` / `bpProgress` are computed at `index.tsx:636-637` and **never rendered** — hiding the drawer entry closes the only door |

A screen that promises sixty rewards and delivers none is the *"no half-done features visible"*
release rule. **The screen, the route, the store and the config all stay**; one commented line in
`components/SideMenu.tsx` restores the link. XP still accrues (`app/results.tsx:603`), so nothing a
player has earned is lost.

## 1.5 The Loop — canary first, both engines, four widths.

`tests/loop.mjs`, artefacts in `docs/last-three/loop/`.

**The canary runs before any app number is reported** and asserts the instrument's own detectors
fire on a page of planted defects: a 3000px element (overflow), an `overflow:hidden` box cutting a
long child (clip), a 24px control (44pt floor), a low-contrast label beside a high-contrast one
(contrast, both directions), and a `#FFD700` button beside a mint one (gold, both directions).
**All seven green in chromium and in webkit.** If any had failed the run aborts and reports nothing.

```
chromium + webkit  ×  320 / 375 / 393 / 430  ×  home / play / settings / theme-pick
gold-on-controls: 16 -> 0        horizontal overflow: 0
/results via real practice hands (seeds 4, 20260827): gold 0
```

**What the loop caught that the source scan had wrong.** My grep had classified the FIVE-O sites as
"theme swatches, not violations". The loop reads the rendered control, and the whole FIVE-O card
**is** a Pressable — so it reported gold on a control in both engines at all four widths. Chasing
that disagreement is what surfaced the swatch lying about the theme's colours. The instrument was
right and the source read was wrong.

`tsc --noEmit` exit 0. `jest`: **2,656 / 2,656 pass, 42 suites.**

---

# §2 — THE LANDING PAGE

## Where it lives

**`https://caps.ftable.co.il/landing.html`**, built from **`public/landing.html`**.

It already existed and had already passed the honesty sweep of 2026-09-02 (one CTA, four stranger
questions, no store date, no invented numbers, the flag-proof "free to play, with optional in-app
purchases" wording). This pass fixed the one thing the corrected language record made wrong, and
proved the rest by measurement instead of inheriting it.

## The catch-all trap — avoided, and proven avoided

The trap is real and reproducible:

```
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://caps.ftable.co.il/definitely-missing-abc123.html
200 1902        <- the app's index.html, not a 404
```

`/landing`, `/Landing.html` and `/landing.htm` all do the same. Source: `vercel.json`
`{ "source": "/(.*)", "destination": "/index.html" }`, with only `/privacy.html` and `/terms.html`
excluded.

**The landing page does not inherit it**, and that is proven by bytes rather than by inspection:

| | sha256 | bytes |
|---|---|---|
| live `/landing.html` | `f5421eee20c487aa…` | 20,791 |
| repo `public/landing.html` | `f5421eee20c487aa…` (identical) | 20,791 |
| live `/` — what the trap serves | `17d87fe69a102e1c…` | 1,902 |

A real static file wins over the rewrite. ⚠️ **The trap itself is reported, not fixed:**
`vercel.json` is outside this sprint's edit scope. The one-line fix is to exclude paths that carry a
file extension from the catch-all so a missing file 404s instead of impersonating the app.

## What it claims, and what makes each claim true

| the brief requires | the page says |
|---|---|
| what CAPS is, in one line a stranger understands | *"CAPS is multi-board poker. You're dealt four cards on every board, and every board plays at the same time — take the most boards to win the hand."* |
| that it is free | *"Yes — free to play, with optional in-app purchases. You start with virtual chips and earn more just by playing, so you never have to pay to keep going."* — the wording that survives the `iap_enabled` flip |
| play now in your browser, no install friction | CTA *"Play now / Free · in your browser · no sign-up"*, then *"Tap and you're dealt in. Nothing to download, no account to make."* |
| what makes it different | the multi-board format, plus *"Live win odds and outs as each board plays out."* |

**The format is READ, not seen — confirmed.** It is stated in the sub-headline
(*"Multi-board poker: four cards on every board, all played at once. Win the most boards, win the
hand."*), in the FAQ answer, and in both figure captions. The hero images carry atmosphere and
proof; no rules fact depends on decoding a picture. The loop asserts this as
`formatInText` on all 12 runs.

**No board count is promised.** The headline is *"More than one way to win — every hand."* — true at
every table size. "Four boards / four chances" would be false for 3-4 players, so it is not said.
"Four cards on every board" is always true and is what appears.

**No store date, no invented numbers** — asserted per run and green on all 12. The only digits in
the visible copy are "4 cards per board", "18+" and the suit glyphs. No player count, no rating, no
review, no "coming soon".

## The fix — the screenshots were 100% Hebrew on an English-first page

`public/shots/*.webp` were re-shot in Hebrew on 2026-09-02 *"to match the primary
caps.ftable.co.il audience"*. The record was corrected on 2026-09-03: **CAPS is English-first and
global; Hebrew is the pilot addition.** A page that says English and shows Hebrew is the same
half-state defect §1 is about.

Both languages are now shot from the **current build** (`tests/landing-shots.mjs`, 440×954 CSS at
dsf 1.5 = the 660×1431 the `<img>` already declares, so no layout shift) and swapped by the page's
**own** `data-l` toggle. **Hebrew is free from the same source**, exactly as the brief allows: one
file, one mechanism, no second page and no new translation.

## The loop caught two things — one in the page, one in the instrument

- **In the page:** `[data-l]{display:none}` **loses on specificity** to `.shot img{display:block}`,
  so BOTH languages' screenshots rendered at once. Both rules are now stated at `.shot` level.
- **In the instrument:** it counted footer legal and contact links as CTAs (reported 4 instead of 1)
  and flagged the honest denial *"no app store, no download"* as a store promise. Both were the
  probe being wrong, not the page. Fixed, and the fix is commented where it happened.

```
chromium + webkit  ×  320 / 393 / 430  ×  en / he      canary green in both engines
correct-language image only · exactly 1 CTA · overflow 0 · format in text · no store date
· no invented numbers · contrast failures 0                        VERDICT: failures 0
```

The gilded wordmark is **skipped** by the contrast detector, stated rather than excused:
`background-clip:text` paints the glyphs from the background, so any ratio computed from `color`
is meaningless (it read 1.18 against a `need` of 3 while being perfectly legible).

## Existing deployment unbroken — proven by a full export

```
npx expo export --platform web --output-dir /tmp/webship
```
- `public/` is copied verbatim into the output; `landing.html` ships **byte-identical** to the repo.
- All four `shots/…` references resolve to files that exist in the output. No dangling reference.
- `index.html` is **identical** to the previous export — the app bundle is untouched.

## Rendered + PNGs committed

```bash
git show 9eaa9b0 --stat -- docs/last-three/landing
git show 9eaa9b0:docs/last-three/landing/landing-en-393-chromium.png > /tmp/landing-en.png
git show 9eaa9b0:docs/last-three/landing/landing-he-320-webkit.png  > /tmp/landing-he.png
git show 9eaa9b0 --stat -- public/shots
git show e272001 --stat -- docs/last-three/loop
```

---

# §3 — THE MIGRATION HISTORY  ·  REPORT ONLY, NOT REPAIRED

## The brief's number is right. Here it is measured.

| | |
|---:|---|
| migration files in `supabase/migrations/` | **39** |
| rows in production's `supabase_migrations.schema_migrations` | **367** |
| repo files matched to a server row (exact name, or prefix) | **32** |
| **server rows with no file in git** | **335** |
| tables the repo's history would create | **5** — `app_config`, `deploy_tracker`, `leaderboard`, `user_profiles`, `whatsapp_sessions` |
| tables on production | **73** (+ 9 views, 188 functions, 100 policies, 197 indexes, 14 triggers) |

**335 changes reached production without ever being a reviewed diff. The brief is exactly right.**

**One thing the brief does not say, and it changes the cost: the SQL is not lost.** All **367** rows
carry their statements — **385 statements, 930,620 bytes**, zero rows with a null or empty
`statements` array. The history is not missing; it lives on the server instead of in git.

**Seven repo files have no server counterpart at all:** `audit_rls_lockdown`, `cups_progression`,
`lobby_v2_activation`, `mp_lobby_rpcs`, `purge_harness_devices`, `session_stats_rpc`, and
`close_s1_econ_bind_ok_fail_closed` — the last of which is correct and deliberate (S1 is held). So
the directory is not a partial history; it is a partly **parallel** one, and
`supabase db push` from a clean checkout is not a safe operation today.

## Do managed backups already cover recovery? **Yes.** Plainly.

| check | measured |
|---|---|
| plan | **Pro** (org "Feature Table") — Supabase Pro includes daily physical backups, 7-day retention |
| `archive_mode` | **on** |
| `archive_command` | `/usr/bin/admin-mgr wal-push %p` — wal-g, continuous WAL archiving |
| `wal_level` | `logical` |
| WAL segments archived | **115,872**, lifetime failures **2** |
| last archive | **2026-09-03 12:06:15 +03** — minutes before this measurement |
| database size | 472 MB |

**The migration history is not the disaster-recovery mechanism and never was.** Production can be
restored from Supabase's own physical backups with the git history in exactly the state it is in
today. Losing the database is not on the list of things a broken history costs.

⚠️ **One thing I could not read and will not assert:** whether the **PITR add-on** is purchased is a
billing setting these tools do not expose. WAL archiving being on is Supabase infrastructure, not
proof the add-on is active. Without it, recovery granularity is the daily snapshot rather than the
second. **Confirm in the dashboard** before treating second-level recovery as available.

## What IS at risk today — and it is one thing, not a list

**Branch-based QA. Iron Rule 11 depends on it, and it is already being paid for.**

A Supabase branch is built by replaying `supabase/migrations/`. That is 39 files and **5 tables**
against production's **73**. Every branch test this series has run has had to hand-build a faithful
reproduction of the shipped function and the tables it reads before it could test anything — CLOSE-S1
and CLOSE-S2 both did exactly that, and both said so.

The cost is real and recurring, and it has a sharp edge: **a branch test can pass against a
reproduction that differs from production.** The reproduction is written by whoever is doing the
sprint, from a code read. That is the actual exposure — not data loss, and not an outage.

**A second, smaller cost:** with 7 files in git that production has never seen, and 335 production
changes git has never seen, nobody can run the standard Supabase workflow from a clean checkout.
The directory is documentation, not a runnable history.

**This is chronic, not urgent.** It has been true for months, it costs a tax per server sprint, and
nothing about it is getting worse on its own.

## Cost to repair — two routes, priced

**Route A — squash to a baseline. RECOMMENDED.**
`pg_dump --schema-only` of production becomes a single `00000000000000_baseline.sql`; the migrations
directory is reset to just that; the baseline is marked applied. Everything after it is a normal
reviewed diff.
- Machine work: minutes. The dump is roughly 1 MB.
- Real work: reviewing the dump, then building a branch from it and diffing its catalog against
  production until the difference is zero — table for table, function for function, policy for
  policy. **One focused server sprint.**
- It is *verifiable*, which Route B is not: the exit condition is a measured zero difference.
- Cost: per-change provenance is lost from git. That provenance already exists in two other places —
  the 367 server rows, and this docs series.
- This is what Supabase itself recommends for a project whose history has diverged.

**Route B — reconstruct the 367.** Write each row's stored statements out as a numbered file and
replay them in order.
- Extraction is mechanical: one query, minutes.
- But replay still would not reproduce production. **18 tables and 21 functions have no `CREATE`
  anywhere in those 367 rows** — they were made in the dashboard or the SQL editor. Among them:
  `referral_links` (2,009 rows), `purchases`, `achievements`, `daily_rewards`, `chip_config`,
  `audit_logs`, `sit_and_go_sessions` / `_players`, `error_logs`, `vamos_handoffs`; and functions
  including `get_home_screen`, `get_game_config`, `get_player_stats`, `join_sit_n_go`,
  `register_push_token`, `sng_eliminate`.
- **35 of the 367 rows are QA simulations, data resets and cleanups** (`qa_sim_*`,
  `reset_all_accounts_*`, `final_leaderboard_clear_before_launch`, `cleanup_*`) that must not run on
  a fresh database. 12 rows begin with plain DML.
- **217 rows contain `CREATE OR REPLACE FUNCTION`**, so most supersede each other — replaying all of
  them rebuilds the same objects many times over.
- Estimate: **several sprints of iteration**, ending in a history that is still not a clean baseline.

## Recommendation

**Route A, and not now.** Do it as the first half of the sprint that next needs a high-fidelity
branch — which, per the CLOSE-S1 sequence, is the payments sprint, because that is the one where a
branch test being subtly wrong costs real money rather than play chips.

Roye orders it. Nothing was attempted this sprint: no migration written, no baseline dumped, no
branch created, no row in `schema_migrations` touched.

---

# PRODUCTION UNCHANGED — verified after all work

| | |
|---|---|
| economy | `leaderboard` / `chip_transactions` untouched; no backfill, reset or credit |
| flags | `iap_enabled` false · `web_payments_enabled` false · `battle_pass_enabled` false (unchanged, still unread by the client) |
| S1 | still fail-open — **deliberately**; the migration remains committed and NOT applied |
| schema | no migration applied; `schema_migrations` has 367 rows, exactly as found |
| winner cue | `components/Card.tsx` not touched; card sizes, the 83px arc and the tie-tally arithmetic not touched |
| security | no grant, policy or `verify_jwt` change |
| deployment | `caps.ftable.co.il` untouched; nothing merged to `main`, no build bump, no deploy |
| my test rows on prod | **0** |
