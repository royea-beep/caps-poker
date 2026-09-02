# VAMOS CAPS SPLASH-AND-LANDING — 2026-09-02

One identity from the first frame to the last, and a front door for the strangers Roye is about to
point at the live web app. Branch `claude/vamos-caps-align-celebration-flppo0`. **Not merged, no
version bump.** Edited only `app.json` (splash key), `app/_layout.tsx` (JS splash), `assets/`, and
added `public/landing.html` + `docs/splash-landing/`.

## MAP (carried forward)
The splash was the *previous* identity: a declared background **maroon `#1C0508`**, a flat-green
`#08341A` image with a **sans-serif** yellow wordmark, and — the one that actually reaches web —
an in-app JS splash on **obsidian `#161922`** with a sans-serif wordmark and an old grey tagline.
The app itself is deep-green felt + a **gilded serif** masthead. Three grounds and two wordmarks in
the first second, before the luxury home. This aligns every splash surface to the home identity.

## Splash assets found — ALL of them (files + declared colours + what the web build uses)
The brief said *"there were three grounds; find all of them."* There were more than three. The full
inventory, and what each is:

| # | Where | Was | Role | Action |
|---|---|---|---|---|
| 1 | `app.json` › `expo.splash.image` = `assets/splash.png` | flat green `#08341A`, **sans-serif** gold "CAPS" | **native** OS splash image (iOS/Android) | **rebranded** → luxury |
| 2 | `assets/splash-icon.png` | flat green, sans-serif "CP / CAPS POKER" | second splash asset (monogram) | **rebranded** → luxury |
| 3 | `app.json` › `expo.splash.backgroundColor` | **`#1C0508` maroon** | the **letterbox bars** behind the native image | **changed** → `#071C12` (felt) |
| 4 | `app/_layout.tsx` `SplashScreen` container `#161922` + sans-serif "CAPS POKER" + "Place Your Cards. Own Every Board." | obsidian, sans-serif, old tagline | **the JS splash overlay — the web build's ACTUAL first frame** (web has no native OS splash; on native it's the frame right after the OS splash) | **rebranded** → LuxuryBackdrop felt + gilded serif lockup |
| 5 | `app.json` › `android.adaptiveIcon.backgroundColor` = `#1C0508` | maroon | Android **launcher-icon** background (a *fallback* — `android-icon-background.png` is set) | **left** — icon asset, not the splash; documented |
| 6 | `app.json` › `expo-notifications.color` = `#1C0508` | maroon | Android **notification accent** | **left** — not a launch surface; documented |
| 7 | `app/_layout.tsx` `RootWrapper` `#161922` (+ home container `#161922`, and ~10 other screens) | obsidian | the app's **established base ground** the home paints LuxuryBackdrop *over* | **left** — a global token used app-wide; changing it is out of scope and would touch home/game |

