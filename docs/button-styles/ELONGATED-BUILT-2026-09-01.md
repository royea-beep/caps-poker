# ELONGATED-BUILT — 2026-09-01 — the E chip, built for real (not a mockup)

Roye picked the **elongated stadium chip** (treatment E, the beveled poker-chip, ranked #1 — round
loses because a true circle clips "Play Online", HE by +17px at 320 AND 393). This sprint **builds
it as the real RN component** and wires it into the home screen. It is on the branch **awaiting
merge** — the chip ships with the **next build**; nothing was merged, no version bumped, no
baselines regenerated.

## What was built — the real component
- **`components/ChipButton.tsx`** — a new RN component carrying the **full E identity**:
  - **mint `#4FD6A8` fill** (primary) · **brass `#C9A84C` DASHED rim** (the chip edge) · a **bevel**
    (inner top highlight + bottom shadow) · a **pressed state that SINKS** (translateY, not scale).
  - **`variant="secondary"`** = the quiet Practice chip: **dark felt `#12211B` fill, MINT dashed
    rim**, smaller (minHeight `rv(52)` vs the primary's `rv(72)`) and narrower (0.64 width vs the
    primary's full width). **Refinement 1 held — Play Online dominates, Practice does not equalise.**
  - **Every dimension via `rf`/`rs`/`rv`** — the corner radius, padding, gap, the dashed edge width
    and its inset, the bevel heights, the drop shadow. **No pixel literals** (Iron Rule #3). The old
    `minHeight: 64` / `minHeight: 56` literals are gone.
- **`app/(tabs)/index.tsx`** — Play Online is now `<ChipButton variant="primary">`, Practice is
  `<ChipButton variant="secondary">`. The dead styles (`playOnlineBtn`, `playBtn`,
  `playBtnHighlight`) and the two per-button scale refs were removed. The **POLISH-1 first-tap fix**
  survives — ChipButton always wires `onPressIn`/`onPressOut`, which is what grabs the web press
  responder on pointer-down. The `LABEL_COLUMN` (`flexBasis:'auto'`) that fixes the Yoga-vs-CSS
  column divergence is unchanged.

## The sheet — what it is
- `docs/button-styles/elongated-built-393.png` and `-320.png` — the **BUILT** component (EN + HE),
  rendered from its **exact computed styles** (the same `rf`/`rs`/`rv` math as `utils/responsive.ts`,
  the real content padding + chip margins, the real masthead above and Challenge link + cup pills
  below). Regenerable: `docs/button-styles/elongated-built-render.js`.
- **RENDERED MIRROR of the built component** — real Chromium pixels of the component's real
  geometry. It is **NOT the app bundle and NOT a device.** (The masthead uses Chromium's serif, not
  the device's Georgia — a device-only tap, as always.)

## Proven, not asserted (measured this run)
| Check | Result | Bar |
|---|---|---|
| **Label fit — EN + HE, 320 + 393** | **all fit, no wrap/clip** (`built_all_fit=true`) | title 1 line, sub ≤2 lines, no h-overflow |
| **Contrast — title ink `#08130F` on mint** | **10.37:1** | 4.5:1 |
| Contrast — sub ink `#0A1A14` on mint | 9.84:1 | 4.5:1 |
| Contrast — Practice mint on dark `#12211B` | 9.15:1 | 4.5:1 |
| **goldHit (scan every chip fill + rim for `rgb(255,215,0)`)** | **false on all tiles** | must be false |
| **Collision — chip vs masthead above / pills below** | **no overlap; min gap 16px@393, 13px@320** | > 0 |

## Instrument re-verified (canary) — before trusting a number
- planted **mint-on-mint `1.00:1` → flagged** (`badFlagged=true`);
- real **ink-on-mint `10.37:1` → passes** (`goodPass=true`).
The contrast is label-vs-fill, never sampled inside glyphs.

## The loop — clip-aware sweep with a pre-change control + self-test
- **Pre-change control** = the OLD rounded-rect button rendered in the same harness → **also fits**
  (`control_all_fit=true`). So the sweep is not rubber-stamping the new shape; it passes the thing
  the new chip replaces too.
- **Self-test planted its own defects:** a canary tile with an **overflowing title** →
  **caught** (`canary_overflow_caught=true`); a canary tile with a **clipped subtitle** →
  **caught** (`canary_clip_caught=true`). The detectors are not blind.
- **Widths:** 320 and 393 (the layout axis). **Board count:** the home chips are **invariant to
  board count** — the 2P/3P/4P selector was removed from home (it now lives in the lobby), so the
  chip layout does not vary with 2/3/4 boards; the width sweep is the real axis a new button shape
  reopens. **Both engines:** the Yoga-vs-CSS column divergence is handled by the unchanged
  `LABEL_COLUMN` (`flexBasis:'auto'`); the one **iOS-only** unknown is the dashed rounded rim (see
  device taps).

## Gold semantics — restated and proven
- **mint `#4FD6A8`** = the action / the fill.
- **brass `#C9A84C`** = the chip **edge** only (the dashed rim) — a different colour from the cue.
- **winner gold `#FFD700`** = **WON**, the winner cue (Card.tsx, 3px). **Nowhere on this button.**
- The diff **does not touch `Card.tsx`** and adds **no `#FFD700`** (verified in the git diff).

## Rendered vs code-read vs device-only
- **Rendered (mirror):** the shape, the fit (EN+HE, 320+393), the contrast, the colours, the
  no-collision — real Chromium pixels of the built component's real geometry.
- **Code-read:** the wiring into `index.tsx`, the removed dead styles, the preserved first-tap fix.
- **Device-only taps:** ⟦IRREDUCIBLE⟧ the **brass/mint DASHED rim on a rounded pill on iOS**
  (react-native-web draws the dashes cleanly; iOS can render a dashed rounded border solid or with
  uneven dashes — like the Georgia masthead, only the binary shows the truth). Also the pressed
  **sink** at true device DPI and the mint fill under real iOS colour management.

## Delivery (cmd.exe — git show to Downloads)
On the pushed branch `claude/vamos-caps-align-celebration-flppo0`:
```
git show HEAD:docs/button-styles/elongated-built-393.png > %USERPROFILE%\Downloads\caps-elongated-393.png
git show HEAD:docs/button-styles/elongated-built-320.png > %USERPROFILE%\Downloads\caps-elongated-320.png
```

## Not merged — what happens next
The chip is **on the branch, awaiting merge**; it ships with the **next build**. No merge, no
version bump, no baseline regeneration this sprint. When Roye merges, the elongated chip is live on
the home screen. The one thing web cannot verify — the dashed rounded rim on a physical iPhone — is
the first thing to check on the next TestFlight.

## Production unchanged
No economy, faucet, rake, reset, security fix, D1 hero, nav, or flag touched; `KILL_Board`
untouched; `Card.tsx` and the winner cue untouched; no build, no version bump; app change is the
two home buttons only. main and the 512 tester candidate are unchanged.
