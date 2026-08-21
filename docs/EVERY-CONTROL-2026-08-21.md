# CAPS — every control, one by one (2026-08-21)

Roye: *"בהגדרות אפילו יש מלא דברים שלא צריכים להיות שם. תחקור באמת, כל מסך ומסך, בלי חארטות."*
He was right. The last report walked the first session and then summarised the rest; Settings alone
carries **42** interactive elements and not one was listed.

Every control below was **operated**, not inspected — tapped from a fresh page load, one at a time,
recording the route, the on-screen text and the persisted store before and after.
Harness: [tests/enumerate-controls.mjs](tests/enumerate-controls.mjs).

**Nothing was built, deleted or fixed.**

---

## SETTINGS — all 42 controls

| # | label (verbatim) | does what | works? | understandable? | belongs? |
|---:|---|---|---|---|---|
| 0 | `Go back` | → `/` | ✅ | yes | keep |
| 1 | `Visual style CLASSIC` | selects classic | ✅ (no-op when already selected) | yes | keep |
| 2 | `Visual style FIVE-O` | `visualTheme: classic→fiveo` | ✅ | yes | keep |
| 3 | `Profile: Player 1` | opens the avatar/name modal | ✅ | yes | keep |
| 4 | `2 players` | writes `config` | ✅ | yes | keep |
| 5 | `3 players` | writes `config` | ✅ | yes | keep |
| 6 | `4 players` | writes `config` | ✅ | yes | keep |
| 7 | `Reveal speed Fast` | writes `config` | ✅ | yes | **merge** — see defaults |
| 8 | `Reveal speed Normal` | writes `config` | ✅ | yes | **merge** |
| 9 | `Reveal speed Cinematic` | writes `config` | ✅ | "cinematic" is not a duration | **merge** |
| 10 | `Starting Chips` | **row label, not a control** — the ± steppers are separate | tap = nothing | no — it is exposed as a button | **fix** semantics |
| 11 | `Pot Per Board` | same; and it edits the **local solo** config only — MP stake is server-side `app_config.pot_per_board` | tap = nothing | **no — a tester will read this as "my stake"** | **cut** |
| 12 | `Complete Bonus %` | same, local only | tap = nothing | no | **cut** |
| 13 | `2-color suits` | selects 2-colour | ✅ | yes | keep |
| 14 | `4-color suits` | `fourColorSuits: false→true` | ✅ | yes | keep |
| 15 | `Colorblind mode off` | selects off | ✅ | yes | keep |
| 16 | `Colorblind mode on` | `colorblindMode: false→true` | ✅ | yes | keep |
| 17 | `Card sort auto` | selects auto | ✅ | "auto" vs "pairs" is not obvious | keep |
| 18 | `Card sort pairs` | `handSortMethod: caps→user` | ✅ | label says *pairs*, value says *user* | **fix** label/value mismatch |
| 19 | `Sound enabled` (switch) | writes `config` | ✅ | yes | keep |
| 20–29 | `Volume 10 percent` … `Volume 100 percent` | ten discrete segments → `config.soundVolume` | ✅ **verified 0.8→0.3** | yes | **merge** — ten controls for one value |
| 30 | `Vibration enabled` (switch) | writes `config` | ✅ | yes | keep |
| 31 | `Ambient sound` (switch) | toggles | ✅ | what ambient sound? | keep |
| 32 | `Push notifications` (switch) | `notificationsEnabled: true→false` | ✅ | yes | keep |
| 33 | `Report a bug` | opens the report UI | ✅ | yes | keep |
| 34 | `📖 Show Tutorial Again` | → `/` and replays the tutorial | ✅ | yes | keep |
| 35 | `Advanced tuning, collapsed` | expands the advanced block | ✅ | "advanced tuning" of what? | keep |
| 36 | `Version 2.7.0` | 7-tap developer gate | no visible effect on one tap (by design) | no — invisible affordance | keep (intentional) |
| 37 | `Reset all progress` | `handleReset` → **`Alert.alert`** | ❌ **DEAD ON WEB** | reads as working | **fix** |
| 38 | `Your rank` | → `/rank` | ✅ | yes | keep |
| 39 | `Privacy policy` (link) | `Linking.openURL(.../privacy.html)` — **200 OK** | ✅ | yes | keep |
| 40 | `Terms of use` (link) | `Linking.openURL(.../terms.html)` — **200 OK** | ✅ | yes | keep |
| 41 | `Delete account` | `handleDeleteAccount` → **`Alert.alert`** | ❌ **DEAD ON WEB** | reads as working | **fix — highest priority** |

