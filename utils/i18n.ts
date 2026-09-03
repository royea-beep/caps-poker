/**
 * i18n — S66
 * Detects device language (Hebrew or English) and provides typed translations.
 * OTA-safe: uses NativeModules fallback (no expo-localization native dependency).
 */
import { I18nManager, NativeModules, Platform } from 'react-native';

export type Language = 'he' | 'en';

/** Detect device language code without requiring expo-localization native module */
function detectLanguageCode(): string {
  try {
    // Try expo-localization first (may or may not be compiled into the binary)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Loc = require('expo-localization');
    const code = Loc.getLocales?.()[0]?.languageCode;
    if (code) return code;
  } catch {
    // Not available in this build — fall through to NativeModules
  }

  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const raw = settings?.AppleLocale || settings?.AppleLanguages?.[0] || 'en';
      return raw.substring(0, 2);
    }
    if (Platform.OS === 'android') {
      const id: string = NativeModules.I18nManager?.localeIdentifier ?? 'en';
      return id.substring(0, 2);
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.substring(0, 2);
    }
  } catch {
    // ignore
  }
  return 'en';
}

// Singleton — computed once per app session
let _lang: Language | null = null;

// PR-I: kick off the HTML lang/dir sync on first import (web only).
// Wrapped in a microtask so React's first render still mounts before we touch the DOM.
if (typeof queueMicrotask !== 'undefined') {
  queueMicrotask(() => { try { applyHtmlLocale(); } catch {} });
} else if (typeof setTimeout !== 'undefined') {
  setTimeout(() => { try { applyHtmlLocale(); } catch {} }, 0);
}

// VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — was English-only (forced 'en') because the
// results/reveal flow half-translated: ~120 strings across Board/EquityBar/
// BoardResultCard/results/BoardReveal + home CTAs hardcoded English, so a Hebrew
// device saw "הפסדת" beside "Board 1 / BOT 1 / COMMUNITY / So close!".
//
// VAMOS FINISH-HEBREW 2026-09-02 — those strings are now all wired to t() (he/en at
// full 202/202 key parity, tsc + 2649 jest green, rendered coverage verified at 320
// across 2P/3P/4P), so the force is LIFTED. getLanguage() now returns the device
// language (Hebrew locales → Hebrew UI, everything else → English). Hand-rank NAMES
// stay English (HAND_RANK_NAMES constants in utils/handEvaluator.ts) — that is a
// deliberate poker-terminology choice, not a gap. The persisted `caps_language`
// preference (set in _layout on boot, changed in SideMenu) drives setLanguage().
export function getLanguage(): Language {
  if (_lang === 'he' || _lang === 'en') return _lang;
  const code = detectLanguageCode();
  _lang = code === 'he' ? 'he' : 'en';
  return _lang;
}

export function setLanguage(lang: Language): void {
  _lang = lang === 'he' ? 'he' : 'en';
  applyHtmlLocale();
}

/**
 * PR-I — write the active locale onto <html lang> and <html dir>.
 * Audit #6: pre-PR-I the document had `<html dir="" lang="en">` despite
 * Hebrew UI. Screen readers spoke Hebrew with the wrong voice, profile-row
 * chevrons faced the wrong way, etc.
 * No-op on native (no document).
 */
export function applyHtmlLocale(): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const lang = getLanguage();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export function isRTL(): boolean {
  return getLanguage() === 'he';
}

// ---------------------------------------------------------------------------
// Translation interface
// ---------------------------------------------------------------------------

interface Translations {
  // Game screen
  botFinished: string;
  yourHand: string;
  placeN: (n: number) => string;
  undo: string;
  ready: string;
  allPlaced: string;
  timeBank: string;
  winAll: (n: number) => string;

  // Board
  bot: string;
  yourCards: string;
  boardN: (n: number, total: number) => string;

  // Reveal
  tapForNextBoard: string;
  tapToReveal: string;
  youWin: string;
  youLose: string;
  tie: string;

  // Results
  dealMeIn: string;
  netChips: (n: number) => string;
  complete: string;
  completeBonus: string;

  // Home
  newHand: string;
  history: string;
  stats: string;
  settings: string;
  tutorial: string;
  boardsPlayers: (boards: number, players: number) => string;

  // Onboarding steps
  onboarding: {
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    step4Title: string;
    step4Body: string;
    step5Title: string;
    step5Body: string;
    next: string;
    skip: string;
    letsPlay: string;
  };


  // Profile menu (S-LOCALE-FIX)
  profileMenuAchievements: string;
  profileMenuDailyMissions: string;
  profileMenuHandHistory: string;
  profileMenuDetailedStats: string;
  profileMenuLeaderboard: string;
  profileMenuSettings: string;
  tabHome: string;
  tabPlay: string;
  tabFriends: string;
  tabCups: string;
  tabProfile: string;

  // Friends referral (S-LOCALE-FIX)
  inviteFriends: string;
  inviteFriendsSub: (chipsPerFriend: number) => string;

  // Common buttons (S-LOCALE-FIX)
  cancel: string;
  confirm: string;
  readyCheck: string;
  continueArrow: string;
  autoPlace: string;
  playNow: string;

  // Game screen (S-LOCALE-FIX)
  boardLabel: (n: number) => string;
  arrangeCards: (n: number) => string;
  /** OTA-COSMETIC-FIXES — lobby instant-bot row subtitle, e.g. "2P · 4 boards · instant". */
  botRowSub: (players: number, boards: number) => string;
  timeUpAutoplaced: string;
  botSingular: string;
  botPlural: (ready: number, total: number) => string;
  botEmojiPlural: (ready: number, total: number) => string;
  boardFull: string;
  leaveGame: {
    title: string;
    body: string;
  };
  a11yReadyReveal: string;
  a11yPlaceRemaining: string;
  community: string;
  hintTexts: [string, string, string];
  waitingForBots: (count: number) => string;
  /** MP analog of waitingForBots: shown while waiting for human opponents to lock in. */
  waitingForOthers: (count: number) => string;
  tapToContinue: string;

  // VAMOS FINISH-HEBREW 2026-09-02 — reveal + results flow (game every hand). Hand-rank NAMES
  // stay English (HAND_RANK_NAMES constants); these are chrome only.
  revealedAfterRiver: string;
  autoPlaceAll: string;
  a11yTapToPlace: string;
  a11ySelectFirst: string;
  equityYou: string;
  equityOpp: string;
  equityLead: string;
  equityLeading: string;
  equityTrailing: string;
  calculatingOdds: string;
  winShort: string;
  lossShort: string;
  tieShort: string;
  shareImage: string;
  shareStory: string;
  copyReplayLink: string;
  linkCopied: string;
  backToHome: string;
  loadingEllipsis: string;
  handUnavailable: string;
  youWinBig: string;
  youLoseBig: string;
  tieGame: string;
  perfect: string;
  youWonChips: (n: number) => string;
  handWonBang: string;
  rematch: string;
  homeBtn: string;
  leaveBtn: string;
  shareHand: string;
  currentBalance: string;
  netResult: string;
  thisSession: string;
  showHandDetails: string;
  hideHandDetails: string;
  rankUp: string;
  rankDown: string;
  xpOnly: string;
  try4Boards: string;
  niceBang: string;
  gameOver: string;
  connectionLost: string;
  hostDisconnected: string;
  rejoin: string;
  keepWaiting: string;
  waitingTimedOut: string;
  waitingTimedOutBody: string;
  hostDisconnectedBody: string;
  connectionLostBody: string;
  shareCompleteBtn: string;
  bestHandFrom9: string;
  practiceXpNote: string;
  boardByBoard: string;
  viewHandHistory: string;
  tallyWon: string;
  tallyTied: string;
  tallyLost: string;
  tieBonus: (n: number) => string;
  winStreakBadge: (n: number) => string;
  bestStreakLabel: (n: number) => string;
  hideDetailsToggle: string;
  showDetailsToggle: string;
  xpLabelGame: string;
  xpLabelBoards: string;
  xpLabelWin: string;
  xpLabelComplete: string;
  bestHandOnBoard: (name: string, board: number) => string;
  statBoardsLabel: string;
  statGamesLabel: string;
  statNetLabel: string;
  statTied: (n: number) => string;
  completeAllBoards: string;
  opponentSwept: string;
  dailyStreakMsg: (day: number, amt: number) => string;
  mpBeat: (name: string) => string;
  mpDefeatedBy: (name: string) => string;
  mpTiedWith: (name: string) => string;
  vsPrefix: string;
  // BoardReveal (the reveal screen)
  soClose: string;
  shareShort: string;
  completeWonXpBonus: (xp: number) => string;
  completeWonPctBonus: (pct: number) => string;
  completeWonBonus: string;
  holdToSkipAll: string;
  tapForResults: string;
  scoreLeading: (p: number, b: number, remaining: number) => string;
  scoreTrailing: (p: number, b: number, remaining: number) => string;
  scoreBoardsLeft: (remaining: number) => string;
  scoreTied: (p: number, b: number, remaining: number) => string;
  tieBoard: string;
  playerFallback: string;
  outsLabel: string;
  dangerLabel: string;
  outsCalculating: string;
  a11yOutsToWin: string;
  a11yOutsToLose: string;
  revealTip1: string;
  revealTip2: string;
  revealTip3: string;
  timeoutTooltip: string;
  // Home CTAs + teaching line (dedicated so EN design text is preserved verbatim)
  homePlayOnline: string;
  homePlayOnlineSub: string;
  homePracticeVsBots: string;
  homePracticeA11y: string;
  homeTeaching: string;

