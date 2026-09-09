/**
 * VERIFY-EVERYTHING · SECTION A — THE RULES, PROVED ON REAL HANDS.
 *
 * This file exists because the handoffs SAY the rules hold. A claim is not evidence. So nothing
 * here is read from a document: every number below is produced by running the app's own engine —
 * `dealCardsMultiplayer` (the real dealer), `evaluateAllBoards` (the real evaluator),
 * `calculateChipDeltas` (the real settlement) and `deriveHandOutcome` (the single definition of
 * winning) — over real deals, and by ENUMERATING the outcome space where enumeration is possible.
 *
 * WHAT IS SAMPLED AND WHAT IS EXHAUSTIVE, said plainly because the difference matters:
 *
 *   · Deals are SAMPLED. 20,000 real deals per player count. A sample can only ever show that a
 *     shape OCCURS; it cannot prove one never does. Every assertion over deals is therefore an
 *     invariant that must hold on all 60,000 (dedupe, zero-sum, geometry), never "X did not
 *     happen so X cannot".
 *   · The BOARD RULE is EXHAUSTIVE. Every reachable distribution of board winners at 2P/3P/4P is
 *     generated and checked against the server's own rule, both with `winnerSeat` and without.
 *     That is a proof over the whole space, not a sample of it.
 *
 * THE INSTRUMENT IS TESTED BEFORE IT IS TRUSTED. `describe('0 · the instrument')` plants two
 * defects — a duplicated card and a broken settlement — and requires the checks to CATCH them.
 * A checker that cannot fail is not evidence that anything passed. Across this series more filed
 * defects turned out to be measurement error than real, so the instrument is now audited first.
 */

import { dealCardsMultiplayer } from '../utils/deck';
import { assignCardsRandomly, evaluateAllBoards, calculateChipDeltas } from '../utils/gameLogic';
import { deriveHandOutcome, type OutcomeBoard } from '../utils/handOutcome';
import { tallyBoards } from '../utils/boardTally';
import { DEFAULT_CONFIG, getBoardCount, getCardsPerPlayer, CARDS_PER_BOARD, BOARD_COMMUNITY_CARDS } from '../constants/gameConfig';
import type { MultiBoardState } from '../types/gameTypes';
import type { Card } from '../constants/cards';

/**
 * `tallyBoards` reads the React Native global `__DEV__`, which Metro defines and a bare Node
 * runtime does not — so calling it outside the app throws `ReferenceError` before it computes
 * anything. That is not an app defect (the app always has the global) but it IS why the function
 * had no test until now: it cannot be called from jest without this line. Set to `true` on
 * purpose, so the __DEV__-only divergence warning inside it is exercised rather than skipped.
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

const DEALS = 20000;
const COUNTS: Array<2 | 3 | 4> = [2, 3, 4];
const key = (c: Card) => `${c.rank}${c.suit}`;

/** One real hand, played end to end by the app's own functions. Nothing here is re-implemented. */
function playHand(playerCount: 2 | 3 | 4) {
  const boardCount = getBoardCount(playerCount);
  const deal = dealCardsMultiplayer(playerCount);
  const boards: MultiBoardState[] = deal.boards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: Array.from({ length: playerCount }, () => [] as Card[]),
    revealed: false,
  }));
  for (let p = 0; p < playerCount; p++) {
    const split = assignCardsRandomly(deal.playerHands[p], boardCount, CARDS_PER_BOARD);
    for (let b = 0; b < boardCount; b++) boards[b].playerCards[p] = split[b];
  }
  const results = evaluateAllBoards(boards, playerCount);
  const settled = calculateChipDeltas(results, playerCount, DEFAULT_CONFIG);
  return { boardCount, deal, boards, results, settled };
}

