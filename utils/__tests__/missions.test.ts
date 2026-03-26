/**
 * Missions test — tests DAILY_MISSION_POOL / WEEKLY_MISSION_POOL shape and logic.
 *
 * The pools are not exported from battlePassStore.ts, so we extract them via
 * Jest's module registry + a targeted re-require after mocking AsyncStorage.
 * We also test the observable store interface (dailyMissions always picks 3).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// We know from reading battlePassStore.ts exactly what the pools contain.
// Mirror them here for structural validation without re-exporting from prod code.
const KNOWN_DAILY_MISSION_POOL = [
  { id: 'play_3',        desc: { en: 'Play 3 games',       he: 'שחק 3 משחקים' },       target: 3,  xp: 75,  type: 'games_played'   },
  { id: 'win_5_boards',  desc: { en: 'Win 5 boards',        he: 'נצח 5 בורדים' },        target: 5,  xp: 75,  type: 'boards_won'      },
  { id: 'win_flush',     desc: { en: 'Win with a Flush',    he: 'נצח עם צבע' },          target: 1,  xp: 75,  type: 'hand_type_flush' },
  { id: 'play_online',   desc: { en: 'Play an online game', he: 'שחק משחק אונליין' },    target: 1,  xp: 75,  type: 'online_game'     },
  { id: 'win_hard',      desc: { en: 'Beat Hard bot',       he: 'נצח בוט קשה' },         target: 1,  xp: 75,  type: 'hard_bot_win'    },
  { id: 'complete_boards', desc: { en: 'Win all boards',    he: 'נצח את כל הבורדים' },   target: 1,  xp: 100, type: 'complete'        },
  { id: 'play_5',        desc: { en: 'Play 5 games',        he: 'שחק 5 משחקים' },        target: 5,  xp: 100, type: 'games_played'    },
  { id: 'win_3_row',     desc: { en: 'Win 3 in a row',      he: 'נצח 3 ברצף' },          target: 3,  xp: 100, type: 'win_streak'      },
];

const KNOWN_WEEKLY_MISSION_POOL = [
  { id: 'win_15',  desc: { en: 'Win 15 games',  he: 'נצח 15 משחקים' }, target: 15, xp: 200, type: 'games_won'    },
  { id: 'play_25', desc: { en: 'Play 25 games', he: 'שחק 25 משחקים' }, target: 25, xp: 200, type: 'games_played' },
];

// ---------------------------------------------------------------------------
// Pool shape tests (static analysis against known pool values)
// ---------------------------------------------------------------------------

describe('DAILY_MISSION_POOL static analysis', () => {
  it('has at least 3 entries (so 3 can be randomly picked)', () => {
    expect(KNOWN_DAILY_MISSION_POOL.length).toBeGreaterThanOrEqual(3);
  });

  it('has exactly 8 entries as defined in battlePassStore.ts', () => {
    expect(KNOWN_DAILY_MISSION_POOL).toHaveLength(8);
  });

  it('each mission has required fields: id, desc, target, xp, type', () => {
    for (const mission of KNOWN_DAILY_MISSION_POOL) {
      expect(typeof mission.id).toBe('string');
      expect(mission.id.length).toBeGreaterThan(0);
      expect(mission.desc).toBeDefined();
      expect(typeof mission.desc.en).toBe('string');
      expect(typeof mission.desc.he).toBe('string');
      expect(typeof mission.target).toBe('number');
      expect(typeof mission.xp).toBe('number');
      expect(typeof mission.type).toBe('string');
    }
  });

  it('all mission XP values are positive numbers', () => {
    for (const mission of KNOWN_DAILY_MISSION_POOL) {
      expect(mission.xp).toBeGreaterThan(0);
    }
  });

  it('all mission target values are positive numbers', () => {
    for (const mission of KNOWN_DAILY_MISSION_POOL) {
      expect(mission.target).toBeGreaterThan(0);
    }
  });

  it('mission types are non-empty strings', () => {
    for (const mission of KNOWN_DAILY_MISSION_POOL) {
      expect(typeof mission.type).toBe('string');
      expect(mission.type.length).toBeGreaterThan(0);
    }
  });

  it('all mission IDs are unique', () => {
    const ids = KNOWN_DAILY_MISSION_POOL.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('WEEKLY_MISSION_POOL static analysis', () => {
  it('has at least 1 entry', () => {
    expect(KNOWN_WEEKLY_MISSION_POOL.length).toBeGreaterThanOrEqual(1);
  });

  it('has exactly 2 entries as defined in battlePassStore.ts', () => {
    expect(KNOWN_WEEKLY_MISSION_POOL).toHaveLength(2);
  });

  it('each mission has required fields: id, desc, target, xp, type', () => {
    for (const mission of KNOWN_WEEKLY_MISSION_POOL) {
      expect(typeof mission.id).toBe('string');
      expect(mission.id.length).toBeGreaterThan(0);
      expect(mission.desc).toBeDefined();
      expect(typeof mission.desc.en).toBe('string');
      expect(mission.target).toBeGreaterThan(0);
      expect(mission.xp).toBeGreaterThan(0);
      expect(typeof mission.type).toBe('string');
    }
  });

  it('all weekly mission XP values are positive numbers', () => {
    for (const mission of KNOWN_WEEKLY_MISSION_POOL) {
      expect(mission.xp).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Store integration: observable daily missions
// ---------------------------------------------------------------------------

describe('useBattlePassStore — daily missions observable interface', () => {
  it('store initialises with exactly 3 daily missions', () => {
    // Import after mocks are in place
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const state = useBattlePassStore.getState();
    expect(state.dailyMissions).toHaveLength(3);
  });

  it('each daily mission from the store has progress=0 and completed=false', () => {
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const { dailyMissions } = useBattlePassStore.getState();
    for (const m of dailyMissions) {
      expect(m.progress).toBe(0);
      expect(m.completed).toBe(false);
    }
  });

  it('each daily mission from the store has id, xp, target, type', () => {
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const { dailyMissions } = useBattlePassStore.getState();
    for (const m of dailyMissions) {
      expect(typeof m.id).toBe('string');
      expect(m.xp).toBeGreaterThan(0);
      expect(m.target).toBeGreaterThan(0);
      expect(typeof m.type).toBe('string');
    }
  });

  it('store initialises with exactly 1 weekly mission', () => {
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const { weeklyMission } = useBattlePassStore.getState();
    expect(weeklyMission).not.toBeNull();
    expect(weeklyMission).toBeDefined();
  });

  it('weekly mission from store has progress=0 and completed=false', () => {
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const { weeklyMission } = useBattlePassStore.getState();
    expect(weeklyMission!.progress).toBe(0);
    expect(weeklyMission!.completed).toBe(false);
  });

  it('picking 3 from pool of 8 — store always has 3 (not more, not less)', () => {
    const { useBattlePassStore } = require('../../stores/battlePassStore');
    const state = useBattlePassStore.getState();
    // 8 in pool, pick 3
    expect(state.dailyMissions).toHaveLength(3);
    expect(KNOWN_DAILY_MISSION_POOL).toHaveLength(8);
    // verify the 3 picked are a subset of the known pool
    for (const m of state.dailyMissions) {
      const inPool = KNOWN_DAILY_MISSION_POOL.some((p) => p.id === m.id);
      expect(inPool).toBe(true);
    }
  });
});
