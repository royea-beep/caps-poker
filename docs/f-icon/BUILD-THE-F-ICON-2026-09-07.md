# BUILD THE F ICON — 2026-09-07

Roye picked F. It is built, in the app's real typeface, at every size iOS and Android ask for.
**It is not swapped into `assets/`.** He approves from pixels; that is the only route that has ever
worked.

**One thing needs his decision before it ships, and I am reporting it rather than fixing it:
at 60px POKER is one ink pixel and the four suits are ten.** He rejected three simplifications
already, so this is his call.

---

## §1 · The icon

`tools/icon/build-f-icon.mjs` → `docs/f-icon/built/` — 23 files.

Three stacked elements, in the order chosen: `♠ ♥ ♦ ♣` in gold across the top, **CAPS** large and
gilded, **POKER** letterspaced beneath, on the green felt gradient. No simplification, no reflow,
nothing dropped.

### The typeface — and the honest part

**Playfair Display**, from a real font file pinned in the repo at
`tools/icon/fonts/PlayfairDisplay.ttf` (the upstream `google/fonts` variable roman, SIL OFL, licence
committed beside it). It is embedded in the render as a `data:` URI so the build cannot silently
fall back to a system serif.

Why that font and not another: the masthead constant is
`Platform.select({ web: 'Playfair Display, Georgia, serif', ios: 'Georgia', android: 'serif' })`.
Playfair is the face the design intends and the one `caps.ftable.co.il` actually renders.

⚠️ **But the app does not render it on a phone.** There are zero font files in `assets/` and
`expo-font` is never imported, so on device the masthead is Georgia (iOS) or the system serif
(Android). The icon is a baked PNG and is therefore identical on every platform — but until a font
batch bundles Playfair, **the icon will be very slightly more refined than the type on the home
screen next to it.** That is a real difference and it is not papered over. Bundling Playfair is a
separate change and was not made here.

### Where the drawing comes from

Not a new composition. `tools/brand-assets.mjs`'s `wordmark(px)` **is already F** — the same suits
row, the same gilded CAPS, the same letterspaced POKER, at the same proportions — and it is what
paints the splash and the cover images. This icon reuses those proportions exactly, so
**icon → splash → home is one identity by construction, not by eye.** See `F-FIRST-SECOND.png`.

### Gold