  // Hand history (S-LOCALE-FIX)
  historyAll: (n: number) => string;
  historyWins: (n: number) => string;
  historyLosses: (n: number) => string;
  historyEmptyTitle: string;
  historyEmptySub: string;

  // Settings
  settingsTitle: string;
  proQuotes: string;
  proVoice: string;
  showTutorial: string;
  simulationMode: string;
  debugOverlay: string;
  resetDefaults: string;
  yourProfile: string;
  edit: string;

  // Navigation / SideMenu
  play: string;
  signIn: string;
  signOut: string;
  leaderboard: string;
  handHistory: string;
  coaching: string;
  spectator: string;
  reportBug: string;
  battlePass: string;
  tournaments: string;
  language: string;
  languageEnglish: string;
  languageHebrew: string;
  playOnline: string;
  localMultiplayer: string;
  chooseLanguage: string;

  // PR-I — nav cards (Friends tab + Play hub + SideMenu)
  hostGame: string;
  joinGame: string;
  hostLocalGameSub: string;
  joinLocalGameSub: string;
  hostOnlineGame: string;
  hostOnlineGameSub: string;
  joinOnlineGameSub: string;
  friendsLeaderboardCard: string;
  friendsLeaderboardCardSub: string;
  cupsTitle: string;
  cupsSubtitle: (earned: number, total: number) => string;
  playChooseMode: string;
  shopBuy: string;
  shopCantAfford: string;
  shopOwned: string;

  // FULL-I18N 2026-09-03 — Roye: "Translate everything." English must NEVER show Hebrew;
  // Hebrew may show English. Hand-rank NAMES and the CAPS loanwords (COMPLETE, CAPS, Sit and Go)
  // stay English in BOTH tables on purpose — that is a standing product rule, not a gap.
  playSinglePlayer: string;
  playSinglePlayerSub: (boards: number) => string;
  playSinglePlayerA11y: string;
  playMpLobby: string;
  playMpLobbySub: string;
  playMpLobbyA11y: string;
  playPrivateTable: string;
  playPrivateTableSub: string;
  playPrivateTableA11y: string;
  playLeaderboardA11y: string;
  notEnoughChips: string;
  needChipsToPlay: (n: number) => string;
  profileTitle: string;
  profileHands: string;
  profileWinRate: string;
  profileStreak: string;
  profileChips: string;
  homeGetChips: string;
  homeGetChipsA11y: string;
  homeOpenChipShop: string;
  homeOpenMenu: string;
  homePlayOnlineA11y: string;
  homeChallengeFriend: string;
  homeChallengeFriendA11y: string;
  homeShareComplete: string;
  homeShareCompleteA11y: string;
  homeDailyClaimed: (amount: number, streak: number) => string;
  homeDailyClaimA11y: string;
  homeDailyStreakClaim: (day: number, amount: number) => string;
  homeDailyClaim: (day: number) => string;
  homeMilestoneWeekly: string;
  homeMilestoneMonthly: string;
  homeWinStreak: (n: number) => string;
  homeWinStreakA11y: (n: number) => string;
  homePotd: string;
  homePotdA11y: string;
  homePotdWinningHand: string;
  homePotdPot: (pot: string) => string;
  homePotdPotA11y: (pot: string) => string;
  homeHandsSaved: (n: number) => string;
  homeHandsSavedA11y: (n: number) => string;
  homeMyProgress: string;
  homeWinRateLabel: (pct: string) => string;
  homeCompetition: string;
  homeLeaderboardRank: string;
  homePlayToBeRanked: string;
  homeRecentWins: string;
  homeRecentWinsA11y: string;
  homeNoHistoryYet: string;
  homeSitAndGoLoss: string;
  homeRecentHands: string;
  homeViewHandHistory: string;
  homeEff: (pct: number) => string;
  homeYourCode: string;
  homeCopy: string;
  homeCopyA11y: string;
  homeShare: string;
  homeShareA11y: string;
  homeEnterInviteCode: string;
  homeEnterInviteCodeSub: string;
  homeInviteDialogA11y: string;
  homeRedeemA11y: (n: number) => string;
  homeCharacters: (n: number) => string;
  homeFriendsCode: string;
  homeCloseDialog: string;
  homeSaveAcrossDevices: string;
  legalLine: string;
  setProfile: string;
  setGameplay: string;
  setCards: string;
  setCardsA11y: string;
  setAudioNotifications: string;
  setTools: string;
  setDangerZone: string;
  setCredits: string;
  setVisualStyle: string;
  setShownOnLeaderboard: string;
  setEdit: string;
  setPushNotifications: string;
  setEnableNotifications: string;
  setRegistering: string;
  setRevealSpeed: string;
  setSpeedFast: string;
  setSpeedNormal: string;
  setSpeedCinematic: string;
  setVibration: string;
  setSoundVolume: string;
  setAmbientSound: string;
  setAmbientSoundSub: string;
  setPlayers: string;
  setPlayersLabel: (n: number) => string;
  setBoardsCards: (boards: number, cards: number) => string;
  setBotDifficulty: string;
  setBotEasy: string;
  setBotMedium: string;
  setBotHard: string;
  setBotEasyHint: string;
  setBotMediumHint: string;
  setBotHardHint: string;
  setOrientationPortrait: string;
  setOrientationWide: string;
  setSkipReveal: string;
  setOffCaps: string;
  setOnCaps: string;
  setOff: string;
  setOn: string;
  setSuitColors: string;
  setColorblindMode: string;
  setCardSort: string;
  setSortAuto: string;
  setSortPairs: string;
  setThemeTimeless: string;
  setThemeArcade: string;
  setThemeConcrete: string;
  setVersion: string;
  setPrivacyPolicy: string;
  setTermsOfUse: string;
  setDeleteAccount: string;
  setResetAllProgress: string;
  setResetConfirmBody: string;
  setResetDone: string;
  setResetDoneBody: string;
  setGoBack: string;
  setYourRank: string;
  setCreditQuotes: string;
  setCreditVoices: string;
  setCreditNotAffiliated: string;
  setCreditParody: string;
  completeShort: string;
  completeBonusChips: (n: number) => string;
  tutorialCompleteBadge: string;
  calculatingResults: string;
  practiceNoChips: string;
  practiceSessionNet: (net: number) => string;
  practiceA11yNoChips: string;
  practiceA11yNet: (net: number) => string;
  homeProgressSub: (pct: string) => string;
  homeChecking: string;
  homeRedeemBtn: (n: number) => string;
  homeSitAndGoWin: (chips: number) => string;
  homeSitAndGoWinA11y: (chips: number) => string;
  homeSitAndGoLossA11y: string;
  setThemeModern: string;
  setThemeClassicDesc: string;
  setThemeFiveoDesc: string;
  setSelect: string;
  setChangeAnytime: string;
  setChooseStyle: string;
  setAdvanced: string;
}

