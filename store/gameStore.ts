import { create } from 'zustand';
import { debugLog } from '../components/DebugOverlay';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG, GameConfig, Card } from '../constants/gameConfig';
import { ConnectedPlayerInfo, GameSession, RevealData } from '../types/gameTypes';
import { CardThemeId, DEFAULT_CARD_THEME } from '../constants/cardThemes';
import { HomeThemeId, DEFAULT_HOME_THEME, ButtonStyle } from '../constants/homeThemes';
import { FriendsBgId } from '../constants/friendsBgs';
import { CardDisplayConfig } from '../utils/supabaseEconomy';

export type OrientationType = 'portrait' | 'landscape';
export type VisualTheme = 'classic' | 'fiveo';

interface GameStore {
  // Persisted state
  chips: number;
  config: GameConfig;
  handsPlayed: number;
  bestChips: number;
  handsWon: number;
  biggestWin: number;
  playerName: string;
  playerAvatar: string;
  notificationsEnabled: boolean;
  cardTheme: CardThemeId;
  homeTheme: HomeThemeId;
  buttonStyle: ButtonStyle;
  friendsBg: FriendsBgId;
  fourColorSuits: boolean;
  colorblindMode: boolean;
  setColorblindMode: (enabled: boolean) => void;
  handSortMethod: 'caps' | 'user';
  orientation: OrientationType | null;
  visualTheme: VisualTheme | null;
  setVisualTheme: (v: VisualTheme) => void;

  // Economy state (persisted)
  lastDailyRewardClaim: string | null;
  dailyRewardStreak: number;
  lastFreeRefill: string | null;
  totalChipsEarned: number;
  totalChipsSpent: number;
  unlockedAchievements: string[];
  currentWinStreak: number;
  bestWinStreak: number;

  // Transient session state (NOT persisted)
  sessionStartChips: number;

  // Card display config from Supabase app_config (NOT persisted — fetched on start)
  cardConfig: CardDisplayConfig | null;
  setCardConfig: (cfg: CardDisplayConfig) => void;

  // Reveal data (NOT persisted — passed between game → reveal screens)
  revealData: RevealData | null;

