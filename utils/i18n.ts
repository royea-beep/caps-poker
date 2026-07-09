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

// VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — English-only. The Hebrew translation
// table is intentionally retained for now (smaller diff, allows easy rollback),
// but every consumer of getLanguage() is forced to 'en'. Hebrew device locales
// will see the English UI. setLanguage() is now a no-op for the same reason.
export function getLanguage(): Language {
  _lang = 'en';
  return 'en';
}

export function setLanguage(_lang: Language): void {
  // no-op — see comment on getLanguage()
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
  autoPlace: '⚡ מיקום אוטומטי',
  playNow: '▶ שחק עכשיו',
  // Game screen
  boardLabel: (n) => `לוח ${n}`,
  arrangeCards: (n) => `סדר ${n} קלפים`,
  botRowSub: (players, boards) => `${players} שחקנים · ${boards} לוחות · מיידי`,
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
  cupsSubtitle: (e, t) => `${e}/${t} cups · 4 cards. 4 boards. 1 winner.`,
  playChooseMode: 'Choose your game mode',
  shopBuy: 'Buy',
  shopCantAfford: "Can't afford",
};

const translations: Record<Language, Translations> = { he, en };

/** Get translations for current device language. Cached singleton. */
export function t(): Translations {
  return translations[getLanguage()];
}
