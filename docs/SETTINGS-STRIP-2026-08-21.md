# CAPS — Settings stripped, 42 → 23 (2026-08-21)

Roye: *"להעיף את כל מה שלא צריך שם. תשאיר רק מה ששחקן ייכנס וימצא שזה חיוני לו והגיוני גם."*

---

## ⚠️ The correction, first — it was relayed to Roye as an emergency

Handoff 88 said **both** destructive controls were dead on web, and called a silently-dead GDPR
delete *"the most serious single item in this report."* **That was wrong.**

- [settings.tsx:971](app/settings.tsx:971) — `handleDeleteAccount` **branches on
  `Platform.OS === 'web'`** and uses `window.confirm`, with a **double** confirmation whose copy
  already names what is lost. **It works.** My probe reported "no effect" because **Playwright
  auto-dismisses native dialogs** when no `page.on('dialog')` handler is registered — the same
  self-inflicted false negative as the ten "dead" volume buttons.
- [settings.tsx:923](app/settings.tsx:923) — `handleReset` had **zero** `Platform.OS` branches.
  `Alert.alert` only. **That** one was genuinely dead on web.

**One dead control, not two. No GDPR emergency.**

## But the real defect was one layer deeper, and it is worse than "dead"

Proven live on a `test-` device with a dialog handler attached:

| run | result |
|---|---|
| **Cancel** | 1 dialog, nothing changes — correct |
| **Accept** | 2 dialogs, then `account_deletion_failed` is tracked **and the data is still there** |

**Why:** [settings.tsx:1006](app/settings.tsx:1006) documents it — `delete_user_account` was
**deliberately revoked** because a NULL-passthrough let any holder of the shipped anon key delete
another player's account across 22 tables. The control is **kept on purpose** (Apple requires an
in-app deletion path) and was given an honest message: *"temporarily disabled while we finish a
security fix. Nothing has been deleted. Email us."*

**That message went through `Alert.alert` — a no-op on web.** So a web player confirmed **twice** and
got **silence**. The failure was deliberate and documented; being unable to *say* so was not.

**Fixed:** that message and the catch-block error now branch to `window.alert` on web — the same
one-line shape as Reset. **The revoked RPC is not touched**; that is the Edge Function project.

## What went — verdict applied to all 42

**Removed (19):**

| control | why it fails Roye's test |
|---|---|
| Reveal Speed ×3 | three options for a duration nobody can evaluate before sitting through it |
| Card Sort ×2 | label said *pairs*, stored value was `user` — not even nameable |
| Volume segments ×10 | ten controls for one continuous value; the on/off switch carries the decision |
| Starting Chips | a row **label** rendered as a button; tapping did nothing |
| Pot Per Board | edits the **local solo** config; the MP stake comes from the server |
| Complete Bonus % | an economy internal dressed as a player setting |

**Also removed, applying his test rather than stopping at the six named — the whole ADVANCED block**
(toggle + Arrangement Time, Board Reveal Duration, Card Flip Speed, Complete Bonus Display, Bot Speed
Min/Max). Six raw-tuning rows behind a **plain collapsible, not the 7-tap gate**, whose own copy read
*"Raw gameplay tuning — the defaults are right for normal play"* — which is the argument for removing
it. Two of them edited the **same values** as the reveal-speed row, so keeping them would have moved
that row out of sight rather than removed it.

**Kept, and why each passes:** Go back · Visual style ×2 (the one cosmetic choice that is visible and
instant) · Profile · Player count ×3 (it changes the game) · suits ×2 and colourblind ×2
(**accessibility, not taste**) · Sound / Vibration / Ambient / Push ×4 · Report a bug · Show Tutorial
Again · Version (the 7-tap gate, untouched) · Reset · Your rank · Privacy · Terms · Delete.

**Nothing a player needs was removed:** every removal is an economy internal, a raw tuning value, a
duplicate path to a value, or a control whose own label contradicted what it stored.

## Orphaned values

Removing a control must not strand what it wrote.
[store/cardThemeMigration.ts](store/cardThemeMigration.ts) extended, **store version 1 → 2**,
normalising `revealSpeed`, `boardRevealDuration`, `turnRevealDelay` and `handSortMethod` to the
shipped defaults — **imported from `constants/gameConfig`, never retyped** (Iron Rule #3). A player
who had chosen *cinematic* or *pairs* lands on the chosen-by-us value instead of keeping a setting
they can no longer reach.

## Verified the way it was found

[tests/enumerate-controls.mjs](tests/enumerate-controls.mjs) re-run, **both engines**, every
remaining control operated from a fresh load: **42 → 23 interactive elements**, identical on WebKit
and Chromium.

Harness hardened against the two traps that produced my own false readings:

1. **State is reset before every control** — previously the sound toggle hid the ten volume segments
   from every later load, producing ten false "dead" verdicts.
2. **A `page.on('dialog')` handler is registered** — previously native confirms were silently
   auto-dismissed, which is exactly why Delete read as dead.

With the handler attached, both destructive controls report their dialogs on both engines:

- Reset → *"Reset All Progress — This will delete all chips, level, history and streak. Are you sure?"*
- Delete → *"Are you sure you want to delete your account? All data will be permanently erased."*

## The two lobby backs

[lobby/index.tsx:249](app/lobby/index.tsx:249) and
[lobby/private.tsx:118](app/lobby/private.tsx:118) now call `safeBack()` — already exported from
[BackControl.tsx:39](components/BackControl.tsx:39) for exactly this. **Cold-load verified, both
engines, both routes: 4 of 4 PASS.**

**Cleanup:** 17 chip_transactions, 9 leaderboard rows, 4 bindings, 20 rate counters, 8 streaks, 8
daily_rewards, 84 analytics events, plus the seeded `test-del-probe`. `purchases` 0, 0 test devices,
the 2 real bindings untouched.

**Nothing else changed:** DEVELOPER and the 7-tap gate untouched · battle-pass, friends, referral,
achievements, leaderboard untouched · first-hand player count unchanged · no C5 option, stake tiers,
stakes UI or tournaments · MP prompt untouched · no keys · the revoked `delete_user_account` grant
**not** restored.

*(handoff: `vamos_handoffs` id 89)*
