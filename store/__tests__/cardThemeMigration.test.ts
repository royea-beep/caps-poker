import { migrateGameStorePersisted } from '../cardThemeMigration';
import { DEFAULT_CARD_THEME } from '../../constants/cardThemes';

// CARD-FACE MERGE (v3.2 ship): the card-face default flipped 'v1' -> 'v3'. Existing devices persisted
// 'v1' and must be migrated so they actually see the upgraded face. These tests guard that migration
// AND that it can never drop a rehydrate or reshape chip-bearing state.
describe('card-face v3.2 ship — default flip + persist migration', () => {
  it('DEFAULT_CARD_THEME is v3 (upgraded face is the default for new installs)', () => {
    expect(DEFAULT_CARD_THEME).toBe('v3');
  });

  it("moves an existing device off the OLD 'v1' default to 'v3'", () => {
    const before = { cardTheme: 'v1', chips: 12345, currentWinStreak: 4 };
    const after = migrateGameStorePersisted(before, 0);
    expect(after.cardTheme).toBe('v3');
  });

  it('preserves EVERY other persisted field (never reshapes chip-bearing state)', () => {
    const before = {
      cardTheme: 'v1',
      chips: 336855,
      totalChipsEarned: 999,
      totalChipsSpent: 111,
      unlockedAchievements: ['a', 'b'],
      currentWinStreak: 7,
      bestWinStreak: 9,
    };
    const after = migrateGameStorePersisted(before, 0);
    expect(after).toEqual({ ...before, cardTheme: 'v3' });
    // chips and every sibling field are byte-identical
    expect(after.chips).toBe(336855);
    expect(after.unlockedAchievements).toEqual(['a', 'b']);
  });

  it("leaves a deliberate 'v1' Classic opt-out untouched only when it is NOT the persisted key — i.e. any non-v1 value is unchanged", () => {
    for (const theme of ['v2', 'v3'] as const) {
      const before = { cardTheme: theme, chips: 500 };
      expect(migrateGameStorePersisted(before, 0)).toEqual(before);
    }
  });

  it('never throws on null/undefined/empty persisted state (cannot drop a rehydrate)', () => {
    expect(() => migrateGameStorePersisted(undefined, 0)).not.toThrow();
    expect(() => migrateGameStorePersisted(null, 0)).not.toThrow();
    expect(migrateGameStorePersisted({}, 0)).toEqual({});
    expect(migrateGameStorePersisted(undefined, 0)).toBeUndefined();
  });

  it('does not mutate the input object (returns a new object on change)', () => {
    const before = { cardTheme: 'v1', chips: 10 };
    const after = migrateGameStorePersisted(before, 0);
    expect(before.cardTheme).toBe('v1'); // input untouched
    expect(after).not.toBe(before);
  });
});
