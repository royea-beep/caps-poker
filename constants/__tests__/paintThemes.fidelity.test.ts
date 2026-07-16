/**
 * S75 paint-layer fidelity — proves ZERO visual change.
 *
 * The paint refactor moved 240 colour/font values out of their source files and into
 * constants/paintThemes.ts, then re-sourced the original exports from it. This suite
 * pins the re-sourced exports to the EXACT pre-refactor literals (captured from git
 * HEAD 34a0f26, the commit this branch forked from). If any value drifts — or if a
 * later theme batch accidentally repoints `current` — these fail loudly.
 *
 * It also guards the Iron Constraint: geometry must NEVER enter the paint layer.
 */
import { currentPaint, PAINT_THEMES, getPaint, DEFAULT_PAINT_THEME, activePaint } from '../paintThemes';
import { colors, spacing, fontWeight } from '../theme';
import { OBSIDIAN, OBSIDIAN_GEOM } from '../obsidianTheme';
import { HOME_THEMES } from '../homeThemes';
import { CARD_THEMES } from '../cardThemes';
import { VISUAL_THEMES, getTheme } from '../visualThemes';

// ── Key counts: the audited shape of the live paint surface ──────────────────
describe('paint layer — domain key counts (audited)', () => {
  it('colors = 56', () => expect(Object.keys(currentPaint.colors)).toHaveLength(56));
  it('obsidian = 25 (S76 added cardGlow)', () => expect(Object.keys(currentPaint.obsidian)).toHaveLength(25));
  it('home = 10 themes x 10 keys = 100', () => {
    const themes = Object.keys(currentPaint.home);
    expect(themes).toHaveLength(10);
    themes.forEach((t) => {
      expect(Object.keys((currentPaint.home as Record<string, object>)[t])).toHaveLength(10);
    });
  });
  it('card = 3 themes x 9 keys = 27', () => {
    const themes = Object.keys(currentPaint.card);
    expect(themes).toHaveLength(3);
    themes.forEach((t) => {
      expect(Object.keys((currentPaint.card as Record<string, object>)[t])).toHaveLength(9);
    });
  });
  it('visual = 2 themes x 16 keys = 32', () => {
    const themes = Object.keys(currentPaint.visual);
    expect(themes).toHaveLength(2);
    themes.forEach((t) => {
      expect(Object.keys((currentPaint.visual as Record<string, object>)[t])).toHaveLength(16);
    });
  });
  it('fonts = 1', () => expect(Object.keys(currentPaint.fonts)).toHaveLength(1));
});

// ── Iron Constraint: zero geometry in the paint layer ────────────────────────
describe('paint layer — Iron Constraint (paint only, no geometry)', () => {
  // EXACT key names only — deliberately NOT a substring match. Keys like `bgTop`,
  // `bgBottom`, `backTop`, `cardFaceBottom` are gradient-STOP COLOURS (paint), and a
  // substring test on 'top'/'bottom' would flag them as geometry, which is wrong.
  // The real teeth is the value-type assertion below: geometry carries numbers, and
  // every value in the paint layer must be a string.
  const GEOMETRY_KEYS = [
    'width', 'height', 'margin', 'padding', 'top', 'left', 'right', 'bottom',
    'flex', 'position', 'gap', 'radius', 'borderwidth', 'translatey', 'spacing',
    'fontweight', 'size', 'offset', 'elevation',
  ];

  const collectKeys = (o: unknown, acc: string[] = []): string[] => {
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        acc.push(k);
        collectKeys(v, acc);
      }
    }
    return acc;
  };

  it('contains no geometry key at any depth', () => {
    const offenders = collectKeys(currentPaint).filter((k) =>
      GEOMETRY_KEYS.includes(k.toLowerCase()),
    );
    expect(offenders).toEqual([]);
  });

  it('every paint value is a string (or undefined for the native font family)', () => {
    const walk = (o: unknown): void => {
      if (o && typeof o === 'object') {
        Object.values(o as Record<string, unknown>).forEach(walk);
      } else {
        expect(['string', 'undefined']).toContain(typeof o);
      }
    };
    walk(currentPaint);
  });
});