### The two dead ones, with the mechanism

[settings.tsx:924](app/settings.tsx:924) and [settings.tsx:974](app/settings.tsx:974) both open with
`Alert.alert(...)`. This project's own hard rule, in `CLAUDE.md`, is **"Alert.alert fails on web —
skip on web, navigate directly."** So on the web build — the build testers will use — **"Reset all
progress" and "Delete account" do nothing at all.** No dialog, no error, no state change. Confirmed
by operating both: `NO VISIBLE EFFECT`, no store delta.

A **Delete account** control that silently does nothing is the most serious single item in this
report: it is the GDPR affordance, and `delete_user_account(device_id, user_id)` exists in the DB
and is never reached from the web.

## Every other screen

| screen | # controls | control-by-control |
|---|---:|---|
| **home** `/` | 8 | `Open chip shop` · `Open menu` · `Play` · `Play online…` · `Challenge a Friend` · `Copy referral code` · `Share referral code` · `Report a bug` — enumerated in the first-session walk, **not individually operated** |
| **play** | 5 + tabs | `Single Player. Practice vs bots`→`/game` ✅ · `Multiplayer Lobby`→`/lobby` ✅ · `Quick Private Table`→`/lobby/private` ✅ · `Leaderboard`→`/leaderboard` ✅ · `Invite Friends`→`/referral` ✅ |
| **friends** | 4 + tabs | `New club name` (input) · `Create club` · `Club code to join` (input) · `Join club` — **all four: no visible effect, and no error message.** The Friends tab is a *club* screen |
| **cups** | **0** + tabs | **no controls of its own at all** |
| **profile** | 4 + tabs | `Achievements` ✅ · `Hand History` ✅ · `Detailed Stats` ✅ · `Settings` ✅ |
| **shop** | 8 | `Back` ✅ + seven buys, **all debit correctly** (rebuy 100 · emote 150 · challenge 200 · quick-poker 200 · avatar 200 · card back 300 · table theme 500) |
| **lobby** | 10 | **`Back` — NO EFFECT (see below)** · three practice rows→`/game` ✅ · six `Join table XXXX`→`/lobby/table` ✅ |
| **achievements** | 14 | `Back` ✅ · six category filters (`All`/`Skill`/`Streak`/`Milestone`/`Social`/`Collection`) ✅ · locked tiles labelled only `🃏🔒`, `💯🔒`, `⭐🔒`, `🏆🔒` — **icon-only labels, unreadable to AT** |
| **missions** | **1** | `Back` ✅ — the missions themselves are not interactive |
| **leaderboard** | **1** | `Back` ✅ — **`🪙 Chips` and `% Win Rate` read as tabs but expose no control** |
| **referral** | 3 | `Back` ✅ · `Share to WhatsApp 💬` (opens externally) · **one control with an empty label `""`** |
| **battle-pass** | 10 | `Back` ✅ · **ten controls labelled only `1 1 2 2 3 3 4 4 5 5`** — duplicated tier numbers, none does anything |
| **chip-store** | 2 | `Go back` ✅ · `Dismiss flash deal` ✅ |
| **stats** | 2 | `Back` ✅ · `Play Now`→`/game` ✅ |
| **results** (no hand) | 1 | `Back to home` ✅ |
| **spectate** | **0** | *"⚠️ No room code provided"* and **no control at all** — not even Back |
| **debug** | **0** | AUTO-DEBUG dump, no Back |

## SHOULD NOT BE HERE

| control | verdict | reason |
|---|---|---|
| `Delete account` (dead on web) | **FIX** | GDPR affordance that silently does nothing. `Alert.alert` no-ops on web |
| `Reset all progress` (dead on web) | **FIX** | same mechanism; reads as working |
| `Pot Per Board` (Settings 11) | **CUT** | edits the *local solo* config; MP stake is server-side. A tester reads it as "my stake" |
| `Complete Bonus %` (Settings 12) | **CUT** | same class — an economy internal exposed as a player setting |
| `Starting Chips` (Settings 10) | **FIX** | row label exposed as a button; tapping does nothing |
| Ten `Volume N percent` segments | **MERGE** | ten controls for one continuous value |
| Three `Reveal speed` options | **MERGE** | see defaults below |
| Battle-pass `1 1 2 2 3 3 4 4 5 5` | **FIX** | ten unlabelled, duplicated, inert controls on a 146-line screen |
| Achievement tiles `🃏🔒` etc. | **FIX** | icon-only accessible names |
| Referral control with label `""` | **FIX** | no accessible name at all |
| `/spectate` menu item | **CUT** | one tap from the side menu to a dead end with no control — already filed |
| `/debug` | **CUT** | dev dump on a public build |
| Lobby `Back` | **FIX** | see below |

