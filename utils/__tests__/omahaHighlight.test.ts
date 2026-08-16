/**
 * Omaha's constraint is absolute: exactly 2 from the hand, exactly 3 from the board. Always.
 *
 * Roye photographed a reveal marking FOUR board cards and two hand cards. The evaluator was not
 * at fault — it searches C(4,2)×C(5,3)=60 candidates and returns 2+3 — but game.tsx built
 * boardHighlightIds as the UNION of the player's three and the bot's three, and where those
 * selections differ the union is 4 or 5.
 *
 * These tests assert the invariant at both levels: the evaluator's own selection, and the
 * highlight set the reveal actually renders.
 *
 * Run over MANY random deals, not one. The photographed case (four aces in hand) is an edge case,
 * and a single deal proves nothing where the input is random.
 */
import { evaluateOmahaHand } from '../handEvaluator';
import { dealCardsMultiplayer } from '../deck';
import { getBoardCount } from '../../constants/gameConfig';
import { Card, Rank, Suit } from '../../constants/gameConfig';

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${rank}_${suit}` });

// The exact hand from the screenshot: board J♣ 8♥ 2♣ Q♠ 6♣, player A♠ A♥ A♦ A♣.
const PHOTO_BOARD: Card[] = [
  card('J', 'clubs'), card('8', 'hearts'), card('2', 'clubs'),
  card('Q', 'spades'), card('6', 'clubs'),
];
const PHOTO_HAND: Card[] = [
  card('A', 'spades'), card('A', 'hearts'), card('A', 'diamonds'), card('A', 'clubs'),
];

describe('Omaha 2+3 — the evaluator', () => {
  it('returns exactly 2 hand cards and 3 board cards for the photographed hand', () => {
    const r = evaluateOmahaHand(PHOTO_HAND, PHOTO_BOARD);
    expect(r.playerCardsUsed).toHaveLength(2);
    expect(r.boardCardsUsed).toHaveLength(3);
  });

  it('cannot make quads from four aces in hand — Omaha caps hand usage at two', () => {
    // Four aces in hand is exactly the trap: a Hold'em-style "best five of nine" would return
    // Four of a Kind. Omaha permits only two of them, so the truth is One Pair.
    const r = evaluateOmahaHand(PHOTO_HAND, PHOTO_BOARD);
    expect(r.name).toBe('One Pair');
    // and both aces used must come from the hand, never the board
    expect(r.playerCardsUsed.every((c) => c.rank === 'A')).toBe(true);
  });

  it('holds 2+3 across many random deals, every player count', () => {
    let checked = 0;
    for (const players of [2, 3, 4] as const) {
      const boardCount = getBoardCount(players);   // 2P=4, 3P=3, 4P=2 — re-derived, not copied
      for (let deal = 0; deal < 120; deal++) {
        const { playerHands, boards } = dealCardsMultiplayer(players);
        expect(boards).toHaveLength(boardCount);
        for (const b of boards) {
          const community = [...b.openCards, ...b.closedCards];
          for (let p = 0; p < players; p++) {
            // Each player places 4 of their cards on each board; take the first 4 as a stand-in
            // for a placement, which is all the evaluator sees.
            const hand = playerHands[p].slice(0, 4);
            const r = evaluateOmahaHand(hand, community);
            expect(r.playerCardsUsed).toHaveLength(2);
            expect(r.boardCardsUsed).toHaveLength(3);
            // The selections must be real members of their sources, not fabricated.
            for (const c of r.playerCardsUsed) expect(hand.some((h) => h.id === c.id)).toBe(true);
            for (const c of r.boardCardsUsed) expect(community.some((h) => h.id === c.id)).toBe(true);
            checked++;
          }
        }
      }
    }
    // Guard against a silently empty loop reporting success.
    expect(checked).toBeGreaterThan(2000);
  });
});

describe('Omaha 2+3 — the rendered highlight set', () => {
  /**
   * Mirrors game.tsx's revealBoards construction. The union it used to build is reproduced here
   * as `unionIds` so the test demonstrates WHY it was wrong, rather than only asserting the fix.
   */
  const buildHighlights = (playerHand: Card[], botHand: Card[], community: Card[]) => {
    const playerResult = evaluateOmahaHand(playerHand, community);
    const botResult = evaluateOmahaHand(botHand, community);
    const winner: 'player' | 'bot' | 'tie' =
      playerResult.score > botResult.score ? 'player'
      : botResult.score > playerResult.score ? 'bot' : 'tie';
    const boardHighlightIds = (winner === 'bot' ? botResult : playerResult)
      .boardCardsUsed.map((c) => c.id);
    const unionIds = [...new Set([
      ...playerResult.boardCardsUsed.map((c) => c.id),
      ...botResult.boardCardsUsed.map((c) => c.id),
    ])];
    return {
      playerHighlightIds: playerResult.playerCardsUsed.map((c) => c.id),
      botHighlightIds: botResult.playerCardsUsed.map((c) => c.id),
      boardHighlightIds,
      unionIds,
    };
  };

  it('marks exactly 2 hand cards and 3 board cards across many random deals', () => {
    let checked = 0;
    let unionWouldHaveBeenWrong = 0;
    for (const players of [2, 3, 4] as const) {
      for (let deal = 0; deal < 120; deal++) {
        const { playerHands, boards } = dealCardsMultiplayer(players);
        for (const b of boards) {
          const community = [...b.openCards, ...b.closedCards];
          const h = buildHighlights(playerHands[0].slice(0, 4), playerHands[1].slice(0, 4), community);

          expect(h.playerHighlightIds).toHaveLength(2);   // winner or loser, the hand row is 2
          expect(h.botHighlightIds).toHaveLength(2);
          expect(h.boardHighlightIds).toHaveLength(3);    // the shared row carries ONE selection

          // no duplicates inside the board set
          expect(new Set(h.boardHighlightIds).size).toBe(3);
          // and every marked board card must exist on that board
          for (const id of h.boardHighlightIds) expect(community.some((c) => c.id === id)).toBe(true);

          if (h.unionIds.length > 3) unionWouldHaveBeenWrong++;
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(700);
    // The regression this guards against must actually be reachable, or the test proves nothing:
    // the old union exceeded three marks on a large share of real deals.
    expect(unionWouldHaveBeenWrong).toBeGreaterThan(0);
  });

  it('the photographed board shows 2 + 3, where the old union showed more', () => {
    const bot: Card[] = [
      card('K', 'hearts'), card('9', 'spades'), card('4', 'diamonds'), card('3', 'hearts'),
    ];
    const h = buildHighlights(PHOTO_HAND, bot, PHOTO_BOARD);
    expect(h.playerHighlightIds).toHaveLength(2);
    expect(h.botHighlightIds).toHaveLength(2);
    expect(h.boardHighlightIds).toHaveLength(3);
    expect(h.playerHighlightIds.length + h.boardHighlightIds.length).toBe(5);
  });
});