// ── Fidelity: re-sourced exports === pre-refactor literals ───────────────────
describe('theme.ts colors — mirrors pre-refactor values exactly', () => {
  it('resolves from the paint layer', () => {
    expect(colors).toBe(currentPaint.colors);
  });

  it('pins every colour to its HEAD 34a0f26 literal', () => {
    expect(colors).toEqual({
      background: '#0a0a0a',
      surface: '#161922',
      surfaceRaised: '#1c1f26',
      border: 'rgba(255,255,255,0.10)',
      overlay: 'rgba(0,0,0,0.88)',
      gold: '#c9a84c',
      goldLight: '#e8c96a',
      goldDim: 'rgba(79,214,168,0.65)',
      goldGlow: 'rgba(79,214,168,0.40)',
      goldBright: '#e8c96a',
      mint: '#4FD6A8',
      mintLight: '#7FE3C2',
      mintBright: '#A7EED6',
      mintDim: 'rgba(79,214,168,0.55)',
      mintGlow: 'rgba(79,214,168,0.55)',
      mintHairline: 'rgba(79,214,168,0.30)',
      mintGhost: 'rgba(79,214,168,0.10)',
      neonBlue: '#4FD6A8',
      neonPurple: '#3da583',
      neonGreen: '#2ecc71',
      neonRed: '#c0392b',
      text: '#f0ead6',
      textMuted: '#9aa19b',
      textDim: '#5b6168',
      cardRed: '#c0392b',
      cardBlack: '#1a1a2e',
      cardBack: '#2A2F3D',
      cardFace: '#f5f0e8',
      cardWhite: '#f5f0e8',
      cardBackPattern: 'rgba(79,214,168,0.45)',
      success: '#2ecc71',
      error: '#c0392b',
      danger: '#c0392b',
      boardBg: '#161922',
      boardBorder: 'rgba(79,214,168,0.45)',
      boardActive: '#4FD6A8',
      boardFull: '#2ecc71',
      felt: '#161922',
      feltLight: '#1c1f26',
      feltBorder: 'rgba(79,214,168,0.30)',
      tableEdge: '#0a0a0a',
      chip1: '#f5f0e8',
      chip5: '#c0392b',
      chip25: '#2ecc71',
      chip100: '#1a1a2e',
      chip500: '#8B008B',
      red: '#c0392b',
      black: '#1a1a2e',
      white: '#f0ead6',
      textPrimary: '#f0ead6',
      textSecondary: '#9aa19b',
      chipGreen: '#2ecc71',
      chipRed: '#c0392b',
      buttonPrimary: '#4FD6A8',
      buttonSecondary: '#161922',
      buttonDanger: '#8b1a1a',
    });
  });
});

describe('obsidianTheme OBSIDIAN — mirrors pre-refactor values exactly', () => {
  it('resolves from the paint layer', () => {
    expect(OBSIDIAN).toBe(currentPaint.obsidian);
  });

  it('pins every colour to its HEAD 34a0f26 literal', () => {
    expect(OBSIDIAN).toEqual({
      mint: '#4FD6A8',
      mintSoft: 'rgba(79,214,168,0.30)',
      mintHairline: 'rgba(79,214,168,0.45)',
      mintGhost: 'rgba(79,214,168,0.10)',
      bgTop: '#1C1F26',
      bgBottom: '#101218',
      bgFallback: '#161922',
      cardFaceTop: '#FFFFFF',
      cardFaceBottom: '#F7F4EC',
      cardFaceFallback: '#FCFAF3',
      cardInk: '#1B1B24',
      cardRed: '#CC1733',
      backTop: '#363D4E',
      backBottom: '#1F2330',
      backBorder: 'rgba(79,214,168,0.65)',
      backEmblemOutline: 'rgba(79,214,168,0.85)',
      backEmblemCore: 'rgba(79,214,168,0.85)',
      slotFill: 'rgba(79,214,168,0.03)',
      slotDash: 'rgba(79,214,168,0.30)',
      slotDashActive: '#4FD6A8',
      autoBg: 'rgba(79,214,168,0.10)',
      autoBorder: 'rgba(79,214,168,0.35)',
      autoText: '#4FD6A8',
      autoBolt: '#4FD6A8',
      // S76 — split out of `mint`; `current` keeps the OLD value so unmigrated
      // surfaces stay byte-identical.
      cardGlow: '#4FD6A8',
    });
  });
});

