# VAMOS CAPS GO-LIVE-LANDING — 2026-09-02

Merged the approved splash+landing to `main` and verified it live, then investigated the Hebrew gap
on the game/results screens — and found (by rendering, not assuming) that enabling it now would ship a
half-translated results flow, so it is reported with an exact scope rather than forced.

## MAP (carried forward)
h155: Roye approved the bilingual landing with real screenshots. This pass ships it and closes the loop
on the Hebrew game screens I flagged in h153–h155.

## Merged | confirmed on origin/main
- **Merged:** `2d9ca2d` — a `--no-ff` merge of `claude/vamos-caps-align-celebration-flppo0` (splash
  rebrand + JS splash + bilingual landing + the TWO-CLEANUPS/onboarding docs) into `main`.
- **Confirmed on origin/main by the remote ref:** `git ls-remote origin main` →
  `2d9ca2d8505dbbf1c561234761b7ece9539b6225` (not a local line).

## LIVE fetch (curl against the real deployed URL — Vercel rebuilt within ~40s)
| URL | result |
|---|---|
| `caps.ftable.co.il/landing.html` (EN) | **HTTP 200, 20,734 bytes** — byte-identical to the local file; markers `__setLang`, `More than one way to win`, `data-lang="en"` present |
| `?lang=he` | served HTML is identical (the query drives the client); the **pre-paint** script (`URLSearchParams` / `navigator.language` / `caps_lang`) is in the deployed HTML, and Hebrew-on-load with no flash is proven on that byte-identical HTML in `bilingual-proof.json` |
| `/shots/game-boards.webp` | **HTTP 200, 53,238 bytes, image/webp** (the eager hero) |
| `/shots/game-reveal.webp` | **HTTP 200, 40,038 bytes, image/webp** (lazy) |
| `/privacy.html` | **HTTP 200, 3,696 bytes** — resolves (not a 404) |
| `/terms.html` | **HTTP 200, 2,863 bytes** — resolves (not a 404) |
| `/` (app SPA) | **HTTP 200** |

The footer links resolve because `scripts/fix-web-html.js` copies root `privacy.html`/`terms.html` into
the build (steps 5/5b) and `vercel.json` rewrites `/privacy.html`→`/privacy.html`; `public/` (landing +
shots) is copied by Expo. The stale `web-dist/` I removed earlier is regenerated fresh each deploy, so
its deletion was harmless.

## Live weight + first paint | instant preserved
Same-origin: HTML **20.7 KB** + eager hero **53 KB** = **~74 KB to first meaningful paint**; the
40 KB reveal is `loading="lazy"`. ~74 KB is ~0.05 s on 4G — the static-file instant-paint property
survived the deploy, matching the local `shots-proof.json`.

## Web first frame is the luxury splash
The deployed bundle is built from the merged source; the JS splash (`app/_layout.tsx` +
`LuxuryBackdrop`) renders the gilded serif CAPS/POKER lockup over the felt — proven earlier from a
local export of this exact code (`live-jssplash-400ms.png`). **Honest limit:** the container's browser
cannot reach the live site (`ERR_PROXY_CONNECTION_FAILED` — the agent proxy blocks live page loads all
sprint), so the live *in-browser* frame was not re-captured from here; the curl checks above plus the
byte-identical local render are the evidence.

## The Hebrew gap — investigated by rendering, reported not forced
**Mechanism (verified):** `utils/i18n.ts` `getLanguage()` was hard-forced to `'en'` (the 2026-06-17
"English hand labels" change). That was over-broad: hand-rank names come from `HAND_RANK_NAMES`
**constants** in `utils/handEvaluator.ts` (no i18n), so they are English regardless of `getLanguage()`.
So enabling Hebrew is one line — but whether it is *safe* is an empirical question.

**Watched it run.** I flipped `getLanguage()` to honour `caps_language`, built a fresh web export, and
walked it at **320** in `he-IL` (with an `en-US` pre-change control):

| screen | EN control | HE | overflow @320 |
|---|---|---|---|
| home | 0% Hebrew | **75%** — coherent | none |
| game (place) | 0% | **72%** — coherent (`בורד 1/2/3`, `סדר 12 קלפים`, `היד שלך`, `אישור/ביטול`) | none |
| reveal / results | 0% | **26%** — **half-translated**: `הפסדת` sits beside hardcoded `Board 1`, `BOT 1`, `COMMUNITY`, `So close!`, `3 boards` | none |

