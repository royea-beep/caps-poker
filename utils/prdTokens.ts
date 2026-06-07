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
    // PR-O v3 — gap fix: at 0.18 the 4×4 grid card height was below Card.tsx's
    // 44pt floor, forcing a fallback to 2×8 that still hid bottom rows AND
    // left a 134dp dead gap between boards and hand. Bumped to 0.30 so 4×4
    // gets ~63dp per row (readable), boards zone naturally absorbs the rest.
    handMinH:        Math.max(rh(180), Math.floor(SCREEN_H * 0.30)),
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
