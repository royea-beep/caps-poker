/**
 * THE REAL EQUIVALENCE HARNESS — server outcome vs local re-evaluation.
 *
 * NOT the tautology of comparing the app evaluator to its own generated copy (byte-identical by
 * construction). This compares what `resolve_hand` RECORDED against what the evaluator computes
 * locally from the same input. The paths differ in runtime, serialisation and input handling even
 * though the algorithm is shared, and that is what is under test.
 *
 * THE TRICK THAT MAKES IT AFFORDABLE. anon cannot read game_hands (401 — correct, the deal is
 * exactly what a client must not see), and shipping 10 decks into a tool call costs kilobytes per
 * hand. So BOTH SIDES DERIVE THE SAME DEAL FROM A SEED: the deck is ordered by md5(seed || card_id)
 * in SQL and by the identical md5 ordering here. Only the seed crosses the boundary.
 *
 *   node tests/equivalence-harness.mjs            prints the local expectation as JSON
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { evaluateOmahaHand, compareHands } = await import('../supabase/functions/_shared/handEvaluator.ts');

const RANKS = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
const SUITS = ['spades','hearts','diamonds','clubs'];
const DECK = [];
for (const r of RANKS) for (const s of SUITS) DECK.push({ id: `${r}_${s}`, rank: r, suit: s });

const md5 = (x) => createHash('md5').update(x).digest('hex');

/** Same ordering SQL uses: order by md5(seed || id). */
function deckFor(seed) {
  return [...DECK].sort((a, b) => {
    const ha = md5(seed + a.id), hb = md5(seed + b.id);
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
}

/** 2 players, 4 boards: 16 + 16 hole cards, then 4 boards of 3 open + 2 closed. */
function layout(seed) {
  const d = deckFor(seed);
  const seats = [d.slice(0, 16), d.slice(16, 32)];
  const boards = [];
  for (let b = 0; b < 4; b++) {
    const base = 32 + b * 5;
    boards.push({ open: d.slice(base, base + 3), closed: d.slice(base + 3, base + 5) });
  }
  return { seats, boards };
}

const seeds = process.argv.slice(2);
const out = {};
for (const seed of seeds) {
  const { seats, boards } = layout(seed);
  const winners = [];
  for (let b = 0; b < 4; b++) {
    const community = [...boards[b].open, ...boards[b].closed];
    // placements are the dealt order, four per board — the same rule the server auto-fills with
    const results = seats.map((cards) => evaluateOmahaHand(cards.slice(b * 4, b * 4 + 4), community));
    let best = 0, tied = [0];
    for (let i = 1; i < results.length; i++) {
      const c = compareHands(results[i], results[best]);
      if (c > 0) { best = i; tied = [i]; } else if (c === 0) tied.push(i);
    }
    winners.push(tied.length > 1 ? -1 : best);
  }
  out[seed] = winners;
}
console.log(JSON.stringify(out));
