/**
 * Achievements system.
 * Pure definitions + check function.
 * Call checkAchievements() in results.tsx after every hand.
 */

import { deriveHandOutcome } from './handOutcome';
import { RevealData } from '../types/gameTypes';
import { GameConfig } from '../constants/gameConfig';
import { isLocalComplete } from './resultsGating';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win',       name: 'First Victory',    description: 'Win your first game',                 reward: 100 },
  { id: 'complete_master', name: 'COMPLETE!',         description: 'Win all boards in one game',          reward: 500 },
  { id: 'streak_3',        name: 'Hot Streak',        description: 'Win 3 games in a row',                reward: 200 },
  { id: 'streak_7',        name: 'On Fire',           description: 'Win 7 games in a row',                reward: 500 },
  { id: 'play_10',         name: 'Getting Started',   description: 'Play 10 games',                       reward: 150 },
  { id: 'play_50',         name: 'Regular',           description: 'Play 50 games',                       reward: 300 },
  { id: 'hard_mode_win',   name: 'Bot Slayer',        description: 'Beat the hard bot',                   reward: 300 },
  { id: 'flush_hand',      name: 'Feeling Flushed',   description: 'Win a board with a Flush',            reward: 100 },
  { id: 'full_house',      name: 'Full House',        description: 'Win a board with a Full House',       reward: 150 },
  { id: 'royal_flush',     name: 'Royal Treatment',   description: 'Get a Royal Flush on any board',      reward: 1000 },
  { id: 'online_win',      name: 'Human Crusher',     description: 'Win an online multiplayer game',      reward: 250 },
  { id: 'underdog',        name: 'Underdog',          description: 'Win a board as the underdog (1 of 3+)', reward: 200 },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export interface AchievementCheckContext {
  revealData: RevealData;
  config: GameConfig;
  handsPlayed: number;
  handsWon: number;
  currentWinStreak: number;
  isMultiplayer: boolean;
  alreadyUnlocked: string[];
}

/** Returns array of achievement IDs newly unlocked by this game result. Never throws. */
export function checkAchievements(ctx: AchievementCheckContext): string[] {
  try {
    const { revealData, config, handsPlayed, handsWon, currentWinStreak, isMultiplayer, alreadyUnlocked } = ctx;
    const unlocked = new Set(alreadyUnlocked);
    const newlyUnlocked: string[] = [];

    function check(id: string, condition: boolean): void {
      if (!unlocked.has(id) && condition) {
        newlyUnlocked.push(id);
        unlocked.add(id);
      }
    }

    const boardsWon = revealData.boards.filter((b) => b.winner === 'player').length;
    // READER 7 - the local achievement check. Reads the SAME function the results screen does,
    // so hard_mode_win and online_win can no longer unlock on a hand the record calls a tie.
    const isWin = deriveHandOutcome(revealData.boards) === 'win';
    const difficulty = (config as any).botDifficulty ?? 'easy';

    check('first_win',       handsWon >= 1);
    // VAMOS-COMPLETE-ON-LOSS 2026-06-22 — "Win all boards in one game" must require the
    // LOCAL player to sweep. revealData.isComplete is true for EITHER player's sweep, so
    // the opponent completing used to unlock COMPLETE!+500 for the LOSER. Shared predicate.
    check('complete_master', isLocalComplete(revealData.isComplete, boardsWon, revealData.boards.length));
    check('streak_3',        currentWinStreak >= 3);
    check('streak_7',        currentWinStreak >= 7);
    check('play_10',         handsPlayed >= 10);
    check('play_50',         handsPlayed >= 50);
    check('hard_mode_win',   difficulty === 'hard' && isWin);
    check('flush_hand',      revealData.boards.some((b) => b.winner === 'player' && b.playerHandName === 'Flush'));
    check('full_house',      revealData.boards.some((b) => b.winner === 'player' && b.playerHandName === 'Full House'));
    check('royal_flush',     revealData.boards.some((b) => b.playerHandName === 'Royal Flush'));
    check('online_win',      isMultiplayer && isWin);
    check('underdog',        boardsWon === 1 && revealData.boardCount >= 3);

    return newlyUnlocked;
  } catch {
    return [];
  }
}
