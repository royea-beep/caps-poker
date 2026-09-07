# F, RESPONSIVE — 2026-09-07

Roye chose option B: full F where POKER is legible, suits + CAPS where it is not. Built, measured,
and **not swapped into `assets/`**.

**This is not the fourth simplification he rejected.** Those changed F everywhere. Nothing changes
at any size where F is legible.

Two things need his eye, both reported rather than decided:

1. **At 60px the four suits are four gold dots, not four suits.** He chose to keep them. He did not
   choose to keep them illegible, so it is on the sheet with the picture.
2. **Shipping a responsive lockup needs more than swapping one file** — `app.json` carries a single
   `icon` path. The routes are set out at the end.

---

## §1 · The threshold — 128px, measured

`docs/f-icon/threshold.mjs` sweeps **every tile size from 40 to 200**, downscaling the 1024 master
exactly the way iOS and Expo do.

**The rule.** POKER's band is divided into its five letter cells across the word's own measured ink
extent, and the question is whether every cell still holds ink. A letter that has dissolved leaves
its cell empty however the survivors fragment. The threshold is the smallest size at which all five
hold at least 2 ink pixels **and keep holding at every larger size** — a size that resolves while
its neighbours do not is resampling luck, not a boundary.

**Threshold: 128px. POKER renders at 7.71px there.** The first size that resolves all five letters
at all is 75px, but it does not hold, which is the whole reason the rule requires persistence.

⚠️ **The rule I wrote first was wrong and the sweep caught it.** I counted connected ink regions and
expected five — P, O, K, E, R — falling as letters vanish. The data says a serif **fragments** at
these sizes: twelve regions at 180, eleven at 144, four at 96. A bowl separates from a stem, a leg
from its serif, and antialiasing strews single stray pixels that each count as a region. That rule
would have passed 64px and failed 96px. Per-letter occupancy is immune to fragmentation; the
component count is noise in both directions.

### Which variant ships where

| variant | sizes |
|---|---|
| **full** | 144 · 152 · 167 · 180 · 192 · 512 · 1024 |
| **compact** | 20 · 29 · 40 · 48 · 58 · 60 · 72 · 76 · 80 · 87 · 96 · 120 |
| **compact** | Android adaptive foreground, and the 64px favicon |

The adaptive foreground is compact **because of a measurement, not a preference**. Its canvas is
432px, far above the threshold — but the canvas is not the mark. Only the central 288px circle
survives the mask, the block is fitted inside it, and a launcher draws the whole thing at roughly
48–108dp. The block's own rendered size works out at **73.8px at 108dp**, below 128.

## §2 · The rebalance — and it is smaller than it sounds

⚠️ **My first attempt did nothing, and the build caught it: compact came out at exactly the same
font size as full, 0% growth.** The reason is a fact I had backwards. **POKER is not what makes the
block wide — CAPS is.** Four Playfair capitals at 308px span about 819px; POKER at 61.7px with its
0.30em letterspacing spans roughly a third of that. Dropping POKER frees only **height**, width
still binds in the same place, and a naive re-fit changes nothing at all.

So compact is grown until its bounding box has the **same half-diagonal** as the full block. That
keeps the mark's footprint radius constant, so both variants sit inside the same circle — which is
also exactly what the Android mask and every circular profile picture care about, and it is the same
diagonal reasoning the safe-zone fit already uses.

| | box at probe 100 | growth | half-diagonal share of the tile |
|---|---|---|---|
| full | 265.7 × 168.0 | — | 47.3% |
| compact | 265.7 × 138.0 | **×1.05** | 47.3% |

**That is 5%, not a transformation, and pretending otherwise would be overselling it.** POKER's row
is small next to CAPS, so there is only so much space to reclaim. CAPS and the suits do take it
rather than the tile gaining empty felt. Nothing else moved: the ratio between the suits and CAPS,
the gap, the gilding stops and the felt are untouched.

## §3 · Ink per layer, and the suits

Measured on the downscaled tile, warm decile against the local dark quartile — the same test as the
previous sprint, so the numbers are comparable. Bands are re-derived per variant, because compact
has two rows at different heights and reusing full's fractions would measure felt and call it a
layer.

| tile | full: suits / CAPS / POKER | compact: suits / CAPS |
|---|---|---|
| 1024 | 2,959 / 43,202 / 2,990 px | 3,258 / 48,038 px |
| 240 | 157 / 2,144 / 165 px | 188 / 2,461 px |
| 120 | 39 / 461 / 36 px | 47 / 524 px |
| **60** | 10 / 78 / **1** px | **13** / **88** px |

Compact at 60 is measurably better than full at 60: CAPS goes from 78 ink pixels to 88 and from
2.56:1 to 3.01:1 local contrast, and there is no broken row beneath it. **I looked at both at 7×
magnification** and the difference is visible, not just arithmetic.

### ⚠️ The suits at 60px are not suits

On the compact 60px tile they are **13 ink pixels across four glyphs** — 3 / 4 / 2 / 4 — rendering
at about 4px each. That is up from 10 in the full lockup, and it is still two to four pixels per
suit. **They are four gold dots.** They read as an ornamental row, which is not ugly and is
arguably fine, but nobody will identify a spade. At 120 they resolve properly and at 240 they are
unambiguous.

**They are not dropped.** Roye kept them; this is his call exactly as POKER was.

## §4 · Sizes, mask and the gold guard

* iOS 20–1024, Android mipmaps 48–512, adaptive foreground / background / monochrome, favicon 64 —
  **both variants at every size**, plus a `responsive/` set carrying whichever variant the threshold
  chose.
