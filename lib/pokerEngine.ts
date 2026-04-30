// Unified Poker Engine — single entrypoint for all poker math
// Wraps: pokersolver (hand naming + winner), poker-odds-calculator (equity), poker-odds-machine (Monte Carlo)
// All these are PURE-JS libs — no native dependencies, safe for OTA
//
// Usage:
//   import { evaluateBoard, calculateEquity, simulateOdds } from "@/lib/pokerEngine";

import { Card } from "@/lib/types";

// Lazy-load to keep startup fast
let _pokersolver: any = null;
let _oddsCalc: any = null;
let _oddsMachine: any = null;

function getPokersolver() {
  if (!_pokersolver) {
    try { _pokersolver = require("pokersolver"); } catch (e) { _pokersolver = null; }
  }
  return _pokersolver;
}

function getOddsCalc() {
  if (!_oddsCalc) {
    try { _oddsCalc = require("poker-odds-calculator"); } catch (e) { _oddsCalc = null; }
  }
  return _oddsCalc;
}

function getOddsMachine() {
  if (!_oddsMachine) {
    try { _oddsMachine = require("poker-odds-machine"); } catch (e) { _oddsMachine = null; }
  }
  return _oddsMachine;
}

// Convert our Card type to pokersolver string format: "Ah", "Td", "2c"
function cardToString(c: Card): string {
  const rankMap: Record<string, string> = {
    "10": "T",
  };
  const suitMap: Record<string, string> = {
    hearts: "h",
    diamonds: "d",
    clubs: "c",
    spades: "s",
  };
  const r = rankMap[c.rank] ?? c.rank;
  const s = suitMap[c.suit] ?? "?";
  return `${r}${s}`;
}

export interface BoardEval {
  rank: number;          // 0-9, higher is better (royal flush = 9)
  name: string;          // "Two Pair", "Flush", etc.
  description: string;   // "Two Pair, Aces & Kings"
  cards: string[];       // The 5 cards forming the best hand
}

/**
 * Evaluate a single board: 4 player cards + 5 community cards.
 * Returns the best 5-card hand and its name.
 */
export function evaluateBoard(playerCards: Card[], communityCards: Card[]): BoardEval | null {
  const ps = getPokersolver();
  if (!ps) return null;
  
  const allCards = [...playerCards, ...communityCards].map(cardToString);
  if (allCards.length < 5) return null;
  
  try {
    const hand = ps.Hand.solve(allCards);
    return {
      rank: hand.rank,
      name: hand.name,
      description: hand.descr,
      cards: hand.cards.map((c: any) => c.toString()),
    };
  } catch (e) {
    console.warn("[pokerEngine] evaluateBoard failed:", e);
    return null;
  }
}

/**
 * Compare 2 boards and return who wins.
 * Returns: "player" | "bot" | "tie" | null on error.
 */
export function compareBoards(
  playerEval: BoardEval | null,
  botEval: BoardEval | null
): "player" | "bot" | "tie" | null {
  if (!playerEval || !botEval) return null;
  const ps = getPokersolver();
  if (!ps) return null;
  
  try {
    // Re-solve so we can use Hand.winners
    const ph = ps.Hand.solve(playerEval.cards);
    const bh = ps.Hand.solve(botEval.cards);
    const winners = ps.Hand.winners([ph, bh]);
    if (winners.length === 2) return "tie";
    return winners[0] === ph ? "player" : "bot";
  } catch {
    return null;
  }
}

/**
 * Calculate equity (% to win) for player vs bot, given current cards + community.
 * Used by coaching hints and replay analysis.
 */
export function calculateEquity(
  playerCards: Card[],
  botCards: Card[],
  community: Card[]
): { player: number; bot: number; tie: number } | null {
  const calc = getOddsCalc();
  if (!calc) return null;
  
  try {
    const playerGroup = calc.CardGroup.fromString(playerCards.map(cardToString).join(""));
    const botGroup = calc.CardGroup.fromString(botCards.map(cardToString).join(""));
    const board = community.length > 0 
      ? calc.CardGroup.fromString(community.map(cardToString).join(""))
      : undefined;
    
    const result = calc.OddsCalculator.calculate([playerGroup, botGroup], board);
    return {
      player: result.equities[0].getEquity(),
      bot: result.equities[1].getEquity(),
      tie: result.equities[0].getTiePercentage?.() ?? 0,
    };
  } catch (e) {
    console.warn("[pokerEngine] calculateEquity failed:", e);
    return null;
  }
}

/**
 * Run Monte Carlo simulation for hand probability distribution.
 * Returns: { winProb: 0.67, handStats: { "Pair": 0.45, "Two Pair": 0.18, ... } }
 */
export function simulateOdds(
  playerCards: Card[],
  numOpponents: number = 1,
  community: Card[] = [],
  iterations: number = 10000
): { winProb: number; handStats: Record<string, number> } | null {
  const machine = getOddsMachine();
  if (!machine) return null;
  
  try {
    const input = {
      hands: [playerCards.map(cardToString).join(",")],
      numPlayers: 1 + numOpponents,
      board: community.length > 0 ? community.map(cardToString).join(",") : undefined,
      boardSize: 5,
      handSize: 4, // CAPS uses 4-card hands per board
      iterations,
      returnHandStats: true,
    };
    const c = new machine.Calculator(input);
    const s = c.simulate();
    return {
      winProb: s.winCounts ? s.winCounts[0] / iterations : 0,
      handStats: s.handStats?.[0] ?? {},
    };
  } catch (e) {
    console.warn("[pokerEngine] simulateOdds failed:", e);
    return null;
  }
}

/**
 * Find the best arrangement of 16 player cards into 4 boards of 4 cards each,
 * given the community cards on each board.
 * This is the killer feature for AI Coaching Hints.
 */
export function findBestArrangement(
  hand: Card[],            // 16 cards
  boardCommunities: Card[][] // 4 boards, each with 5 community cards
): { boards: Card[][]; totalEquity: number } | null {
  if (hand.length !== 16 || boardCommunities.length === 0) return null;
  
  // For now, return a simple heuristic: distribute cards round-robin
  // TODO: full search of all 16!/(4!^4) = ~63 valid distributions
  const boards: Card[][] = [[], [], [], []];
  hand.forEach((card, i) => {
    boards[i % 4].push(card);
  });
  
  let totalEquity = 0;
  boards.forEach((boardCards, i) => {
    const ev = evaluateBoard(boardCards, boardCommunities[i] ?? []);
    if (ev) totalEquity += ev.rank;
  });
  
  return { boards, totalEquity };
}

// Sanity check: are libraries loaded?
export function isPokerEngineReady(): { 
  pokersolver: boolean; 
  oddsCalculator: boolean; 
  oddsMachine: boolean 
} {
  return {
    pokersolver: !!getPokersolver(),
    oddsCalculator: !!getOddsCalc(),
    oddsMachine: !!getOddsMachine(),
  };
}