  // Multiplayer state (NOT persisted)
  multiplayerMode: 'none' | 'host' | 'guest';
  roomCode: string | null;
  hostIP: string | null;
  connectedPlayers: ConnectedPlayerInfo[];
  gameSession: GameSession | null;
  opponentName: string;
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
  setPlayerAvatar: (avatar: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCardTheme: (theme: CardThemeId) => void;
  setHomeTheme: (theme: HomeThemeId) => void;
  setButtonStyle: (style: ButtonStyle) => void;
  setFriendsBg: (bg: FriendsBgId) => void;
  setFourColorSuits: (v: boolean) => void;
  setHandSortMethod: (method: 'caps' | 'user') => void;
  setOrientation: (v: OrientationType) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  resetConfig: () => void;
  trackChipsSpent: (amount: number) => void;
  trackChipsEarned: (amount: number) => void;
  setLastDailyRewardClaim: (iso: string) => void;
  setDailyRewardStreak: (streak: number) => void;
  setLastFreeRefill: (iso: string) => void;
  unlockAchievement: (id: string) => void;
  incrementWinStreak: () => void;
  resetWinStreak: () => void;

  // Session actions
  initSession: () => void;

  // Reveal actions
  setRevealData: (data: RevealData) => void;
  clearRevealData: () => void;

  // Language version (NOT persisted — runtime counter to force re-renders on language change)
  languageVersion: number;
  bumpLanguageVersion: () => void;

  // Multiplayer actions
  setMultiplayerMode: (mode: 'none' | 'host' | 'guest') => void;
  setRoomCode: (code: string | null) => void;
  setHostIP: (ip: string | null) => void;
  setConnectedPlayers: (players: ConnectedPlayerInfo[]) => void;
  updatePlayer: (id: string, updates: Partial<ConnectedPlayerInfo>) => void;
  setGameSession: (session: GameSession | null) => void;
  setOpponentName: (name: string) => void;
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
      playerAvatar: '🎰',
      notificationsEnabled: true,
      cardTheme: DEFAULT_CARD_THEME,
      homeTheme: DEFAULT_HOME_THEME,
      buttonStyle: 'solid' as ButtonStyle,
      friendsBg: 'none' as FriendsBgId,
      fourColorSuits: false,
      colorblindMode: false,
      setColorblindMode: (enabled: boolean) => set({ colorblindMode: enabled }),
      handSortMethod: 'caps' as 'caps' | 'user',
      orientation: null,
      visualTheme: null,

      // Economy state (persisted)
      lastDailyRewardClaim: null,
      dailyRewardStreak: 0,
      lastFreeRefill: null,
      totalChipsEarned: 0,
      totalChipsSpent: 0,
      unlockedAchievements: [],
      currentWinStreak: 0,
      bestWinStreak: 0,

      // Transient session state
      sessionStartChips: DEFAULT_CONFIG.startingChips,

      // Card display config (not persisted)
      cardConfig: null,

      // Reveal data (not persisted)
      revealData: null,

      // Language version (not persisted)
      languageVersion: 0,

      // Multiplayer state (not persisted via partialize)
      multiplayerMode: 'none',
      roomCode: null,
      hostIP: null,
      connectedPlayers: [],
      gameSession: null,
      opponentName: '',
      mpServer: null,
      mpClient: null,

      // Persisted actions
      setChips: (chips: number) => set({ chips }),
      addChips: (amount: number) => {
        debugLog(`S1 addChips: ${amount}`);
        set((state) => ({ chips: state.chips + amount }));
        debugLog('S2 addChips DONE');
      },
      incrementHandsPlayed: () => set((state) => ({ handsPlayed: state.handsPlayed + 1 })),
      incrementHandsWon: () => set((state) => ({ handsWon: state.handsWon + 1 })),
      updateBestChips: () => set((state) => ({
        bestChips: Math.max(state.bestChips, state.chips),
      })),
      updateBiggestWin: (win: number) => set((state) => ({
        biggestWin: Math.max(state.biggestWin, win),
      })),
      setPlayerName: (name: string) => set({ playerName: name }),
      setPlayerAvatar: (avatar: string) => set({ playerAvatar: avatar }),
      setNotificationsEnabled: (enabled: boolean) => set({ notificationsEnabled: enabled }),
      setCardTheme: (theme: CardThemeId) => set({ cardTheme: theme }),
      setHomeTheme: (theme: HomeThemeId) => set({ homeTheme: theme }),
      setButtonStyle: (style: ButtonStyle) => set({ buttonStyle: style }),
      setFriendsBg: (bg: FriendsBgId) => set({ friendsBg: bg }),
      setFourColorSuits: (v: boolean) => set({ fourColorSuits: v }),
      setHandSortMethod: (method: 'caps' | 'user') => set({ handSortMethod: method }),
      setOrientation: (v: OrientationType) => set({ orientation: v }),
      setVisualTheme: (v: VisualTheme) => set({ visualTheme: v }),
      initSession: () => set((state) => ({ sessionStartChips: state.chips })),
      setCardConfig: (cfg: CardDisplayConfig) => set({ cardConfig: cfg }),
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
      unlockAchievement: (id: string) =>
        set((state) => ({
          unlockedAchievements: state.unlockedAchievements.includes(id)
            ? state.unlockedAchievements
            : [...state.unlockedAchievements, id],
        })),
      incrementWinStreak: () =>
        set((state) => {
          const next = state.currentWinStreak + 1;
          return { currentWinStreak: next, bestWinStreak: Math.max(state.bestWinStreak, next) };
        }),
      resetWinStreak: () => set({ currentWinStreak: 0 }),

      // Language version action
      bumpLanguageVersion: () => set((state) => ({ languageVersion: state.languageVersion + 1 })),

      // Reveal actions
      setRevealData: (data) => {
        debugLog(`S3 setRevealData START: boards=${data?.boards?.length}`);
        set({ revealData: data });
        debugLog('S4 setRevealData DONE');
      },
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
      setOpponentName: (name) => set({ opponentName: name }),
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
          opponentName: '',
          mpServer: null,
          mpClient: null,
        });
      },
    }),
    {
      name: 'caps-poker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ chips: state.chips, config: state.config, handsPlayed: state.handsPlayed, bestChips: state.bestChips, handsWon: state.handsWon, biggestWin: state.biggestWin, playerName: state.playerName, playerAvatar: state.playerAvatar, notificationsEnabled: state.notificationsEnabled, cardTheme: state.cardTheme, homeTheme: state.homeTheme, buttonStyle: state.buttonStyle, friendsBg: state.friendsBg, fourColorSuits: state.fourColorSuits, colorblindMode: state.colorblindMode, handSortMethod: state.handSortMethod, orientation: state.orientation, visualTheme: state.visualTheme, lastDailyRewardClaim: state.lastDailyRewardClaim, dailyRewardStreak: state.dailyRewardStreak, lastFreeRefill: state.lastFreeRefill, totalChipsEarned: state.totalChipsEarned, totalChipsSpent: state.totalChipsSpent, unlockedAchievements: state.unlockedAchievements, currentWinStreak: state.currentWinStreak, bestWinStreak: state.bestWinStreak }),
    }
  )
);