* **No font size is hardcoded.** Each tile renders a probe, reads its real bounding box and solves
  for the fit. Width binds for the full block and — because compact is nearly square — the flip to
  height-binding is exactly why nothing here may be a fixed number.
* **Nothing is clipped by the mask.** Worst corner reaches **139.7px of the 144px safe radius**,
  3.0% clearance, fits. The fit solves for the measured diagonal, not the width.
* **No `#FFD700` anywhere.** All **80** regenerated files — both variants, every size, the responsive
  set, the adaptive layers, the favicon — re-read pixel by pixel after rendering: **0 hits.** The
  guard is in the build script.

## §5 · The sheets

* `docs/f-icon/F-RESPONSIVE-SHEET.png` (1600×4333) — the threshold sweep as a chart, both variants
  at 1024 / 240 / 120 / 60 each also circle-masked, the responsive set as it would ship, the ink
  tables, and the 7× magnifications.
* `docs/f-icon/F-FIRST-SECOND.png` — icon → splash → home. **The top row is the compact lockup,
  because that is the variant a phone home screen actually receives.**

## §6 · Social

All four profile assets came out **FULL**, and that was decided by measuring each rendered file
rather than by remembering what any platform does — POKER's five letter cells were counted on a
full-lockup render at each size:

| file | size | variant | POKER weakest cell | outside the circle | clearance |
|---|---|---|---|---|---|
| `caps-profile-1024.png` | 1024 | full | 439 px | **0** | 28.9% |
| `caps-profile-facebook-360.png` | 360 | full | 60 px | **0** | 29.1% |
| `caps-profile-instagram-320.png` | 320 | full | 42 px | **0** | 29.0% |
| `caps-profile-tiktok-200.png` | 200 | full | 18 px | **0** | 29.7% |

⚠️ **A platform never shows a profile picture larger than it was uploaded, and I cannot verify any
platform's actual display size from here.** Rather than assert one, `docs/f-icon/profile-shrink.mjs`
measures the verifiable thing: each shipped file progressively downscaled until POKER loses a
letter.

| file | holds POKER down to | gone by |
|---|---|---|
| 1024 | 100px display | 96px |
| facebook-360 | 100px | 96px |
| instagram-320 | 84px | 80px |
| tiktok-200 | 100px | 96px |

So these carry the word wherever a profile is rendered at roughly 100px or more. In a comment-sized
avatar it will not, and that is a fact about avatars rather than something an upload can fix.

**The cover is kept**, as instructed — it is large and the full lockup belongs there. The optional
Playfair versions sit beside it as `OPTIONAL-cover-*.png`, replacing nothing.

---

## §7 · Not shipped, and what shipping would actually take

* **`assets/icon.png` is untouched.** `git status` on `assets/` is empty. So is `app.json`.
* No splash, no winner cue, no card size, no 83px arc, no economy value, no flag.
* **No Edge Function deployed** — `verify_jwt` unchanged everywhere.
* `docs/icon-history/` now holds **eight** icons: the six the app has ever shipped, plus F full and
  F compact as `06-` and `07-`.

### ⚠️ A responsive lockup is not a one-file swap, and this is worth knowing before he approves

`app.json` carries a single `icon: './assets/icon.png'`, there is no `ios.icon`, and there are no
native `ios/` or `android/` directories — this is a managed/prebuild project, so the per-size iOS
icons are derived from that one master. Android is simpler: `adaptiveIcon.foregroundImage` is one
image and launchers draw it small, so Android takes the compact foreground and needs nothing extra.

Three routes, and the choice is Roye's:

1. **Ship compact as the single master.** Works today, no tooling. Every device size gets compact,
   and so does the 1024 App Store listing — so the full lockup would live only on the splash, the
   home screen and the cover. Simplest, and loses full F in the store.
2. **Ship full as the single master.** Also works today, and is the status quo of the last sprint —
   which is exactly the 60px tile he rejected.
3. **An Expo config plugin that writes a proper iOS asset catalogue**, taking full at 144 and above
   and compact below. This is the only route that delivers option B as chosen on iOS. It is a small
   plugin, and it is a code change rather than an asset change.

The `responsive/` folder is built and correct either way; what varies is only how it reaches the
build.

### Getting the pictures to Downloads (cmd.exe, from `C:\Projects\POKER\Caps`)

```
git fetch origin claude/vamos-caps-align-celebration-flppo0
set B=origin/claude/vamos-caps-align-celebration-flppo0
git show %B%:docs/f-icon/F-RESPONSIVE-SHEET.png > %USERPROFILE%\Downloads\F-RESPONSIVE-SHEET.png
git show %B%:docs/f-icon/F-FIRST-SECOND.png > %USERPROFILE%\Downloads\F-FIRST-SECOND.png
git show %B%:docs/f-icon/built/full/icon-1024.png > %USERPROFILE%\Downloads\F-full-1024.png
git show %B%:docs/f-icon/built/compact/icon-1024.png > %USERPROFILE%\Downloads\F-compact-1024.png
git show %B%:docs/f-icon/built/compact/icon-60.png > %USERPROFILE%\Downloads\F-compact-60.png
git show %B%:docs/f-icon/built/responsive/icon-180.png > %USERPROFILE%\Downloads\F-responsive-180.png
git show %B%:docs/f-icon/built/android-icon-foreground.png > %USERPROFILE%\Downloads\F-adaptive-foreground.png
git show %B%:docs/f-icon/social/caps-profile-1024.png > %USERPROFILE%\Downloads\F-profile-1024.png
```
