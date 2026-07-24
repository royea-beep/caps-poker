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
import { migrateGameStorePersisted } from './cardThemeMigration';

export type OrientationType = 'portrait' | 'landscape';
// S76 — MUST stay in sync with the same-named type in constants/visualThemes.ts.
// `streetStencil` (N8) is DORMANT: neither picker lists it (both hardcode
// [classic, fiveo]) and _layout defaults to 'classic', so it is unselectable
// structurally until S77 wires the picker + premium_theme_enabled gate.
export type VisualTheme = 'classic' | 'fiveo' | 'streetStencil';

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
  // RESERVED — cardTheme is the toggle for the upcoming CARD-FACE batch. Its Settings picker was
  // removed in BATCH-B (five look-pickers unified into Visual Style), but the store field + setter
  // + persistence STAY. Do NOT delete as "unused": simulate.tsx reads it, and the card-face batch
  // depends on this mechanism being intact.
  cardTheme: CardThemeId;
  homeTheme: HomeThemeId;
  buttonStyle: ButtonStyle;
  friendsBg: FriendsBgId;
  fourColorSuits: boolean;
  /** VAMOS S-BATCH — instant results: skip the board-by-board reveal (unlocked after 3 games) */
  skipBoardReveal: boolean;
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
  // PRACTICE-TO-LIVE — demo counter for practice-vs-bots ("this session: +X"). SEPARATE
  // from the real bankroll (chips): practice never touches chips or leaderboard.total_chips.
  practiceSessionNet: number;

  // Card display config from Supabase app_config (NOT persisted — fetched on start)
  cardConfig: CardDisplayConfig | null;
  setCardConfig: (cfg: CardDisplayConfig) => void;

  // Reveal data (NOT persisted — passed between game → reveal screens)
  revealData: RevealData | null;

  // Multiplayer state (NOT persisted)
  multiplayerMode: 'none' | 'host' | 'guest';
  roomCode: string | null;
  /** Set only for CLUB tables — drives record_club_result at game end (null otherwise). */
  clubCode: string | null;
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
  setSkipBoardReveal: (v: boolean) => void;
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
  addPracticeSessionNet: (delta: number) => void;
  resetPracticeSessionNet: () => void;

  // Reveal actions
  setRevealData: (data: RevealData) => void;
  clearRevealData: () => void;

  // Language version (NOT persisted — runtime counter to force re-renders on language change)
  languageVersion: number;
  bumpLanguageVersion: () => void;

  // Multiplayer actions
  setMultiplayerMode: (mode: 'none' | 'host' | 'guest') => void;
  setRoomCode: (code: string | null) => void;
  setClubCode: (code: string | null) => void;
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
      playerAvatar: '👤',
      notificationsEnabled: true,
      cardTheme: DEFAULT_CARD_THEME,
      homeTheme: DEFAULT_HOME_THEME,
      buttonStyle: 'solid' as ButtonStyle,
      friendsBg: 'none' as FriendsBgId,
      fourColorSuits: false,
      skipBoardReveal: false,
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
      practiceSessionNet: 0,

      // Card display config (not persisted)
      cardConfig: null,

      // Reveal data (not persisted)
      revealData: null,

      // Language version (not persisted)
      languageVersion: 0,

      // Multiplayer state (not persisted via partialize)
      multiplayerMode: 'none',
      roomCode: null,
      clubCode: null,
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
        set((state) => ({ chips: (state.chips ?? 1000) + (amount ?? 0) }));
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
      setSkipBoardReveal: (v: boolean) => set({ skipBoardReveal: v }),
      setHandSortMethod: (method: 'caps' | 'user') => set({ handSortMethod: method }),
      setOrientation: (v: OrientationType) => set({ orientation: v }),
      setVisualTheme: (v: VisualTheme) => set({ visualTheme: v }),
      initSession: () => set((state) => ({ sessionStartChips: state.chips })),
      addPracticeSessionNet: (delta: number) => set((state) => ({ practiceSessionNet: state.practiceSessionNet + delta })),
      resetPracticeSessionNet: () => set({ practiceSessionNet: 0 }),
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
      setClubCode: (code) => set({ clubCode: code }),
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
          clubCode: null,
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
      // CARD-FACE MERGE (v3.2 ship): store was previously unversioned (version 0). Bump to 1 so the
      // one-time migrate runs on existing devices to move the flipped card-face default. Logic lives
      // in the exported migrateGameStorePersisted() (below) so it can be unit-tested directly.
      version: 1,
      migrate: migrateGameStorePersisted,
      partialize: (state) => ({ chips: state.chips, config: state.config, handsPlayed: state.handsPlayed, bestChips: state.bestChips, handsWon: state.handsWon, biggestWin: state.biggestWin, playerName: state.playerName, playerAvatar: state.playerAvatar, notificationsEnabled: state.notificationsEnabled, cardTheme: state.cardTheme, homeTheme: state.homeTheme, buttonStyle: state.buttonStyle, friendsBg: state.friendsBg, fourColorSuits: state.fourColorSuits, skipBoardReveal: state.skipBoardReveal, colorblindMode: state.colorblindMode, handSortMethod: state.handSortMethod, orientation: state.orientation, visualTheme: state.visualTheme, lastDailyRewardClaim: state.lastDailyRewardClaim, dailyRewardStreak: state.dailyRewardStreak, lastFreeRefill: state.lastFreeRefill, totalChipsEarned: state.totalChipsEarned, totalChipsSpent: state.totalChipsSpent, unlockedAchievements: state.unlockedAchievements, currentWinStreak: state.currentWinStreak, bestWinStreak: state.bestWinStreak }),
    }
  )
);
