// CAPS paint layer — S75 (theme plumbing, ZERO visual change).
//
// This file owns every LIVE paint value in the app. It is the single source the
// existing paint exports now resolve from, so a later batch can swap `currentPaint`
// for an alternate theme (Olympus / Volcano Ruby / Marble Noir) without touching the
// consumers.
//
// IRON CONSTRAINT — PAINT ONLY. There are ZERO geometry keys in `PaintTokens`:
//   * spacing / fontWeight ................. stay static in constants/theme.ts   (R-B)
//   * OBSIDIAN_GEOM (incl. cardRadius) ..... stays in constants/obsidianTheme.ts (R-C)
//   * faceRadius / faceBorderWidth /
//     backBorderWidth / selectedTranslateY .. stay in constants/cardThemes.ts    (R-B/C)
//   * primaryBtnRadius ..................... stays in constants/visualThemes.ts (R-C)
//   * shadow specs (boardOuterShadow, cardLiftShadow, …) mix shadowColor with
//     offset/radius/elevation → left FULLY untouched this batch                 (F10)
//
// Namespaced by REAL source domain (R-F) rather than one false flat object, so each
// alternate theme later just supplies the same namespaces.
//
// EXCLUDED as dead + stale (F9, 0 consumers — verified): design.ts CAPS_THEME (still
// holds the pre-Obsidian maroon #5C1818 / #FFFEF8 / #FFD700 palette) and
// obsidianTheme.ts BOARD_IDENTITY. Snapshotting dead paint would bake a lie into this
// layer, so their values are deliberately NOT carried here.
//
// S75 migrates 0 components and repaints 0 surfaces. Resolution is frozen at import,
// which is correct while `current` is the only theme; live repaint arrives when
// surfaces migrate to usePaint() at render time (R-G), in later per-surface batches.
import { Platform } from 'react-native';
// Type-only imports — erased at runtime, so there is no import cycle with the
// source files that now read back from this module.
import type { HomeThemeId } from './homeThemes';
import type { CardThemeId } from './cardThemes';

/**
 * S76 — the key type for the paint layer's `visual` namespace.
 *
 * Deliberately NOT `VisualTheme` from visualThemes.ts. That union is the registry of
 * SELECTABLE themes and it grows (S76 added 'streetStencil'); this namespace is a
 * frozen SNAPSHOT of the two LEGACY visualThemes palettes mirrored in S75 (2 x 16 = 32
 * values). Keying it by `VisualTheme` coupled the two, so widening the registry
 * demanded a bogus `streetStencil` entry inside the Obsidian snapshot — tsc caught it.
 * A NEW theme composes its ThemeTokens in visualThemes.ts FROM this layer's
 * colors/obsidian tokens; it does not add an entry here.
 */
export type LegacyVisualPaintId = 'classic' | 'fiveo';

/** One home-screen palette (constants/homeThemes.ts → HomeTheme). Paint only. */
export interface HomePaint {
  bg: string;
  accent: string;
  accentSecondary: string;
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  titleColor: string;
  subtitleColor: string;
}

/** Card-art paint (constants/cardThemes.ts → CardThemeConfig, paint subset only). */
export interface CardPaint {
  faceBg: string;
  faceBorderColor: string;
  redSuit: string;
  blackSuit: string;
  backBg: string;
  backBorderColor: string;
  backDiamond: string;
  selectedBorderColor: string;
  selectedGlowColor: string;
}

/** Visual-theme paint (constants/visualThemes.ts → ThemeTokens, minus primaryBtnRadius). */
export interface VisualPaint {
  background: string;
  surface: string;
  boardBg: string;
  boardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  cardFace: string;
  cardBorder: string;
  cardShadow: string;
  primaryBtn: string;
  primaryBtnText: string;
  winColor: string;
  loseColor: string;

