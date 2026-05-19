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

export function getLanguage(): Language {
  if (!_lang) {
    const code = detectLanguageCode();
    _lang = code === 'he' ? 'he' : 'en';
  }
  return _lang;
}

export function setLanguage(lang: Language): void {
  _lang = lang;
  // Notify store to bump version (lazy import to avoid circular dep)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useGameStore } = require('../store/gameStore');
    useGameStore.getState().bumpLanguageVersion?.();
  } catch {}
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
  timeUpAutoplaced: string;
  botSingular: string;
  botPlural: (ready: number, total: number) => string;
  botEmojiPlural: (ready: number, total: number) => string;

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
  profileMenuHandHistory: 'היסטוריית ידות',
  profileMenuDetailedStats: 'סטטיסטיקות מפורטות',
  profileMenuLeaderboard: 'לוח מנצחים',
  profileMenuSettings: 'הגדרות',
  // Friends referral
  inviteFriends: 'הזמן חברים',
  inviteFriendsSub: (n) => `שתף את הקוד שלך · +${n} 💰 לכל חבר`,
  // Common buttons
  cancel: 'ביטול',
  confirm: 'אישור',
  readyCheck: '✓ מוכן',
  continueArrow: 'המשך →',
  autoPlace: '⚡ מיקום אוטומטי',
  playNow: '▶ שחק עכשיו',
  // Game screen
  boardLabel: (n) => `לוח ${n}`,
  arrangeCards: (n) => `סדר ${n} קלפים`,
  timeUpAutoplaced: '⏱ הזמן נגמר — קלפים הונחו אוטומטית',
  botSingular: 'בוט',
  botPlural: (r, t) => `בוטים ${r}/${t}`,
  botEmojiPlural: (r, t) => `🤖 בוטים ${r}/${t}`,
  // Hand history
  historyAll: (n) => `הכל (${n})`,
  historyWins: (n) => `ניצחונות (${n})`,
  historyLosses: (n) => `הפסדים (${n})`,
  historyEmptyTitle: 'אין ידות שוחקו עדיין',
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
  bot: 'בוט',
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
  timeUpAutoplaced: '⏱ Time up — cards placed automatically',
  botSingular: 'Bot',
  botPlural: (r, t) => `Bots ${r}/${t}`,
  botEmojiPlural: (r, t) => `🤖 Bots ${r}/${t}`,
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
};

const translations: Record<Language, Translations> = { he, en };

/** Get translations for current device language. Cached singleton. */
export function t(): Translations {
  return translations[getLanguage()];
}