// ---------------------------------------------------------------------------
// Hebrew
// ---------------------------------------------------------------------------

const he: Translations = {
  botFinished: 'הבוט סיים!',
  yourHand: 'היד שלך',
  placeN: (n) => `שים ${n}`,
  undo: 'בטל',
  ready: 'מוכן',
  allPlaced: 'כל הקלפים הונחו!',
  timeBank: '+15 שניות',
  winAll: (n) => `נצח הכל ← +${n} 🟡`,
  bot: 'בוט',
  yourCards: 'הקלפים שלך',
  boardN: (n, total) => `בורד ${n} מתוך ${total}`,
  tapForNextBoard: 'הקש לבורד הבא',
  tapToReveal: 'הקש לחשיפה',
  youWin: '✅ ניצחת',
  youLose: '❌ הפסדת',
  tie: '🤝 תיקו',
  dealMeIn: 'קלפים חדשים',
  netChips: (n) => n > 0 ? `+${n} 🟡` : `${n} 🟡`,
  complete: 'סיבוב הושלם! 🏆',
  completeBonus: '+50% בונוס',
  newHand: 'יד חדשה',
  history: 'היסטוריה',
  stats: 'סטטיסטיקות',
  settings: 'הגדרות',
  tutorial: 'מדריך',
  boardsPlayers: (b, p) => `${b} בורדים · ${p} שחקנים`,
  onboarding: {
    step1Title: 'ברוך הבא ל-CAPS',
    step1Body: 'CAPS הוא משחק Omaha Poker על מספר בורדים במקביל. כל בורד = יד נפרדת עם פוט נפרד.',
    step2Title: 'חלק את הקלפים',
    step2Body: 'קיבלת 16 קלפים. שים 4 קלפים על כל בורד — כולם בשימוש, אין קלפים בצד.',
    step3Title: 'בחר בחוכמה',
    step3Body: 'הפלופ גלוי מראש. בנה את היד הטובה ביותר לפי חוקי Omaha: בדיוק 2 מהקלפים שלך + 3 מקלפי הקהילה.',
    step4Title: 'COMPLETE Bonus',
    step4Body: 'נצח את כל הבורדים → קבל 50% נוספים! זה ה-COMPLETE bonus. מסוכן אבל שווה.',
    step5Title: 'מוכן לשחק?',
    step5Body: 'הבוט ימלא את הקלפים שלו. לחץ מוכן כשסיימת. הקש על הקלפים כדי לבחור, הקש על הבורד כדי להניח.',
    next: 'הבא',
    skip: 'דלג',
    letsPlay: 'בואו נשחק!',
  },
  // Profile menu (S-LOCALE-FIX)
  profileMenuAchievements: 'הישגים',
  profileMenuDailyMissions: 'משימות יומיות',
  profileMenuHandHistory: 'היסטוריית ידיים',
  profileMenuDetailedStats: 'סטטיסטיקות מפורטות',
  profileMenuLeaderboard: 'לוח מנצחים',
  profileMenuSettings: 'הגדרות',
  tabHome: 'בית',
  tabPlay: 'שחק',
  tabFriends: 'חברים',
  tabCups: 'כוסות',
  tabProfile: 'פרופיל',
  // Friends referral
  inviteFriends: 'הזמן חברים',
  inviteFriendsSub: (n) => `שתף את הקוד שלך · +${n} 💰 לכל חבר`,
  // Common buttons
  cancel: 'ביטול',
  confirm: 'אישור',
  readyCheck: '✓ מוכן',
  continueArrow: 'המשך →',
  autoPlace: '⚡ מילוי',
  playNow: '▶ שחק עכשיו',
  // Game screen
  // NAMING: the game board is "בורד/בורדים" everywhere (matches the onboarding, the home,
  // boardsPlayers, and the landing page). "לוח" is kept ONLY for the leaderboard terms below
  // (לוח מנצחים / לוח תוצאות) — a different concept, not the game board.
  boardLabel: (n) => `בורד ${n}`,
  arrangeCards: (n) => `סדר ${n} קלפים`,
  botRowSub: (players, boards) => `${players} שחקנים · ${boards} בורדים · מיידי`,
  timeUpAutoplaced: '⏱ הזמן נגמר — קלפים הונחו אוטומטית',
  botSingular: 'בוט',
  botPlural: (r, t) => `בוטים ${r}/${t}`,
  botEmojiPlural: (r, t) => `🤖 בוטים ${r}/${t}`,
  boardFull: 'הבורד מלא',
  leaveGame: {
    title: 'לעזוב את המשחק?',
    body: 'תאבד את הפוט של היד הזו.',
  },
  a11yReadyReveal: 'מוכן, חשוף את הידיים',
  a11yPlaceRemaining: 'הנח את הקלפים הנותרים על הבורדים',
  community: 'קהילה',
  hintTexts: [
    '👆 הקש על קלף מהיד, ואז הקש על בורד כדי להניח',
    '🎯 נסה לנצח את כל הבורדים לבונוס COMPLETE!',
    '💡 טיפ: הקש על קלף שהונח כדי להסיר אותו ולנסות בורד אחר',
  ],
  waitingForBots: (n) => n > 1 ? 'ממתין לבוטים...' : 'ממתין לבוט...',
  waitingForOthers: (n) => n > 1 ? 'ממתין לשחקנים האחרים...' : 'ממתין ליריב...',
  tapToContinue: 'הקש להמשך →',
  // Hand history
  historyAll: (n) => `הכל (${n})`,
  historyWins: (n) => `ניצחונות (${n})`,
  historyLosses: (n) => `הפסדים (${n})`,
  historyEmptyTitle: 'אין ידיים שוחקו עדיין',
  historyEmptySub: 'שחק את המשחק הראשון שלך כדי לראות היסטוריה!',
  settingsTitle: 'הגדרות',
  proQuotes: 'ציטוטי מקצוענים (הדמיה)',
  proVoice: 'קולות מקצוענים (AI)',
  showTutorial: 'הצג מדריך מחדש',
  simulationMode: 'מצב סימולציה',
  debugOverlay: 'כלי דיבאג',
  resetDefaults: 'אפס הגדרות',
  yourProfile: 'הפרופיל שלך',
  edit: 'ערוך',
  play: 'שחק',
  signIn: 'כניסה',
  signOut: 'יציאה',
  leaderboard: 'לוח תוצאות',
  handHistory: 'היסטוריית ידיים',
  coaching: 'אימון',
  spectator: 'צפייה',
  reportBug: 'דווח על תקלה',
  battlePass: 'מעבר קרב',
  tournaments: 'טורנירים',
  language: 'שפה',
  languageEnglish: 'English',
  languageHebrew: 'עברית',
  playOnline: 'שחק אונליין',
  localMultiplayer: 'מולטי-פלייר מקומי',
  chooseLanguage: 'בחר את השפה שלך',
  // PR-I
  hostGame: 'אירוח משחק',
  joinGame: 'הצטרף למשחק',
  hostLocalGameSub: 'שחק עם מישהו לידך (WiFi)',
  joinLocalGameSub: 'מצא מארח ברשת שלך',
  hostOnlineGame: 'אירוח משחק אונליין',
  hostOnlineGameSub: 'צור חדר לחברים להצטרף',
  joinOnlineGameSub: 'הזן קוד חדר',
  friendsLeaderboardCard: 'לוח תוצאות',
  friendsLeaderboardCardSub: 'ראה את הדירוג שלך גלובלית',
  cupsTitle: 'כוסות',
  cupsSubtitle: (e, t) => `${e}/${t} כוסות · ארבע קלפים. ארבעה בורדים. מנצח אחד.`,
  playChooseMode: 'בחר מצב משחק',
  shopBuy: 'קנה',
  shopCantAfford: 'אין מספיק צ׳יפים',
  shopOwned: 'ברשותך',
  // VAMOS FINISH-HEBREW 2026-09-02 — reveal + results flow. autoPlace shortened to
  // fit 320px (was '⚡ מיקום אוטומטי' which truncated). Hand-rank NAMES stay English.
  revealedAfterRiver: 'ייחשף אחרי הריבר',
  autoPlaceAll: 'מלא הכל',
  a11yTapToPlace: 'הקש כדי להניח כאן את הקלף שנבחר.',
  a11ySelectFirst: 'בחר קלף קודם.',
  equityYou: 'אתה',
  equityOpp: 'יריב',
  equityLead: 'יתרון',
  equityLeading: 'מוביל',
  equityTrailing: 'מפגר',
  calculatingOdds: 'מחשב סיכויים',
  winShort: 'ניצחת',
  lossShort: 'הפסד',
  tieShort: 'תיקו',
  shareImage: 'שתף תמונה',
  shareStory: 'שתף כסטורי',
  copyReplayLink: 'העתק קישור שחזור',
  linkCopied: 'הקישור הועתק!',
  backToHome: 'חזרה לבית',
  loadingEllipsis: 'טוען...',
  handUnavailable: 'היד הזו כבר לא זמינה.',
  youWinBig: 'ניצחת!',
  youLoseBig: 'הפסדת',
  tieGame: 'תיקו',
  perfect: 'מושלם!',
  youWonChips: (n) => `ניצחת ${n} צ׳יפים!`,
  handWonBang: 'ניצחת את היד!',
  rematch: 'שחק שוב',
  homeBtn: 'בית',
  leaveBtn: 'עזוב',
  shareHand: 'שתף יד',
  currentBalance: 'יתרה נוכחית',
  netResult: 'תוצאה נטו',
  thisSession: 'המושב הזה',
  showHandDetails: 'הצג פרטי יד',
  hideHandDetails: 'הסתר פרטי יד',
  rankUp: 'עלייה בדרגה',
  rankDown: 'ירידה בדרגה',
  xpOnly: 'XP בלבד',
  try4Boards: 'נסה 4 בורדים',
  niceBang: 'יופי!',
  gameOver: 'המשחק נגמר',
  connectionLost: 'החיבור אבד',
  hostDisconnected: 'המארח התנתק',
  rejoin: 'הצטרף מחדש',
  keepWaiting: 'המשך להמתין',
  waitingTimedOut: 'זמן ההמתנה תם',
  waitingTimedOutBody: 'אין תגובה מהשחקנים האחרים.',
  hostDisconnectedBody: 'המארח עזב את המשחק.',
  connectionLostBody: 'איבדת חיבור לחדר המשחק. אפשר לנסות להצטרף מחדש.',
  shareCompleteBtn: 'שתף COMPLETE',
  bestHandFrom9: '★ היד הטובה ביותר מ-9 קלפים',
  practiceXpNote: '🤖 תרגול מול הבוט — XP בלבד, בלי צ׳יפים',
  boardByBoard: 'בורד אחר בורד',
  viewHandHistory: 'הצג היסטוריית ידיים →',
  tallyWon: 'ניצח',
  tallyTied: 'תיקו',
  tallyLost: 'הפסד',
  tieBonus: (n) => `בונוס תיקו: +${n} צ׳יפים`,
  winStreakBadge: (n) => `${n} רצף נצחונות!`,
  bestStreakLabel: (n) => `שיא: ${n}`,
  hideDetailsToggle: 'הסתר פרטים ▴',
  showDetailsToggle: 'פרטי היד ▾',
  xpLabelGame: 'משחק',
  xpLabelBoards: 'בורדים',
  xpLabelWin: 'ניצחון',
  xpLabelComplete: 'COMPLETE',
  bestHandOnBoard: (name, board) => `⭐ היד הטובה ביותר: ${name} בבורד ${board}`,
  statBoardsLabel: 'בורדים',
  statGamesLabel: 'משחקים',
  statNetLabel: 'נטו',
  statTied: (n) => `(${n} תיקו)`,
  completeAllBoards: 'COMPLETE! כל הבורדים!',
  opponentSwept: 'היריב זכה בכל הבורדים',
  dailyStreakMsg: (day, amt) => `רצף של ${day} ימים! +${amt} צ׳יפים בונוס מחר`,
  mpBeat: (name) => `ניצחת את ${name}!`,
  mpDefeatedBy: (name) => `הובסת ע"י ${name}`,
  mpTiedWith: (name) => `תיקו עם ${name}`,
  vsPrefix: 'מול',
  soClose: 'כמעט! 😬',
  shareShort: 'שתף',
  completeWonXpBonus: (xp) => `ניצחת בכל הבורדים! +${xp} XP בונוס`,
  completeWonPctBonus: (pct) => `ניצחת בכל הבורדים! +${pct}% בונוס`,
  completeWonBonus: 'ניצחת בכל הבורדים! בונוס COMPLETE',
  holdToSkipAll: 'החזק לדילוג על הכל',
  tapForResults: '▶ הקש לתוצאות',
  scoreLeading: (p, b, remaining) => `מוביל ${p}-${b} · נותרו ${remaining}`,
  scoreTrailing: (p, b, remaining) => `מפגר ${p}-${b} · נותרו ${remaining}`,
  scoreBoardsLeft: (remaining) => `${remaining} בורדים`,
  scoreTied: (p, b, remaining) => `תיקו ${p}-${b} · נותרו ${remaining}`,
  tieBoard: 'בורד תיקו',
  playerFallback: 'שחקן 1',
  outsLabel: 'אאוטים',
  dangerLabel: 'סכנה',
  outsCalculating: 'מחשב…',
  a11yOutsToWin: 'אאוטים לניצחון',
  a11yOutsToLose: 'קלפים שמפסידים',
  revealTip1: 'עכשיו ראה מה יש ליריב בכל בורד.',
  revealTip2: 'כל קלף משנה את היד המנצחת!',
  revealTip3: 'ירוק = ניצחון, אדום = הפסד. שים לב לבונוס COMPLETE!',
  timeoutTooltip: 'נגמר הזמן = הקלפים יונחו אקראית',
  homePlayOnline: 'שחק אונליין',
  homePlayOnlineSub: 'שחקנים אמיתיים · שולחנות בוט מיידיים',
  homePracticeVsBots: 'תרגול מול בוטים',
  homePracticeA11y: 'תרגול מול בוטים',
  homeTeaching: 'ארבעה קלפים בכל בורד. כל הבורדים משוחקים יחד. הנצח ברוב הבורדים, זכה ביד.',

  // FULL-I18N 2026-09-03 — Roye: "Translate everything." English must NEVER show Hebrew;
  // Hebrew may show English. Hand-rank NAMES and the CAPS loanwords (COMPLETE, CAPS, Sit and Go)
  // stay English in BOTH tables on purpose — that is a standing product rule, not a gap.
  playSinglePlayer: 'שחקן יחיד',
  playSinglePlayerSub: (boards) => `תרגול מול בוטים · ${boards} בורדים`,
  playSinglePlayerA11y: 'שחקן יחיד. תרגול מול בוטים',
  playMpLobby: 'לובי רב-משתתפים',
  playMpLobbySub: 'הצטרף לשולחן ציבורי פתוח · מתחיל אוטומטית כשמתמלא',
  playMpLobbyA11y: 'לובי רב-משתתפים. הצטרף לשולחן ציבורי פתוח',
  playPrivateTable: 'שולחן פרטי מהיר',
  playPrivateTableSub: 'שולחן חד-פעמי · שתף קוד או הצטרף עם קוד',
  playPrivateTableA11y: 'שולחן פרטי מהיר. צור שולחן חד-פעמי לשיתוף, או הצטרף עם קוד',
  playLeaderboardA11y: 'לוח מנצחים. ראה את הדירוג העולמי שלך',
  notEnoughChips: 'אין מספיק צ׳יפים',
  needChipsToPlay: (n) => `צריך ${n} צ׳יפים כדי לשחק.`,
  profileTitle: 'פרופיל',
  profileHands: 'ידיים',
  profileWinRate: 'אחוז ניצחון',
  profileStreak: 'רצף',
  profileChips: 'צ׳יפים',
  homeGetChips: 'קבל צ׳יפים',
  homeGetChipsA11y: 'קבל צ׳יפים',
  homeOpenChipShop: 'פתח את חנות הצ׳יפים',
  homeOpenMenu: 'פתח תפריט',
  homePlayOnlineA11y: 'שחק אונליין, פתח את הלובי',
  homeChallengeFriend: '⚔️ אתגר חבר',
  homeChallengeFriendA11y: 'אתגר חבר',
  homeShareComplete: '🏆 עשית COMPLETE! לשתף?',
  homeShareCompleteA11y: 'שתף את ניצחון ה-COMPLETE שלך',
  homeDailyClaimed: (amount, streak) => `✅ +${amount} נאסף · יום ${streak} ברצף`,
  homeDailyClaimA11y: 'קבל בונוס יומי',
  homeDailyStreakClaim: (day, amount) => `🔥 יום ${day} ברצף! +${amount} צ׳יפים!`,
  homeDailyClaim: (day) => `🎁 קבל בונוס יומי · יום ${day}`,
  homeMilestoneWeekly: ' (בונוס שבועי!)',
  homeMilestoneMonthly: ' (בונוס חודשי!)',
  homeWinStreak: (n) => `🔥 ${n} ניצחונות ברצף`,
  homeWinStreakA11y: (n) => `${n} ניצחונות ברצף`,
  homePotd: '🏆 המהלך של היום',
  homePotdA11y: 'המהלך של היום',
  homePotdWinningHand: 'יד מנצחת',
  homePotdPot: (pot) => `קופה: ${pot} 💰`,
  homePotdPotA11y: (pot) => `קופה: ${pot} צ׳יפים`,
  homeHandsSaved: (n) => `📊 ${n} ידיים שמורות`,
  homeHandsSavedA11y: (n) => `היסטוריית ידיים, ${n} ידיים שמורות`,
  homeMyProgress: 'ההתקדמות שלי',
  homeWinRateLabel: (pct) => `${pct} אחוז ניצחון`,
  homeCompetition: 'תחרות',
  homeLeaderboardRank: 'דירוג בלוח המנצחים',
  homePlayToBeRanked: 'שחק כדי להיכנס לדירוג',
  homeRecentWins: '🏆 ניצחונות אחרונים',
  homeRecentWinsA11y: 'ניצחונות אחרונים',
  homeNoHistoryYet: 'שחק Sit and Go כדי לראות היסטוריה',
  homeSitAndGoLoss: '❌ Sit and Go — בפעם הבאה',
  homeRecentHands: 'ידיים אחרונות',
  homeViewHandHistory: 'צפה בהיסטוריית הידיים',
  homeEff: (pct) => `${pct}% יעילות`,
  homeYourCode: 'הקוד שלך',
  homeCopy: '📋 העתק',
  homeCopyA11y: 'העתק קוד הזמנה',
  homeShare: '📤 שתף',
  homeShareA11y: 'שתף קוד הזמנה',
  homeEnterInviteCode: '🎁 הזן קוד הזמנה',
  homeEnterInviteCodeSub: 'הזן את הקוד שחבר שיתף איתך',
  homeInviteDialogA11y: 'חלון קוד הזמנה',
  homeRedeemA11y: (n) => `מימוש קוד הזמנה עבור ${n} צ׳יפים`,
  homeCharacters: (n) => `${n} תווים`,
  homeFriendsCode: 'קוד ההזמנה של החבר',
  homeCloseDialog: 'סגור חלון',
  homeSaveAcrossDevices: 'הניצחונות, הצ׳יפים וההיסטוריה שלך יישמרו בכל המכשירים.',
  legalLine: 'משחק חינם | צ׳יפים וירטואליים בלבד | ללא הימורים בכסף אמיתי | 18+',
  setProfile: 'פרופיל',
  setGameplay: 'משחק',
  setCards: 'קלפים',
  setCardsA11y: 'קלפים',
  setAudioNotifications: 'שמע והתראות',
  setTools: 'כלים',
  setDangerZone: 'אזור מסוכן',
  setCredits: 'קרדיטים',
  setVisualStyle: 'סגנון חזותי',
  setShownOnLeaderboard: 'מוצג בלוח המנצחים · הקש לעריכה',
  setEdit: 'עריכה',
  setPushNotifications: 'התראות',
  setEnableNotifications: 'הפעל התראות',
  setRegistering: 'רושם…',
  setRevealSpeed: 'מהירות החשיפה',
  setSpeedFast: 'מהיר',
  setSpeedNormal: 'רגיל',
  setSpeedCinematic: 'קולנועי',
  setVibration: 'רטט',
  setSoundVolume: 'עוצמת השמע',
  setAmbientSound: 'מוזיקת רקע',
  setAmbientSoundSub: 'מוזיקת רקע של קזינו',
  setPlayers: 'שחקנים',
  setPlayersLabel: (n) => `${n} שחקנים (מול ${n - 1} ${n === 2 ? 'בוט' : 'בוטים'})`,
  setBoardsCards: (boards, cards) => `${boards} בורדים, ${cards} קלפים כל אחד`,
  setBotDifficulty: 'רמת הבוט',
  setBotEasy: 'קל',
  setBotMedium: 'בינוני',
  setBotHard: 'קשה',
  setBotEasyHint: 'הנחה אקראית',
  setBotMediumHint: 'מקבץ קלפים באותה סדרה',
  setBotHardHint: 'משחק כדי לנצח בכל בורד',
  setOrientationPortrait: 'לאורך',
  setOrientationWide: 'מסך רחב',
  setSkipReveal: 'דלג על החשיפה בורד-אחר-בורד',
  setOffCaps: 'כבוי',
  setOnCaps: 'פועל',
  setOff: 'כבוי',
  setOn: 'פועל',
  setSuitColors: 'צבעי הסדרות',
  setColorblindMode: 'מצב עיוורון צבעים',
  setCardSort: 'מיון הקלפים',
  setSortAuto: 'אוטומטי',
  setSortPairs: 'זוגות',
  setThemeTimeless: 'נצחי',
  setThemeArcade: 'ארקייד',
  setThemeConcrete: 'בטון',
  setVersion: 'גרסה',
  setPrivacyPolicy: 'מדיניות פרטיות',
  setTermsOfUse: 'תנאי שימוש',
  setDeleteAccount: 'מחיקת חשבון',
  setResetAllProgress: 'איפוס כל ההתקדמות',
  setResetConfirmBody: 'הפעולה תמחק את כל הצ׳יפים, הרמה, ההיסטוריה והרצף. להמשיך?',
  setResetDone: 'ההתקדמות אופסה',
  setResetDoneBody: 'כל ההתקדמות נמחקה. הפעל מחדש את האפליקציה כדי להשלים.',
  setGoBack: 'חזרה',
  setYourRank: 'הדירוג שלך',
  setCreditQuotes: '🤖 ציטוטי מקצוענים: סימולציה דיגיטלית של AI — ציטוטים בדיוניים',
  setCreditVoices: '🔊 קטעי קול: קולות שנוצרו ב-AI באמצעות ElevenLabs',
  setCreditNotAffiliated: '⚠️ ללא כל שיוך לשחקני הפוקר המוזכרים',
  setCreditParody: 'הקולות הם פרודיה / בידור בלבד',
  completeShort: 'COMPLETE!',
  completeBonusChips: (n) => `+${n} צ׳יפים בונוס!`,
  tutorialCompleteBadge: '🏆 COMPLETE +50%',
  calculatingResults: 'מחשב תוצאות...',
  practiceNoChips: '🤖 תרגול · בלי צ׳יפים',
  practiceSessionNet: (net) => `🤖 תרגול · ${net > 0 ? '+' : ''}${net} צ׳יפים`,
  practiceA11yNoChips: 'תרגול, בלי צ׳יפים על הכף',
  practiceA11yNet: (net) => `תרגול, במפגש הזה ${net > 0 ? 'פלוס' : 'מינוס'} ${Math.abs(net)} צ׳יפים`,
  homeProgressSub: (pct) => `הישגים · ${pct} אחוז ניצחון`,
  homeChecking: 'בודק...',
  homeRedeemBtn: (n) => `מימוש +${n} 💰`,
  homeSitAndGoWin: (chips) => `✅ ניצחון ב-Sit and Go — +${chips} 💰`,
  homeSitAndGoWinA11y: (chips) => `ניצחת ב-Sit and Go — +${chips} צ׳יפים`,
  homeSitAndGoLossA11y: 'Sit and Go — בפעם הבאה',
  setThemeModern: 'מודרני',
  setThemeClassicDesc: 'זהב כהה\nמראה אלגנטי',
  setThemeFiveoDesc: 'שולחן כחול כהה\nהדגשים במנטה',
  setSelect: 'בחר',
  setChangeAnytime: 'ניתן לשנות בכל עת בהגדרות',
  setChooseStyle: 'בחר את הסגנון שלך',
  setAdvanced: '⚙️ מתקדם',
};

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