  /**
   * ── S76-BOARD, PIN STAGE ─────────────────────────────────────────────────
   * The Board's colour vocabulary. Board.tsx paints from module-scope
   * StyleSheets that freeze `COLORS.*` / `OBSIDIAN.*` at import, so it cannot
   * repaint at runtime. These keys give each of those reads a themed home.
   *
   * NOTHING READS THESE YET. The routing batch flips Board's reads to them, one
   * surface at a time; each flip is provably a no-op because the key already
   * holds the exact value it replaces.
   *
   * PINNED classic === fiveo === today's static value. They are equal by
   * construction: every read below is a STATIC read, so both themes already
   * render it identically today.
   *
   * NAMED `board*` BY DELIBERATE CHOICE. Do NOT route a Board read to the
   * same-named existing key — `theme.*` and `COLORS.*` collide by name with
   * DIFFERENT values (theme.textSecondary is mint #4FD6A8; COLORS.textSecondary
   * is grey #9aa19b). Reusing by name is exactly how a grey label silently turns
   * mint. Only 3 reads were value-identical on BOTH themes and so reuse an
   * existing key instead of minting one here: COLORS.background → background,
   * COLORS.mint / OBSIDIAN.mint → accent, COLORS.boardBorder → boardBorder.
   */
  // from COLORS (constants/theme.ts)
  boardGold: string;
  boardGoldLight: string;
  boardGoldBright: string;
  boardTextPrimary: string;
  boardTextSecondary: string;
  boardTextMuted: string;
  boardTextDim: string;
  boardNeonGreen: string;
  boardNeonRed: string;
  // from OBSIDIAN (constants/obsidianTheme.ts)
  boardMintHairline: string;
  boardMintGhost: string;
  boardSlotFill: string;
  boardSlotDash: string;
  boardSlotDashActive: string;
  boardCardInk: string;
  boardAutoBg: string;
  boardAutoBorder: string;
  boardAutoText: string;
  boardAutoBolt: string;

  /**
   * ── S76-BOARD-LITERALS/PANEL ──────────────────────────────────────────────
   * The board PANEL backdrop + the 3 live raw literals. Same pin rule: classic ===
   * fiveo === today. Byte-identity here is STRUCTURAL, not a coincidence: the panel
   * reads OBSIDIAN.* (theme-independent) and the literals are literals, so both
   * themes already render them identically today.
   *
   * WHY THESE ARE NEW KEYS AND NOT REUSES OF boardGold: reuse demands VALUE and
   * ALPHA identity, not merely the same hue. #FFD700 (boardChipFloat) is not
   * boardGold's #c9a84c; and rgba(201,168,76,0.7) IS boardGold at 0.7 alpha —
   * routing it to boardGold would silently drop the alpha. Different value OR
   * different alpha ⇒ a new key. This is the name-collision trap one level down.
   */
  boardPanelTop: string;
  boardPanelBottom: string;
  boardPanelFallback: string;
  boardHintIcon: string;
  boardTieBg: string;
  boardChipFloat: string;
}

/**
 * The full LIVE paint surface of the app — colour + font-family ONLY.
 * Key counts: colors 56 · obsidian 25 · home 10x10=100 · card 9x3=27 ·
 * visual 41x2=82 · fonts 1  →  291 paint values.
 * (S76 added obsidian.cardGlow; S76-BOARD added 19 `board*` visual keys;
 *  S76-BOARD-LITERALS/PANEL added 6 more — 25 `board*` keys total.)
 */
export interface PaintTokens {
  /** constants/theme.ts → colors → THEME.colors → gameConfig.COLORS (648 refs). */
  colors: {
    background: string; surface: string; surfaceRaised: string; border: string; overlay: string;
    gold: string; goldLight: string; goldDim: string; goldGlow: string; goldBright: string;
    mint: string; mintLight: string; mintBright: string; mintDim: string; mintGlow: string;
    mintHairline: string; mintGhost: string;
    neonBlue: string; neonPurple: string; neonGreen: string; neonRed: string;
    text: string; textMuted: string; textDim: string;
    cardRed: string; cardBlack: string; cardBack: string; cardFace: string; cardWhite: string;
    cardBackPattern: string;
    success: string; error: string; danger: string;
    boardBg: string; boardBorder: string; boardActive: string; boardFull: string;
    felt: string; feltLight: string; feltBorder: string; tableEdge: string;
    chip1: string; chip5: string; chip25: string; chip100: string; chip500: string;
    red: string; black: string; white: string; textPrimary: string; textSecondary: string;
    chipGreen: string; chipRed: string;
    buttonPrimary: string; buttonSecondary: string; buttonDanger: string;
  };
  /** constants/obsidianTheme.ts → OBSIDIAN (what components/Card.tsx actually paints from). */
  obsidian: {
    mint: string; mintSoft: string; mintHairline: string; mintGhost: string;
    bgTop: string; bgBottom: string; bgFallback: string;
    cardFaceTop: string; cardFaceBottom: string; cardFaceFallback: string;
    cardInk: string; cardRed: string;
    backTop: string; backBottom: string; backBorder: string;
    backEmblemOutline: string; backEmblemCore: string;
    slotFill: string; slotDash: string; slotDashActive: string;
    autoBg: string; autoBorder: string; autoText: string; autoBolt: string;
    /**
     * S76 — the card's glow shadowColor. Split out from `mint` because Card.tsx read
     * ONE token for TWO intents (community-frame border AND the glow), and Street
     * Stencil needs them to differ (yellow frame vs cyan glow). `current` keeps the
     * old value (#4FD6A8), so unmigrated surfaces stay byte-identical.
     */
    cardGlow: string;
  };
  home: Record<HomeThemeId, HomePaint>;
  card: Record<CardThemeId, CardPaint>;
  visual: Record<LegacyVisualPaintId, VisualPaint>;
  /** Font FAMILIES are paint; font WEIGHTS stay static in theme.ts (R-B). */
  fonts: { display: string | undefined };
}

