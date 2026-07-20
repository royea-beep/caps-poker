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
import { readFileSync } from 'fs';
import { join } from 'path';
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
  it('visual = 2 themes x 41 keys = 82 (S76-BOARD 19 + LITERALS/PANEL 6 = 25 board* pins)', () => {
    const themes = Object.keys(currentPaint.visual);
    expect(themes).toHaveLength(2);
    themes.forEach((t) => {
      expect(Object.keys((currentPaint.visual as Record<string, object>)[t])).toHaveLength(41);
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

// ── S76-BOARD, PIN STAGE ─────────────────────────────────────────────────────
// Board.tsx's colour vocabulary, pinned classic === fiveo === today's value.
// NOTHING reads these yet — Board is routed in a later batch. These assertions are
// what make that batch provable: each flip swaps a token for a key of equal value.
//
// Expected values are written as LITERALS on purpose. Asserting `board* === COLORS.x`
// would pass no matter what either side drifted to, and prove nothing.
describe('S76-BOARD pins — classic === fiveo === Board.tsx TODAY', () => {
  const PINS: Record<string, string> = {
    // from COLORS (constants/theme.ts)
    boardGold: '#c9a84c',
    boardGoldLight: '#e8c96a',
    boardGoldBright: '#e8c96a',
    boardTextPrimary: '#f0ead6',
    boardTextSecondary: '#9aa19b',
    boardTextMuted: '#9aa19b',
    boardTextDim: '#5b6168',
    boardNeonGreen: '#2ecc71',
    boardNeonRed: '#c0392b',
    // from OBSIDIAN (constants/obsidianTheme.ts)
    boardMintHairline: 'rgba(79,214,168,0.45)',
    boardMintGhost: 'rgba(79,214,168,0.10)',
    boardSlotFill: 'rgba(79,214,168,0.03)',
    boardSlotDash: 'rgba(79,214,168,0.30)',
    boardSlotDashActive: '#4FD6A8',
    boardCardInk: '#1B1B24',
    boardAutoBg: 'rgba(79,214,168,0.10)',
    boardAutoBorder: 'rgba(79,214,168,0.35)',
    boardAutoText: '#4FD6A8',
    boardAutoBolt: '#4FD6A8',
    // S76-BOARD-LITERALS/PANEL — panel backdrop + the 3 live raw literals.
    boardPanelTop: '#1C1F26',
    boardPanelBottom: '#101218',
    boardPanelFallback: '#161922',
    boardHintIcon: 'rgba(201,168,76,0.7)',
    boardTieBg: 'rgba(79,214,168,0.92)',
    boardChipFloat: '#FFD700',
  };

  it('pins exactly 25 board* keys', () => {
    expect(Object.keys(PINS)).toHaveLength(25);
    const onTheme = Object.keys(currentPaint.visual.classic).filter((k) => k.startsWith('board') && k !== 'boardBg' && k !== 'boardBorder');
    expect(onTheme.sort()).toEqual(Object.keys(PINS).sort());
  });

  Object.entries(PINS).forEach(([key, value]) => {
    it(`${key} — classic === fiveo === ${value}`, () => {
      expect((currentPaint.visual.classic as Record<string, string>)[key]).toBe(value);
      expect((currentPaint.visual.fiveo as Record<string, string>)[key]).toBe(value);
      // and it reaches the delivery layer unchanged
      expect((VISUAL_THEMES.classic as unknown as Record<string, string>)[key]).toBe(value);
      expect((VISUAL_THEMES.fiveo as unknown as Record<string, string>)[key]).toBe(value);
    });
  });

  it('every board* pin is a COLOUR, never geometry', () => {
    Object.keys(PINS).forEach((k) => {
      expect(typeof (currentPaint.visual.classic as Record<string, unknown>)[k]).toBe('string');
      expect((currentPaint.visual.classic as Record<string, string>)[k]).toMatch(/^(#|rgba?\()/);
    });
  });

  // The traps that Ruling 1 (new-key-by-default) exists to dodge. If a later batch
  // "simplifies" a board* pin into the same-named existing key, these fail loudly.
  it('board* pins are DISTINCT from the same-named theme keys (the collision traps)', () => {
    expect(VISUAL_THEMES.classic.boardTextSecondary).not.toBe(VISUAL_THEMES.classic.textSecondary);
    expect(VISUAL_THEMES.fiveo.boardTextSecondary).not.toBe(VISUAL_THEMES.fiveo.textSecondary);
    expect(VISUAL_THEMES.fiveo.boardTextPrimary).not.toBe(VISUAL_THEMES.fiveo.textPrimary);
    expect(VISUAL_THEMES.fiveo.boardTextMuted).not.toBe(VISUAL_THEMES.fiveo.textMuted);
    expect(VISUAL_THEMES.classic.boardNeonGreen).not.toBe(VISUAL_THEMES.classic.winColor);
    expect(VISUAL_THEMES.classic.boardNeonRed).not.toBe(VISUAL_THEMES.classic.loseColor);
  });

  // S76-BOARD FILL11 — every board* key now holds a REAL N8 value. The 11 marked
  // (FILL11) replaced inherited-Obsidian TODOs; all values are Roye-approved.
  // Written as literals so a drift in either layer fails here.
  const STREET: Record<string, string> = {
    boardGold: '#F8C020',                        // FILL11 — Variant A warm gold, deliberately
    boardGoldLight: '#FFD84D',                   // FILL11   NOT the spray yellow: a win badge
    boardGoldBright: '#FFE87A',                  // FILL11   must not merge into the yellow UI
    boardTextPrimary: '#ECECEC',
    boardTextSecondary: '#c8c8cc',
    boardTextMuted: '#c8c8cc',
    boardTextDim: '#8a8a90',                     // FILL11 — concrete-grey
    boardNeonGreen: '#2ecc71',                   // generic green — readability, deliberately unthemed
    boardNeonRed: '#c0392b',                     // generic red — ditto
    boardMintHairline: 'rgba(248,240,80,0.45)',
    boardMintGhost: 'rgba(248,240,80,0.10)',
    boardSlotFill: 'rgba(248,240,80,0.06)',      // FILL11 — alpha RAISED from 0.03 (see paintThemes)
    boardSlotDash: 'rgba(248,240,80,0.45)',      // FILL11 — alpha RAISED from 0.30
    boardSlotDashActive: '#F8F050',              // FILL11
    boardCardInk: '#18181c',
    boardAutoBg: '#18181c',                      // FILL11 — solid charcoal, not a translucent chip
    boardAutoBorder: '#F8F050',                  // FILL11
    boardAutoText: '#F8F050',                    // FILL11
    boardAutoBolt: '#F8F050',                    // FILL11
    // S76-BOARD-LITERALS/PANEL. Panel = the FELT stops, NOT the screen-bg stops:
    // GameView's N8 bg is #4e4e54, so bg stops would make the board VANISH into it.
    boardPanelTop: '#5a5a60',
    boardPanelBottom: '#42424a',
    boardPanelFallback: '#4e4e54',
    boardHintIcon: 'rgba(248,240,80,0.7)',   // UI chrome -> spray yellow (gold is for PRIZES)
    boardTieBg: 'rgba(200,200,204,0.92)',    // neutral grey — a tie is neither win nor loss
    boardChipFloat: '#F8C020',               // a prize -> Variant-A gold, matching the win badge
  };

  it('streetStencil carries all 25 board* values', () => {
    expect(Object.keys(STREET).sort()).toEqual(Object.keys(PINS).sort());
  });

  Object.entries(STREET).forEach(([key, value]) => {
    it(`streetStencil.${key} === ${value}`, () => {
      expect((VISUAL_THEMES.streetStencil as unknown as Record<string, string>)[key]).toBe(value);
    });
  });

  it('streetStencil gold stays DISTINCT from the spray yellow (Variant A)', () => {
    expect(VISUAL_THEMES.streetStencil.boardGold).not.toBe('#F8F050');
    expect(VISUAL_THEMES.streetStencil.boardGold).not.toBe(VISUAL_THEMES.streetStencil.accent);
  });

  it('no board* key still inherits its Obsidian value (FILL11 left no TODO)', () => {
    // The 11 that used to inherit. If any reverts, it silently paints mint on concrete.
    const FILLED = ['boardGold', 'boardGoldLight', 'boardGoldBright', 'boardTextDim', 'boardSlotFill',
      'boardSlotDash', 'boardSlotDashActive', 'boardAutoBg', 'boardAutoBorder', 'boardAutoText', 'boardAutoBolt'];
    expect(FILLED).toHaveLength(11);
    FILLED.forEach((k) => {
      const street = (VISUAL_THEMES.streetStencil as unknown as Record<string, string>)[k];
      expect(street).not.toBe(PINS[k]);              // no longer today's Obsidian value
      expect(street).not.toMatch(/79,214,168/);      // no mint rgba survived
      expect(street).not.toBe('#4FD6A8');            // no mint hex survived
    });
  });
});

// ── S76-BOARD: proof this batch routed NOTHING ───────────────────────────────
// S76-BOARD-ROUTING — Board now CONSUMES the pinned keys.
//
// The pin stage asserted here that Board read NO board* key ("routes nothing"). That
// guard did its job: it failed the moment routing landed, which is exactly what it was
// for. Routing is now the intent, so the assertion is INVERTED — and replaced with the
// guards that protect THIS batch.
describe('S76-BOARD-ROUTING — Board.tsx consumes the pinned keys, safely', () => {
  const rawSrc = readFileSync(join(__dirname, '..', '..', 'components', 'Board.tsx'), 'utf8');

  // Match CODE, never prose. The first draft of the trap guard below failed on Board's
  // own explanatory comment ("...NOT theme.loseColor or theme.textSecondary...") — the
  // exact `goldDim` failure mode this codebase has already been bitten by: a comment
  // read as a live reference. A guard that greps prose proves nothing; strip it first.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const boardSrc = stripComments(rawSrc);

  it('the comment-stripper actually works (guards the guard)', () => {
    // Board DOES mention the trap keys in prose; it must NOT reference them in code.
    expect(rawSrc).toMatch(/theme\.textSecondary/);   // present as prose
    expect(boardSrc).not.toMatch(/theme\.textSecondary/); // absent from code
  });

  it('Board.tsx now reads board* theme keys (routing landed)', () => {
    const reads = boardSrc.match(/theme\.board[A-Z][A-Za-z]*/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
  });

  it('Board.tsx still has exactly 7 shared values — NOT 8 (geometry frozen)', () => {
    expect(rawSrc.match(/useSharedValue\(/g) ?? []).toHaveLength(7);
  });

  // THE TRAPS. Board must never read the same-named legacy keys: theme.textSecondary is
  // MINT on both themes (COLORS.textSecondary is grey #9aa19b); theme.textMuted is
  // #bbbbbb on fiveo (COLORS.textMuted is #9aa19b); theme.textPrimary is #ffffff on
  // fiveo. Routing to any of them breaks a legacy theme silently — fiveo-only for two
  // of the three, so no eye-test on classic would ever catch it.
  it('Board.tsx reads NO trap key (textSecondary / textMuted / textPrimary)', () => {
    expect(boardSrc).not.toMatch(/theme\.textSecondary\b/);
    expect(boardSrc).not.toMatch(/theme\.textMuted\b/);
    expect(boardSrc).not.toMatch(/theme\.textPrimary\b/);
  });

  // R1 — win/lose is an ACCESSIBILITY axis (useGameColors → colorblind blue/orange),
  // never a theme axis. Routing it to theme.winColor/loseColor would override a
  // colorblind user's palette and BREAK colorblind mode. Inviolable, not a preference.
  it('win/lose stays on useGameColors — colorblind mode intact', () => {
    expect(boardSrc).toMatch(/gameColors\.win\b/);
    expect(boardSrc).toMatch(/gameColors\.lose\b/);
    expect(boardSrc).not.toMatch(/theme\.winColor\b/);
    expect(boardSrc).not.toMatch(/theme\.loseColor\b/);
  });

  // S76-BOARD-LITERALS/PANEL — this guard previously asserted the panel/literals were
  // still UNROUTED (they were that batch's scope, not routing's). It failed the moment
  // this batch landed — by design, same as the pin stage's guard before it. Inverted.
  it('panel + the 3 live literals are now ROUTED', () => {
    // Reads that lived in RENDER code are gone — replaced outright.
    expect(boardSrc).not.toMatch(/OBSIDIAN\.bgTop/);
    expect(boardSrc).not.toMatch(/OBSIDIAN\.bgBottom/);
    expect(boardSrc).not.toMatch(/#FFD700/); // was inline in FloatingChips -> boardChipFloat

    // Every routed read now resolves from the theme.
    expect(boardSrc).toMatch(/theme\.boardPanelTop/);
    expect(boardSrc).toMatch(/theme\.boardPanelBottom/);
    expect(boardSrc).toMatch(/theme\.boardPanelFallback/);
    expect(boardSrc).toMatch(/theme\.boardHintIcon/);
    expect(boardSrc).toMatch(/theme\.boardTieBg/);
    expect(boardSrc).toMatch(/theme\.boardChipFloat/);
  });

  // HOUSE-STYLE, asserted so nobody "tidies" it away: colour is overridden at the JSX
  // site while the StyleSheet KEEPS its geometry AND its colour as a fallback (the
  // file's own precedent at communitySeparator). So hintInfoIcon's and tieBadge's
  // literals SURVIVING in the StyleSheet is correct — they are dead fallbacks, not
  // unrouted reads. Deleting them would risk a site silently losing its paint.
  it('StyleSheet keeps its colour fallbacks (override house-style)', () => {
    expect(boardSrc).toMatch(/rgba\(201,168,76,0\.7\)/);  // hintInfoIcon fallback
    expect(boardSrc).toMatch(/rgba\(79,214,168,0\.92\)/); // tieBadge fallback
  });

  // R4 — DEAD code stays untouched (its own cleanup batch, never a paint batch).
  // #c9a84c survives ONLY in dead styles (communityLabelWrap/Text, 0 consumers) and
  // OBSIDIAN.bgFallback ONLY at the dead container.backgroundColor (overridden inline).
  it('dead styles are left alone, not routed', () => {
    expect(boardSrc).toMatch(/#c9a84c/);
    expect(boardSrc).toMatch(/OBSIDIAN\.bgFallback/);
  });

  // The trap THIS batch had: reuse demands VALUE **and ALPHA** identity, not just hue.
  it('the 3 literal keys are DISTINCT from boardGold (value + alpha identity)', () => {
    expect(VISUAL_THEMES.classic.boardChipFloat).not.toBe(VISUAL_THEMES.classic.boardGold);
    expect(VISUAL_THEMES.classic.boardHintIcon).not.toBe(VISUAL_THEMES.classic.boardGold);
    expect(VISUAL_THEMES.streetStencil.boardHintIcon).not.toBe(VISUAL_THEMES.streetStencil.boardGold);
    // boardHintIcon IS boardGold's rgb at 0.7 alpha — routing it to boardGold would
    // have silently dropped the alpha. Proof the alpha is still carried:
    expect(VISUAL_THEMES.classic.boardHintIcon).toMatch(/0\.7\)$/);
    expect(VISUAL_THEMES.classic.boardTieBg).toMatch(/0\.92\)$/);
  });

  // The panel must not collapse into GameView's background on streetStencil.
  it('streetStencil panel uses the FELT stops, not the screen-bg stops', () => {
    expect(VISUAL_THEMES.streetStencil.boardPanelTop).toBe('#5a5a60');
    expect(VISUAL_THEMES.streetStencil.boardPanelTop).not.toBe(VISUAL_THEMES.streetStencil.background);
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
