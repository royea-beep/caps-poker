// Does the GENERATED evaluator actually execute outside the app? Last run I flagged this as
// inferred rather than observed: the resolver probe proved the import SHAPE resolves, not that
// handEvaluator.ts's own syntax survives a non-Metro runtime.
//
// Node's type stripping is the cheap proxy — same extensioned imports Deno needs, no bundler, no
// Babel. If this runs, the syntax is plain enough for Deno too; if it throws, better to know here
// than in a deployed function.
import { evaluateOmahaHand, compareHands } from '../supabase/functions/_shared/handEvaluator.ts';

const C = (rank, suit) => ({ rank, suit, id: `${rank}_${suit}` });

// A known board: a player holding two spades against a board with three spades makes a flush.
const board = [C('A', 'spades'), C('7', 'spades'), C('2', 'spades'), C('9', 'hearts'), C('4', 'clubs')];
const flushHand = [C('K', 'spades'), C('Q', 'spades'), C('3', 'hearts'), C('5', 'clubs')];
const pairHand = [C('A', 'hearts'), C('A', 'clubs'), C('8', 'hearts'), C('6', 'clubs')];

const a = evaluateOmahaHand(flushHand, board);
const b = evaluateOmahaHand(pairHand, board);

console.log(JSON.stringify({
  ran: true,
  flush: { rank: a.rank, score: a.score, cards: a.playerCardsUsed?.length, board: a.boardCardsUsed?.length },
  trips: { rank: b.rank, score: b.score },
  flushBeatsTrips: compareHands(a, b) > 0,
  // The structural invariant the evaluator exists to enforce: exactly 2 from hand, 3 from board.
  usesTwoAndThree: a.playerCardsUsed?.length === 2 && a.boardCardsUsed?.length === 3,
}, null, 1));