/**
 * `currentPaint` — a faithful snapshot of today's LIVE values, moved verbatim from
 * their real sources. No invented colours, no compression, no re-mapping (R-E).
 */
export const currentPaint = {
  // ── colors: moved verbatim from constants/theme.ts (Obsidian + Lift, 2026-06-13) ──
  colors: {
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
  },

  // ── obsidian: moved verbatim from constants/obsidianTheme.ts → OBSIDIAN ──
  obsidian: {
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
    // S76 — split out of `mint` (see PaintTokens). Today's value, so Card.tsx's glow
    // is byte-identical to before for anything still reading `current`.
    cardGlow: '#4FD6A8',
  },

  // ── home: moved verbatim from constants/homeThemes.ts → HOME_THEMES (10 x 10) ──
  home: {
    dark_gold: {
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
    },
    navy_silver: {
      bg: '#0a0f1e',
      accent: '#7eb8e8',
      accentSecondary: '#4a90c4',
      buttonPrimary: '#7eb8e8',
      buttonPrimaryText: '#0a0f1e',
      buttonSecondaryBg: 'rgba(126,184,232,0.08)',
      buttonSecondaryBorder: '#7eb8e8',
      buttonSecondaryText: '#7eb8e8',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.5)',
    },
    purple_neon: {
      bg: '#080010',
      accent: '#b44fff',
      accentSecondary: '#7c1fe0',
      buttonPrimary: '#b44fff',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: 'rgba(180,79,255,0.08)',
      buttonSecondaryBorder: '#b44fff',
      buttonSecondaryText: '#b44fff',
      titleColor: '#b44fff',
      subtitleColor: 'rgba(180,79,255,0.6)',
    },
    casino_red: {
      bg: '#0a0000',
      accent: '#e8192c',
      accentSecondary: '#a00000',
      buttonPrimary: '#e8192c',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: 'rgba(232,25,44,0.08)',
      buttonSecondaryBorder: '#e8192c',
      buttonSecondaryText: '#e8192c',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.5)',
    },
    emerald: {
      bg: '#001a0d',
      accent: '#00c875',
      accentSecondary: '#007a47',
      buttonPrimary: '#00c875',
      buttonPrimaryText: '#000000',
      buttonSecondaryBg: 'rgba(0,200,117,0.08)',
      buttonSecondaryBorder: '#00c875',
      buttonSecondaryText: '#00c875',
      titleColor: '#00c875',
      subtitleColor: 'rgba(0,200,117,0.6)',
    },
    rose_gold: {
      bg: '#120008',
      accent: '#e8a0b4',
      accentSecondary: '#b4627a',
      buttonPrimary: '#e8a0b4',
      buttonPrimaryText: '#120008',
      buttonSecondaryBg: 'rgba(232,160,180,0.08)',
      buttonSecondaryBorder: '#e8a0b4',
      buttonSecondaryText: '#e8a0b4',
      titleColor: '#e8a0b4',
      subtitleColor: 'rgba(232,160,180,0.6)',
    },
    ocean: {
      bg: '#000d1a',
      accent: '#00d4ff',
      accentSecondary: '#0088cc',
      buttonPrimary: '#00d4ff',
      buttonPrimaryText: '#000d1a',
      buttonSecondaryBg: 'rgba(0,212,255,0.08)',
      buttonSecondaryBorder: '#00d4ff',
      buttonSecondaryText: '#00d4ff',
      titleColor: '#00d4ff',
      subtitleColor: 'rgba(0,212,255,0.6)',
    },
    sunset: {
      bg: '#0a0500',
      accent: '#ff6b35',
      accentSecondary: '#cc3d00',
      buttonPrimary: '#ff6b35',
      buttonPrimaryText: '#000000',
      buttonSecondaryBg: 'rgba(255,107,53,0.08)',
      buttonSecondaryBorder: '#ff6b35',
      buttonSecondaryText: '#ff6b35',
      titleColor: '#ff6b35',
      subtitleColor: 'rgba(255,107,53,0.6)',
    },
    arctic: {
      bg: '#0a0f14',
      accent: '#e8f4f8',
      accentSecondary: '#a8c8d8',
      buttonPrimary: '#e8f4f8',
      buttonPrimaryText: '#0a0f14',
      buttonSecondaryBg: 'rgba(232,244,248,0.08)',
      buttonSecondaryBorder: '#e8f4f8',
      buttonSecondaryText: '#e8f4f8',
      titleColor: '#e8f4f8',
      subtitleColor: 'rgba(232,244,248,0.6)',
    },
    matrix: {
      bg: '#000a00',
      accent: '#00ff41',
      accentSecondary: '#007a1e',
      buttonPrimary: '#00ff41',
      buttonPrimaryText: '#000a00',
      buttonSecondaryBg: 'rgba(0,255,65,0.08)',
      buttonSecondaryBorder: '#00ff41',
      buttonSecondaryText: '#00ff41',
      titleColor: '#00ff41',
      subtitleColor: 'rgba(0,255,65,0.6)',
    },
  },

  // ── card: paint subset moved verbatim from constants/cardThemes.ts (3 x 9).
  //    faceRadius / faceBorderWidth / backBorderWidth / selectedTranslateY are
  //    GEOMETRY and deliberately stay in cardThemes.ts. ──
  card: {
    v1: {
      faceBg: '#f5f0e8',
      faceBorderColor: 'rgba(0,0,0,0.10)',
      redSuit: '#c0392b',
      blackSuit: '#1a1a2e',
      backBg: '#0a0a1e',
      backBorderColor: '#c9a84c',
      backDiamond: '#c9a84c',
      selectedBorderColor: '#c9a84c',
      selectedGlowColor: '#c9a84c',
    },
    v2: {
      faceBg: '#1a1a2e',
      faceBorderColor: '#C9A84C',
      redSuit: '#E5C56A',
      blackSuit: '#C9A84C',
      backBg: '#0a0a1a',
      backBorderColor: '#C9A84C',
      backDiamond: '#E5C56A',
      selectedBorderColor: '#9B59B6',
      selectedGlowColor: '#9B59B6',
    },
    v3: {
      faceBg: '#FFFFFF',
      faceBorderColor: 'transparent',
      redSuit: '#E74C3C',
      blackSuit: '#2C3E50',
      backBg: '#4A0E8F',
      backBorderColor: '#7B2FBE',
      backDiamond: '#C39BD3',
      selectedBorderColor: '#3498DB',
      selectedGlowColor: '#3498DB',
    },
  },

  // ── visual: paint subset moved verbatim from constants/visualThemes.ts (2 x 16).
  //    primaryBtnRadius is GEOMETRY and stays in visualThemes.ts. ──
  visual: {
    classic: {
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

      // ── S76-BOARD pin. Each value is Board.tsx's TODAY value, copied from the
      //    token it reads. classic === fiveo (static reads — no divergence). ──
      boardGold: '#c9a84c',              // COLORS.gold
      boardGoldLight: '#e8c96a',         // COLORS.goldLight
      boardGoldBright: '#e8c96a',        // COLORS.goldBright
      boardTextPrimary: '#f0ead6',       // COLORS.textPrimary — NOT theme.textPrimary (#ffffff on fiveo)
      boardTextSecondary: '#9aa19b',     // COLORS.textSecondary — NOT theme.textSecondary (#4FD6A8 mint)
      boardTextMuted: '#9aa19b',         // COLORS.textMuted — NOT theme.textMuted (#bbbbbb on fiveo)
      boardTextDim: '#5b6168',           // COLORS.textDim
      boardNeonGreen: '#2ecc71',         // COLORS.neonGreen — NOT winColor (#22c55e)
      boardNeonRed: '#c0392b',           // COLORS.neonRed — NOT loseColor (#ef4444)
      boardMintHairline: 'rgba(79,214,168,0.45)',  // OBSIDIAN.mintHairline
      // CC2 / D3 — THE EMPTY SLOT IS CHROME, NOT FIELD. Roye: "המשבצות הריקות (זיתי-בוצי) -
      // הכי לא-אטרקטיביות ודווקא הן יעד הפעולה." Measured, "olive-muddy" is arithmetically
      // exact: mint fill at 0.10 alpha, inside an element the pulse drives down to 0.4 opacity,
      // composited over the rgb(40,62,49) table top, renders rgb(42,71,56) - L 0.0528 against
      // the table's 0.0412. A muddy olive almost indistinguishable from the felt it sits on.
      //
      // Two reasons it is now WHITE rather than a brighter mint. First the colour map: mint
      // means THE FIELD, and community card frames already use it - so a mint empty slot made
      // one colour mean both "a card that exists" and "a space where none does", which is the
      // gold collision from C4 wearing different clothes. Second, an empty slot is the ABSENCE
      // of content; chrome is exactly what it is.
      boardMintGhost: 'rgba(255,255,255,0.10)',    // slot fill while a card is selected
      boardSlotFill: 'rgba(255,255,255,0.045)',    // resting fill - a marked place, not a hole
      boardSlotDash: 'rgba(255,255,255,0.30)',     // resting outline
      boardSlotDashActive: 'rgba(255,255,255,0.72)', // the invitation, when a card is in hand
      boardCardInk: '#1B1B24',                     // OBSIDIAN.cardInk
      boardAutoBg: 'rgba(79,214,168,0.10)',        // OBSIDIAN.autoBg
      boardAutoBorder: 'rgba(79,214,168,0.35)',    // OBSIDIAN.autoBorder
      boardAutoText: '#4FD6A8',                    // OBSIDIAN.autoText
      boardAutoBolt: '#4FD6A8',                    // OBSIDIAN.autoBolt

      // ── PANEL-FELT batch: board panel -> ~0.55 alpha (0x8C) so the root felt reads through
      //    the play area. fallback -> transparent so native's fallback+gradient stack does NOT
      //    double the opacity (the gradient is the sole 0.55 paint on both native and web). ──
      boardPanelTop: '#1C1F268C',                  // OBSIDIAN.bgTop @ ~0.55
      boardPanelBottom: '#1012188C',               // OBSIDIAN.bgBottom @ ~0.55
      boardPanelFallback: 'rgba(22,25,34,0)',      // was #161922 — alpha 0 (transparent) so alpha isn't doubled on native; kept as an rgba() colour, not 'transparent', for the colour-invariant guard
      boardHintIcon: 'rgba(201,168,76,0.7)',       // raw literal — gold AT 0.7 ALPHA, so NOT boardGold
      boardTieBg: 'rgba(79,214,168,0.92)',         // raw literal — "mint at 92% reads neutral"
      boardChipFloat: '#FFD700',                   // raw literal — NOT boardGold (#c9a84c)
    },
    fiveo: {
      background: '#0a0a0a',
      surface: '#1A1A2E',
      boardBg: '#161922',
      boardBorder: 'rgba(79,214,168,0.45)',
      textPrimary: '#ffffff',
      textSecondary: '#4FD6A8',
      textMuted: '#bbbbbb',
      accent: '#4FD6A8',
      accentText: '#0a0a0a',
      cardFace: '#FAFAFA',
      cardBorder: 'rgba(0,0,0,0.25)',
      cardShadow: 'rgba(0,0,0,0.6)',
      primaryBtn: '#4FD6A8',
      primaryBtnText: '#1A1A2E',
      winColor: '#28A745',
      loseColor: '#CC0000',

      // ── S76-BOARD pin. IDENTICAL to classic above, by construction: every
      //    Board read these mirror is STATIC (a module-scope StyleSheet read of
      //    COLORS.*/OBSIDIAN.*), so fiveo renders the same pixels as classic
      //    there TODAY. Pinning them equal is what makes the later routing batch
      //    a provable no-op on BOTH themes. Divergence here would be a bug. ──
      boardGold: '#c9a84c',              // COLORS.gold
      boardGoldLight: '#e8c96a',         // COLORS.goldLight
      boardGoldBright: '#e8c96a',        // COLORS.goldBright
      boardTextPrimary: '#f0ead6',       // COLORS.textPrimary — NOT theme.textPrimary (#ffffff here)
      boardTextSecondary: '#9aa19b',     // COLORS.textSecondary — NOT theme.textSecondary (#4FD6A8 mint)
      boardTextMuted: '#9aa19b',         // COLORS.textMuted — NOT theme.textMuted (#bbbbbb here)
      boardTextDim: '#5b6168',           // COLORS.textDim
      boardNeonGreen: '#2ecc71',         // COLORS.neonGreen — NOT winColor (#28A745 here)
      boardNeonRed: '#c0392b',           // COLORS.neonRed — NOT loseColor (#CC0000 here)
      boardMintHairline: 'rgba(79,214,168,0.45)',  // OBSIDIAN.mintHairline
      // CC2 / D3 — THE EMPTY SLOT IS CHROME, NOT FIELD. Roye: "המשבצות הריקות (זיתי-בוצי) -
      // הכי לא-אטרקטיביות ודווקא הן יעד הפעולה." Measured, "olive-muddy" is arithmetically
      // exact: mint fill at 0.10 alpha, inside an element the pulse drives down to 0.4 opacity,
      // composited over the rgb(40,62,49) table top, renders rgb(42,71,56) - L 0.0528 against
      // the table's 0.0412. A muddy olive almost indistinguishable from the felt it sits on.
      //
      // Two reasons it is now WHITE rather than a brighter mint. First the colour map: mint
      // means THE FIELD, and community card frames already use it - so a mint empty slot made
      // one colour mean both "a card that exists" and "a space where none does", which is the
      // gold collision from C4 wearing different clothes. Second, an empty slot is the ABSENCE
      // of content; chrome is exactly what it is.
      boardMintGhost: 'rgba(255,255,255,0.10)',    // slot fill while a card is selected
      boardSlotFill: 'rgba(255,255,255,0.045)',    // resting fill - a marked place, not a hole
      boardSlotDash: 'rgba(255,255,255,0.30)',     // resting outline
      boardSlotDashActive: 'rgba(255,255,255,0.72)', // the invitation, when a card is in hand
      boardCardInk: '#1B1B24',                     // OBSIDIAN.cardInk
      boardAutoBg: 'rgba(79,214,168,0.10)',        // OBSIDIAN.autoBg
      boardAutoBorder: 'rgba(79,214,168,0.35)',    // OBSIDIAN.autoBorder
      boardAutoText: '#4FD6A8',                    // OBSIDIAN.autoText
      boardAutoBolt: '#4FD6A8',                    // OBSIDIAN.autoBolt

      // ── S76-BOARD-LITERALS/PANEL pin. IDENTICAL to classic, STRUCTURALLY: the
      //    panel reads OBSIDIAN.* (theme-independent — fiveo has never had its own
      //    panel colour) and the other three are raw literals. Both themes render
      //    these exact pixels today, so pinning them equal is a proof, not a choice.
      // PANEL-FELT batch: fiveo panel matches classic — ~0.55 alpha + transparent fallback.
      boardPanelTop: '#1C1F268C',                  // OBSIDIAN.bgTop @ ~0.55
      boardPanelBottom: '#1012188C',               // OBSIDIAN.bgBottom @ ~0.55
      boardPanelFallback: 'rgba(22,25,34,0)',      // was #161922 — alpha 0 (transparent) so alpha isn't doubled on native; kept as an rgba() colour, not 'transparent', for the colour-invariant guard
      boardHintIcon: 'rgba(201,168,76,0.7)',       // raw literal — gold AT 0.7 ALPHA, so NOT boardGold
      boardTieBg: 'rgba(79,214,168,0.92)',         // raw literal — "mint at 92% reads neutral"
      boardChipFloat: '#FFD700',                   // raw literal — NOT boardGold (#c9a84c)
    },
  },

  // ── fonts: font FAMILIES only. Mirrors app/(tabs)/index.tsx:192 DISPLAY_FONT.
  //    Not yet consumed — index.tsx keeps its own const this batch because S75
  //    migrates 0 components (R-G); the per-surface migration unifies it. ──
  fonts: {
    display: Platform.select({ web: 'Playfair Display, Georgia, serif', default: undefined }),
  },
} as const satisfies PaintTokens;

