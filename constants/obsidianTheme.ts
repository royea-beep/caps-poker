/**
 * constants/obsidianTheme.ts
 *
 * Option C — "Obsidian + Lift" visual tokens (VAMOS-VISUAL-C, 2026-06-11).
 *
 * Single source of truth for the new board/card/hand visual language.
 * Geometry is locked at build 471 — these tokens only change visual surface,
 * not layout dims. Card/slot dimensions still come from utils/prdTokens.ts.
 *
 * Tuning rules:
 *  - Per-board identity color (1/2/3/4 = yellow/blue/green/orange) carries
 *    the TAB and the EDGE so 4-board mode reads identity at a glance.
 *  - Mint (#4FD6A8) carries inner details (separator, slot dash, card-back
 *    emblem) so the boards stay cohesive instead of rainbow.
 *  - Shadows are moderate (4 boards + hand on one screen — perf budget).
 */

import { Platform } from 'react-native';
import { PRD } from '../utils/prdTokens';
import { activePaint } from './paintThemes';

// ---------- Color tokens ----------

// S75 (theme plumbing) — the 24 paint VALUES moved verbatim to the paint layer
// (constants/paintThemes.ts → currentPaint.obsidian) and this export now RESOLVES
// from the active paint. Name, shape, literal types and values are unchanged, so
// components/Card.tsx (the real consumer of this palette) renders identically.
// The geometry (OBSIDIAN_GEOM) and the shadow specs below are NOT paint and are
// deliberately left untouched — the shadow objects mix shadowColor with
// offset/radius/elevation, so splitting them is a later, separately-audited batch.
export const OBSIDIAN = activePaint.obsidian;

/** Per-board identity (already locked in PRD.board.accent — re-exported for clarity). */
export const BOARD_IDENTITY = PRD.board.accent;

// ---------- Geometry tokens ----------

export const OBSIDIAN_GEOM = {
  boardRadius: 14,       // was rs(18) — sharper/modern per Option C
  cardRadius: 8,         // lifted face-up
  cardBackRadius: 6,     // geometric back
  slotRadius: 6,         // ghost slot
  tabRadius: 6,          // minimal chip
  separatorW: PRD.board.flopSeparatorW, // unchanged — 2px feel preserved via styling
} as const;

// ---------- Shadow specs ----------

/** Board outer drop shadow (elevation off near-black background). */
export const boardOuterShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.62,
    shadowRadius: 22,
  } as const,
  android: { elevation: 10 } as const,
  default: { boxShadow: '0 14px 32px rgba(0,0,0,0.62)' as any } as any,
});

/**
 * Per-board identity glow ring. Returns the platform-correct shadow spec.
 * Use INSTEAD of boardOuterShadow when the board needs the identity halo.
 */
export function boardIdentityGlow(identityColor: string) {
  return Platform.select({
    ios: {
      shadowColor: identityColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 10,
    } as const,
    android: { elevation: 10 } as const,
    default: { boxShadow: `0 0 18px ${hexToRgba(identityColor, 0.55)}` as any } as any,
  });
}

/** VAMOS-PLACEMENT-POLISH D3 (#8) — toned down so face-up cards REST on the board
 *  instead of looking like they float ~6dp above it. Offset+radius+opacity all cut. */
export const cardLiftShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 5,
  } as const,
  android: { elevation: 4 } as const,
  default: { boxShadow: '0 2px 6px rgba(0,0,0,0.30)' as any } as any,
});

/** Even subtler for small (community/bc=4) cards. */
export const cardLiftShadowSmall = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  } as const,
  android: { elevation: 2 } as const,
  default: { boxShadow: '0 1px 4px rgba(0,0,0,0.25)' as any } as any,
});

/** Card-back shadow (close to surface — sits on felt). */
export const cardBackShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  } as const,
  android: { elevation: 5 } as const,
  default: { boxShadow: '0 4px 10px rgba(0,0,0,0.45)' as any } as any,
});

// ---------- Helpers ----------

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export { hexToRgba };
