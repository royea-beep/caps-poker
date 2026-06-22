// VAMOS-HAND-TIEBREAK 2026-06-22 — TASK 1: profile the same-category comparator.
// Strategist live QA reported ~92% tie rate on SAME-type boards ("a pair doesn't beat
// a pair"). These tests pin down whether the comparator walks the full kicker vector.
import { evaluate5Cards, evaluateOmahaHand, compareHands } from '../handEvaluator';
import type { Card, Rank, Suit } from '../../constants/gameConfig';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${rank}-${suit}` });
const H: Suit = 'hearts', D: Suit = 'diamonds', C: Suit = 'clubs', S: Suit = 'spades';

// Compare two 5-card hands by score (the comparator used for same-category hands).
const cmp = (a: Card[], b: Card[]): number => evaluate5Cards(a).score - evaluate5Cards(b).score;

describe('VAMOS-HAND-TIEBREAK — same-category comparator (5-card)', () => {
  it('1. One Pair Kings + A kicker beats One Pair Kings + Q kicker', () => {
    const a = [c('K', H), c('K', D), c('A', C), c('9', S), c('5', H)];
    const b = [c('K', C), c('K', S), c('Q', D), c('9', H), c('5', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('2. One Pair Aces beats One Pair Kings', () => {
    const a = [c('A', H), c('A', D), c('9', C), c('5', S), c('3', H)];
    const b = [c('K', C), c('K', S), c('9', D), c('5', H), c('3', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('3. Two Pair K&7 + A kicker beats Two Pair K&7 + Q kicker', () => {
    const a = [c('K', H), c('K', D), c('7', C), c('7', S), c('A', H)];
    const b = [c('K', C), c('K', S), c('7', D), c('7', H), c('Q', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('4. Two Pair A&2 beats Two Pair K&Q', () => {
    const a = [c('A', H), c('A', D), c('2', C), c('2', S), c('9', H)];
    const b = [c('K', C), c('K', S), c('Q', D), c('Q', H), c('9', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('5. High card A K Q J 9 beats A K Q J 8', () => {
    const a = [c('A', H), c('K', D), c('Q', C), c('J', S), c('9', H)];
    const b = [c('A', C), c('K', S), c('Q', D), c('J', H), c('8', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('6. Trip 8s kickers A,K beats Trip 8s kickers A,Q', () => {
    const a = [c('8', H), c('8', D), c('8', C), c('A', S), c('K', H)];
    const b = [c('8', C), c('8', S), c('8', H), c('A', D), c('Q', C)];
    expect(cmp(a, b)).toBeGreaterThan(0);
  });

  it('7. Genuinely identical 5-card ranks are a TRUE tie', () => {
    const a = [c('K', H), c('K', D), c('A', C), c('9', S), c('5', H)];
    const b = [c('K', C), c('K', S), c('A', D), c('9', H), c('5', C)];
    expect(cmp(a, b)).toBe(0);
  });
});

describe('VAMOS-HAND-TIEBREAK — real Omaha path (evaluateOmahaHand + compareHands)', () => {
  it('same pair on a shared board is decided by kicker (not a tie)', () => {
    // Shared board: one King, no pairs/flush/straight.
    const board = [c('K', S), c('9', H), c('5', C), c('3', D), c('2', S)];
    // A: K + A kicker; B: K + Q kicker (both pair Kings via the board King).
    const aHole = [c('K', D), c('A', C), c('7', H), c('4', S)];
    const bHole = [c('K', H), c('Q', C), c('8', D), c('6', S)];
    const a = evaluateOmahaHand(aHole, board);
    const b = evaluateOmahaHand(bHole, board);
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('truly identical hole-pair + identical board kickers is a TRUE tie', () => {
    const board = [c('A', H), c('K', C), c('Q', D), c('7', S), c('2', H)];
    const aHole = [c('9', D), c('9', C), c('4', S), c('3', H)]; // pair 9s + A,K,Q
    const bHole = [c('9', H), c('9', S), c('5', C), c('2', D)]; // pair 9s + A,K,Q
    const a = evaluateOmahaHand(aHole, board);
    const b = evaluateOmahaHand(bHole, board);
    expect(compareHands(a, b)).toBe(0);
  });
});
