# CAPS Placement-Matrix Auto-QA Findings

**Generated**: 2026-06-15 (VAMOS-QA-LOOP first proof-of-loop)
**Base URL**: https://caps.ftable.co.il
**Deployed commit at capture time**: `b6fffc0` (BOARD-FILL-3, deployed via manual workflow_dispatch run 27538505339)
**HEAD at capture time**: `610af49` (QA-LOOP commit — web-deploy auto-trigger for `fix/**` just added, deploy in flight)
**Commit gap**: 2 commits — QA-LOOP scaffold (4a93d11) + this commit (610af49). Both are TOOLING-only, no app code change since BOARD-FILL-3 / b6fffc0. The captured screenshots faithfully reflect BOARD-FILL-3 + HAND-FIT + BOARD-FILL-2 + earlier theme work.

## 9-cell capture matrix

| bc | width | File | Hand visible? | Cluster centered in board? | Notes |
|---|---|---|---|---|---|
| 4 (2P, 16-card hand, 4 boards 1×4) | 440 | `qa-bc4-440.png` | ✓ 2×8 grid, visible margins both edges, no clip | ⚠ cards LEFT-pushed inside each board, large RIGHT void | Money pill still GOLD `800` (not mint) |
| 4 | 390 | `qa-bc4-390.png` | ✓ | ⚠ same | — |
| 4 | 320 | `qa-bc4-320.png` | ✓ 8-across visibly fits with margins (hand-fit B2 working) | ⚠ same | Cards clipped by overlay hint card but hand row itself is well-margined |
| 3 (3P, 12-card hand, 3 boards 1×3) | 440 | `qa-bc3-440.png` | ✓ 2×6 grid | ⚠ same | — |
| 3 | 390 | `qa-bc3-390.png` | ✓ | ⚠ same | — |
| 3 | 320 | `qa-bc3-320.png` | ✓ | ⚠ same | — |
| 2 (4P, 8-card hand, 2 boards 2×1) | 440 | `qa-bc2-440.png` | ✓ 4 cards visible per row × 2 | ⚠ cards LEFT-pushed, big RIGHT void inside each board | Money pill gold; Cancel mint outline + Confirm mint solid both visible at bottom |
| 2 | 390 | `qa-bc2-390.png` | ✓ | ⚠ same | — |
| 2 | 320 | `qa-bc2-320.png` | ✓ | ⚠ same | — |

## Open-item verdicts (re-verify on current code)

### Hand row at bc=4
**No clip at 440 OR 320.** Visible breathing room on both edges. ✓ **BOARD-FILL-2 outer→inner padding fix is real.** The hand at 320 has cards 8-across with clear edge margin (overlay hint partially covers the row but the row itself reads fine).

### Boards at bc=2 / bc=3
**Cards are visibly LEFT-pushed inside each board.** Large empty band on the RIGHT side of every board across all bc=2/3 captures. The uniform 0.72 BOARD-FILL-3 growth gave cards slightly bigger sizes than build 479 (visible vs the BoardX naming) but the centering bug dominates the visual.

**Aspect**: cards still look proportional (no 0.55 tall-skinny distortion). ASPECT_LOW revert worked. ✓

**Hypothesis for the left-push**: this is a RTL flexbox issue. `Board.tsx contentCenter` has `alignItems: 'center'` + `width: '100%'`; `cardRow` has `justifyContent: 'center'`. In RTL with `flexDirection: 'row'`, the start anchor flips, but `justifyContent: 'center'` SHOULD still center. Either:
- (a) The cardRow's width is implicitly being constrained narrower than the available area, with the row itself left-anchored in the contentCenter
- (b) RN Web's RTL handling has an edge case where alignItems/justifyContent compose incorrectly
- (c) Some intermediate wrapper (pressableInner?) has an asymmetric padding

The boards are FULL HEIGHT at all bc — the FIX-4 collapse regression has NOT returned. ✓

### bc=4 cluster
The 4 boards stack 1×4 vertically with full board height. Cards inside each bc=4 board show the same RIGHT void. ✓ height-wise + ⚠ centering-wise.

### Chrome (theme)
- ✓ "Auto-Place" pill: mint bg + mint border + bolt + mint text — visible per board top-left
- ✓ Cancel ("ביטול"): mint outline on dark
- ✓ Confirm ("אישור"): mint solid (when active, gradient when disabled)
- ✓ "סדר N קלפים" header pill: mint border + mint text
- ✓ "תיד שלך N" hand label badge: mint pill
- ✓ Per-board identity pill ("לוח 1"): gold for B1, blue for B2, green for B3, orange for B4 — distinct
- ✓ Separator: 2px mint with no glow (per BOARD-FILL nudge)
- ✗ **Money/balance pill (top-left "💰 600" / "325" / "800")**: STILL GOLD. The `headerChips` cascade did NOT reach the deployed b6fffc0 render. Either (1) my edit landed but Vercel served a stale bundle, OR (2) there's a SECOND money-pill render path I missed.

## Action items for next pass

1. **Centering bug** (highest priority) — debug the bc=2/3 cards being left-pushed inside each board. Likely a RTL × flexbox interaction. Add an `[board-content-row]` onLayout log to confirm the row's x-position inside the board container.
2. **Money pill cascade gap** — re-grep for any other `COLORS.gold` / `#c9a84c` / `headerChipsAmount`-style pill rendering at top-left/right of the game screen. The deployed build clearly shows the pill still gold; need a second-pass diagnosis.

## Standing loop

`npm run qa:placement` is wired and proven working. Future layout changes:
1. Push to `fix/**` → auto-triggers `Web Deploy (Vercel)` (just enabled this pass).
2. Wait ~5 min for caps.ftable.co.il to reflect the commit.
3. `npm run qa:placement` → produces 9 screenshots + this findings doc.
4. Eyeball or grep findings for regressions. No phone required.

## Capture metadata
- Playwright Chromium `chromium-1217` (Win64), headless
- Viewport `width × 956`, `deviceScaleFactor: 2`
- localStorage `caps-poker-storage.state.config.numberOfPlayers` set BEFORE each reload
- Page load: `domcontentloaded` + 2.6s settle
