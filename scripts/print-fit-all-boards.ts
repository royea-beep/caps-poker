/**
 * scripts/print-fit-all-boards.ts
 * THROWAWAY DIAGNOSTIC — FIT-ALL-BOARDS task A1+A2.
 *
 * Models the NEW boards-first allocation in game.tsx so we can confirm:
 *   - boards have priority; all `gridRows` cells fit fully even when the
 *     preferred PLAYER_HAND_H wouldn't have left room.
 *   - the hand zone is the remainder (>= rh(80) floor).
 *   - the _handMarginB matches BoardArrangement's real marginBottom expression.
 *
 * Run: npx tsx scripts/print-fit-all-boards.ts
 */
import Module from 'module';
const _orig = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === 'react-native') return require.resolve('./__rn_stub.cjs');
  return _orig.call(this, req, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rs, rh } = require('../utils/responsive');

function compute(screenW: number, screenH: number, insetsTop: number, insetsBottom: number, boardCount: 2 | 3 | 4, boardCardCapDp = 70) {
  // Mirror game.tsx
  const TOP_CHROME_H = rh(56, screenH);
  const TOP_BAR_H    = Math.round(TOP_CHROME_H * 36 / 56);
  const BOT_STATUS_H = Math.round(TOP_CHROME_H * 20 / 56);
  const HINT_H       = 22;

  const PLAYER_HAND_H_PREFERRED =
    boardCount === 2 ? rh(170, screenH)
    : boardCount === 3 ? rh(162, screenH)
    : rh(125, screenH); // BC4-STACK-REBALANCE: bc=4 is now 2-row hand (rh(125) for 5dp 320 margin)

  const safeH = screenH - insetsTop - insetsBottom;

  const _gridGap          = rs(4, screenW);
  const _gridSidePadIfWide = rs(8, screenW);
  // BC4-STACK-REBALANCE: bc=4 now 1x4 stack (no 2x2)
  const _use2x2 = false;
  const _gridRows = boardCount;
  const _gridCols = 1;

  // BC4-STACK-REBALANCE: dropped +rs(40) bc=4 extra (no 4x4 hand grid anymore)
  const _handMarginB = rs(72, screenW) + insetsBottom + rs(8, screenW);
  const _chromeSafety = rs(28, screenW);

  // boards-first
  const MIN_BOARD_CARD_H = rh(22, screenH);
  const CELL_CHROME_V = rs(34, screenW);
  const _minCellH = 2 * MIN_BOARD_CARD_H + CELL_CHROME_V;
  const _minBoardsZoneH = _gridRows * _minCellH + (_gridRows - 1) * _gridGap + rs(8, screenW);
  const _availForBoardsAndHand = safeH - TOP_BAR_H - BOT_STATUS_H - _handMarginB - HINT_H - _chromeSafety;

  let _boardsZoneH = _availForBoardsAndHand - PLAYER_HAND_H_PREFERRED;
  let shrunkHandFromPreferred = false;
  if (_boardsZoneH < _minBoardsZoneH) {
    _boardsZoneH = _minBoardsZoneH;
    shrunkHandFromPreferred = true;
  }
  const _handZoneActualH = Math.max(rh(80, screenH), _availForBoardsAndHand - _boardsZoneH);

  const _cellH = Math.max(rh(48, screenH), Math.floor((_boardsZoneH - (_gridRows - 1) * _gridGap) / _gridRows) - rs(4, screenW));
  const _cellW = Math.max(rs(80, screenW), Math.floor((screenW - _gridSidePadIfWide - (_gridCols - 1) * _gridGap) / _gridCols));

  // Replicate Board.tsx fit-cell math
  const _cellHeightPropForBoard =
    boardCount === 3 || boardCount === 4
      ? Math.max(rs(48, screenW), _cellH - rs(12, screenW))
      : _cellH;
  const _innerH = Math.max(40, _cellHeightPropForBoard - rs(16, screenW) - 2 * rs(2, screenW));
  const _fitBoardCardH = Math.max(rh(22, screenH), Math.floor((_innerH - rs(2, screenW)) / 2));
  // Setting cap is in dp at base 393x852; scale by screenH/852 to match rh().
  const capScaled = Math.round(boardCardCapDp * screenH / 852);
  const _boardCardH = Math.min(_fitBoardCardH, capScaled);

  return {
    PLAYER_HAND_H_PREFERRED,
    _handMarginB,
    _availForBoardsAndHand,
    _minBoardsZoneH,
    _boardsZoneH,
    _handZoneActualH,
    shrunkHandFromPreferred,
    _cellH,
    _cellW,
    _gridRows,
    _gridCols,
    _fitBoardCardH,
    capScaled,
    _boardCardH,
  };
}

const cases: Array<{ w: number; h: number; insTop: number; insBot: number; label: string }> = [
  { w: 320, h: 568, insTop: 20, insBot: 0,  label: 'SE1/5s (20/0)'           },
  { w: 393, h: 852, insTop: 47, insBot: 34, label: 'iP15/16 base (47/34)'    },
  { w: 430, h: 932, insTop: 59, insBot: 34, label: 'iP15/16 ProMax (59/34)'  },
];

for (const c of cases) {
  console.log(`\n=== ${c.label}  ${c.w}x${c.h} ===`);
  console.log('bc  hand_pref handMB avail minBZ  bZone  handZ  cell  rowsxcols  fitCH  cap  bCardH  shrunk?');
  for (const bc of [2, 3, 4] as const) {
    const r = compute(c.w, c.h, c.insTop, c.insBot, bc, 70);
    console.log(
      `${bc}   ${String(r.PLAYER_HAND_H_PREFERRED).padStart(8)} ${String(r._handMarginB).padStart(6)} ${String(r._availForBoardsAndHand).padStart(5)} ${String(r._minBoardsZoneH).padStart(5)}  ${String(r._boardsZoneH).padStart(5)}  ${String(r._handZoneActualH).padStart(5)}  ${String(r._cellW).padStart(3)}x${String(r._cellH).padStart(3)}  ${r._gridRows}x${r._gridCols}        ${String(r._fitBoardCardH).padStart(4)}  ${String(r.capScaled).padStart(3)}  ${String(r._boardCardH).padStart(4)}    ${r.shrunkHandFromPreferred ? 'YES' : 'no'}`,
    );
  }
}

console.log('\nDone.\n');
