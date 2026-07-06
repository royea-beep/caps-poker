import { THEME } from './theme';

// VAMOS S-BATCH 2026-07-02 — COMPLETE bonus % scaled by board count (2 boards is the
// easiest sweep AND the biggest pot, so flat 50% over-rewarded 4P). Values come from
// app_config key `complete_bonus_pct_by_boards` (e.g. {"2":25,"3":50,"4":75}), fetched
// once per session in _layout. No remote map -> fallback to config.completeBonusPercent
// (current flat 50) so offline/jest behavior is unchanged.
let _remoteBonusPctByBoards: Record<string, number> | null = null;
export function setCompleteBonusPctByBoards(map: unknown): void {
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    _remoteBonusPctByBoards = map as Record<string, number>;
  }
}
export function getCompleteBonusPercent(boardCount: number, fallbackPct: number): number {
  const remote = _remoteBonusPctByBoards?.[String(boardCount)];
  return typeof remote === 'number' && remote >= 0 ? remote : fallbackPct;
}

// SHIP-MP-REVEAL 2026-07-06 — fast remote kill-switch. mpBoardReveal is shipping without a
// real 2-device confirmation (owner accepted the risk); this lets the strategist disable it
// from app_config (key `mp_board_reveal_enabled`) with no code deploy if the reveal turns out
// broken on real devices. Same "fetch once in _layout, default to the client const on any
// failure" pattern as _remoteBonusPctByBoards above — no remote row / fetch failure / RLS
// issue -> DEFAULT_CONFIG.mpBoardReveal (true) still applies, so this can never regress
// offline/jest behavior.
let _remoteMpBoardRevealEnabled: boolean | null = null;
export function setMpBoardRevealEnabled(value: unknown): void {
  if (typeof value === 'boolean') {
    _remoteMpBoardRevealEnabled = value;
  }
}
export function isMpBoardRevealEnabled(): boolean {
  return _remoteMpBoardRevealEnabled ?? DEFAULT_CONFIG.mpBoardReveal;
}

export const DEFAULT_CONFIG = {
  arrangementTime: 60,
  boardRevealDuration: 5,
  turnRevealDelay: 800,
  completeBonusDisplay: 3,
  // VAMOS UX-BATCH-2b 2026-07-02 — aligned to the server baseline (leaderboard.total_chips
  // column default = 2000). The 1000-vs-2000 split made fresh devices push 1000+X over the
  // server's 2000 via submit_score (client-wins upsert) before the first adoption ran.
  startingChips: 2000,
  potPerBoard: 25,
  completeBonusPercent: 50,
  numberOfPlayers: 2,
  botSpeedMin: 1500,
  botSpeedMax: 4000,
  soundEnabled: true as boolean,
  soundVolume: 0.8 as number,
  revealSpeed: 'normal' as 'fast' | 'normal' | 'cinematic',
  botDifficulty: 'easy' as 'easy' | 'medium' | 'hard',
  /**
   * MP-RENDER-PARITY 2026-06-28, ENABLED 2026-07-06 (FIX-MP-REVEAL-ANIMATION) — when
   * true, MP plays the same <BoardReveal> animation SOLO plays before navigating to
   * /results, instead of jumping straight to the final result. Owner confirmed on
   * 2 real devices that MP itself works end-to-end (join, cards, correct final
   * result) — the only gap was this flag being off, so both host and guest skipped
   * setPendingRevealBoards/setShowSafeReveal entirely (app/multiplayer-game.tsx
   * lines ~638 and ~763) and fell straight through to router.replace('/results').
   * Both host and guest already build the exact same RevealBoardData[] shape SOLO
   * does (adaptRevealBoardsForReveal), so no new rendering path is needed — this
   * flag was the entire gap. Paired with feat/mp-stability's BOARD_REVEAL
   * ACK+retry + guest-side grace period (this branch is based on that one) so the
   * staged per-board animation isn't waiting on data that never reliably arrives.
   */
  mpBoardReveal: true,
};

export type GameConfig = typeof DEFAULT_CONFIG;

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

/** @deprecated Default for 2 players only. Use getBoardCount(numberOfPlayers) for dynamic count. */
export const NUM_BOARDS = 4;
export const CARDS_PER_BOARD = 4;
export const BOARD_COMMUNITY_CARDS = 5;
export const BOARD_OPEN_CARDS = 3;
export const BOARD_CLOSED_CARDS = 2;
/** @deprecated Default for 2 players only. Use getCardsPerPlayer(numberOfPlayers) for dynamic count. */
export const PLAYER_HAND_SIZE = 16;

/** Board count depends on player count (52-card deck constraint) */
export function getBoardCount(numberOfPlayers: number): number {
  if (numberOfPlayers === 3) return 3;
  if (numberOfPlayers === 4) return 2;
  return 4;
}

/** Cards per player depends on player count */
export function getCardsPerPlayer(numberOfPlayers: number): number {
  if (numberOfPlayers === 3) return 12;
  if (numberOfPlayers === 4) return 8;
  return 16;
}

/** Unique board accent colors — gives each board visual identity */
export const BOARD_COLORS = [
  '#FFD700', // Board 1 — gold
  '#4FC3F7', // Board 2 — blue
  '#81C784', // Board 3 — green
  '#FF8A65', // Board 4 — orange
] as const;

/** Card sizing based on player count (more players = fewer boards = bigger cards) */
export const CARD_SCALE: Record<number, { cardHeight: number; communityScale: number }> = {
  2: { cardHeight: 60, communityScale: 1.15 },  // 4 boards — tightest, needs biggest relative boost
  3: { cardHeight: 66, communityScale: 1.1  },  // 3 boards
  4: { cardHeight: 74, communityScale: 1.1  },  // 2 boards — most space
};

/**
 * Responsive card sizing for native — derived from screen width so cards are
 * readable on ALL iPhones (375pt SE/mini through 430pt Plus/Max).
 *
 * Width-based approach: fit 5 community cards in a row with realistic overhead,
 * then scale player card height proportionally.
 *
 * overhead breakdown:
 *   boardsColumn paddingHorizontal(16×2=32) + pressableInner padding(16) +
 *   rowLabel width(20) + 4 card gaps(6×4=24) + separator(~8) = 100px
 */
export function getCardDimensions(
  screenWidth: number,
  numberOfPlayers: 2 | 3 | 4,
): { cardHeight: number; cardWidth: number; communityScale: number } {
  const communityScale = CARD_SCALE[numberOfPlayers]?.communityScale ?? 1.1;
  const overhead = 120;
  const commW = Math.min(50, Math.max(28, Math.floor((screenWidth - overhead) / 5)));
  const commH = Math.round(commW / 0.7);
  const cardH = Math.max(38, Math.min(88, Math.round(commH / communityScale)));
  return { cardHeight: cardH, cardWidth: Math.round(cardH * 0.7), communityScale };
}

// Re-export for backward compatibility
export const COLORS = THEME.colors;