/**
 * `streetStencil` (N8) — S76. The NEW default look: dark concrete + spray-yellow
 * accent + stencil cards with a cyan spray glow.
 *
 * Authored as a spread of `currentPaint` + the N8 intent overrides. Keys the N8 spec
 * does not define yet simply inherit today's value — harmless, because only surfaces
 * migrated to usePaint() read this theme, and those read exactly the keys overridden
 * below. As each later surface migrates, its keys get their N8 values here.
 *
 * PAINT ONLY — every value below is a colour. No geometry (Street Stencil is painted
 * onto the existing frozen layout; nothing moves).
 */
export const streetStencil = {
  ...currentPaint,
  colors: {
    ...currentPaint.colors,
    // Concrete. FLAT in Commit 1a — the 3-stop 160deg gradient (#6a6a70 → #4e4e54 55%
    // → #3a3a40) needs a LinearGradient element, which would be a STRUCTURAL change to
    // GameView's tree. It lands in Commit 1b on Board, where the felt surface lives.
    // #4e4e54 is the 55% mid-stop, so the flat fill reads as the gradient's midpoint.
    background: '#4e4e54',
    surface: '#42424a',
    surfaceRaised: '#5a5a60',
    // Table / felt — the 3 concrete stops, present now for Commit 1b to gradient with.
    felt: '#5a5a60',
    feltLight: '#42424a',
    tableEdge: '#33333a',
    feltBorder: '#F8F050', // accent hairline
    // Accent — spray yellow. `mint` is the app's accent token name (legacy); under N8
    // it carries the yellow, so every migrated accent read flips together.
    mint: '#F8F050',
    mintLight: '#FBF68C',
    mintBright: '#FDFAC0',
    mintDim: 'rgba(248,240,80,0.55)',
    mintGlow: 'rgba(248,240,80,0.55)',
    mintHairline: 'rgba(248,240,80,0.45)',
    mintGhost: 'rgba(248,240,80,0.10)',
    boardActive: '#F8F050',
    boardBorder: 'rgba(248,240,80,0.45)',
    // Labels
    text: '#ECECEC',
    textSecondary: '#c8c8cc',
    textMuted: '#c8c8cc',
    // S76-BOARD FILL11 — concrete-grey. The Obsidian value (#5b6168) is a mint-grey
    // tuned for a near-black bg; on #4e4e54 concrete it drops below legibility.
    textDim: '#8a8a90',
    // S76-BOARD FILL11 — Gold, Variant A (Roye-approved). A DELIBERATE second accent:
    // a warm gold kept distinct from the spray yellow so a win badge reads as a prize
    // rather than merging into the all-yellow UI. Not an oversight, not a leftover.
    gold: '#F8C020',
    goldLight: '#FFD84D',
    goldBright: '#FFE87A',
    // Cards
    cardFace: '#ECECEC',
    cardWhite: '#ECECEC',
    cardBlack: '#18181c',
    cardRed: '#E82E5A',
    // Chips / buttons — dark ink body, accent border+text
    buttonPrimary: '#18181c',
    buttonSecondary: '#18181c',
  },
  obsidian: {
    ...currentPaint.obsidian,
    // Card face — stencil greys (hole #ECECEC → community #DADADA)
    cardFaceTop: '#ECECEC',
    cardFaceBottom: '#DADADA',
    cardFaceFallback: '#ECECEC',
    cardInk: '#18181c',
    cardRed: '#E82E5A',
    // Card back — dark ink with a sprayed accent emblem
    backTop: '#2a2a30',
    backBottom: '#18181c',
    backBorder: '#F8F050',
    backEmblemOutline: '#F8F050',
    backEmblemCore: '#F8F050',
    // Accent (community frame / hairlines) — spray yellow
    mint: '#F8F050',
    mintSoft: 'rgba(248,240,80,0.30)',
    mintHairline: 'rgba(248,240,80,0.45)',
    mintGhost: 'rgba(248,240,80,0.10)',
    // The cyan spray glow — the reason cardGlow exists (see PaintTokens.cardGlow).
    cardGlow: 'rgba(58,214,255,0.5)',

    // ── S76-BOARD FILL11 (Roye-approved) ────────────────────────────────────
    // Empty card slots. Spray yellow, but at RAISED alphas vs the mint they
    // replace (fill 0.03 -> 0.06, dash 0.30 -> 0.45): yellow on concrete has far
    // less contrast than mint on near-black, so the Obsidian alphas would leave
    // the slot invisible. Deliberate, not a copy of the mint alphas.
    slotFill: 'rgba(248,240,80,0.06)',
    slotDash: 'rgba(248,240,80,0.45)',
    slotDashActive: '#F8F050',
    // Auto-place chip. Solid charcoal body — matches the PLACE button rather than
    // the translucent mint chip it replaces — with accent border + label.
    autoBg: '#18181c',
    autoBorder: '#F8F050',
    autoText: '#F8F050',
    autoBolt: '#F8F050',
  },
} as const satisfies PaintTokens;

