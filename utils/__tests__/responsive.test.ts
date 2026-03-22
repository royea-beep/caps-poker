import { rv, rh, rf, rs, rb, ri, getCardDimensions, getBoardLayout, UI, DEVICE } from '../responsive';

const ALL_WIDTHS  = [320, 360, 375, 380, 384, 390, 393, 402, 412, 414, 428, 430, 432, 440, 480];
const ALL_HEIGHTS = [568, 667, 736, 812, 824, 844, 852, 874, 896, 926, 932, 956];
const PLAYER_COUNTS = [2, 3, 4] as const;

describe('Responsive System — getCardDimensions', () => {
  ALL_WIDTHS.forEach(w => {
    PLAYER_COUNTS.forEach(p => {
      const boards = p === 2 ? 4 : p === 3 ? 3 : 2;
      it(`cards readable at ${w}pt × ${p} players (${boards} boards)`, () => {
        const dims = getCardDimensions(w, p, boards);
        expect(dims.board.width).toBeGreaterThanOrEqual(24);
        expect(dims.board.height).toBeGreaterThanOrEqual(30);
        expect(dims.board.rankSize).toBeGreaterThanOrEqual(9);
        expect(dims.hand.width).toBeGreaterThanOrEqual(30);
        expect(dims.hand.height).toBeGreaterThanOrEqual(40);
        expect(dims.hand.rankSize).toBeGreaterThanOrEqual(10);
      });
    });
  });
});

describe('Responsive System — getBoardLayout', () => {
  ALL_WIDTHS.forEach(w => {
    ALL_HEIGHTS.forEach(h => {
      [2, 3, 4].forEach(boards => {
        it(`board layout valid at ${w}×${h} ${boards} boards`, () => {
          const layout = getBoardLayout(w, h, boards);
          expect(layout.boardHeight).toBeGreaterThan(0);
          expect(layout.boardPaddingV).toBeGreaterThanOrEqual(0);
          expect(layout.boardHeaderHeight).toBeGreaterThan(0);
          expect(typeof layout.compact).toBe('boolean');
        });
      });
    });
  });
});

describe('Responsive System — rb (button heights)', () => {
  it('always >= 44pt (Apple HIG)', () => {
    ALL_WIDTHS.forEach(w => {
      expect(rb(60, w)).toBeGreaterThanOrEqual(44);
      expect(rb(36, w)).toBeGreaterThanOrEqual(44);
      expect(rb(44, w)).toBeGreaterThanOrEqual(44);
    });
  });
});

describe('Responsive System — rf (font sizes)', () => {
  it('never below minimum', () => {
    ALL_WIDTHS.forEach(w => {
      expect(rf(16, 13, undefined, w)).toBeGreaterThanOrEqual(13);
      expect(rf(11,  9, undefined, w)).toBeGreaterThanOrEqual(9);
      expect(rf(44, 32, undefined, w)).toBeGreaterThanOrEqual(32);
    });
  });

  it('never above maximum', () => {
    ALL_WIDTHS.forEach(w => {
      expect(rf(16, undefined, 18, w)).toBeLessThanOrEqual(18);
      expect(rf(44, undefined, 52, w)).toBeLessThanOrEqual(52);
    });
  });
});

describe('Responsive System — ri (icon sizes)', () => {
  it('always >= 24pt for tap targets', () => {
    ALL_WIDTHS.forEach(w => {
      expect(ri(24, w)).toBeGreaterThanOrEqual(24);
      expect(ri(16, w)).toBeGreaterThanOrEqual(24); // small icon still 24pt
    });
  });
});

describe('Responsive System — rv/rs', () => {
  it('scales proportionally to screen width', () => {
    expect(rv(100, 393)).toBe(100);    // base
    expect(rv(100, 480)).toBeGreaterThan(100); // larger screen
    expect(rv(100, 320)).toBeLessThan(100);    // smaller screen
  });

  it('rs mirrors rv', () => {
    ALL_WIDTHS.forEach(w => {
      expect(rs(16, w)).toBe(rv(16, w));
    });
  });
});

describe('Responsive System — rh', () => {
  it('scales proportionally to screen height', () => {
    expect(rh(100, 852)).toBe(100);         // base
    expect(rh(100, 956)).toBeGreaterThan(100);
    expect(rh(100, 667)).toBeLessThan(100);
  });
});

describe('Responsive System — DEVICE', () => {
  it('DEVICE object has required shape', () => {
    expect(typeof DEVICE.width).toBe('number');
    expect(typeof DEVICE.height).toBe('number');
    expect(typeof DEVICE.isSmall).toBe('boolean');
    expect(typeof DEVICE.isTiny).toBe('boolean');
    expect(typeof DEVICE.isShort).toBe('boolean');
    expect(typeof DEVICE.isTall).toBe('boolean');
    expect(['tiny','xsmall','small','medium','large','xlarge']).toContain(DEVICE.category);
    expect(['vshort','short','medium','tall','vtall']).toContain(DEVICE.heightCategory);
  });
});

describe('Responsive System — UI tokens', () => {
  it('UI.button.primaryHeight >= 44', () => {
    expect(UI.button.primaryHeight).toBeGreaterThanOrEqual(44);
  });

  it('UI.button.secondaryHeight >= 44', () => {
    expect(UI.button.secondaryHeight).toBeGreaterThanOrEqual(44);
  });

  it('UI text sizes are positive numbers', () => {
    expect(UI.text.hero).toBeGreaterThan(0);
    expect(UI.text.h1).toBeGreaterThan(0);
    expect(UI.text.body).toBeGreaterThan(0);
    expect(UI.text.tiny).toBeGreaterThan(0);
  });

  it('UI spacing values are non-negative', () => {
    expect(UI.spacing.xs).toBeGreaterThanOrEqual(0);
    expect(UI.spacing.sm).toBeGreaterThanOrEqual(0);
    expect(UI.spacing.cardGap).toBeGreaterThanOrEqual(0);
  });
});

describe('Responsive System — device matrix output', () => {
  it('prints readable summary', () => {
    const lines: string[] = [];
    [320, 375, 393, 430, 440].forEach(w => {
      [3].forEach(p => {
        const boards = p === 2 ? 4 : p === 3 ? 3 : 2;
        const dims = getCardDimensions(w, p, boards);
        lines.push(
          `${w}pt ${p}p: board ${dims.board.width}×${dims.board.height} rank=${dims.board.rankSize} | ` +
          `hand ${dims.hand.width}×${dims.hand.height} rank=${dims.hand.rankSize} | ` +
          `btn=${rb(60,w)} title=${rf(24,18,28,w)}`
        );
      });
    });
    // eslint-disable-next-line no-console
    lines.forEach(l => console.log(l));
    expect(lines.length).toBeGreaterThan(0);
  });
});