describe('homeThemes HOME_THEMES — paint resolves, values pinned', () => {
  it('resolves from the paint layer', () => {
    expect(HOME_THEMES).toBe(currentPaint.home);
  });
  it('keeps the default dark_gold palette byte-identical', () => {
    expect(HOME_THEMES.dark_gold).toEqual({
      bg: '#0a0a0a',
      accent: '#c9a84c',
      accentSecondary: '#8B6914',
      buttonPrimary: '#c9a84c',
      buttonPrimaryText: '#000000',
      buttonSecondaryBg: 'rgba(201,168,76,0.08)',
      buttonSecondaryBorder: '#c9a84c',
      buttonSecondaryText: '#c9a84c',
      titleColor: '#c9a84c',
      subtitleColor: 'rgba(201,168,76,0.6)',
    });
  });
  it('still exposes all 10 themes', () => {
    expect(Object.keys(HOME_THEMES).sort()).toEqual([
      'arctic', 'casino_red', 'dark_gold', 'emerald', 'matrix',
      'navy_silver', 'ocean', 'purple_neon', 'rose_gold', 'sunset',
    ]);
  });
});

describe('cardThemes CARD_THEMES — paint from layer, GEOMETRY untouched', () => {
  it('v1 paint matches the pre-refactor literals', () => {
    expect(CARD_THEMES.v1).toMatchObject({
      faceBg: '#f5f0e8',
      faceBorderColor: 'rgba(0,0,0,0.10)',
      redSuit: '#c0392b',
      blackSuit: '#1a1a2e',
      backBg: '#0a0a1e',
      backBorderColor: '#c9a84c',
      backDiamond: '#c9a84c',
      selectedBorderColor: '#c9a84c',
      selectedGlowColor: '#c9a84c',
    });
  });

  it('GEOMETRY is preserved exactly (not themed)', () => {
    expect(CARD_THEMES.v1).toMatchObject({ faceRadius: 8, faceBorderWidth: 1, backBorderWidth: 2, selectedTranslateY: -8 });
    expect(CARD_THEMES.v2).toMatchObject({ faceRadius: 12, faceBorderWidth: 2, backBorderWidth: 2.5, selectedTranslateY: -6 });
    expect(CARD_THEMES.v3).toMatchObject({ faceRadius: 16, faceBorderWidth: 0, backBorderWidth: 2, selectedTranslateY: -4 });
  });

  it('metadata is preserved', () => {
    expect(CARD_THEMES.v1).toMatchObject({ id: 'v1', name: 'Classic Poker', label: 'V1: Classic' });
    expect(CARD_THEMES.v2).toMatchObject({ id: 'v2', name: 'Vegas Dark', label: 'V2: Vegas' });
    expect(CARD_THEMES.v3).toMatchObject({ id: 'v3', name: 'Clean Modern', label: 'V3: Modern' });
  });
});

