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
    // CARD-FACE batch — the UPGRADED face's larger centre suit. Kept as a SIBLING (not a bump of
    // centerSuit) so the DEFAULT face stays byte-identical. Internal glyph only: the card's outer
    // width/height/hitbox is unchanged (proven before/after). Flip centerSuit itself to 0.62 only
    // if/when Roye makes the upgraded face the default.
    centerSuitBig: (cardW: number): number => Math.max(16, Math.round(cardW * 0.64)),
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
    // PR-N 2026-06-02 — tighten hand zone further. Build 459 device test showed
    // hand rendered ~35% of SCREEN_H because handZone.marginBottom inflated the
    // visual footprint. New cap: 28% of SCREEN_H for the hand zone itself, and
    // handZone.marginBottom drops to just rs(8) + insets.bottom so total footprint
    // (zone + buffer + action bar) stays under 50%.
    topChromeH:      rh(56),
    // Shrink-fix 2026-06-07 iter 2 — 0.32 was 45dp short of fitting the rendered
    // 4×4 grid because Card.tsx 62dp height floor + per-row cardWrapper border
    // (2dp × 2 = 4) + container.paddingVertical (rs(3) × 2 = 6) + 3 row gaps
    // (rs(3) × 3 = 9) + labelRow (~21) added up to ~292dp actual chrome. Bumped
    // to 0.38 (320dp on 844) so 4 rows of ~62dp + 52dp chrome = 300dp fits with
    // 20dp safety.
    handMinH:        Math.max(rh(180), Math.floor(SCREEN_H * 0.40)),
    handMaxH:        Math.floor(SCREEN_H * 0.40),
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