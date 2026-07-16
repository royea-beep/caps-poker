import { activePaint, streetStencil as streetStencilPaint } from './paintThemes';

// S76 — `streetStencil` (N8) joins classic/fiveo. It is DORMANT: neither picker lists it
// (both hardcode [classic, fiveo] literals — settings.tsx VisualThemePicker `options` and
// theme-pick.tsx), and _layout.tsx still defaults to 'classic'. So it is unselectable
// STRUCTURALLY — no runtime flag to misread, no fetch that can fail open. The
// premium_theme_enabled gate gets wired in S77, when the picker is changed to list themes.
// NOTE: this type is ALSO declared in store/gameStore.ts — both must stay in sync.
export type VisualTheme = 'classic' | 'fiveo' | 'streetStencil';

export interface ThemeTokens {
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
  primaryBtnRadius: number;
  winColor: string;
  loseColor: string;

  // ── S76-BOARD, PIN STAGE. The Board's colour vocabulary. See the block comment
  //    on VisualPaint in constants/paintThemes.ts for the full rationale.
  //    NOTHING READS THESE YET — Board.tsx is untouched this batch. They are
  //    pinned classic === fiveo === today's static value so the routing batch is
  //    a provable no-op. All 19 are COLOUR. `primaryBtnRadius` above stays the
  //    ONLY number in this type — geometry is frozen (R-C).
  boardGold: string;
  boardGoldLight: string;
  boardGoldBright: string;
  boardTextPrimary: string;
  boardTextSecondary: string;
  boardTextMuted: string;
  boardTextDim: string;
  boardNeonGreen: string;
  boardNeonRed: string;
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
}

// S75 (theme plumbing) — the 32 paint VALUES (2 themes x 16 keys) moved verbatim to
// the paint layer (constants/paintThemes.ts -> currentPaint.visual); each theme now
// spreads the active paint and keeps primaryBtnRadius inline. primaryBtnRadius is a
// DIMENSION, not paint, so it stays here untouched (S75 R-C). The `ThemeTokens` type
// above is left exactly as-is — the paint layer deliberately uses the distinct name
// `PaintTokens` to avoid colliding with it (S75 R-A).
//
// Original intent (VAMOS-THEME-PROPAGATION 2026-06-13): both themes obsidianized.
// "classic" is Option C (Obsidian + Lift); "fiveo" keeps a slightly warmer navy
// surface so users who picked it still see a distinct vibe, on the same obsidian board.
export const VISUAL_THEMES: Record<VisualTheme, ThemeTokens> = {
  classic: {
    ...activePaint.visual.classic,
    primaryBtnRadius: 12, // GEOMETRY — unchanged
  },
  fiveo: {
    ...activePaint.visual.fiveo,
    primaryBtnRadius: 8, // GEOMETRY — unchanged
  },
  // S76 — Street Stencil (N8). PAINT ONLY: this theme is painted onto the existing
  // frozen layout; nothing moves. Values are sourced FROM the paint layer
  // (paintThemes.streetStencil) — paintThemes is the DATA layer, visualThemes the
  // DELIVERY mechanism (S76 Option 2). classic/fiveo above are untouched.
  streetStencil: {
    // Concrete. FLAT for now — the 3-stop 160deg gradient needs a LinearGradient
    // element (structural), so it lands with Board in Commit 1b. #4e4e54 is the
    // gradient's 55% mid-stop, so the flat fill reads as its midpoint.
    background: streetStencilPaint.colors.background,
    surface: streetStencilPaint.colors.surface,
    boardBg: streetStencilPaint.colors.feltLight,
    boardBorder: streetStencilPaint.colors.feltBorder,
    textPrimary: streetStencilPaint.colors.text,
    textSecondary: streetStencilPaint.colors.textSecondary,
    textMuted: streetStencilPaint.colors.textMuted,
    accent: streetStencilPaint.colors.mint, // `mint` is the legacy accent token name
    accentText: streetStencilPaint.colors.cardBlack, // #18181c ink on yellow
    cardFace: streetStencilPaint.colors.cardFace,
    cardBorder: streetStencilPaint.colors.cardBlack,
    cardShadow: streetStencilPaint.obsidian.cardGlow, // cyan spray glow
    primaryBtn: streetStencilPaint.colors.buttonPrimary,
    primaryBtnText: streetStencilPaint.colors.mint,
    primaryBtnRadius: 12, // GEOMETRY — identical to classic. No per-theme shape (R-C).
    // DELIBERATE: win/lose stay generic green/red. They are readability-critical —
    // the player must instantly parse won vs lost — so they are NOT themed to the N8
    // palette. Deferred to a later polish pass, not an oversight.
    winColor: activePaint.visual.classic.winColor, // #22c55e
    loseColor: activePaint.visual.classic.loseColor, // #ef4444

    // ── S76-BOARD pin. Sourced FROM the paint layer, never hardcoded here
    //    (paintThemes = DATA, visualThemes = DELIVERY — S76 Option 2).
    //    NOTHING READS THESE YET; Board is routed in a later batch.
    //
    //    S76-BOARD FILL11: every board* key below now resolves to a REAL N8 value.
    //    No TODOs remain — the 11 that previously inherited Obsidian were authored
    //    into paintThemes.streetStencil (the DATA layer) and flow through here
    //    unchanged. This file gained no hardcoded colour.
    boardGold: streetStencilPaint.colors.gold,             // #F8C020 — Variant A warm gold
    boardGoldLight: streetStencilPaint.colors.goldLight,   // #FFD84D
    boardGoldBright: streetStencilPaint.colors.goldBright, // #FFE87A
    // `text` is N8-authored under "// Labels"; COLORS.textPrimary is a legacy alias of
    // COLORS.text (identical #f0ead6 in currentPaint), so this follows the N8 author's
    // stated intent rather than inheriting the cream, which would be unreadable on concrete.
    boardTextPrimary: streetStencilPaint.colors.text,           // #ECECEC
    boardTextSecondary: streetStencilPaint.colors.textSecondary, // #c8c8cc
    boardTextMuted: streetStencilPaint.colors.textMuted,         // #c8c8cc
    boardTextDim: streetStencilPaint.colors.textDim,       // #8a8a90 — concrete-grey
    // DELIBERATE, not a TODO: win/lose markers stay generic green/red for the same
    // readability reason winColor/loseColor above are not themed.
    boardNeonGreen: streetStencilPaint.colors.neonGreen,
    boardNeonRed: streetStencilPaint.colors.neonRed,
    boardMintHairline: streetStencilPaint.obsidian.mintHairline, // rgba(248,240,80,0.45)
    boardMintGhost: streetStencilPaint.obsidian.mintGhost,       // rgba(248,240,80,0.10)
    boardSlotFill: streetStencilPaint.obsidian.slotFill,             // rgba(248,240,80,0.06)
    boardSlotDash: streetStencilPaint.obsidian.slotDash,             // rgba(248,240,80,0.45)
    boardSlotDashActive: streetStencilPaint.obsidian.slotDashActive, // #F8F050
    boardCardInk: streetStencilPaint.obsidian.cardInk,           // #18181c
    boardAutoBg: streetStencilPaint.obsidian.autoBg,             // #18181c — solid charcoal body
    boardAutoBorder: streetStencilPaint.obsidian.autoBorder,     // #F8F050
    boardAutoText: streetStencilPaint.obsidian.autoText,         // #F8F050
    boardAutoBolt: streetStencilPaint.obsidian.autoBolt,         // #F8F050
  },
};

export function getTheme(theme: VisualTheme | null): ThemeTokens {
  return VISUAL_THEMES[theme ?? 'classic'];
}