**Why the web-build answer is #4, not a PNG:** Expo web is `output:'single'` (an SPA). There is no
native OS splash on web — the first frame is the JS `SplashScreen` in `_layout.tsx`, shown ~1s while
the bundle boots. That is the surface strangers see, and it was still the old obsidian/sans-serif
identity. It is now the same felt + gilded serif the home paints. (`#161922` is kept as the base,
exactly as the home keeps it and paints `LuxuryBackdrop` on top — see #7.)

## Rebranded — what changed | image and background moved together
- **`assets/splash.png`** (native) — regenerated to the luxury identity: the LuxuryBackdrop felt
  (FELT_TOP `#0C2C1D` / MID `#071C12` / BOT `#03110B`) + the **same** radial vignette
  `radial-gradient(120% 78% at 50% 30%, rgba(26,70,44,.55)…rgba(0,0,0,.55))` and warm diagonal beam
  the home paints, with a **gilded Playfair serif** "CAPS" (gold gradient `#F2E0A6→#C9A84C→#9C7C33`),
  tracked "POKER", the four suits, and a thin gilt rule — the home masthead lockup. 464 KB (dithered;
  no gradient banding — checked by eye).
- **`assets/splash-icon.png`** — same ground, the "CP" monogram lockup. 462 KB.
- **`app.json` splash.backgroundColor `#1C0508` → `#071C12`.** This is the required *"image and the
  background must move together — change both or neither."* I measured the image's own edge pixels
  (left/right-mid `#071B12`, essentially FELT_MID `#071C12`) and set the bars to that token, so the
  letterbox is the **same continuous felt** as the art — green bars around green art, never the old
  maroon-around-green (or the worse green-on-black the brief warned about).
- **`app/_layout.tsx` JS splash** — added `<LuxuryBackdrop/>` behind the content (identical to how
  `index.tsx` composits the home) and gilded the wordmark: `CAPS` in the display serif
  (`SPLASH_DISPLAY_FONT` = Playfair on web / Georgia iOS / serif Android, mirroring index.tsx) +
  tracked `POKER` + suits + rule. Dropped the old grey "Place Your Cards…" line. The gold is the
  wordmark gold `#c9a84c` — **not** the winner cue `#FFD700`.

## Letterboxing — RENDERED, not assumed
`resizeMode:'contain'` + `backgroundColor:'#071C12'` reproduced exactly (an `object-fit:contain`
image on a background-coloured device rect), screenshot at real device pixels. Image aspect =
1284/2778 = **0.4622**.

| device | px | aspect | bars | file |
|---|---|---|---|---|
| iPhone 14 Pro Max | 1290×2796 | 0.4614 | **~3 px top/bottom** (nearly none) | `letterbox-14promax-1290x2796.png` |
| iPhone SE | 750×1334 | 0.5622 | **67 px each side** | `letterbox-se-750x1334.png` |
| Pixel 7 | 1080×2400 | 0.4500 | 32 px top/bottom | `letterbox-pixel7-1080x2400.png` |

What I saw: on the SE (the worst case, 67 px side bars) the bars are the same felt green as the image
edge and the gilded lockup sits centred — one continuous felt, no maroon, no black. On the 14 Pro Max
the image is all but edge-to-edge (3 px). `letterbox-report.json` carries the numbers.

## Splash → home transition — continuous, proven by measurement
The splash ground is built from the **same LuxuryBackdrop tokens** the home paints, and the bar colour
`#071C12` **is** the home's FELT_MID. Sampled the built-home ground (`docs/button-styles/
luxury-home-built-393.png`) against the new splash at four vertical bands:

| band | splash | home |
|---|---|---|
| 6 % (top glow) | `#1D3727` | `#21392A` |
| 30 % (wordmark) | `#102A1D` | `#112A1C` |
| 55 % (mid felt) | `#071A10` | `#071911` |
| 85 % (deep bottom) | `#030D08` | `#030D08` (identical) |

Same felt family, same vignette geometry, same bar = FELT_MID. OS splash → JS splash → home is one
green with no colour jump. (Proof PNG of the JS splash frame: `jssplash-393.png` / `jssplash-320.png`.)

**Watched it run (live, from the real bundle):** built the web export (`expo export -p web --clear`),
served it, and captured the boot at 400 ms — `live-jssplash-400ms.png` shows the actual bundle
rendering the gilded serif CAPS/POKER lockup over the felt weave (Playfair loaded), then handing off
to home by 600 ms with **zero page errors**. The static landing is copied into the export
(`web-splash-dist/landing.html` present) and serves live with CTA `/` and all four questions
(`live-landing-393.png`) — confirming the deploy path.

## Landing page — where it lives + why | phone-first
**`public/landing.html` — a self-contained static page.** Recommendation and reasoning:
- **Static, not an app route.** Social taps are cold first-touches; a ~9 KB static page paints
  instantly, where the app route would boot the ~3.8 MB SPA (JS splash, then home) before anything
  shows. First impression speed is the whole game for stranger conversion.
- **Survives a domain move.** It is one HTML file with **no domain baked in** — the only link out is a
  **root-relative `href="/"`** to the game. Copied to any origin (caps.ftable.co.il today, anywhere
  tomorrow) it works verbatim; a route is welded to the app deploy. `caps.ftable.co.il` being a
  subdomain of another project is exactly why this matters.
- **How it deploys / is linked.** Expo copies the root `public/` dir into the web export, so the file
  ships to `…/landing.html`. Roye points the social links at `caps.ftable.co.il/landing.html`; the
  "Play now" button sends them to `/` (the game) on the same origin. If the game ever lives at a
  different path, the single `href` is the one line to update (commented in the file).
- **Phone-first — proven** at 320 / 393 / 430: single column, `max-width:440`, no horizontal overflow
  at any width (`overflowX:false` all three), CTA ≥ 44 pt (84 px). Renders: `landing-320/393/430.png`.

## What it says (copy) | the four stranger questions answered
Masthead (gilded serif CAPS POKER + suits) → the app's canonical line **"Four cards on every board.
Every board plays at once. Win the most boards, win the hand."** → the ONE action **"Play now · Free ·
in your browser · no sign-up"** → "Tap and you're dealt in. Nothing to download, no account to make."
→ four question cards → legal line. The four stranger questions, answered on the page:
1. **What is this game?** — "CAPS is multi-board poker. You're dealt four cards on every board, and
   every board plays at the same time — take the most boards to win the hand."
2. **Is it free?** — "Yes — completely free to play. You start with virtual chips and there's nothing
   to buy to keep playing."
3. **Do I need to install anything?** — "No. It runs right here in your browser. One tap and you're in
   — no app store, no download."
4. **Is it gambling?** — "No. Virtual chips only — no real money goes in and none comes out. It's the
   game for its own sake. 18+."

## Legal line present | no signup wall
- **Legal line, verbatim the app's promise:** **"Free play · Virtual chips only · No real-money
  gambling · 18+"** — present and prominent (not hidden; the app shows it, so the front door shows it,
  or it reads evasive). Confirmed in `landing-loop.json`.
