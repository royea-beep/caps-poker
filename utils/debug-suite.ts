/**
 * Caps Poker — Auto-Debug Test Suite
 * 7 steps covering core game logic, tested in sequence.
 * Steps test REAL code paths — not UI navigation.
 */

import { DebugStep } from './auto-debug'
import { HandRank, evaluateOmahaHand } from './handEvaluator'
import { createDeck, shuffleDeck, dealCards } from './deck'
import { initializeGame, initializeGameMulti, calculateHandResults } from './gameLogic'
import { simulateBatch } from './simulate'
import { getMatchCost, canAffordMatch, getEconomyStatus } from './economy'
import { getHandHint } from './handHint'
import { DEFAULT_CONFIG } from '../constants/gameConfig'
import type { Card } from '../constants/gameConfig'

export const CAPS_DEBUG_STEPS: DebugStep[] = [
  {
    id: 1,
    name: 'Deck: create + shuffle (52 cards, no duplicates)',
    timeout: 3000,
    action: () => {
      const deck = createDeck()
      if (deck.length !== 52) throw new Error(`Expected 52 cards, got ${deck.length}`)
      const shuffled = shuffleDeck([...deck])
      if (shuffled.length !== 52) throw new Error(`Shuffle lost cards: ${shuffled.length}`)
      const ids = shuffled.map(c => c.id)
      const unique = new Set(ids)
      if (unique.size !== 52) throw new Error(`Duplicate cards after shuffle: ${52 - unique.size} dupes`)
    },
  },

  {
    id: 2,
    name: 'Hand evaluator: royal flush + full house detection',
    timeout: 3000,
    action: () => {
      // Royal flush: A♠ K♠ Q♠ J♠ in player hand, 10♠ on board
      const makeCard = (rank: string, suit: string, id: string): Card =>
        ({ rank: rank as Card['rank'], suit: suit as Card['suit'], id })

      const playerCards: Card[] = [
        makeCard('A', 'spades', 'as'),
        makeCard('K', 'spades', 'ks'),
        makeCard('Q', 'spades', 'qs'),
        makeCard('J', 'spades', 'js'),
      ]
      const boardCards: Card[] = [
        makeCard('10', 'spades', '10s'),
        makeCard('2', 'hearts', '2h'),
        makeCard('3', 'clubs', '3c'),
      ]
      const result = evaluateOmahaHand(playerCards, boardCards)
      if (result.rank !== HandRank.RoyalFlush) {
        throw new Error(`Royal flush not detected — got rank ${result.rank}`)
      }

      // Full house: three Aces + two Kings
      const playerCards2: Card[] = [
        makeCard('A', 'spades', 'as2'),
        makeCard('A', 'hearts', 'ah2'),
        makeCard('K', 'spades', 'ks2'),
        makeCard('K', 'hearts', 'kh2'),
      ]
      const boardCards2: Card[] = [
        makeCard('A', 'clubs', 'ac2'),
        makeCard('2', 'diamonds', '2d2'),
        makeCard('4', 'clubs', '4c2'),
      ]
      const result2 = evaluateOmahaHand(playerCards2, boardCards2)
      if (result2.rank !== HandRank.FullHouse) {
        throw new Error(`Full house not detected — got rank ${result2.rank}`)
      }
    },
  },

  {
    id: 3,
    name: 'Game init: dealCards() — correct player/board card counts',
    timeout: 3000,
    action: () => {
      const deal = dealCards()
      if (!deal.playerHand || deal.playerHand.length !== 4) {
        throw new Error(`Player hand should have 4 cards, got ${deal.playerHand?.length}`)
      }
      if (!deal.boards || deal.boards.length === 0) {
        throw new Error('No boards dealt')
      }
      for (let i = 0; i < deal.boards.length; i++) {
        const b = deal.boards[i]
        const total = b.openCards.length + b.closedCards.length
        if (total < 4) throw new Error(`Board ${i} has only ${total} cards`)
      }
    },
  },

  {
    id: 4,
    name: 'Game logic: initializeGame() — no crash, phases valid',
    timeout: 3000,
    action: () => {
      const { gameState } = initializeGame()
      if (!gameState) throw new Error('initializeGame returned no state')
      if (gameState.phase !== 'arrangement') {
        throw new Error(`Expected phase 'arrangement', got '${gameState.phase}'`)
      }
      if (!gameState.boards?.length) throw new Error('No boards in game state')

      // Also test multiplayer init
      const multiState = initializeGameMulti(2)
      if (!multiState || !multiState.boards?.length) throw new Error('initializeGameMulti(2) failed')
    },
  },

  {
    id: 5,
    name: 'Simulation: simulateBatch(2P, 20 hands) — zero-sum verified',
    timeout: 8000,
    action: () => {
      const result = simulateBatch(2, 20, DEFAULT_CONFIG)
      if (!result.zeroSumVerified) {
        throw new Error(`Zero-sum FAILED — chip conservation broken`)
      }
      if (result.errors.length > 0) {
        throw new Error(`Simulation errors: ${result.errors.slice(0, 3).join('; ')}`)
      }
      if (result.handsRun !== 20) {
        throw new Error(`Expected 20 hands, ran ${result.handsRun}`)
      }
    },
  },

  {
    id: 6,
    name: 'Economy: match cost + afford check + status',
    timeout: 3000,
    action: () => {
      const cost = getMatchCost(DEFAULT_CONFIG.potPerBoard, 2)
      if (cost <= 0) throw new Error(`Match cost must be > 0, got ${cost}`)

      const canAfford = canAffordMatch(1000, cost)
      if (!canAfford) throw new Error(`1000 chips should afford cost ${cost}`)

      const cantAfford = canAffordMatch(0, cost)
      if (cantAfford) throw new Error(`0 chips should not afford cost ${cost}`)

      const status = getEconomyStatus(1000, DEFAULT_CONFIG.potPerBoard, 2, null, 0, null)
      if (!status) throw new Error('getEconomyStatus returned null')
    },
  },

  {
    id: 7,
    name: 'Hand hints: known cards return non-empty hint',
    timeout: 3000,
    action: () => {
      const makeCard = (rank: string, suit: string, id: string): Card =>
        ({ rank: rank as Card['rank'], suit: suit as Card['suit'], id })

      const cards: Card[] = [
        makeCard('A', 'spades', 'as'),
        makeCard('A', 'hearts', 'ah'),
        makeCard('A', 'clubs', 'ac'),
        makeCard('K', 'spades', 'ks'),
      ]
      const hint = getHandHint(cards)
      if (!hint) throw new Error('Hand hint returned empty for trip aces')
    },
  },
]
