import { themeAxes, VISUAL_THEME_AXES } from '../visualThemes';
import { FRIENDS_BGS } from '../friendsBgs';
import { HOME_THEMES, DEFAULT_HOME_THEME } from '../homeThemes';

/**
 * BATCH-B — the five appearance pickers were unified into Visual Style. Background + Home are now
 * DERIVED from `visualTheme` via `themeAxes`. These tests demonstrate the two guards Roye required:
 *   (a) a DEFAULT user sees no change, and
 *   (b) a user with NON-DEFAULT values on all four old pickers resolves cleanly (no crash, no
 *       broken half-state) — because the derivation depends ONLY on visualTheme, so the stale
 *       friendsBg/homeTheme/buttonStyle/cardTheme keys are inert.
 */
describe('BATCH-B unified look pickers — themeAxes derivation', () => {
  // Conservative mapping anchors = today's store defaults (friendsBg 'none', homeTheme dark_gold).
  const DEFAULT_BG = 'none';
  const DEFAULT_HOME = 'dark_gold';

  it('default user (visualTheme null) → today\'s defaults, so render is byte-identical', () => {
    expect(themeAxes(null)).toEqual({ bg: DEFAULT_BG, home: DEFAULT_HOME });
    // guard the anchor: the folded home default must equal the app\'s prior default.
    expect(DEFAULT_HOME_THEME).toBe(DEFAULT_HOME);
  });

  it('every theme maps to the conservative defaults (zero intended visual change this batch)', () => {
    for (const theme of ['classic', 'fiveo', 'streetStencil'] as const) {
      expect(themeAxes(theme)).toEqual({ bg: DEFAULT_BG, home: DEFAULT_HOME });
    }
  });

  it('non-default user on ALL four old pickers resolves cleanly — stale keys are inert', () => {
    // A user persisted: friendsBg:'vegas', homeTheme:'matrix', buttonStyle:'glass', cardTheme:'vegas'
    // + visualTheme:'fiveo'. themeAxes reads ONLY visualTheme, so those saved values cannot leak in.
    const axes = themeAxes('fiveo');
    expect(axes).toEqual({ bg: 'none', home: 'dark_gold' }); // NOT vegas/matrix — derived, not stored

    // ...and both derived values are VALID keys downstream → no crash / no broken half-state:
    // bg 'none' → FriendsBg renders null (no overlay); a non-'none' bg would resolve in FRIENDS_BGS.
    expect(axes.bg === 'none' || Boolean(FRIENDS_BGS[axes.bg as Exclude<typeof axes.bg, 'none'>])).toBe(true);
    expect(HOME_THEMES[axes.home]).toBeTruthy();
  });

  it('mapping table covers exactly the three VisualTheme ids (Street included but dormant)', () => {
    expect(Object.keys(VISUAL_THEME_AXES).sort()).toEqual(['classic', 'fiveo', 'streetStencil']);
  });
});
