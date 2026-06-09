/**
 * scripts/print-board-density.ts
 * THROWAWAY DIAGNOSTIC — BOARD-DENSITY task C.
 *
 * Computes the per-board cell math (after TASK B chrome tighten) across widths
 * 320 and 393 for each boardCount, so we can tell whether bc=4 @ 320 has any
 * slack left to support TASK C (card-size enlargement).
 *
 * Run: npx tsx scripts/print-board-density.ts
 */
import Module from 'module';
const _orig = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === 'react-native') return require.resolve('./__rn_stub.cjs');
  return _orig.call(this, req, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rs, rh } = require('../utils/responsive');

// Constants mirrored from game.tsx + Board.tsx + BoardArrangement.tsx + prdTokens.ts
function compute(screenW: number, screenH: number, boardCount: 2 | 3 | 4) {
  const TOP_CHROME_H   = rh(56, screenH);
  const TOP_BAR_H      = Math.round(TOP_CHROME_H * 36 / 56);
  const BOT_STATUS_H   = Math.round(TOP_CHROME_H * 20 / 56);
  const HINT_H         = 22;

  // PLAYER_HAND_H per boardCount (game.tsx after d0be2f6)
  const PLAYER_HAND_H =
    boardCount === 2 ? rh(170, screenH)
    : boardCount === 3 ? rh(162, screenH)
    : boardCount === 4 ? rh(305, screenH)
    : 0;

  // safeH approximation — assume insets ~ rh(40, screenH) total (top notch + home indicator)
  const insetsApprox = Math.round(screenH * 0.08); // ~8% conservative
  const safeH = screenH - insetsApprox;

  const _gridGap          = rs(4, screenW);
  const _gridSidePadIfWide = rs(8, screenW);
  const _projectedCellW2x2 = Math.floor((screenW - _gridSidePadIfWide - _gridGap) / 2);
  const _use2x2 = boardCount === 4 && _projectedCellW2x2 >= rs(180, screenW);
  const _gridRows = _use2x2 ? 2 : boardCount;
  const _gridCols = _use2x2 ? 2 : 1;
  const _handMarginB = rs(56, screenW) + rs(4, screenW); // PRD.zone.actionBarH = rs(56) + rs(4)
  const _chromeSafety = rs(28, screenW);
  const _boardsZoneH = Math.max(
    rh(180, screenH),
    safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - _handMarginB - HINT_H - _chromeSafety,
  );
  const _cellH = Math.max(rh(48, screenH), Math.floor((_boardsZoneH - (_gridRows - 1) * _gridGap) / _gridRows) - rs(4, screenW));
  const _cellW = Math.max(rs(80, screenW), Math.floor((screenW - _gridSidePadIfWide - (_gridCols - 1) * _gridGap) / _gridCols));

  // Per-board: BoardArrangement passes cellH-rs(12) to Board for bc=3/4
  const cellHeightProp =
    boardCount === 3 || boardCount === 4
      ? Math.max(rs(48, screenW), _cellH - rs(12, screenW))
      : _cellH;

  // Board.tsx after TASK B: HEADER_H = rs(16), PAD_V = rs(2), rowGap = rs(2)
  const HEADER_H = rs(16, screenW);
  const PAD_V    = rs(2, screenW);
  const rowGap   = rs(2, screenW);

  // Outer chrome NOT in Board's innerH math: cell wrapper padV (rs(2)*2) + container border (rs(2)*2) + pressableInner padV (rs(2)*2) = 12dp ≈ rs(12)
  // This is exactly what cellH-rs(12) compensates for.

  const innerH = Math.max(40, cellHeightProp - HEADER_H - 2 * PAD_V);
  const cardH_byHeight = Math.max(20, Math.floor((innerH - rowGap) / 2));
  const cardW_fromHeight = Math.max(14, Math.round(cardH_byHeight * 0.72));

  // Compare to pre-B baseline: HEADER_H=rs(20), header.marginBottom=rs(2),
  // cardRow.paddingVertical=1*2*2=4, contentSafetyPad=rs(6)*2=12 (bc=3/4 only)
  const HEADER_H_OLD = rs(20, screenW);
  const innerH_OLD = Math.max(40, cellHeightProp - HEADER_H_OLD - 2 * PAD_V);
  const contentSafetyPad_OLD = (boardCount === 3 || boardCount === 4) ? rs(6, screenW) * 2 : 0;
  const headerMb_OLD = rs(2, screenW);
  const cardRowPv_OLD = 1 * 2 * 2; // 1px*2 sides * 2 rows
  const innerH_OLD_effective = innerH_OLD - contentSafetyPad_OLD - headerMb_OLD - cardRowPv_OLD;
  const cardH_byHeight_OLD = Math.max(20, Math.floor((innerH_OLD_effective - rowGap) / 2));

  return {
    cellH: _cellH,
    cellW: _cellW,
    use2x2: _use2x2,
    cellHeightProp,
    innerH,
    cardH_byHeight,
    cardW_fromHeight,
    cardH_byHeight_OLD,
    delta: cardH_byHeight - cardH_byHeight_OLD,
    PLAYER_HAND_H,
    boardsZoneH: _boardsZoneH,
  };
}

const cases: Array<{ w: number; h: number; label: string }> = [
  { w: 320, h: 568, label: 'SE1 5s  (smallest)'  },
  { w: 393, h: 852, label: 'iP15/16 BASE'        },
];

for (const c of cases) {
  console.log(`\n=== ${c.label}  ${c.w}x${c.h} ===`);
  console.log('bc  cellW cellH cellHprop innerH cardH cardW  was->now (delta)');
  for (const bc of [2, 3, 4] as const) {
    const r = compute(c.w, c.h, bc);
    console.log(
      `${bc}   ${String(r.cellW).padStart(4)}  ${String(r.cellH).padStart(4)}  ${String(r.cellHeightProp).padStart(8)}  ${String(r.innerH).padStart(5)}  ${String(r.cardH_byHeight).padStart(4)}  ${String(r.cardW_fromHeight).padStart(4)}   ${r.cardH_byHeight_OLD}â${r.cardH_byHeight} (+${r.delta})  use2x2=${r.use2x2}  hand=${r.PLAYER_HAND_H}  zoneH=${r.boardsZoneH}`,
    );
  }
}

console.log('\nDone.\n');