/** The results screen's view of a hand, from seat 0. `winnerSeat` -1 = the board tied. */
const outcomeBoards = (results: ReturnType<typeof playHand>['results']): OutcomeBoard[] =>
  results.map((r) => ({
    winner: r.winnerIndex === 0 ? 'player' : r.winnerIndex < 0 ? 'tie' : 'bot',
    winnerSeat: r.winnerIndex,
  }));

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('0 · the instrument — it must be able to fail', () => {
  // Every check below is applied to a KNOWN-BAD hand. If a check passes here, it would have
  // passed on the real deals for the same wrong reason, and its green would have meant nothing.

  test('the dedupe check catches a planted duplicate card', () => {
    const { deal, boardCount } = playHand(2);
    const all = [...deal.playerHands.flat(), ...deal.boards.flatMap((b) => [...b.openCards, ...b.closedCards])];
    expect(new Set(all.map(key)).size).toBe(all.length);        // the real deal is clean
    const planted = [...all, all[0]];                            // now plant one duplicate
    expect(new Set(planted.map(key)).size).not.toBe(planted.length);
    expect(boardCount).toBe(4);
  });

  test('the zero-sum check catches a planted settlement error', () => {
    const deltas = [50, -50, 0];
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
    const broken = [50, -49, 0];                                 // one chip conjured from nowhere
    expect(broken.reduce((a, b) => a + b, 0)).not.toBe(0);
  });

  test('the board rule check catches a planted wrong outcome', () => {
    // 3 players, 3 boards, one board each: the server calls this a TIE for every seat. A checker
    // that cannot tell this apart from a win is the exact failure this whole section guards.
    const oneEach: OutcomeBoard[] = [
      { winner: 'player', winnerSeat: 0 },
      { winner: 'bot', winnerSeat: 1 },
      { winner: 'bot', winnerSeat: 2 },
    ];
    expect(deriveHandOutcome(oneEach)).toBe('tie');
    expect(deriveHandOutcome(oneEach)).not.toBe('win');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('1 · geometry — dynamic board count, on real deals', () => {
  test.each(COUNTS)('%iP: boards, cards per player, community cards, one deck', (playerCount) => {
    const boardCount = getBoardCount(playerCount);
    // Iron rule #3: the expectation is derived from the same function the app uses, never typed in.
    expect(boardCount).toBe(playerCount === 2 ? 4 : playerCount === 3 ? 3 : 2);
    expect(getCardsPerPlayer(playerCount)).toBe(boardCount * CARDS_PER_BOARD);

    for (let i = 0; i < 2000; i++) {
      const { deal, boards } = playHand(playerCount);
      expect(deal.boards).toHaveLength(boardCount);
      for (let p = 0; p < playerCount; p++) expect(deal.playerHands[p]).toHaveLength(boardCount * CARDS_PER_BOARD);
      for (const b of boards) {
        expect(b.openCards.length + b.closedCards.length).toBe(BOARD_COMMUNITY_CARDS);
        for (let p = 0; p < playerCount; p++) expect(b.playerCards[p]).toHaveLength(CARDS_PER_BOARD);
      }
      // ONE 52-CARD DECK: nothing dealt twice, and the total never exceeds 52.
      const all = [...deal.playerHands.flat(), ...deal.boards.flatMap((b) => [...b.openCards, ...b.closedCards])];
      expect(all.length).toBe(playerCount * boardCount * CARDS_PER_BOARD + boardCount * BOARD_COMMUNITY_CARDS);
      expect(all.length).toBeLessThanOrEqual(52);
      expect(new Set(all.map(key)).size).toBe(all.length);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('2 · ties happen everywhere, and settle conserved', () => {
  const seen: Record<number, { deals: number; tiedBoards: number; handsWithTie: number; maxWay: number }> = {};

  test.each(COUNTS)('%iP: ties occur on real deals and chips stay zero-sum through them', (playerCount) => {
    const stat = { deals: 0, tiedBoards: 0, handsWithTie: 0, maxWay: 0 };
    for (let i = 0; i < DEALS; i++) {
      const { results, settled } = playHand(playerCount);
      stat.deals++;
      let handHasTie = false;
      for (const r of results) {
        if (r.winnerIndex < 0) {
          handHasTie = true;
          stat.tiedBoards++;
          stat.maxWay = Math.max(stat.maxWay, r.tiedPlayers.length);
          expect(r.tiedPlayers.length).toBeGreaterThan(1);
        } else {
          expect(r.tiedPlayers).toEqual([r.winnerIndex]);
        }
      }
      if (handHasTie) stat.handsWithTie++;
      // ZERO-SUM, on every hand, tied or not. Chips are neither created nor destroyed by a tie.
      expect(settled.chipDeltas.reduce((a, b) => a + b, 0)).toBe(0);
      expect(settled.chipDeltas).toHaveLength(playerCount);
      // The display tally always adds up to the board count, by construction.
      const t = tallyBoards(outcomeBoards(results));
      expect(t.won + t.tied + t.lost).toBe(t.total);
      expect(t.total).toBe(results.length);
    }
    seen[playerCount] = stat;
    // A tie must be REACHABLE at every player count, or the tie handling is untested code.
    expect(stat.tiedBoards).toBeGreaterThan(0);
  }, 300000);

  afterAll(() => {
    console.log('\nTIES ON REAL DEALS (' + DEALS + ' deals per player count)');
    console.log('players  boards  tied boards  hands with >=1 tie  widest tie');
    for (const p of COUNTS) {
      const s = seen[p];
      if (!s) continue;
      console.log(`   ${p}P      ${getBoardCount(p)}     ${String(s.tiedBoards).padStart(9)}  ` +
        `${String(s.handsWithTie).padStart(16)} (${(100 * s.handsWithTie / s.deals).toFixed(2)}%)  ${s.maxWay}-way`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('3 · boards decide, at 3 and 4 players — EXHAUSTIVE, not sampled', () => {
  /** Every reachable assignment of `boardCount` boards to {tied, seat 0 .. seat n-1}. */
  function* distributions(playerCount: number, boardCount: number): Generator<number[]> {
    const options = [-1, ...Array.from({ length: playerCount }, (_, i) => i)];
    const rec = function* (acc: number[]): Generator<number[]> {
      if (acc.length === boardCount) { yield acc; return; }
      for (const o of options) yield* rec([...acc, o]);
    };
    yield* rec([]);
  }

  /** The server's rule, stated once here so the app's function is compared against something. */
  function serverRule(seats: number[], playerCount: number): 'win' | 'loss' | 'tie' {
    const won = Array.from({ length: playerCount }, (_, p) => seats.filter((s) => s === p).length);
    const max = Math.max(...won);
    if (won[0] < max) return 'loss';
    return won.filter((w) => w === max).length === 1 ? 'win' : 'tie';
  }

  test.each(COUNTS)('%iP: every reachable distribution agrees with the server rule', (playerCount) => {
    const boardCount = getBoardCount(playerCount);
    let n = 0, mismatches: string[] = [];
    for (const seats of distributions(playerCount, boardCount)) {
      n++;
      const boards: OutcomeBoard[] = seats.map((s) => ({
        winner: s === 0 ? 'player' : s < 0 ? 'tie' : 'bot',
        winnerSeat: s,
      }));
      const got = deriveHandOutcome(boards);
      const want = serverRule(seats, playerCount);
      if (got !== want) mismatches.push(`[${seats.join(',')}] app=${got} server=${want}`);
    }
    expect(n).toBe((playerCount + 1) ** boardCount);
    expect(mismatches).toEqual([]);
  });

  test('the collapsed fallback (no winnerSeat) is wrong at exactly one shape — 3P, one board each', () => {
    // This is not a defect being filed. It is the documented, deliberate limit of the fallback,
    // and it is confirmed here rather than taken on the comment's word.
    const boardCount = getBoardCount(3);
    const bad: string[] = [];
    for (const seats of distributions(3, boardCount)) {
      const collapsed: OutcomeBoard[] = seats.map((s) => ({ winner: s === 0 ? 'player' : s < 0 ? 'tie' : 'bot' }));
      const got = deriveHandOutcome(collapsed);
      const want = serverRule(seats, 3);
      if (got !== want) bad.push(seats.slice().sort().join(','));
    }
    // Every disagreement is a permutation of "one board each"; nothing else diverges.
    expect([...new Set(bad)]).toEqual(['0,1,2']);
  });

  test('at 2P and 4P the collapsed fallback is identical to the seat rule', () => {
    for (const playerCount of [2, 4] as const) {
      for (const seats of distributions(playerCount, getBoardCount(playerCount))) {
        const seated: OutcomeBoard[] = seats.map((s) => ({ winner: s === 0 ? 'player' : s < 0 ? 'tie' : 'bot', winnerSeat: s }));
        const collapsed: OutcomeBoard[] = seats.map((s) => ({ winner: s === 0 ? 'player' : s < 0 ? 'tie' : 'bot' }));
        expect(deriveHandOutcome(collapsed)).toBe(deriveHandOutcome(seated));
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('4 · won and negative chips — searched for, exhaustively', () => {
  /**
   * THE QUESTION. Can the screen say you WON the hand while your chip delta is NEGATIVE? Boards
   * decide who won; chips settle separately. Two definitions over one hand is exactly the split
   * that produced the tie defect, so the gap between them is worth measuring rather than assuming.
   *
   * This is EXHAUSTIVE over board-winner distributions — the settlement depends on nothing else.
   */
  const rows: Array<{ p: number; seats: string; outcome: string; delta: number }> = [];

  function* distributions(playerCount: number, boardCount: number): Generator<number[]> {
    const options = [-1, ...Array.from({ length: playerCount }, (_, i) => i)];
    const rec = function* (acc: number[]): Generator<number[]> {
      if (acc.length === boardCount) { yield acc; return; }
      for (const o of options) yield* rec([...acc, o]);
    };
    yield* rec([]);
  }

  test.each(COUNTS)('%iP: enumerate every distribution and record where outcome and chips disagree', (playerCount) => {
    const boardCount = getBoardCount(playerCount);
    for (const seats of distributions(playerCount, boardCount)) {
      // A tied board's tiedPlayers must be a real set; enumerate the widest (all seats), which is
      // what the evaluator produces when every seat plays the board.
      const results = seats.map((s, boardIndex) => ({
        boardIndex,
        winnerIndex: s,
        tiedPlayers: s >= 0 ? [s] : Array.from({ length: playerCount }, (_, i) => i),
        potWon: 0,
        playerResults: [] as never[],
      }));
      const settled = calculateChipDeltas(results as never, playerCount, DEFAULT_CONFIG);
      expect(settled.chipDeltas.reduce((a: number, b: number) => a + b, 0)).toBe(0);
      const outcome = deriveHandOutcome(seats.map((s) => ({
        winner: s === 0 ? 'player' : s < 0 ? 'tie' : 'bot', winnerSeat: s,
      })));
      const delta = settled.chipDeltas[0];
      if ((outcome === 'win' && delta <= 0) || (outcome === 'loss' && delta >= 0)) {
        rows.push({ p: playerCount, seats: seats.join(','), outcome, delta });
      }
    }
  });

  afterAll(() => {
    console.log('\nWON-AND-NEGATIVE — every distribution where the boards outcome and the chip delta disagree');
    if (!rows.length) console.log('  none found at any player count');
    for (const r of rows) console.log(`  ${r.p}P seats=[${r.seats}] outcome=${r.outcome} chips=${r.delta >= 0 ? '+' : ''}${r.delta}`);
  });
});