describe('visualThemes VISUAL_THEMES — paint from layer, GEOMETRY untouched', () => {
  it('classic paint matches the pre-refactor literals', () => {
    expect(VISUAL_THEMES.classic).toMatchObject({
      background: '#0a0a0a',
      surface: '#161922',
      boardBg: '#161922',
      boardBorder: 'rgba(79,214,168,0.45)',
      textPrimary: '#f0ead6',
      textSecondary: '#4FD6A8',
      textMuted: '#9aa19b',
      accent: '#4FD6A8',
      accentText: '#0a0a0a',
      cardFace: '#FCFAF3',
      cardBorder: 'rgba(0,0,0,0.15)',
      cardShadow: 'rgba(79,214,168,0.30)',
      primaryBtn: '#4FD6A8',
      primaryBtnText: '#0a0a0a',
      winColor: '#22c55e',
      loseColor: '#ef4444',
    });
  });

  it('fiveo paint matches the pre-refactor literals', () => {
    expect(VISUAL_THEMES.fiveo).toMatchObject({
      background: '#0a0a0a',
      surface: '#1A1A2E',
      boardBg: '#161922',
      cardFace: '#FAFAFA',
      cardShadow: 'rgba(0,0,0,0.6)',
      primaryBtnText: '#1A1A2E',
      winColor: '#28A745',
      loseColor: '#CC0000',
    });
  });

  it('primaryBtnRadius (GEOMETRY) is preserved exactly', () => {
    expect(VISUAL_THEMES.classic.primaryBtnRadius).toBe(12);
    expect(VISUAL_THEMES.fiveo.primaryBtnRadius).toBe(8);
  });

  // ── S76 — streetStencil (N8) registered, DORMANT ──────────────────────────
  it('streetStencil resolves the N8 token map', () => {
    expect(VISUAL_THEMES.streetStencil).toMatchObject({
      background: '#4e4e54',      // flat concrete (55% mid-stop; gradient is 1b)
      surface: '#42424a',
      boardBg: '#42424a',
      boardBorder: '#F8F050',
      textPrimary: '#ECECEC',
      textSecondary: '#c8c8cc',
      textMuted: '#c8c8cc',
      accent: '#F8F050',
      accentText: '#18181c',
      cardFace: '#ECECEC',
      cardBorder: '#18181c',
      cardShadow: 'rgba(58,214,255,0.5)',
      primaryBtn: '#18181c',
      primaryBtnText: '#F8F050',
    });
  });

  it('streetStencil primaryBtnRadius is 12 — IDENTICAL to classic (no per-theme shape)', () => {
    expect(VISUAL_THEMES.streetStencil.primaryBtnRadius).toBe(12);
    expect(VISUAL_THEMES.streetStencil.primaryBtnRadius).toBe(VISUAL_THEMES.classic.primaryBtnRadius);
  });

  it('streetStencil win/lose stay GENERIC green/red (readability-critical, deliberately unthemed)', () => {
    expect(VISUAL_THEMES.streetStencil.winColor).toBe('#22c55e');
    expect(VISUAL_THEMES.streetStencil.loseColor).toBe('#ef4444');
  });

  it('adding streetStencil left classic + fiveo byte-identical', () => {
    expect(VISUAL_THEMES.classic).toEqual({ ...currentPaint.visual.classic, primaryBtnRadius: 12 });
    expect(VISUAL_THEMES.fiveo).toEqual({ ...currentPaint.visual.fiveo, primaryBtnRadius: 8 });
  });

  it('getTheme still defaults to classic (streetStencil is DORMANT)', () => {
    expect(getTheme(null)).toBe(VISUAL_THEMES.classic);
    expect(getTheme('streetStencil')).toBe(VISUAL_THEMES.streetStencil);
  });
});

// ── Geometry exports must remain static, never themed ────────────────────────
describe('geometry exports stay static (never routed through paint)', () => {
  it('spacing is unchanged', () => {
    expect(spacing).toEqual({ hairline: 1, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 });
  });
  it('fontWeight is unchanged', () => {
    expect(fontWeight).toEqual({
      regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900',
    });
  });
  it('OBSIDIAN_GEOM (incl. cardRadius) is unchanged and NOT in the paint layer', () => {
    expect(OBSIDIAN_GEOM.boardRadius).toBe(14);
    expect(OBSIDIAN_GEOM.cardRadius).toBe(8);
    expect(OBSIDIAN_GEOM.cardBackRadius).toBe(6);
    expect(OBSIDIAN_GEOM.slotRadius).toBe(6);
    expect(OBSIDIAN_GEOM.tabRadius).toBe(6);
    expect(currentPaint).not.toHaveProperty('cardRadius');
  });
});

// ── Resolver: only `current` exists in S75 ───────────────────────────────────
describe('paint resolver', () => {
  it('default id is streetStencil (S76 — the new default look)', () => expect(DEFAULT_PAINT_THEME).toBe('streetStencil'));
  it('ships current + streetStencil (S76)', () => expect(Object.keys(PAINT_THEMES)).toEqual(['current', 'streetStencil']));
  it('null/undefined resolve to the DEFAULT theme (now streetStencil)', () => {
    expect(getPaint(null)).toBe(PAINT_THEMES.streetStencil);
    expect(getPaint(undefined)).toBe(PAINT_THEMES.streetStencil);
  });

  it('activePaint still points at currentPaint so UNMIGRATED surfaces stay Obsidian', () => {
    expect(activePaint).toBe(currentPaint);
    expect(colors).toBe(currentPaint.colors);
    expect(OBSIDIAN).toBe(currentPaint.obsidian);
  });
});
