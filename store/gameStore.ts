import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig, Card } from '../constants/gameConfig';
import { ConnectedPlayerInfo, GameSession } from '../types/gameTypes';

interface GameStore {
  // Persisted state
  chips: number;
  config: GameConfig;
  handsPlayed: number;
  bestChips: number;

  // Transient session state (NOT persisted)
  sessionStartChips: number;

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
  incrementHandsPlayed: () => void;
  updateBestChips: () => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;

  // Session actions
  initSession: () => void;

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
      handsPlayed: 0,
      bestChips: DEFAULT_CONFIG.startingChips,

      // Transient session state
      sessionStartChips: DEFAULT_CONFIG.startingChips,

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
      incrementHandsPlayed: () => set((state) => ({ handsPlayed: state.handsPlayed + 1 })),
      updateBestChips: () => set((state) => ({
        bestChips: Math.max(state.bestChips, state.chips),
      })),
      initSession: () => set((state) => ({ sessionStartChips: state.chips })),
      updateConfig: (partial: Partial<GameConfig>) =>
        set((state) => {
          const merged = { ...state.config, ...partial };
          // Clamp numeric settings to reasonable bounds
          merged.potPerBoard = Math.max(1, merged.potPerBoard);
          merged.arrangementTime = Math.max(10, merged.arrangementTime);
          merged.startingChips = Math.max(1, merged.startingChips);
          merged.boardRevealDuration = Math.max(1, merged.boardRevealDuration);
          merged.completeBonusDisplay = Math.max(1, merged.completeBonusDisplay);
          merged.completeBonusPercent = Math.max(0, Math.min(100, merged.completeBonusPercent));
          merged.turnRevealDelay = Math.max(100, merged.turnRevealDelay);
          merged.numberOfPlayers = Math.max(2, Math.min(4, merged.numberOfPlayers));
          merged.botSpeedMin = Math.max(0, merged.botSpeedMin);
          merged.botSpeedMax = Math.max(merged.botSpeedMin, merged.botSpeedMax);
          return { config: merged };
        }),
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
      partialize: (state) => ({ chips: state.chips, config: state.config, handsPlayed: state.handsPlayed, bestChips: state.bestChips }),
    }
  )
);
