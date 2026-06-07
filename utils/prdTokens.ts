/**
 * utils/prdTokens.ts
 *
 * PR-D study tokens (caps-design-study, 2026-05-25).
 * PR-M 2026-05-29 — aggressive vertical budget pass.
 *
 * All values derived from utils/responsive.ts (rs/rh) so they scale linearly
 * with screenW/393 and screenH/852. SCREEN_W/H are locked at module load — no
 * useWindowDimensions(), so layout is deterministic for the session.
 */

import { rh, rs, SCREEN_H } from './responsive';

export const PRD = {
  card: {
    community: { w: rs(28), h: rs(40) },
    slot:      { w: rs(34), h: rs(48) },
    hand:      { w: rs(46), h: rs(65) },
    gap:       rs(3),
    centerSuit: (cardW: number): number => Math.max(14, Math.round(cardW * 0.55)),
    cornerRank: (cardW: number): number => Math.max(9,  Math.round(cardW * 0.30)),
    cornerSuit: (cardW: number): number => Math.max(7,  Math.round(cardW * 0.22)),
  },
  board: {
    // PR-M: tighter cell padding so the cell usable height matches what the
    // outer cellH math budgets. Was rs(6/5) -> now rs(4/2).
    gridGap:        rs(4),
    cellPadH:       rs(4),
    cellPadV:       rs(2),
    cellHCap:       rh(118),
    border:         rs(2),
    accent:         ['#FFD24A', '#4DAEFF', '#5BD17A', '#FF8E5A'] as const,
    flopSeparatorW: rs(3),
  },
  zone: {
    // PR-M 2026-05-29 — aggressive vertical budget. Top chrome collapses from
    // rh(68) to rh(56), action bar from rs(72) to rs(56), hand zone gets a HARD
    // cap at 32% of screen height. Boards consume everything else so the 3p
    // vertical-stack stops clipping board 3 off the viewport.
    topChromeH:      rh(56),
    handMinH:        Math.max(rh(120), Math.floor(SCREEN_H * 0.22)),
    handMaxH:        Math.floor(SCREEN_H * 0.32),
    actionBarH:      rs(56),
    hairlineMarginH: rs(8),
  },
  selection: {
    liftY:        -rs(6),
    springMs:     220,
    pulseMs:      200,
    haloOpacity:  0.55,
  },
} as const;