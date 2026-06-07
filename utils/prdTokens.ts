/**
 * utils/prdTokens.ts
 *
 * PR-D study tokens (caps-design-study, 2026-05-25).
 *
 * Exact responsive values derived from
 *   screenshots/caps-design-study/placement_320|393|430.png
 *   screenshots/caps-design-study/ready_320|393|430.png
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
    gridGap:        rs(6),
    cellPadH:       rs(6),
    cellPadV:       rs(5),
    cellHCap:       rh(118),
    border:         rs(2),
    accent:         ['#FFD24A', '#4DAEFF', '#5BD17A', '#FF8E5A'] as const,
    flopSeparatorW: rs(3),
  },
  zone: {
    topChromeH:      rh(68),
    // PR-O v3.1 — gap fix iter 2: at 0.30 the 4×4 grid (with Card.tsx's
    // internal padding) rendered at ~352dp, overflowing the 253dp container.
    // Bumped to 0.42 so the 4×4 grid actually fits its container (no
    // overflow below the viewport). Boards-zone naturally shrinks to absorb.
    handMinH:        Math.max(rh(180), Math.floor(SCREEN_H * 0.42)),
    actionBarH:      rs(72),
    hairlineMarginH: rs(12),
  },
  selection: {
    liftY:        -rs(6),
    springMs:     220,
    pulseMs:      200,
    haloOpacity:  0.55,
  },
} as const;
