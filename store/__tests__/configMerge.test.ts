import { mergeGameStorePersisted } from '../configMerge';
import { DEFAULT_CONFIG } from '../../constants/gameConfig';

// Persist rehydration merge. zustand's default merge is SHALLOW, so a partially-written `config`
// REPLACES the initial one and rehydrates with keys missing — every arithmetic read of a missing
// key is then NaN (sticky where it accumulates, and a 0-delay timer where it feeds setTimeout).
// These tests guard that gaps are filled, that DELIBERATE settings are never overwritten by the
// defaults filling them, and that a bad read can never throw and drop a rehydrate.

// A small stand-in for DEFAULT_CONFIG so most cases stay pure and independent of the real values.
const DEFAULTS = {
  potPerBoard: 25,
  numberOfPlayers: 2,
  botSpeedMin: 1500,
  botSpeedMax: 4000,
  soundEnabled: true,
  soundVolume: 0.8,
  revealSpeed: 'normal',
};

describe('persist merge — config completeness', () => {
  it('fills keys the persisted config is missing', () => {
    const persisted = { config: { numberOfPlayers: 3 }, chips: 500 };
    const out = mergeGameStorePersisted(persisted, { config: {} }, DEFAULTS);

    expect(out.config.numberOfPlayers).toBe(3); // the persisted value wins
    expect(out.config.potPerBoard).toBe(25); // the gap is filled
    expect(out.config.botSpeedMin).toBe(1500);
    expect(out.config.botSpeedMax).toBe(4000);
    // Every key present => no arithmetic read can yield NaN.
    for (const k of Object.keys(DEFAULTS)) expect(out.config[k]).toBeDefined();
  });

  // THE ONE THAT MATTERS. A naive `{...persisted, ...defaults}` ordering passes every other test
  // in this file and silently resets every user setting on each launch.
  it('never overwrites a deliberate non-default setting with the default', () => {
    const persisted = {
      config: { soundEnabled: false, soundVolume: 0, botSpeedMin: 200, revealSpeed: 'fast' },
    };
    const out = mergeGameStorePersisted(persisted, { config: {} }, DEFAULTS);

    expect(out.config.soundEnabled).toBe(false); // NOT reset to the default `true`
    expect(out.config.soundVolume).toBe(0); // falsy, and must survive
    expect(out.config.botSpeedMin).toBe(200);
    expect(out.config.revealSpeed).toBe('fast');
    // …while a key the user never touched still comes from defaults.
    expect(out.config.potPerBoard).toBe(25);
  });

  it('never throws on null/undefined/empty persisted state, and still yields a complete config', () => {
    const current = { config: { ...DEFAULTS }, chips: 2000 };

    expect(() => mergeGameStorePersisted(undefined, current, DEFAULTS)).not.toThrow();
    expect(() => mergeGameStorePersisted(null, current, DEFAULTS)).not.toThrow();

    for (const p of [undefined, null, {}]) {
      const out = mergeGameStorePersisted(p, current, DEFAULTS);
      expect(out.config).toEqual(DEFAULTS);
      expect(out.chips).toBe(2000); // current state survives an absent rehydrate
    }

    // A persisted object with no `config` at all is the same case.
    const out = mergeGameStorePersisted({ chips: 77 }, current, DEFAULTS);
    expect(out.config).toEqual(DEFAULTS);
    expect(out.chips).toBe(77);
  });

  it('preserves non-config persisted fields and the store actions on `current`', () => {
    const action = () => {};
    const current = { config: { ...DEFAULTS }, chips: 0, addPracticeSessionNet: action };
    const persisted = {
      config: { potPerBoard: 50 },
      chips: 336855,
      totalChipsEarned: 999,
      unlockedAchievements: ['a', 'b'],
      currentWinStreak: 7,
      bestWinStreak: 9,
    };
    const out = mergeGameStorePersisted(persisted, current, DEFAULTS);

    expect(out.chips).toBe(336855);
    expect(out.totalChipsEarned).toBe(999);
    expect(out.unlockedAchievements).toEqual(['a', 'b']);
    expect(out.currentWinStreak).toBe(7);
    expect(out.bestWinStreak).toBe(9);
    expect(out.addPracticeSessionNet).toBe(action); // actions are not dropped
    expect(out.config.potPerBoard).toBe(50);
    // Input is not mutated.
    expect(persisted.config).toEqual({ potPerBoard: 50 });
  });

  // Regression for the exact shape that produced "This session: NaN" on 2026-08-20, pinned
  // against the REAL DEFAULT_CONFIG rather than the fixture above.
  it('regression: a config missing potPerBoard rehydrates with the real default, so the chip math is finite', () => {
    const persisted = { config: { numberOfPlayers: 2, soundEnabled: false, soundVolume: 0 } };
    const out = mergeGameStorePersisted(persisted, { config: {} }, DEFAULT_CONFIG);

    expect(DEFAULT_CONFIG.potPerBoard).toBe(25);
    expect(out.config.potPerBoard).toBe(25);
    expect(out.config.soundEnabled).toBe(false); // the deliberate override still stands

    // app/game.tsx:735 — the expression that went NaN.
    const boardCount = 4;
    const playerChipsWon = 200;
    expect(Number.isNaN(playerChipsWon - out.config.potPerBoard * boardCount)).toBe(false);
    expect(playerChipsWon - out.config.potPerBoard * boardCount).toBe(100);

    // app/game.tsx:621 — the bot-delay expression, which degrades to a 0ms timer when NaN.
    const delay = out.config.botSpeedMin + 0.5 * (out.config.botSpeedMax - out.config.botSpeedMin);
    expect(Number.isNaN(delay)).toBe(false);
    expect(delay).toBeGreaterThan(0);
  });
});