### The lobby Back — a fix that missed two screens

[ScreenHeader.tsx:19-21](components/ScreenHeader.tsx:19) carries a **DEAD-END FIX from 2026-08-13**:
a cold load leaves the history stack empty, so a bare `router.back()` "silently" does nothing. There
is even a [BackControl.tsx](components/BackControl.tsx) component whose header comment describes
exactly this failure.

But **[lobby/index.tsx:249](app/lobby/index.tsx:249) and
[lobby/private.tsx:118](app/lobby/private.tsx:118) still call bare `router.back()`** and use neither
helper. The fix was applied to the shared component and two screens kept their own header. Measured:
lobby `Back` on a cold load = no effect. In flow (arriving from Play) it works — so this bites the
deep-linked or refreshed tester, which is precisely the tester who is already lost.

## Settings that should be defaults — Roye's 1,080 thesis, applied

| setting | why it is a decision we are outsourcing | proposed default |
|---|---|---|
| **Reveal speed** (3 options) | nobody knows what "cinematic" costs them until they have sat through it | pick one, remove the row |
| **Volume** (10 segments) | ten taps to express one number; the on/off switch already carries the real decision | keep the switch, drop the segments to 3 or none |
| **Card sort** (auto/pairs) | the label says *pairs*, the stored value says *user* — the option is not even nameable | default to `auto`, remove |
| **2-/4-colour suits** | genuine accessibility preference | **keep** |
| **Colorblind mode** | genuine accessibility preference | **keep** |
| **Pot Per Board / Starting Chips / Complete Bonus %** | economy internals, solo-only, contradicted by the server | **cut entirely** |

Removing reveal-speed, volume segments, card sort and the three economy rows takes Settings from
**42 controls to about 26** without removing a single thing a player needs.

## Dead · duplicated · contradictory

- **Dead (web):** `Reset all progress`, `Delete account` — both `Alert.alert`.
- **Dead (cold load):** lobby `Back`, lobby/private `Back`.
- **Inert:** the ten battle-pass tier buttons; the four Friends club controls (no action, no error).
- **Duplicated:** battle-pass tier numbers appear **twice each** (`1 1 2 2 3 3…`); ten volume
  segments for one value.
- **Contradictory:** `Card sort pairs` → stores `user`. `gameover.tsx:116` (already filed) says
  *"Not enough chips to continue"* above the real balance.

## Corrections — including to my own probe this run

1. **The ten volume buttons are NOT dead.** My first pass reported `NO VISIBLE EFFECT` for all ten.
   The cause was my own harness: control 19 toggled **Sound off**, and the segments only render when
   sound is on, so every later fresh load had nothing to tap. Re-tested in isolation:
   **`soundVolume 0.8 → 0.3`. They work.** Reported because the first number was mine and wrong.
2. **Privacy policy and Terms of use are NOT dead** — they call `Linking.openURL` and both URLs
   return **200**. My probe cannot see a new tab.
3. My first enumeration silently **deleted every letter `s`** from every label ("Vi ual  tyle") — a
   regex escaping level. Fixed before any of the above was recorded.
4. Index-based tapping **drifted**: the control list is not stable between loads, so the last ten
   Settings controls were never operated in the first run. Switched to label matching.

## Coverage — stated exactly

**Controls enumerated AND operated — 15 screens:** settings (42) · play · friends · cups · profile ·
shop · lobby · achievements · missions · leaderboard · referral · battle-pass · chip-store · stats ·
results.
**Enumerated, not individually operated — 1:** home (8 controls, from the walk).
**Rendered last sprint, controls confirmed zero — 2:** spectate, debug.
**UNTOUCHED — 9, named:** `game` · `multiplayer-game` · `lobby/table` · `lobby/private` ·
`gameover` · `rank` · `replay` · `heatmap` · `coaching` · `hand-history` · `theme-pick`.
*(`game` and `multiplayer-game` need a live hand per control, which is a sprint of its own.)*

**Nothing built, deleted or fixed.** No C5 option · MP prompt untouched · no keys · first-hand player
count untouched per Roye's ruling.

*(handoff: `vamos_handoffs` id 88)*
