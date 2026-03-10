import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig } from '../constants/gameConfig';

interface GameStore {
  chips: number;
  config: GameConfig;
  setChips: (chips: number) => void;
  addChips: (amount: number) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;
  loadPersistedData: () => Promise<void>;
  persistChips: (chips: number) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  chips: DEFAULT_CONFIG.startingChips,
  config: { ...DEFAULT_CONFIG },

  setChips: (chips: number) => {
    set({ chips });
    get().persistChips(chips);
  },

  addChips: (amount: number) => {
    const newChips = get().chips + amount;
    set({ chips: newChips });
    get().persistChips(newChips);
  },

  updateConfig: (partial: Partial<GameConfig>) => {
    set((state) => ({ config: { ...state.config, ...partial } }));
  },

  resetConfig: () => {
    set({ config: { ...DEFAULT_CONFIG } });
  },

  loadPersistedData: async () => {
    try {
      const stored = await AsyncStorage.getItem('caps_poker_chips');
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) {
          set({ chips: parsed });
        }
      }
    } catch {
      // Ignore storage errors
    }
  },

  persistChips: async (chips: number) => {
    try {
      await AsyncStorage.setItem('caps_poker_chips', chips.toString());
    } catch {
      // Ignore storage errors
    }
  },
}));