- **No signup wall — by construction.** The page has exactly **one** interactive control: the "Play
  now" link straight to the game. No form, no email capture, no gate, no analytics/JS. `unnamed
  controls = 0`; the one control is named. Nothing sits between the tap and the game.

## iOS — recommendation: DO NOT mention it (yet)
Leave iOS off the landing page. TestFlight is invite-only; a "coming soon to iPhone" that then sits
for months reads as *stalled*, and it invites the exact question the page is built to close ("do I
need to install anything?" — the honest answer today is *no, play in the browser*). The moment there
is a public App Store link (not a TestFlight invite), add a secondary line — never a second primary
CTA competing with "Play now." The page is authored so that addition is a one-block insert.

## Survives a domain move — how
No absolute URLs anywhere in the page. The CTA is root-relative (`/`), assets are the system font
stack + one Google-Fonts serif with a `Georgia, serif` fallback, all styling is inline. Nothing
references `caps.ftable.co.il`. Copy the file to any host and it is intact.

## PNGs committed — where | git show
All under `docs/splash-landing/`:
- Splash: `splash-full-1284x2778.png`, `splash-icon-1284x2778.png`
- Letterbox: `letterbox-14promax-1290x2796.png`, `letterbox-se-750x1334.png`, `letterbox-pixel7-1080x2400.png`, `letterbox-report.json`
- JS splash: `jssplash-393.png`, `jssplash-320.png`
- Landing: `landing-320.png`, `landing-393.png`, `landing-430.png`, `landing-loop.json`
- Source: `splash-source.html`, this doc

```
git show HEAD:assets/splash.png | wc -c          # the committed luxury splash
git show HEAD:app.json | grep -A2 '"splash"'     # backgroundColor #071C12
git show HEAD:app/_layout.tsx | grep -n LuxuryBackdrop   # JS splash gets the felt ground
git show HEAD:public/landing.html | head -30     # the static landing page
```

## Full loop
- **Widths:** landing at 320 / 393 / 430 — no horizontal overflow at any (`overflowX:false` ×3);
  splash letterboxing at 3 device aspects. Web engine = Chromium only (WebKit not in the container).
- **Contrast:** gilded gold `#c9a84c` on felt, and the mint CTA label `#08130F` on `#4FD6A8` — both
  well clear (dark-on-mint is a high ratio). Legal line dimmed but legible.
- **44 pt:** the CTA is 84 px tall (> 44 pt) at every width; it is the only tap target.
- **Unnamed controls:** 0. The one control carries both text and an `aria-label`.
- **Gold-CTA canary:** the CTA fill is **mint `rgb(79,214,168)`** with a **brass `rgb(201,168,76)`**
  edge and a **dark `rgb(8,19,15)`** label — the ChipButton identity, **not** a gold button. Passes.
- **Canary first:** the gold-semantics check ran as the guard before eyeballing.
- **Typecheck:** `tsc --noEmit` = **0 errors**. **Tests:** full jest suite **2649/2649 passed** (41
  suites, exit 0) — the `_layout.tsx` splash change broke nothing.

## Not merged, no bump | production unchanged
Branch only; `app.json` version `2.7.0` and `ios.buildNumber` "513" untouched. No economy / reset /
security / flag / home / game / results value touched. `KILL_Board` still true. The only code change
is the JS splash's ground + wordmark; the only config change is one splash `backgroundColor`; the only
new runtime file is a static page that links to `/`.
