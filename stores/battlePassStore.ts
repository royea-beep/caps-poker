import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BATTLE_PASS_CONFIG } from '../constants/battlePassConfig';
import { getTierForXP, awardXP } from '../utils/battlePass';

// ---------------------------------------------------------------------------
// Mission types
// ---------------------------------------------------------------------------

export interface DailyMission {
  id: string;
  desc: { en: string; he: string };
  target: number;
  xp: number;
  type: string;
  progress: number;
  completed: boolean;
}

export interface WeeklyMission extends DailyMission {}

// ---------------------------------------------------------------------------
// Mission pools
// ---------------------------------------------------------------------------

const DAILY_MISSION_POOL: Omit<DailyMission, 'progress' | 'completed'>[] = [
  {
    id: 'play_3',
    desc: { en: 'Play 3 games', he: 'שחק 3 משחקים' },
    target: 3,
    xp: 75,
    type: 'games_played',
  },
  {
    id: 'win_5_boards',
    desc: { en: 'Win 5 boards', he: 'נצח 5 בורדים' },
    target: 5,
    xp: 75,
    type: 'boards_won',
  },
  {
    id: 'win_flush',
    desc: { en: 'Win with a Flush', he: 'נצח עם צבע' },
    target: 1,
    xp: 75,
    type: 'hand_type_flush',
  },
  {
    id: 'play_online',
    desc: { en: 'Play an online game', he: 'שחק משחק אונליין' },
    target: 1,
    xp: 75,
    type: 'online_game',
  },
  {
    id: 'win_hard',
    desc: { en: 'Beat Hard bot', he: 'נצח בוט קשה' },
    target: 1,
    xp: 75,
    type: 'hard_bot_win',
  },
  {
    id: 'complete_boards',
    desc: { en: 'Win all boards', he: 'נצח את כל הבורדים' },
    target: 1,
    xp: 100,
    type: 'complete',
  },
  {
    id: 'play_5',
    desc: { en: 'Play 5 games', he: 'שחק 5 משחקים' },
    target: 5,
    xp: 100,
    type: 'games_played',
  },
  {
    id: 'win_3_row',
    desc: { en: 'Win 3 in a row', he: 'נצח 3 ברצף' },
    target: 3,
    xp: 100,
    type: 'win_streak',
  },
];

