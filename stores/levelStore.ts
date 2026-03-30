import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_LEVEL = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Total XP required to reach level N (1-indexed). Level 1=50, level 2=200, level 3=450 … level 20=20000 */
export function xpForLevel(level: number): number {
  return level * level * 50;
}

/** Derive current level (1–20) from total XP accumulated. */
function computeLevel(xp: number): number {
  let level = 1;
  for (let n = 2; n <= MAX_LEVEL; n++) {
    if (xp >= xpForLevel(n)) {
      level = n;
    } else {
      break;
    }
  }
  return level;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface LevelState {
  xp: number;    // total XP earned
  level: number; // current level (1-20)

  // Actions
  addXP: (amount: number) => { leveledUp: boolean; newLevel: number; previousLevel: number };
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLevelStore = create<LevelState>()(
  persist(
    (set, get) => ({
      xp: 0,
      level: 1,

      // ------------------------------------------------------------------
      addXP(amount: number): { leveledUp: boolean; newLevel: number; previousLevel: number } {
        const state = get();
        const previousLevel = state.level;
        const newXP = state.xp + amount;
        const newLevel = Math.min(computeLevel(newXP), MAX_LEVEL);
        set({ xp: newXP, level: newLevel });
        return {
          leveledUp: newLevel > previousLevel,
          newLevel,
          previousLevel,
        };
      },

      // ------------------------------------------------------------------
      reset(): void {
        set({ xp: 0, level: 1 });
      },
    }),
    {
      name: 'caps-level-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