/** The theme ids the paint layer can resolve. */
export type PaintThemeId = 'current' | 'streetStencil';

export const PAINT_THEMES: Record<PaintThemeId, PaintTokens> = {
  current: currentPaint,
  streetStencil,
};

/**
 * S76 — the default is now Street Stencil, so `usePaint()` returns it (the
 * premium_theme_enabled gate is absent → PaintProvider forces the default).
 * NOTE: `activePaint` below deliberately still points at `currentPaint`, so every
 * surface NOT yet migrated to usePaint() keeps rendering Obsidian byte-identically.
 * That split is what makes the surface-by-surface rollout possible on a global cascade.
 */
export const DEFAULT_PAINT_THEME: PaintThemeId = 'streetStencil';

/** Resolve a paint theme by id; unknown/absent ids fall back to `current`. */
export function getPaint(id: PaintThemeId | null | undefined): PaintTokens {
  return PAINT_THEMES[id ?? DEFAULT_PAINT_THEME] ?? currentPaint;
}

/**
 * The ACTIVE paint the static exports resolve from. While `current` is the only
 * theme this is exactly today's values, so the app is pixel-identical (S75 repaints
 * nothing). Live switching arrives via usePaint() at render time in later batches.
 */
// NOTE: deliberately NOT annotated `: PaintTokens` — that would widen the literal
// types (e.g. '#c9a84c' → string) and churn every downstream consumer. Reading from
// the `as const` object keeps the exports byte-identical in type AND value to today.
export const activePaint = currentPaint;

