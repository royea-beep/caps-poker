/**
 * The four card primitives, and NOTHING ELSE.
 *
 * WHY THIS FILE EXISTS. `utils/handEvaluator.ts` needs exactly four things — the `Card` and `Rank`
 * types and the `RANKS` and `SUITS` arrays — and it used to take them from `constants/gameConfig`,
 * which imports `./theme`, which imports `./paintThemes`, which imports **react-native**. That chain
 * is harmless in the app and fatal in Deno: an Edge Function that imports the evaluator fails at
 * module load, on a UI framework the evaluator never touches.
 *
 * Server-side adjudication runs the SAME evaluator rather than a second implementation, so the
 * import had to stop dragging a UI framework behind it. The evaluator's body is unchanged; only
 * where it reads these four symbols from moved.
 *
 * THIS FILE MUST IMPORT NOTHING. Not a type, not a constant, not a sibling in this directory. The
 * moment anything creeps in, the Edge Function breaks — and it breaks THERE, not in the app, so
 * nobody would notice locally. If you are about to add an import here, add a new file instead.
 *
 * `constants/gameConfig.ts` re-exports all four, so every existing consumer is untouched.
 */

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}
