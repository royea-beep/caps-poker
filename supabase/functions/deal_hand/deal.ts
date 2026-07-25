// SERVER-DEAL-PHASE-A — pure, deterministic server-side deal.
//
// Reproduces utils/deck.ts (createDeck) + dealCardsMultiplayer BYTE-FOR-BYTE, with Math.random()
// replaced by a SEED-DRIVEN SHA-256 float stream. Same seed -> same deck (provable by test).
//
// Portability: uses only `node:crypto`, which runs BOTH in the Supabase Edge (Deno) runtime and in
// Node/jest — so the exact same logic is unit-tested and shipped. No Deno-only APIs here (those live
// in index.ts). The seed here is opaque hex; Phase B swaps the stream construction for
// HMAC-SHA256(server_seed, `${client_seed}:${nonce}`) — the deal/consume order stays identical.

import { createHash } from 'node:crypto';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export interface Card { suit: Suit; rank: Rank; id: string; }

// MUST match constants/gameConfig.ts:73-74 exactly — this order is part of the reproducible spec.
export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}_${suit}` });
    }
  }
  return deck;
}

/** Deterministic float in [0,1) for shuffle step `counter`, derived from the seed. Same seed -> same stream. */
function seededFloat(seedHex: string, counter: number): number {
  const h = createHash('sha256').update(`${seedHex}:${counter}`).digest();
  const u = h[0] * 0x1000000 + h[1] * 0x10000 + h[2] * 0x100 + h[3]; // first 4 bytes -> uint32
  return u / 0x100000000; // / 2^32 -> [0,1)
}

/** Identical descending Fisher-Yates to utils/deck.ts:13-20, but j is drawn from the seeded stream. */
export function seededShuffle(deck: Card[], seedHex: string): Card[] {
  const shuffled = [...deck];
  let counter = 0;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededFloat(seedHex, counter++) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function cardsPerPlayerFor(playerCount: 2 | 3 | 4): number {
  return playerCount === 2 ? 16 : playerCount === 3 ? 12 : 8;
}
export function boardCountFor(playerCount: 2 | 3 | 4): number {
  return playerCount === 2 ? 4 : playerCount === 3 ? 3 : 2;
}

export interface ServerDeal {
  playerHands: Card[][]; // SERVER ONLY — every seat's hole cards
  boards: { openCards: Card[]; closedCards: Card[] }[]; // closedCards SERVER ONLY until reveal
  discarded: Card[];
  deck: Card[]; // full shuffled deck — SERVER ONLY, never sent to any client
  seedHex: string; // SERVER ONLY in Phase A (revealed in Phase B commit-reveal)
}

/**
 * Full deal, exact consume order from FAIRNESS_PLAN.md §2 (== dealCardsMultiplayer):
 *   Phase A: all hole cards, seat-by-seat contiguous blocks.
 *   Phase B: boards board-by-board — 3 open then 2 closed.
 *   Phase C: discard the remainder.
 * Totals: 2P 32+20=52/0 discard · 3P 36+15=51/1 · 4P 32+10=42/10.
 */
export function dealFromSeed(seedHex: string, playerCount: 2 | 3 | 4): ServerDeal {
  const cardsPerPlayer = cardsPerPlayerFor(playerCount);
  const boardCount = boardCountFor(playerCount);
  const deck = seededShuffle(createDeck(), seedHex);
  let idx = 0;

  const playerHands: Card[][] = [];
  for (let p = 0; p < playerCount; p++) {
    playerHands.push(deck.slice(idx, idx + cardsPerPlayer));
    idx += cardsPerPlayer;
  }

  const boards: { openCards: Card[]; closedCards: Card[] }[] = [];
  for (let b = 0; b < boardCount; b++) {
    const openCards = deck.slice(idx, idx + 3);
    idx += 3;
    const closedCards = deck.slice(idx, idx + 2);
    idx += 2;
    boards.push({ openCards, closedCards });
  }

  const discarded = deck.slice(idx);
  return { playerHands, boards, discarded, deck, seedHex };
}

/**
 * The ONLY thing a client may receive: its own hole cards + each board's OPEN cards + a closed COUNT.
 * NEVER opponents' hole cards, NEVER any closed card. This is the no-leak boundary that closes the
 * current host-holds-the-whole-deck cheating vector.
 */
export interface PlayerDealPayload {
  playerIndex: number;
  handId: string;
  playerCount: number;
  yourCards: Card[];
  boards: { openCards: Card[]; closedCardCount: number }[];
}

export function sliceForPlayer(deal: ServerDeal, playerIndex: number, handId: string): PlayerDealPayload {
  return {
    playerIndex,
    handId,
    playerCount: deal.playerHands.length,
    yourCards: deal.playerHands[playerIndex],
    boards: deal.boards.map((b) => ({ openCards: b.openCards, closedCardCount: b.closedCards.length })),
  };
}
