# LUXURY-HOME — 2026-09-01 — the approved Luxury Dark home, built from real parts

Roye approved a Luxury Dark home design over several mockup rounds. This sprint **builds it for
real** on the branch — real cards, real tokens, the chip component from this cycle — awaiting merge.
It ships with the **next build**: no merge, no version bump, no baseline regeneration.

## ⚠️ The reference render was not in the repo
`docs/luxury-home-ref.png` — named in the brief as the build target — is **not committed** to this
repo or any branch (checked: not tracked, not untracked, not in any commit). The prior mockup
session never landed it here. So this was built **to the brief's written spec** (which fully
specifies the layout top-to-bottom), NOT pixel-matched to an image I could open — I will not claim a
match to a picture I never saw (Iron Rule #14). If Roye drops the ref into `docs/`, a follow-up can
do the side-by-side diff. Where the spec was explicit, the build follows it exactly; the exact
pixels come from real components and real tokens, as the brief itself directs.

## What was built — from real parts
- **`components/LuxuryBackdrop.tsx`** — the deep **radial-green felt vignette** (green glow under the
  wordmark band ~30% down, dark at the rim, so it **lifts** the gilded CAPS rather than fighting it),
  a **diagonal light beam** from the top corner, and a **faint felt weave**. All gradients are
  PERCENTAGE / token-based — **no pixel literals** (Iron Rule #3). Native gets the felt gradient
  (expo-linear-gradient); the true radial + beam + weave are web-rich / **device-tap** layers, same
  idiom as the existing `grainOverlay`.
- **`components/RoyalFlushFan.tsx`** — the **10 J Q K A of spades** hero fan, rendered from the app's
  **real `components/Card.tsx`** at a small size (no redrawn SVG, no forked card). A spread hand
  (translateX offset + gentle tilt about a shared bottom pivot) so every rank index reads. Below it,
  a small gilded **"ROYAL FLUSH"** caption in the wordmark gold `#c9a84c` (**not** the winner gold
  `#FFD700` — it is not a cue). `Card.tsx` renders a static face with no owner/zone (no glow) and
  `highlighted=false` (neutral 1px border, never the winner cue).
- **`components/ChipButton.tsx`** — the elongated stadium chip from the previous sprint, now with a
  **smooth SOLID brass edge line** (Roye removed the dash in this review). Mint fill, brass edge, no
  gold fill; the pressed **sink** and refinement-1 hierarchy (Play Now dominant, Practice quiet) are
  unchanged.
- **`app/(tabs)/index.tsx`** — wired: LuxuryBackdrop behind everything, the four suits in gilded gold
  `#c9a84c`, the fan below the wordmark, and the teaching sentence moved below the CTAs as "the
  tagline" (the approved order: wordmark → fan → chips → tagline). Nav, destinations, economy, flags
  untouched — this is the home art, not a new structure.

## The sheet — what it is
- `docs/button-styles/luxury-home-built-393.png` and `-320.png` — the BUILT home (EN + HE), rendered
  from its **exact computed geometry** (same rf/rs/rv math as `utils/responsive.ts`, the real
  backdrop, the real Card.tsx face rules, the real chip). Regenerable:
  `docs/button-styles/luxury-home-render.js`.
- **RENDERED MIRROR of the built component** — real Chromium pixels of the real geometry. It is **NOT
  the app bundle** (the feature branch is not deployed, so mirrored-bytes would show the OLD home,
  stated plainly) and **NOT a device.** The masthead uses Chromium's serif, not the device's Georgia.

## The floor — measured at 320 / 375 / 393 / 430, EN + HE
| Check | Result |
|---|---|
| Horizontal overflow | **none** at any width |
| Content overlap | **none** at any width |
| **Fan overlaps POKER** | **never** — min gap **13px** (the defect Roye caught in the mockup, now proven clear) |
| Chip label fits EN + HE in the full composition | **fits every width** (no wrap/clip) |
| goldHit on the CTAs (scan fill + rim for `rgb(255,215,0)`) | **false** |

## Contrast — every text vs its REAL sampled background (canary first)
The instrument renders a copy with the text hidden, screenshots, and **samples the composited pixel**
(vignette + beam + felt + overlays) under each text — it does not assume the background. Minimums
across all widths:
| Element | Colour | Min ratio | Bar |
|---|---|---|---|
| CAPS wordmark | `#c9a84c` on the vignette | **6.12:1** | 4.5 |
| POKER | `#c9a84c` | 5.83:1 | 4.5 |
| Four suits | `#c9a84c` | 6.35:1 | 4.5 |
| ROYAL FLUSH caption | `#c9a84c` on felt | 6.20:1 | 4.5 |
| Tagline | `#cfd8d2` on felt | 12.66:1 | 4.5 |
| Chip title | ink `#08130F` on mint | 10.37:1 | 4.5 |
| Practice label | mint on dark `#12211B` | 9.15:1 | 4.5 |

**Canary re-verified first:** mint-on-mint `1.00` → flagged; ink-on-mint `10.37` → passes. Self-test
planted an overflow and a clip → **both caught**. 44pt is cleared by both chips (primary minHeight
`rv(72)`, secondary `rv(52)`), and each has a visible pressed **sink**.

## Gold semantics — proven
- **mint `#4FD6A8`** = the action / the fill. **brass/gilded `#c9a84c`** = the wordmark, the suits,
  the chip edge line, the ROYAL FLUSH caption. **winner gold `#FFD700`** = WON only, untouched.
- No CTA sits at `#FFD700` (goldHit=false). The diff **does not touch `Card.tsx`** — the winner-cue
  logic and its `#FFD700` are exactly as they were; the fan uses the component, never its cue.

## Built home rendered vs the reference
- **Matches the written spec:** the top-down order (suits → CAPS/POKER → royal-flush fan → ROYAL
  FLUSH caption → Play Now dominant → Practice quiet → tagline), the deep radial-green vignette +
  beam + felt, the smooth mint/brass chip, the gilded wordmark and gold suits.
- **Had to differ / decide (ref image unavailable):** the exact fan spread and card size are my
  measured choice (every index legible, never overlapping POKER); the teaching sentence is treated
  as "the tagline" and moved below the CTAs per the stated order; the wordmark keeps the shipped D1
  (Georgia/Playfair, gilded) — not rebuilt.

## Native-only items (device taps)
⟦device-tap⟧ the **radial vignette**, the **diagonal beam** and the **felt weave** render truly only
on a device — the web mirror shows them via CSS gradients / an SVG weave; iOS may differ (the felt
gradient is real via expo-linear-gradient, the beam/weave are approximations). Also the **gilded
Georgia wordmark** (device-only face) and the **chip pressed sink** at true DPI.

## Delivery (cmd.exe — git show to Downloads)
On the pushed branch `claude/vamos-caps-align-celebration-flppo0`:
```
git show HEAD:docs/button-styles/luxury-home-built-393.png > %USERPROFILE%\Downloads\caps-luxury-393.png
git show HEAD:docs/button-styles/luxury-home-built-320.png > %USERPROFILE%\Downloads\caps-luxury-320.png
```

## Not merged — production unchanged
On the branch, awaiting merge; ships with the next build. No merge, no version bump, no baseline
regeneration. No economy, faucet, rake, reset, security fix, nav, destination, or flag touched;
`KILL_Board` untouched; `Card.tsx` and the winner cue untouched; no motion added. 2,649 tests green,
tsc clean.
