import { PRO_QUOTES, getRandomQuote } from '../../constants/proQuotes';
import { CARD_SCALE, BOARD_COLORS } from '../../constants/gameConfig';

describe('proQuotes', () => {
  it('getRandomQuote returns a quote with matching context', () => {
    const q = getRandomQuote('home');
    expect(q.context).toBe('home');
    expect(q.quote.length).toBeGreaterThan(0);
    expect(q.player.length).toBeGreaterThan(0);
    expect(q.emoji.length).toBeGreaterThan(0);
  });

  it('getRandomQuote works for all contexts', () => {
    const contexts = ['home', 'complete', 'summary', 'waiting', 'tutorial'] as const;
    for (const ctx of contexts) {
      const q = getRandomQuote(ctx);
      expect(q.context).toBe(ctx);
    }
  });

  it('every quote has id, player, emoji, quote, context', () => {
    for (const q of PRO_QUOTES) {
      expect(q.id).toBeTruthy();
      expect(q.player).toBeTruthy();
      expect(q.emoji).toBeTruthy();
      expect(q.quote).toBeTruthy();
      expect(q.context).toBeTruthy();
    }
  });

  it('no duplicate quote ids', () => {
    const ids = PRO_QUOTES.map(q => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('CARD_SCALE', () => {
  it('has config for player counts 2, 3, 4', () => {
    expect(CARD_SCALE[2]).toBeDefined();
    expect(CARD_SCALE[3]).toBeDefined();
    expect(CARD_SCALE[4]).toBeDefined();
  });

  it('communityScale is > 1 for all configs', () => {
    for (const key of [2, 3, 4]) {
      expect(CARD_SCALE[key].communityScale).toBeGreaterThan(1);
    }
  });

  it('cardHeight increases with player count (more players = more space)', () => {
    expect(CARD_SCALE[4].cardHeight).toBeGreaterThan(CARD_SCALE[2].cardHeight);
  });
});

describe('BOARD_COLORS', () => {
  it('has 4 colors', () => {
    expect(BOARD_COLORS.length).toBe(4);
  });

  it('all colors are valid hex', () => {
    for (const color of BOARD_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('all colors are distinct', () => {
    const unique = new Set(BOARD_COLORS);
    expect(unique.size).toBe(4);
  });
});
