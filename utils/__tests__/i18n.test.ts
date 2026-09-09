/**
 * i18n tests — S66
 * Verifies language detection, translation output, and RTL logic.
 */

// Reset module registry between tests that mock NativeModules
import { NativeModules, Platform } from 'react-native';

// Isolate the module so we can reset the singleton between tests
function loadFresh() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../i18n');
}

describe('i18n — getLanguage', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns "en" by default (no Hebrew locale)', () => {
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { getLanguage } = loadFresh();
    expect(getLanguage()).toBe('en');
  });

  it('returns "he" when device language is Hebrew (VAMOS FINISH-HEBREW un-forced getLanguage)', () => {
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'he' }],
    }), { virtual: true });
    const { getLanguage } = loadFresh();
    expect(getLanguage()).toBe('he');
  });

  it('returns "en" for any non-Hebrew locale (e.g. fr)', () => {
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'fr' }],
    }), { virtual: true });
    const { getLanguage } = loadFresh();
    expect(getLanguage()).toBe('en');
  });
});

describe('i18n — t()', () => {
  it('t().ready returns "READY" in English', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().ready).toBe('READY');
  });

  it('t().ready returns Hebrew "מוכן" when device is Hebrew (FINISH-HEBREW)', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'he' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().ready).toBe('מוכן');
  });

  it('t().placeN(5) returns correct English string', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().placeN(5)).toBe('PLACE 5');
  });

  it('t().boardN(2, 4) returns correct English string', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().boardN(2, 4)).toBe('BOARD 2 OF 4');
  });

  it('t().netChips returns + prefix for positive chips', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().netChips(10)).toBe('+10 🟡');
  });

  it('t().netChips returns no + prefix for negative chips', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().netChips(-5)).toBe('-5 🟡');
  });
});

describe('i18n — isRTL()', () => {
  it('isRTL() returns true with Hebrew locale (FINISH-HEBREW un-forced RTL)', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'he' }],
    }), { virtual: true });
    const { isRTL } = loadFresh();
    expect(isRTL()).toBe(true);
  });

  it('isRTL() returns false for English', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { isRTL } = loadFresh();
    expect(isRTL()).toBe(false);
  });
});

describe('i18n — onboarding strings', () => {
  it('onboarding.letsPlay returns "LET\'S PLAY!" in English', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'en' }],
    }), { virtual: true });
    const { t } = loadFresh();
    expect(t().onboarding.letsPlay).toBe("LET'S PLAY!");
  });

  it('onboarding has 5 step titles in Hebrew', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageCode: 'he' }],
    }), { virtual: true });
    const { t } = loadFresh();
    const ob = t().onboarding;
    expect(ob.step1Title).toBeTruthy();
    expect(ob.step2Title).toBeTruthy();
    expect(ob.step3Title).toBeTruthy();
    expect(ob.step4Title).toBeTruthy();
    expect(ob.step5Title).toBeTruthy();
  });
});

describe('i18n — S92 new keys', () => {
  const freshHe = () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'he' }] }), { virtual: true });
    return loadFresh();
  };
  const freshEn = () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }), { virtual: true });
    return loadFresh();
  };

  it('t().play is non-empty in both languages', () => {
    expect(freshHe().t().play).toBeTruthy();
    expect(freshEn().t().play).toBeTruthy();
  });

  it('t().battlePass is non-empty in Hebrew and English', () => {
    expect(freshHe().t().battlePass).toBeTruthy();
    expect(freshEn().t().battlePass).toBeTruthy();
  });

  it('t().tournaments is non-empty in both languages', () => {
    expect(freshHe().t().tournaments).toBeTruthy();
    expect(freshEn().t().tournaments).toBeTruthy();
  });

  it('t().leaderboard is non-empty in both languages', () => {
    expect(freshHe().t().leaderboard).toBeTruthy();
    expect(freshEn().t().leaderboard).toBeTruthy();
  });

  it('t().handHistory is non-empty in both languages', () => {
    expect(freshHe().t().handHistory).toBeTruthy();
    expect(freshEn().t().handHistory).toBeTruthy();
  });

  it('t().language is non-empty in both languages', () => {
    expect(freshHe().t().language).toBeTruthy();
    expect(freshEn().t().language).toBeTruthy();
  });

  it('setLanguage switches the active language (FINISH-HEBREW un-forced setLanguage)', () => {
    jest.resetModules();
    jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }), { virtual: true });
    jest.mock('../../store/gameStore', () => ({
      useGameStore: { getState: () => ({ bumpLanguageVersion: () => {} }) },
    }), { virtual: true });
    const { getLanguage, setLanguage } = loadFresh();
    expect(getLanguage()).toBe('en');
    setLanguage('he');
    expect(getLanguage()).toBe('he');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
  });

  it('all 16 new S92 keys are non-empty strings in Hebrew', () => {
    const { t } = freshHe();
    const keys: string[] = [
      'play', 'signIn', 'signOut', 'leaderboard', 'handHistory', 'coaching',
      'spectator', 'reportBug', 'battlePass', 'tournaments', 'language',
      'languageEnglish', 'languageHebrew', 'playOnline', 'localMultiplayer', 'chooseLanguage',
    ];
    for (const key of keys) {
      expect((t() as Record<string, unknown>)[key]).toBeTruthy();
    }
  });
});
