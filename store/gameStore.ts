import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig, Card } from '../constants/gameConfig';
import { ConnectedPlayerInfo, GameSession } from '../types/gameTypes';

interface GameStore {
  // Persisted state
  chips: number;
  config: GameConfig;

  // Multiplayer state (NOT persisted)
  multiplayerMode: 'none' | 'host' | 'guest';
  roomCode: string | null;
  hostIP: string | null;
  connectedPlayers: ConnectedPlayerInfo[];
  gameSession: GameSession | null;
  onSendReady: ((boardAssignments: Card[][]) => void) | null;

  // Persisted actions
  setChips: (chips: number) => void;
  addChips: (amount: number) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;

  // Multiplayer actions
  setMultiplayerMode: (mode: 'none' | 'host' | 'guest') => void;
  setRoomCode: (code: string | null) => void;
  setHostIP: (ip: string | null) => void;
  setConnectedPlayers: (players: ConnectedPlayerInfo[]) => void;
  updatePlayer: (id: string, updates: Partial<ConnectedPlayerInfo>) => void;
  setGameSession: (session: GameSession | null) => void;
  setOnSendReady: (fn: ((boardAssignments: Card[][]) => void) | null) => void;
  resetMultiplayer: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Persisted state
      chips: DEFAULT_CONFIG.startingChips,
      config: { ...DEFAULT_CONFIG },

      // Multiplayer state (not persisted via partialize)
      multiplayerMode: 'none',
      roomCode: null,
      hostIP: null,
      connectedPlayers: [],
      gameSession: null,
      onSendReady: null,

      // Persisted actions
      setChips: (chips: number) => set({ chips }),
      addChips: (amount: number) => set((state) => ({ chips: state.chips + amount })),
      updateConfig: (partial: Partial<GameConfig>) =>
        set((state) => ({ config: { ...state.config, ...partial } })),
      resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),

      // Multiplayer actions
      setMultiplayerMode: (mode) => set({ multiplayerMode: mode }),
      setRoomCode: (code) => set({ roomCode: code }),
      setHostIP: (ip) => set({ hostIP: ip }),
      setConnectedPlayers: (players) => set({ connectedPlayers: players }),
      updatePlayer: (id, updates) =>
        set((state) => ({
          connectedPlayers: state.connectedPlayers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      setGameSession: (session) => set({ gameSession: session }),
      setOnSendReady: (fn) => set({ onSendReady: fn }),
      resetMultiplayer: () =>
        set({
          multiplayerMode: 'none',
          roomCode: null,
          hostIP: null,
          connectedPlayers: [],
          gameSession: null,
          onSendReady: null,
        }),
    }),
    {
      name: 'caps-poker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ chips: state.chips, config: state.config }),
    }
  )
);