// PANEL-FELT batch (mechanism proof) — a MINIMAL dark felt gradient painted at the screen root so
// the newly ~0.55-alpha board panels read over "a table, not a void". Deliberately NOT a ThemeTokens
// field (kept a standalone const) so it adds zero keys to the visual paint records — no fidelity-count
// or Record<VisualTheme> ripple. The rich atmosphere batch will fold this into proper theme tokens.
// Plain two-stop linear gradient only — NO texture / vignette / pattern / blur. streetStencil stays
// dormant; its entry keeps it from breaking if ever selected.
export const FELT_GRADIENT: Record<'classic' | 'fiveo' | 'streetStencil', readonly [string, string]> = {
  // FELT-FIX: classic lifted from #14231D->#0A0F0C (faded to near-black — read as a void, not a
  // table). Now a near-uniform visible green in the owner's #0E2418–#10281A range (~rgb(14,36,24)):
  // dark and tasteful but actually reads as green felt through the 0.55 panels. The "buried under
  // rgb(10,10,10)" the panel saw was navigator/WebContainer chrome BEHIND the felt (contentStyle
  // #0a0a0a + WebContainer #050f0a gutter), not a layer over it — the felt was simply too dark.
  classic:       ['#10281A', '#0E2418'], // top rgb(16,40,26) -> bottom rgb(14,36,24), visible green felt
  fiveo:         ['#28101A', '#0C070A'], // dark maroon felt (harmonises with fiveo's #5A1520 lean) — UNTOUCHED
  streetStencil: ['#4E4E54', '#42424A'], // dormant — concrete-grey, matches its existing bg/feltLight
};
