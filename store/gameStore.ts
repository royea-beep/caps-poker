import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig } from '../constants/gameConfig';

interface GameStore {
  chips: number;
  config: GameConfig;
  setChips: (chips: number) => void;
  addChips: (amount: number) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      chips: DEFAULT_CONFIG.startingChips,
      config: { ...DEFAULT_CONFIG },

      setChips: (chips: number) => set({ chips }),

      addChips: (amount: number) => set((state) => ({ chips: state.chips + amount })),

      updateConfig: (partial: Partial<GameConfig>) =>
        set((state) => ({ config: { ...state.config, ...partial } })),

      resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),
    }),
    {
      name: 'caps-poker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ chips: state.chips, config: state.config }),
    }
  )
);