The home and game-place translate cleanly and fit. **The reveal/results flow does not** — its chrome is
hardcoded English across multiple tightest-layout components:
`components/Board.tsx` (~33 strings), `components/EquityBar.tsx` (~13),
`components/BoardResultCard.tsx` (~18), `app/results.tsx` (~60) — ~120+ literals, only a few `t()` calls.
Enabling `getLanguage()` **without** wiring those to `t()` first ships a jarring EN/HE mix on the app's
tightest screen on the next build. Per the brief's "report anything that would need a layout change
rather than doing it," I **reverted the enablement** (back to forced-`en`) and scoped the fix.

**What I DID keep — the board-term standardisation (safe, brief item 2):** the game board is now
`בורד/בורדים` everywhere it is user-facing (`utils/i18n.ts` `boardLabel` `לוח`→`בורד`, `botRowSub`
`לוחות`→`בורדים`; `app/game.tsx` tip `הלוח`→`הבורד`). **Chosen `בורד/בורדים`** because it is the term
the onboarding, the home teaching sentence, `boardsPlayers`, and the just-shipped landing all use — a
player learns the game with it. `לוח` is kept ONLY for the leaderboard terms (`לוח מנצחים`, `לוח תוצאות`)
— a different concept, not the game board. These strings are latent (getLanguage is forced-`en`) but
correct the day the switch flips.

**Recommended follow-up (one focused pass, before the next build enables it):** un-force `getLanguage()`
(respect `caps_language`; hand labels stay English via constants) **together with** wiring
Board.tsx / EquityBar.tsx / BoardResultCard.tsx / results.tsx and the home mode labels + legal line to
`t()` (the Translations table already has `youWin/youLose/tie/tapToReveal/dealMeIn/netChips/complete`…),
then fit-verify Hebrew at **320 across 2P/3P/4P** (4/3/2 boards). Hebrew here runs *shorter* than English
for most of these labels (`COMMUNITY`→`קהילה`, `So close!`→`כמעט!`), so overflow risk is low — but it
must be measured, not assumed.

## Home mode labels + legal line in Hebrew
Not changed this pass: with `getLanguage()` correctly reverted to forced-`en`, any `isHE` Hebrew on the
home is dead code, so wiring the mode labels/legal now would ship nothing and add churn. They are part
of the same follow-up (the home is already 75% bilingual-ready via `isHE`; only `Play Online`,
`Practice vs bots`, the legal line, and the rotating tagline are hardcoded English).

## Hebrew at 320, all board counts | anything needing a layout change
Verified 3-player (3 boards) at 320: **no overflow**, `בורד` labels fit, cards/arc unchanged. 2P (4
boards) and 4P (2 boards) were **not** separately walked because the enablement is reverted (the app
ships all-English, so there is nothing new to fit-test this build); they belong to the follow-up's
fit-verification. **One layout finding to carry into that pass:** the per-board `מיקום אוטומטי`
(Auto-Place) button truncates to `מיקום אוטו…` at 320, and the hand-level `Auto-Place ALL` button is
still English — both to resolve when the reveal/results wiring lands (report, not fix — the button width
is load-bearing).

## Cue / card sizes / 83px arc / tie tally untouched
Confirmed. The only code changes are string constants (`בורד`) and the reverted `getLanguage()` (now
identical behaviour to before). No winner cue, card geometry, arc, tally, or layout value touched. The
EN control render at 320 is byte-for-byte the current shipped behaviour.

## New Hebrew screenshots | landing
**Not re-shot** — the game/results flow does not render coherent Hebrew yet (reveal 26%), so a "Hebrew"
game screenshot would still be a half-English mix, i.e. not honest. The landing keeps the real screens
with their translated captions (h155). Re-shooting is the last step of the enablement follow-up, once
the flow renders Hebrew. This is the same truth rule that refused a fabricated Hebrew screenshot in h155.

## git show
```
git show HEAD:utils/i18n.ts | grep -n "בורד\|getLanguage\|forced to 'en'"
git show HEAD:app/game.tsx | grep -n "הבורד הזה"
git show --stat HEAD
```

## Full loop | canary first | clip sweep with control
- **Control first:** the `en-US` 320 walk (0% Hebrew, no overflow) is the pre-change control
  (`he-check/en-game-320.png`); the `he-IL` renders are the change (`he-check/he-{home,game,reveal}-320.png`).
- **Clip sweep:** no horizontal overflow at 320 in either language on any walked screen
  (`ox:false` throughout); the reveal finding is a translation-coverage gap, not a clip.
- **Landing loop (unchanged, still green):** one mint CTA (canary), 84px, no overflow 320/393/430,
  contrast AA/AAA — carried from h155; the landing was not touched this pass.
- Tests: `i18n` + `handNames` suites green (39/39) after the board-term change.

## Not bumped, no build
Version 2.7.0 / build 513 untouched; no `expo`/EAS build dispatched. The Hebrew board-term strings ride
the next build with the enablement follow-up. Economy / reset / security / nav / flags untouched.