const WEEKLY_MISSION_POOL: Omit<WeeklyMission, 'progress' | 'completed'>[] = [
  {
    id: 'win_15',
    desc: { en: 'Win 15 games', he: 'נצח 15 משחקים' },
    target: 15,
    xp: 200,
    type: 'games_won',
  },
  {
    id: 'play_25',
    desc: { en: 'Play 25 games', he: 'שחק 25 משחקים' },
    target: 25,
    xp: 200,
    type: 'games_played',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO week number (Monday-based) */
function isoWeekNumber(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1 … Sun=7)
  const dayNum = tmp.getUTCDay() === 0 ? 7 : tmp.getUTCDay();
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function pickRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function makeDailyMissions(): DailyMission[] {
  return pickRandom(DAILY_MISSION_POOL, 3).map((m) => ({
    ...m,
    progress: 0,
    completed: false,
  }));
}

function makeWeeklyMission(): WeeklyMission {
  const [picked] = pickRandom(WEEKLY_MISSION_POOL, 1);
  return { ...picked, progress: 0, completed: false };
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface BattlePassState {
  currentXP: number;
  currentTier: number;
  isPremium: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
  seasonStartDate: string;

  dailyMissions: DailyMission[];
  dailyMissionsDate: string;
  weeklyMission: WeeklyMission | null;
  weeklyMissionsWeek: number;

  // Actions
  addXP: (amount: number) => { unlockedTiers: number[] };
  claimFreeReward: (tier: number) => boolean;
  claimPremiumReward: (tier: number) => boolean;
  upgradeToPremium: () => void;
  refreshDailyMissions: () => void;
  refreshWeeklyMission: () => void;
  trackMissionProgress: (type: string, amount: number) => string[];
  resetSeason: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBattlePassStore = create<BattlePassState>()(
  persist(
    (set, get) => ({
      currentXP: 0,
      currentTier: 0,
      isPremium: false,
      claimedFreeTiers: [],
      claimedPremiumTiers: [],
      seasonStartDate: new Date().toISOString(),

      dailyMissions: makeDailyMissions(),
      dailyMissionsDate: todayString(),
      weeklyMission: makeWeeklyMission(),
      weeklyMissionsWeek: isoWeekNumber(new Date()),

      // ------------------------------------------------------------------
      addXP(amount: number): { unlockedTiers: number[] } {
        const state = get();
        const result = awardXP(state.currentXP, amount);
        set({ currentXP: result.newXP, currentTier: result.newTier });
        return { unlockedTiers: result.unlockedTiers };
      },

      // ------------------------------------------------------------------
      claimFreeReward(tier: number): boolean {
        const state = get();
        if (state.currentTier < tier) return false;
        if (state.claimedFreeTiers.includes(tier)) return false;
        set({ claimedFreeTiers: [...state.claimedFreeTiers, tier] });
        return true;
      },

      // ------------------------------------------------------------------
      claimPremiumReward(tier: number): boolean {
        const state = get();
        if (!state.isPremium) return false;
        if (state.currentTier < tier) return false;
        if (state.claimedPremiumTiers.includes(tier)) return false;
        set({ claimedPremiumTiers: [...state.claimedPremiumTiers, tier] });
        return true;
      },

      // ------------------------------------------------------------------
      upgradeToPremium(): void {
        set({ isPremium: true });
      },

      // ------------------------------------------------------------------
      refreshDailyMissions(): void {
        const today = todayString();
        const state = get();
        if (state.dailyMissionsDate === today) return;
        set({
          dailyMissions: makeDailyMissions(),
          dailyMissionsDate: today,
        });
      },

      // ------------------------------------------------------------------
      refreshWeeklyMission(): void {
        const thisWeek = isoWeekNumber(new Date());
        const state = get();
        if (state.weeklyMissionsWeek === thisWeek) return;
        set({
          weeklyMission: makeWeeklyMission(),
          weeklyMissionsWeek: thisWeek,
        });
      },

      // ------------------------------------------------------------------
      trackMissionProgress(type: string, amount: number): string[] {
        const state = get();
        const completedIds: string[] = [];

        const updatedDaily = state.dailyMissions.map((mission) => {
          if (mission.type !== type || mission.completed) return mission;
          const newProgress = mission.progress + amount;
          const justCompleted = newProgress >= mission.target;
          if (justCompleted) {
            completedIds.push(mission.id);
          }
          return {
            ...mission,
            progress: newProgress,
            completed: justCompleted,
          };
        });

        let updatedWeekly = state.weeklyMission;
        if (
          updatedWeekly &&
          updatedWeekly.type === type &&
          !updatedWeekly.completed
        ) {
          const newProgress = updatedWeekly.progress + amount;
          const justCompleted = newProgress >= updatedWeekly.target;
          if (justCompleted) {
            completedIds.push(updatedWeekly.id);
          }
          updatedWeekly = { ...updatedWeekly, progress: newProgress, completed: justCompleted };
        }

        set({ dailyMissions: updatedDaily, weeklyMission: updatedWeekly });

        // Award XP for each newly completed mission
        for (const id of completedIds) {
          const daily = updatedDaily.find((m) => m.id === id);
          if (daily) {
            get().addXP(daily.xp);
          } else if (updatedWeekly && updatedWeekly.id === id) {
            get().addXP(updatedWeekly.xp);
          }
        }

        return completedIds;
      },

      // ------------------------------------------------------------------
      resetSeason(): void {
        const initialTier = getTierForXP(0, BATTLE_PASS_CONFIG);
        set({
          currentXP: 0,
          currentTier: initialTier,
          isPremium: false,
          claimedFreeTiers: [],
          claimedPremiumTiers: [],
          seasonStartDate: new Date().toISOString(),
          dailyMissions: makeDailyMissions(),
          dailyMissionsDate: todayString(),
          weeklyMission: makeWeeklyMission(),
          weeklyMissionsWeek: isoWeekNumber(new Date()),
        });
      },
    }),
    {
      name: 'battle-pass-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
