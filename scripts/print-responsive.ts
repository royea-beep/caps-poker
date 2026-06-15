/**
 * scripts/print-responsive.ts
 * THROWAWAY DIAGNOSTIC — BUILD467-VERIFY task A3
 *
 * Imports the REAL responsive helpers and prints computed values for
 * PLAYER_HAND_H (boardCount 2/3/4), board cell W/H, and card W/H across
 * a row of simulated widths.
 *
 * Run with:  npx tsx scripts/print-responsive.ts
 */

// Stub react-native BEFORE importing responsive.ts.
// responsive.ts only reads Platform.OS and PixelRatio.get(); the real
// fallback path (web) hardcodes 393×852, which is exactly what we want
// — we pass screenW/screenH explicitly via the override parameters.
import Module from 'module';
const _orig = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === 'react-native') {
    return require.resolve('./__rn_stub.cjs');
  }
  return _orig.call(this, req, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const r = require('../utils/responsive');
const { rs, rh, rv, rf, getCardDimensions, getBoardLayout } = r as {
  rs: (v: number, w?: number) => number;
  rh: (v: number, h?: number) => number;
  rv: (v: number, w?: number) => number;
  rf: (v: number, min?: number, max?: number, w?: number) => number;
  getCardDimensions: (
    w: number,
    np: number,
    nb: number,
  ) => {
    board: { width: number; height: number };
    hand: { width: number; height: number };
  };
  getBoardLayout: (
    w: number,
    h: number,
    nb: number,
  ) => {
    boardHeight: number;
    boardPaddingV: number;
    boardHeaderHeight: number;
    compact: boolean;
  };
};

// Widths × heights from utils/responsive.ts comment block.
// Use the most common matching height per width (real iPhone pairs where possible).
const cases: Array<{ w: number; h: number; label: string }> = [
  { w: 320, h: 568, label: 'iPhone SE1 / 5s'        },
  { w: 360, h: 740, label: 'Android budget'         },
  { w: 375, h: 667, label: 'iPhone SE2/3'           },
  { w: 390, h: 844, label: 'iPhone 13/14'           },
  { w: 393, h: 852, label: 'iPhone 15/16 (BASE)'    },
  { w: 414, h: 896, label: 'iPhone 11 / XS Max'     },
  { w: 430, h: 932, label: 'iPhone 15/16 Pro Max'   },
];

console.log('\n=== PLAYER_HAND_H (rh()-scaled per boardCount) ===');
console.log('width  height  label                       rh(170)  rh(162)  rh(305)');
console.log('-----  ------  --------------------------  -------  -------  -------');
for (const c of cases) {
  const v2 = rh(170, c.h);
  const v3 = rh(162, c.h);
  const v4 = rh(305, c.h);
  console.log(
    `${String(c.w).padStart(5)}  ${String(c.h).padStart(6)}  ${c.label.padEnd(26)}  ${String(v2).padStart(7)}  ${String(v3).padStart(7)}  ${String(v4).padStart(7)}`,
  );
}

console.log('\n=== rs()-scaled layout literals (width-based) ===');
console.log('width  rs(4)  rs(8)  rs(28)  rs(80)  rs(180)');
console.log('-----  -----  -----  ------  ------  -------');
for (const c of cases) {
  console.log(
    `${String(c.w).padStart(5)}  ${String(rs(4, c.w)).padStart(5)}  ${String(rs(8, c.w)).padStart(5)}  ${String(rs(28, c.w)).padStart(6)}  ${String(rs(80, c.w)).padStart(6)}  ${String(rs(180, c.w)).padStart(7)}`,
  );
}

console.log('\n=== Board cells via getBoardLayout(numBoards=2) ===');
console.log('width  height  boardH  padV  headerH  compact');
console.log('-----  ------  ------  ----  -------  -------');
for (const c of cases) {
  const bl = getBoardLayout(c.w, c.h, 2);
  console.log(
    `${String(c.w).padStart(5)}  ${String(c.h).padStart(6)}  ${String(bl.boardHeight).padStart(6)}  ${String(bl.boardPaddingV).padStart(4)}  ${String(bl.boardHeaderHeight).padStart(7)}  ${String(bl.compact).padStart(7)}`,
  );
}

console.log('\n=== Cards via getCardDimensions(numPlayers=3, numBoards=3) ===');
console.log('width  boardW  boardH  handW  handH');
console.log('-----  ------  ------  -----  -----');
for (const c of cases) {
  const cd = getCardDimensions(c.w, 3, 3);
  console.log(
    `${String(c.w).padStart(5)}  ${String(cd.board.width).padStart(6)}  ${String(cd.board.height).padStart(6)}  ${String(cd.hand.width).padStart(5)}  ${String(cd.hand.height).padStart(5)}`,
  );
}

console.log('\nDone.\n');