const en: Translations = {
  botFinished: 'Bot finished!',
  yourHand: 'YOUR HAND',
  placeN: (n) => `PLACE ${n}`,
  undo: 'UNDO',
  ready: 'READY',
  allPlaced: 'All cards placed!',
  timeBank: '+15s',
  winAll: (n) => `WIN ALL → +${n} 🟡`,
  // VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — was 'בוט' (Hebrew) in the en
  // translation table; rendered as the bot's display name even with English
  // locale, which is what the user was seeing in a full game.
  bot: 'Bot',
  yourCards: 'YOUR CARDS',
  boardN: (n, total) => `BOARD ${n} OF ${total}`,
  tapForNextBoard: '▶ TAP FOR NEXT BOARD',
  tapToReveal: 'Tap to reveal',
  youWin: '✅ YOU WIN',
  youLose: '❌ YOU LOSE',
  tie: '🤝 TIE',
  dealMeIn: 'DEAL ME IN',
  netChips: (n) => n > 0 ? `+${n} 🟡` : `${n} 🟡`,
  complete: 'Round Complete! 🏆',
  completeBonus: '+50% BONUS',
  newHand: 'NEW HAND',
  history: 'HISTORY',
  stats: 'STATS',
  settings: 'SETTINGS',
  tutorial: 'TUTORIAL',
  boardsPlayers: (b, p) => `${b} boards · ${p} players`,
  onboarding: {
    step1Title: 'Welcome to CAPS',
    step1Body: 'CAPS is Omaha Poker played across multiple boards simultaneously. Each board is a separate hand with its own pot.',
    step2Title: 'Distribute your cards',
    step2Body: 'You receive 16 cards. Place exactly 4 cards on each board — all cards must be placed, none left over.',
    step3Title: 'Choose wisely',
    step3Body: 'The flop is visible upfront. Build the best hand on each board using Omaha rules: exactly 2 of your cards + 3 community cards.',
    step4Title: 'COMPLETE Bonus',
    step4Body: "Win ALL boards → earn 50% extra from the total pot! That's the COMPLETE bonus. Risky but powerful.",
    step5Title: 'Ready to play?',
    step5Body: 'The bot will fill its cards. Press READY when done. Tap a card to select it, tap a board slot to place it.',
    next: 'NEXT',
    skip: 'SKIP',
    letsPlay: "LET'S PLAY!",
  },
  // Profile menu (S-LOCALE-FIX)
  profileMenuAchievements: 'Achievements',
  profileMenuDailyMissions: 'Daily Missions',
  profileMenuHandHistory: 'Hand History',
  profileMenuDetailedStats: 'Detailed Stats',
  profileMenuLeaderboard: 'Leaderboard',
  profileMenuSettings: 'Settings',
  tabHome: 'Home',
  tabPlay: 'Play',
  tabFriends: 'Friends',
  tabCups: 'Cups',
  tabProfile: 'Profile',
  // Friends referral
  inviteFriends: 'Invite Friends',
  inviteFriendsSub: (n) => `Share your code · +${n} 💰 per friend`,
  // Common buttons
  cancel: 'Cancel',
  confirm: 'Confirm',
  readyCheck: '✓ READY',
  continueArrow: 'CONTINUE →',
  autoPlace: '⚡ Auto-Place',
  playNow: '▶ Play Now',
  // Game screen
  boardLabel: (n) => `Board ${n}`,
  arrangeCards: (n) => `Place ${n} cards`,
  botRowSub: (players, boards) => `${players}P · ${boards} boards · instant`,
  timeUpAutoplaced: '⏱ Time up — cards placed automatically',
  botSingular: 'Bot',
  botPlural: (r, t) => `Bots ${r}/${t}`,
  botEmojiPlural: (r, t) => `🤖 Bots ${r}/${t}`,
  boardFull: 'Board is full',
  leaveGame: {
    title: 'Leave Game?',
    body: 'You will lose your pot for this hand.',
  },
  a11yReadyReveal: 'Ready, reveal hands',
  a11yPlaceRemaining: 'Place remaining cards on boards',
  community: 'Community',
  hintTexts: [
    '👆 Tap a card from your hand, then tap a board to place it',
    '🎯 Try to win ALL boards for the COMPLETE bonus!',
    '💡 Tip: Tap a placed card to remove it and try a different board',
  ],
  waitingForBots: (n) => n > 1 ? 'Waiting for bots...' : 'Waiting for bot...',
  waitingForOthers: (n) => n > 1 ? 'Waiting for the other players...' : 'Waiting for opponent...',
  tapToContinue: 'TAP TO CONTINUE →',
  // Hand history
  historyAll: (n) => `All (${n})`,
  historyWins: (n) => `Wins (${n})`,
  historyLosses: (n) => `Losses (${n})`,
  historyEmptyTitle: 'No hands played yet',
  historyEmptySub: 'Play your first game to see history!',
  settingsTitle: 'SETTINGS',
  proQuotes: 'Pro Quotes (AI Simulation)',
  proVoice: 'Pro Voice Clips (AI-Generated)',
  showTutorial: 'Show Tutorial Again',
  simulationMode: 'Simulation Mode',
  debugOverlay: 'Debug Overlay',
  resetDefaults: 'Reset to Defaults',
  yourProfile: 'YOUR PROFILE',
  edit: 'EDIT',
  play: 'PLAY',
  signIn: 'SIGN IN',
  signOut: 'SIGN OUT',
  leaderboard: 'LEADERBOARD',
  handHistory: 'HAND HISTORY',
  coaching: 'COACHING',
  spectator: 'SPECTATOR',
  reportBug: 'REPORT BUG',
  battlePass: 'BATTLE PASS',
  tournaments: 'TOURNAMENTS',
  language: 'LANGUAGE',
  languageEnglish: 'English',
  languageHebrew: 'עברית',
  playOnline: 'PLAY ONLINE',
  localMultiplayer: 'LOCAL MULTIPLAYER',
  chooseLanguage: 'Choose your language',
  // PR-I
  hostGame: 'Host Game',
  joinGame: 'Join Game',
  hostLocalGameSub: 'Play with someone nearby (WiFi)',
  joinLocalGameSub: 'Find a host on your network',
  hostOnlineGame: 'Host Online Game',
  hostOnlineGameSub: 'Create a room for friends to join',
  joinOnlineGameSub: 'Enter a room code',
  friendsLeaderboardCard: 'Leaderboard',
  friendsLeaderboardCardSub: 'See where you rank globally',
  cupsTitle: 'Cups',
  // BOARD-COUNT FIX 2026-08-11 — was "4 cards. 4 boards. 1 winner." on the Cups tab. Same false
  // claim as the home tagline and the five pro quotes: the board count is dynamic (2P=4, 3P=3,
  // 4P=2). This is a SIXTH site the first grep missed — "two renderers, not one" again.
  cupsSubtitle: (e, t) => `${e}/${t} cups · 4 cards. Every board. 1 winner.`,
  playChooseMode: 'Choose your game mode',
  shopBuy: 'Buy',
  shopCantAfford: "Can't afford",
  shopOwned: 'Owned',
  // VAMOS FINISH-HEBREW 2026-09-02 — reveal + results flow.
  revealedAfterRiver: 'Revealed after River',
  autoPlaceAll: 'Auto-Place ALL',
  a11yTapToPlace: 'Tap to place the selected card here.',
  a11ySelectFirst: 'Select a card first.',
  equityYou: 'YOU',
  equityOpp: 'OPP',
  equityLead: 'LEAD',
  equityLeading: 'LEADING',
  equityTrailing: 'TRAILING',
  calculatingOdds: 'Calculating odds',
  winShort: 'WIN',
  lossShort: 'LOSS',
  tieShort: 'TIE',
  shareImage: 'Share Image',
  shareStory: 'Share as Story',
  copyReplayLink: 'Copy Replay Link',
  linkCopied: 'Link copied!',
  backToHome: 'Back to home',
  loadingEllipsis: 'Loading...',
  handUnavailable: 'This hand is no longer available.',
  youWinBig: 'YOU WIN',
  youLoseBig: 'YOU LOSE',
  tieGame: 'TIE GAME',
  perfect: 'PERFECT!',
  youWonChips: (n) => `You won ${n} chips!`,
  handWonBang: 'Hand won!',
  rematch: 'REMATCH',
  homeBtn: 'HOME',
  leaveBtn: 'LEAVE',
  shareHand: 'Share Hand',
  currentBalance: 'Current Balance',
  netResult: 'Net Result',
  thisSession: 'This session',
  showHandDetails: 'Show hand details',
  hideHandDetails: 'Hide hand details',
  rankUp: 'Rank up',
  rankDown: 'Rank down',
  xpOnly: 'XP only',
  try4Boards: 'Try 4 boards',
  niceBang: 'Nice!',
  gameOver: 'GAME OVER',
  connectionLost: 'Connection Lost',
  hostDisconnected: 'Host Disconnected',
  rejoin: 'Rejoin',
  keepWaiting: 'Keep Waiting',
  waitingTimedOut: 'Waiting Timed Out',
  waitingTimedOutBody: 'No response from other players.',
  hostDisconnectedBody: 'The host has left the game.',
  connectionLostBody: 'Lost connection to the game room. You can try to rejoin.',
  shareCompleteBtn: 'Share COMPLETE',
  bestHandFrom9: '★ Best hand from 9 cards',
  practiceXpNote: '🤖 Practice vs bot — XP only, no chips',
  boardByBoard: 'Board by board',
  viewHandHistory: 'View hand history →',
  tallyWon: 'WON',
  tallyTied: 'TIED',
  tallyLost: 'LOST',
  tieBonus: (n) => `Tie bonus: +${n} chips`,
  winStreakBadge: (n) => `${n} WIN STREAK!`,
  bestStreakLabel: (n) => `Best: ${n}`,
  hideDetailsToggle: 'Hide details ▴',
  showDetailsToggle: 'Hand details ▾',
  xpLabelGame: 'Game',
  xpLabelBoards: 'Boards',
  xpLabelWin: 'Win',
  xpLabelComplete: 'Complete',
  bestHandOnBoard: (name, board) => `⭐ Best hand: ${name} on Board ${board}`,
  statBoardsLabel: 'Boards',
  statGamesLabel: 'Games',
  statNetLabel: 'Net',
  statTied: (n) => `(${n} tied)`,
  completeAllBoards: 'COMPLETE! ALL BOARDS!',
  opponentSwept: 'Opponent swept all boards',
  dailyStreakMsg: (day, amt) => `Day ${day} streak! +${amt} bonus chips tomorrow`,
  mpBeat: (name) => `You beat ${name}!`,
  mpDefeatedBy: (name) => `Defeated by ${name}`,
  mpTiedWith: (name) => `Tied with ${name}`,
  vsPrefix: 'vs',
  soClose: 'So close! 😬',
  shareShort: 'Share',
  completeWonXpBonus: (xp) => `You won ALL boards! +${xp} XP bonus`,
  completeWonPctBonus: (pct) => `You won ALL boards! +${pct}% bonus`,
  completeWonBonus: 'You won ALL boards! COMPLETE bonus',
  holdToSkipAll: 'hold to skip all',
  tapForResults: '▶ TAP FOR RESULTS',
  scoreLeading: (p, b, remaining) => `Leading ${p}-${b} · ${remaining} left`,
  scoreTrailing: (p, b, remaining) => `Trailing ${p}-${b} · ${remaining} left`,
  scoreBoardsLeft: (remaining) => `${remaining} boards`,
  scoreTied: (p, b, remaining) => `Tied ${p}-${b} · ${remaining} left`,
  tieBoard: 'Tie board',
  playerFallback: 'Player 1',
  outsLabel: 'OUTS',
  dangerLabel: 'DANGER',
  outsCalculating: 'CALCULATING…',
  a11yOutsToWin: 'outs to win',
  a11yOutsToLose: 'cards that lose it',
  revealTip1: 'Now see what your opponent has on each board.',
  revealTip2: 'Each card changes the winning hand!',
  revealTip3: 'Green = win, Red = loss. Watch for COMPLETE bonus!',
  timeoutTooltip: 'Time out = cards placed randomly',
  homePlayOnline: 'Play Online',
  homePlayOnlineSub: 'Real players · instant bot tables',
  homePracticeVsBots: 'Practice vs bots',
  homePracticeA11y: 'Practice against bots',
  homeTeaching: 'Four cards on every board. Every board plays at once. Win the most boards, win the hand.',

  // FULL-I18N 2026-09-03 — Roye: "Translate everything." English must NEVER show Hebrew;
  // Hebrew may show English. Hand-rank NAMES and the CAPS loanwords (COMPLETE, CAPS, Sit and Go)
  // stay English in BOTH tables on purpose — that is a standing product rule, not a gap.
  playSinglePlayer: 'Single Player',
  playSinglePlayerSub: (boards) => `Practice vs bots · ${boards} boards`,
  playSinglePlayerA11y: 'Single Player. Practice vs bots',
  playMpLobby: 'Multiplayer Lobby',
  playMpLobbySub: 'Join an open public table · auto-start when full',
  playMpLobbyA11y: 'Multiplayer Lobby. Join an open public table',
  playPrivateTable: 'Quick Private Table',
  playPrivateTableSub: 'One-off table · share a code or join one',
  playPrivateTableA11y: 'Quick Private Table. Create a one-off table to share, or join by code',
  playLeaderboardA11y: 'Leaderboard. See where you rank globally',
  notEnoughChips: 'Not Enough Chips',
  needChipsToPlay: (n) => `You need ${n} chips to play.`,
  profileTitle: 'PROFILE',
  profileHands: 'HANDS',
  profileWinRate: 'WIN RATE',
  profileStreak: 'STREAK',
  profileChips: 'CHIPS',
  homeGetChips: 'GET CHIPS',
  homeGetChipsA11y: 'Get chips',
  homeOpenChipShop: 'Open chip shop',
  homeOpenMenu: 'Open menu',
  homePlayOnlineA11y: 'Play online, open the multiplayer lobby',
  homeChallengeFriend: '⚔️ Challenge a Friend',
  homeChallengeFriendA11y: 'Challenge a Friend',
  homeShareComplete: '🏆 You got COMPLETE! Share it?',
  homeShareCompleteA11y: 'Share your COMPLETE win',
  homeDailyClaimed: (amount, streak) => `✅ +${amount} claimed · Day ${streak} streak`,
  homeDailyClaimA11y: 'Claim daily bonus',
  homeDailyStreakClaim: (day, amount) => `🔥 Day ${day} streak! +${amount} chips!`,
  homeDailyClaim: (day) => `🎁 Claim daily bonus · Day ${day}`,
  homeMilestoneWeekly: ' (Weekly bonus!)',
  homeMilestoneMonthly: ' (Monthly bonus!)',
  homeWinStreak: (n) => `🔥 ${n} win streak`,
  homeWinStreakA11y: (n) => `${n} wins in a row`,
  homePotd: '🏆 Play of the Day',
  homePotdA11y: 'Play of the Day',
  homePotdWinningHand: 'Winning hand',
  homePotdPot: (pot) => `Pot: ${pot} 💰`,
  homePotdPotA11y: (pot) => `Pot: ${pot} chips`,
  homeHandsSaved: (n) => `📊 ${n} hands saved`,
  homeHandsSavedA11y: (n) => `Hand history, ${n} hands saved`,
  homeMyProgress: 'My Progress',
  homeWinRateLabel: (pct) => `${pct} win rate`,
  homeCompetition: 'Competition',
  homeLeaderboardRank: 'Leaderboard rank',
  homePlayToBeRanked: 'Play to be ranked',
  homeRecentWins: '🏆 Recent Wins',
  homeRecentWinsA11y: 'Recent wins',
  homeNoHistoryYet: 'Play Sit and Go to see your history',
  homeSitAndGoLoss: '❌ Sit and Go — next time',
  homeRecentHands: 'Recent Hands',
  homeViewHandHistory: 'View hand history',
  homeEff: (pct) => `${pct}% eff`,
  homeYourCode: 'YOUR CODE',
  homeCopy: '📋 Copy',
  homeCopyA11y: 'Copy referral code',
  homeShare: '📤 Share',
  homeShareA11y: 'Share referral code',
  homeEnterInviteCode: '🎁 Enter Invite Code',
  homeEnterInviteCodeSub: 'Enter the code your friend shared',
  homeInviteDialogA11y: 'Invite code dialog',
  homeRedeemA11y: (n) => `Redeem invite code for ${n} chips`,
  homeCharacters: (n) => `${n} characters`,
  homeFriendsCode: "Friend's referral code",
  homeCloseDialog: 'Close dialog',
  homeSaveAcrossDevices: 'Your wins, bankroll & history will be saved across devices.',
  legalLine: 'Free play | Virtual chips only | No real-money gambling | 18+',
  setProfile: 'PROFILE',
  setGameplay: 'GAMEPLAY',
  setCards: 'CARDS',
  setCardsA11y: 'Cards',
  setAudioNotifications: 'AUDIO & NOTIFICATIONS',
  setTools: 'TOOLS',
  setDangerZone: 'DANGER ZONE',
  setCredits: 'CREDITS',
  setVisualStyle: 'VISUAL STYLE',
  setShownOnLeaderboard: 'Shown on leaderboard · Tap to edit',
  setEdit: 'EDIT',
  setPushNotifications: 'Push Notifications',
  setEnableNotifications: 'Enable Notifications',
  setRegistering: 'Registering…',
  setRevealSpeed: 'Reveal Speed',
  setSpeedFast: 'Fast',
  setSpeedNormal: 'Normal',
  setSpeedCinematic: 'Cinematic',
  setVibration: 'Vibration',
  setSoundVolume: 'Sound Volume',
  setAmbientSound: 'Ambient Sound',
  setAmbientSoundSub: 'Casino background music',
  setPlayers: 'Players',
  setPlayersLabel: (n) => `${n} Players (vs ${n - 1} ${n === 2 ? 'Bot' : 'Bots'})`,
  setBoardsCards: (boards, cards) => `${boards} boards, ${cards} cards each`,
  setBotDifficulty: 'Bot Difficulty',
  setBotEasy: 'Easy',
  setBotMedium: 'Medium',
  setBotHard: 'Hard',
  setBotEasyHint: 'Random placement',
  setBotMediumHint: 'Groups suited cards',
  setBotHardHint: 'Plays to win each board',
  setOrientationPortrait: 'Portrait',
  setOrientationWide: 'Widescreen',
  setSkipReveal: 'Skip board-by-board reveal',
  setOffCaps: 'OFF',
  setOnCaps: 'ON',
  setOff: 'Off',
  setOn: 'On',
  setSuitColors: 'Suit Colors',
  setColorblindMode: 'Colorblind Mode',
  setCardSort: 'Card Sort',
  setSortAuto: 'Auto',
  setSortPairs: 'Pairs',
  setThemeTimeless: 'Timeless',
  setThemeArcade: 'Arcade',
  setThemeConcrete: 'Concrete',
  setVersion: 'Version',
  setPrivacyPolicy: 'Privacy Policy',
  setTermsOfUse: 'Terms of Use',
  setDeleteAccount: 'Delete Account',
  setResetAllProgress: 'Reset All Progress',
  setResetConfirmBody: 'This will delete all chips, level, history and streak. Are you sure?',
  setResetDone: 'Progress Reset',
  setResetDoneBody: 'All progress has been cleared. Restart the app to apply fully.',
  setGoBack: 'Go back',
  setYourRank: 'Your rank',
  setCreditQuotes: '🤖 Pro Quotes: AI digital simulation — fictional quotes',
  setCreditVoices: '🔊 Voice Clips: AI-generated voices via ElevenLabs',
  setCreditNotAffiliated: '⚠️ Not affiliated with any poker player mentioned',
  setCreditParody: 'Voices are parody / entertainment only',
  completeShort: 'COMPLETE!',
  completeBonusChips: (n) => `+${n} bonus chips!`,
  tutorialCompleteBadge: '🏆 COMPLETE +50%',
  calculatingResults: 'Calculating results...',
  practiceNoChips: '🤖 Practice · no chips',
  practiceSessionNet: (net) => `🤖 Practice · ${net > 0 ? '+' : ''}${net} chips`,
  practiceA11yNoChips: 'Practice, no chips at stake',
  practiceA11yNet: (net) => `Practice, this session ${net > 0 ? 'plus' : 'minus'} ${Math.abs(net)} chips`,
  homeProgressSub: (pct) => `Achievements · ${pct} win rate`,
  homeChecking: 'Checking...',
  homeRedeemBtn: (n) => `Redeem +${n} 💰`,
  homeSitAndGoWin: (chips) => `✅ Won Sit and Go — +${chips} 💰`,
  homeSitAndGoWinA11y: (chips) => `You won Sit and Go — +${chips} chips`,
  homeSitAndGoLossA11y: 'Sit and Go — next time',
  setThemeModern: 'Modern',
  setThemeClassicDesc: 'Dark gold\nElegant look',
  setThemeFiveoDesc: 'Navy table\nMint accents',
  setSelect: 'SELECT',
  setChangeAnytime: 'Can be changed anytime in Settings',
  setChooseStyle: 'Choose your style',
  setAdvanced: '⚙️ ADVANCED',
};

const translations: Record<Language, Translations> = { he, en };

/** Get translations for current device language. Cached singleton. */
export function t(): Translations {
  return translations[getLanguage()];
}
