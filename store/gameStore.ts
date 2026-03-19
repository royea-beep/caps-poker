import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig, Card } from '../constants/gameConfig';
import { ConnectedPlayerInfo, GameSession, RevealData } from '../types/gameTypes';
import { CardThemeId, DEFAULT_CARD_THEME } from '../constants/cardThemes';
import { HomeThemeId, DEFAULT_HOME_THEME, ButtonStyle } from '../constants/homeThemes';
import { FriendsBgId } from '../constants/friendsBgs';

interface GameStore {
  // Persisted state
  chips: number;
  config: GameConfig;
  handsPlayed: number;
  bestChips: number;
  handsWon: number;
  biggestWin: number;
  playerName: string;
  notificationsEnabled: boolean;
  cardTheme: CardThemeId;
  homeTheme: HomeThemeId;
  buttonStyle: ButtonStyle;
  friendsBg: FriendsBgId;
  fourColorSuits: boolean;

  // Economy state (persisted)
  lastDailyRewardClaim: string | null;
  dailyRewardStreak: number;
  lastFreeRefill: string | null;
  totalChipsEarned: number;
  totalChipsSpent: number;

  // Transient session state (NOT persisted)
  sessionStartChips: number;

  // Reveal data (NOT persisted — passed between game → reveal screens)
  revealData: RevealData | null;

  // Multiplayer state (NOT persisted)
  multiplayerMode: 'none' | 'host' | 'guest';
  roomCode: string | null;
  hostIP: string | null;
  connectedPlayers: ConnectedPlayerInfo[];
  gameSession: GameSession | null;
  // Server/client instances survive screen transitions (stored as `any` to avoid
  // importing native-only modules at the type level)
  mpServer: any | null;
  mpClient: any | null;

  // Persisted actions
  setChips: (chips: number) => void;
  addChips: (amount: number) => void;
  incrementHandsPlayed: () => void;
  incrementHandsWon: () => void;
  updateBestChips: () => void;
  updateBiggestWin: (win: number) => void;
  setPlayerName: (name: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCardTheme: (theme: CardThemeId) => void;
  setHomeTheme: (theme: HomeThemeId) => void;
  setButtonStyle: (style: ButtonStyle) => void;
  setFriendsBg: (bg: FriendsBgId) => void;
  setFourColorSuits: (v: boolean) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;
  trackChipsSpent: (amount: number) => void;
  trackChipsEarned: (amount: number) => void;
  setLastDailyRewardClaim: (iso: string) => void;
  setDailyRewardStreak: (streak: number) => void;
  setLastFreeRefill: (iso: string) => void;

  // Session actions
  initSession: () => void;

  // Reveal actions
  setRevealData: (data: RevealData) => void;
  clearRevealData: () => void;

  // Multiplayer actions
  setMultiplayerMode: (mode: 'none' | 'host' | 'guest') => void;
  setRoomCode: (code: string | null) => void;
  setHostIP: (ip: string | null) => void;
  setConnectedPlayers: (players: ConnectedPlayerInfo[]) => void;
  updatePlayer: (id: string, updates: Partial<ConnectedPlayerInfo>) => void;
  setGameSession: (session: GameSession | null) => void;
  setMpServer: (server: any | null) => void;
  setMpClient: (client: any | null) => void;
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
      handsWon: 0,
      biggestWin: 0,
      playerName: '',
      notificationsEnabled: true,
      cardTheme: DEFAULT_CARD_THEME,
      homeTheme: DEFAULT_HOME_THEME,
      buttonStyle: 'solid' as ButtonStyle,
      friendsBg: 'none' as FriendsBgId,
      fourColorSuits: false,

      // Economy state (persisted)
      lastDailyRewardClaim: null,
      dailyRewardStreak: 0,
      lastFreeRefill: null,
      totalChipsEarned: 0,
      totalChipsSpent: 0,

      // Transient session state
      sessionStartChips: DEFAULT_CONFIG.startingChips,

      // Reveal data (not persisted)
      revealData: null,

      // Multiplayer state (not persisted via partialize)
      multiplayerMode: 'none',
      roomCode: null,
      hostIP: null,
      connectedPlayers: [],
      gameSession: null,
      mpServer: null,
      mpClient: null,

      // Persisted actions
      setChips: (chips: number) => set({ chips }),
      addChips: (amount: number) => set((state) => ({ chips: state.chips + amount })),
      incrementHandsPlayed: () => set((state) => ({ handsPlayed: state.handsPlayed + 1 })),
      incrementHandsWon: () => set((state) => ({ handsWon: state.handsWon + 1 })),
      updateBestChips: () => set((state) => ({
        bestChips: Math.max(state.bestChips, state.chips),
      })),
      updateBiggestWin: (win: number) => set((state) => ({
        biggestWin: Math.max(state.biggestWin, win),
      })),
      setPlayerName: (name: string) => set({ playerName: name }),
      setNotificationsEnabled: (enabled: boolean) => set({ notificationsEnabled: enabled }),
      setCardTheme: (theme: CardThemeId) => set({ cardTheme: theme }),
      setHomeTheme: (theme: HomeThemeId) => set({ homeTheme: theme }),
      setButtonStyle: (style: ButtonStyle) => set({ buttonStyle: style }),
      setFriendsBg: (bg: FriendsBgId) => set({ friendsBg: bg }),
      setFourColorSuits: (v: boolean) => set({ fourColorSuits: v }),
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
      trackChipsSpent: (amount: number) => set((state) => ({
        totalChipsSpent: state.totalChipsSpent + Math.max(0, amount),
      })),
      trackChipsEarned: (amount: number) => set((state) => ({
        totalChipsEarned: state.totalChipsEarned + Math.max(0, amount),
      })),
      setLastDailyRewardClaim: (iso: string) => set({ lastDailyRewardClaim: iso }),
      setDailyRewardStreak: (streak: number) => set({ dailyRewardStreak: streak }),
      setLastFreeRefill: (iso: string) => set({ lastFreeRefill: iso }),

      // Reveal actions
      setRevealData: (data) => set({ revealData: data }),
      clearRevealData: () => set({ revealData: null }),

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
      setMpServer: (server) => set({ mpServer: server }),
      setMpClient: (client) => set({ mpClient: client }),
      resetMultiplayer: () => {
        const { mpServer, mpClient } = get();
        if (mpServer) {
          try { mpServer.stop(); } catch {}
        }
        if (mpClient) {
          try { mpClient.disconnect(); } catch {}
        }
        set({
          multiplayerMode: 'none',
          roomCode: null,
          hostIP: null,
          connectedPlayers: [],
          gameSession: null,
          mpServer: null,
          mpClient: null,
        });
      },
    }),
    {
      name: 'caps-poker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ chips: state.chips, config: state.config, handsPlayed: state.handsPlayed, bestChips: state.bestChips, handsWon: state.handsWon, biggestWin: state.biggestWin, playerName: state.playerName, notificationsEnabled: state.notificationsEnabled, cardTheme: state.cardTheme, homeTheme: state.homeTheme, buttonStyle: state.buttonStyle, friendsBg: state.friendsBg, fourColorSuits: state.fourColorSuits, lastDailyRewardClaim: state.lastDailyRewardClaim, dailyRewardStreak: state.dailyRewardStreak, lastFreeRefill: state.lastFreeRefill, totalChipsEarned: state.totalChipsEarned, totalChipsSpent: state.totalChipsSpent }),
    }
  )
);