`#c9a84c` (the theme's `colors.gold`), with `#e8d9a0` and `#8d6f24` as the two stops that gild the
CAPS fill — the same three `brand-assets.mjs` already uses on the cover.

**`#FFD700` appears nowhere.** That value is the winner cue (`constants/gameConfig.ts:111`) and must
not appear in brand furniture. All 23 generated files were re-read pixel by pixel after rendering:
**0 hits.** The guard is in the build script, not a claim in this document.

### Sizes

| platform | sizes |
|---|---|
| iOS | 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024 |
| Android mipmaps | 48, 72, 96, 144, 192, and 512 for the Play listing |
| Adaptive | foreground, background and monochrome on the 432px canvas |
| Web | favicon 64 |

⚠️ **No font size is hardcoded.** Each tile renders the block at a probe size, reads its real
bounding box in the page, and solves for the scale that hits the target share. This matters:
POKER's 0.30em letterspacing makes the block **wider than it is tall**, so width is the binding
constraint at every one of the 19 sizes and a guessed font-size would have clipped it.

### Nothing is clipped by the adaptive mask

Only the central 72 of the adaptive icon's 108dp survives every OEM shape — a **288px circle on the
432px canvas**. F is wide, so fitting its *width* to that circle would still push its corners
outside. The fit solves for the block's **diagonal**, computed from its measured aspect ratio.

Worst corner reaches **139.7px of the 144px safe radius** — 3.0% clearance. **Fits: YES.**

---

## §2 · Proved at the size that decides

`docs/f-icon/F-ICON-SHEET.png` (1600×2888) — 1024 / 240 / 120 / 60, each also masked to a circle,
with a 7× magnification of the 60px tile and the numbers beside the pictures.

⚠️ **The tile that matters is the downscaled one.** `build-f-icon.mjs` lays F out fresh at every
size, but iOS and Expo do not do that — they resample the 1024 master down. So the 60px tile a phone
shows is a *downscale*, and a 3.6px serif crushed out of 308px type is not the same as one drawn at
60. Both are measured; the sheet uses the downscale, because that is the truth.

### POKER and the suits at 60px — they are not legible, and here is the arithmetic

F's own proportions put POKER at 0.20 of the CAPS size and the suits at 0.22. On a 60px tile CAPS
renders at 18.1px, which is fine. That makes **POKER 3.6px and the suits 4.0px.** A serif face has
no stem left below about 5px.

Each layer measured separately on the shipped tile — ink is the warm decile, ground the local dark
quartile, contrast is WCAG:

| tile | suits ink | CAPS ink | POKER ink |
|---|---|---|---|
| 1024 | 2,959 px | 43,202 px | 2,990 px |
| 240 | 157 px | 2,144 px | 165 px |
| 120 | 39 px | 461 px | 36 px |
| **60** | **10 px** | 78 px | **1 px** |

**POKER's band retains one ink pixel of the 2,990 it has at 1024.** It is not hard to read; it is
gone. The four suits are ten pixels between them — four indistinct blobs, spade indistinguishable
from club. CAPS survives: 78 ink pixels at 2.56:1 local contrast, dim but shaped.

**The failure is specific to 60.** At 120 POKER is readable and the suits separate. This is not a
rendering problem and a different downscaler will not fix it — it is what happens when three layers
are stacked in a square 60 pixels wide.

**Not simplified.** Roye rejected three refinements; the fix here would have been a fourth one he
never asked for. Reported with the picture, decision left to him. If he wants it addressed, the
options are: drop POKER and the suits below some size (the platforms let you ship a distinct small
asset), enlarge POKER relative to CAPS, or accept that at 60px the icon reads as "CAPS" alone —
which is arguably fine, since that is the product's name.

### The instrument's own numbers, and a correction I had to make to myself

Measured with the maths copied verbatim from `tools/thirty-directions/icon-legibility.mjs`:

| icon | subject share | contrast | crispness |
|---|---|---|---|
| **F** | 5.3% | 1.90:1 | 0.043 |
| CP | 99% (flagged) | 1.68:1 | 0.116 |
| C-GREEN | 10.1% | 1.91:1 | 0.072 |
| C-BLACK | 13.8% | 4.25:1 | 0.156 |
| C1 (shipped) | 41.4% | 18.96:1 | 0.470 |

⚠️ **I quoted F's 1.90:1 as if it were the contrast of the ink against the felt. It is not, and I
was wrong to.** The instrument takes the ground to be the median of the four corner pixels. F's
ground is a vertical gradient whose bottom corners are `#010805`, nearly black, while the type sits
on lit felt in the middle. **The real pairing, `#c9a84c` on `#003115`, is 6.34:1.** That is why the
per-layer table above exists and is the honest measurement.

Subject share and crispness are also structurally unkind to a wordmark: the instrument rewards one
big solid block, and C1 *is* one big solid block. Comparing 5.3% against 41.4% across those two
shapes is not a fair fight and should not be read as one. **What survives the correction, and still
decides, is the ink count.**

### The first second

`docs/f-icon/F-FIRST-SECOND.png` — F, C1 and C-BLACK each shown as icon → splash → home, with the
same current splash and home in every row. F is the only one that is the same drawing as the screen
it opens into.

---

## §3 · Social images rebuilt from F

`docs/f-icon/social/` — the same four profile sizes, with F on them instead of the C1 card:

| file | size | mark outside the circle | clearance |
|---|---|---|---|
| `caps-profile-1024.png` | 1024 | **0** | 28.9% of the radius |
| `caps-profile-facebook-360.png` | 360 | **0** | 29.1% |
| `caps-profile-instagram-320.png` | 320 | **0** | 29.0% |
| `caps-profile-tiktok-200.png` | 200 | **0** | 29.7% |

Every platform serves a profile picture as a circle. F is a wide block, so fitting its width would
still push its corners out; the fit solves for the measured diagonal. The proof then **re-reads each
rendered PNG and counts mark pixels outside the inscribed circle** — zero at every size, with more
clearance than C1 had (24%).

⚠️ **Written to `docs/f-icon/social/`, not over `docs/social/`.** F is not approved yet, and
overwriting art in place is exactly the habit that lost the C icon for five months. When Roye
approves, these copy across in one move.

**The cover is kept**, as instructed — the gilded wordmark on felt still matches. One note: the
shipped cover is set in Georgia, the substitute serif, because that is what `brand-assets.mjs` had.
A Playfair version is rendered beside it as `OPTIONAL-cover-*.png` so the difference is visible.
Nothing was replaced.

---

## §4 · Not shipped

* **`assets/icon.png` is untouched.** `git status` on `assets/` is empty. So is `app.json`.
* Nothing in `assets/`, no splash, no winner cue, no card size, no 83px arc, no economy value, no flag.
* **No Edge Function deployed** — `verify_jwt` unchanged everywhere.
* `docs/icon-history/` is intact: all six historical icons still there, plus the comparison sheet.
* The only files added outside `docs/` are the build script and the pinned font with its licence.

### Getting the pictures to Downloads (cmd.exe, from `C:\Projects\POKER\Caps`)

```
git fetch origin claude/vamos-caps-align-celebration-flppo0
set B=origin/claude/vamos-caps-align-celebration-flppo0
git show %B%:docs/f-icon/F-ICON-SHEET.png > %USERPROFILE%\Downloads\F-ICON-SHEET.png
git show %B%:docs/f-icon/F-FIRST-SECOND.png > %USERPROFILE%\Downloads\F-FIRST-SECOND.png
git show %B%:docs/f-icon/built/icon-1024.png > %USERPROFILE%\Downloads\F-icon-1024.png
git show %B%:docs/f-icon/built/icon-180.png > %USERPROFILE%\Downloads\F-icon-180.png
git show %B%:docs/f-icon/built/icon-60.png > %USERPROFILE%\Downloads\F-icon-60.png
git show %B%:docs/f-icon/built/android-icon-foreground.png > %USERPROFILE%\Downloads\F-adaptive-foreground.png
git show %B%:docs/f-icon/social/caps-profile-1024.png > %USERPROFILE%\Downloads\F-profile-1024.png
git show %B%:docs/f-icon/social/caps-profile-tiktok-200.png > %USERPROFILE%\Downloads\F-profile-tiktok-200.png
```

### What shipping it would take, once he says yes

1. Copy `docs/f-icon/built/icon-1024.png` → `assets/icon.png` and `assets/adaptive-icon.png`;
   `android-icon-foreground/background/monochrome.png` and `favicon.png` → `assets/`.
2. Copy `docs/f-icon/social/caps-profile-*.png` → `docs/social/`.
3. `app.json` needs no edit — every path already points where these go.
4. Regenerate the BackstopJS baselines on Linux if any scenario captures the favicon.
