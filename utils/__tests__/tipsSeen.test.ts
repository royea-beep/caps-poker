/**
 * A TIP STAYS DISMISSED — the regression guard for DISMISS-THE-TIPS.
 *
 * The defect was not a missing setting. The first-hand explanations were gated on
 * `caps_games_played === 0`, and that counter is written in exactly one place — app/game.tsx's
 * reveal-done handler — so it counts hands FINISHED. Open a hand, read the six tips, leave:
 * nothing recorded, and the next hand teaches you again. Measured on the built app
 * (tests/tips-abandon.mjs): four abandoned hands, tips on all four, counter still null.
 *
 * These pin the two halves that actually broke: the store must persist a dismissal, and the
 * screens must consult it instead of the counter.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// An in-memory stand-in, same idiom as handHistory.test.ts — the real module needs a browser.
const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(store.has(k) ? store.get(k)! : null)),
  setItem: jest.fn((k: string, v: string) => { store.set(k, v); return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { store.delete(k); return Promise.resolve(); }),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadDismissedTips, isTipDismissed, markTipDismissed, resetDismissedTips,
  gameTipId, BOARD_HINT_ID, TIPS_DISMISSED_KEY, TIPS_ENABLED_KEY,
  areTipsEnabled, setTipsEnabled, __resetTipsCacheForTest,
} from '../tipsSeen';

const ROOT = join(__dirname, '..', '..');
/** Comments are stripped first: the fix's own comments quote the gate they replaced. */
const code = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

beforeEach(() => { __resetTipsCacheForTest(); store.clear(); });

describe('the store', () => {
  it('shows every tip to a brand-new device', async () => {
    await loadDismissedTips();
    for (let i = 1; i <= 6; i++) expect(isTipDismissed(gameTipId(i))).toBe(false);
    expect(isTipDismissed(BOARD_HINT_ID)).toBe(false);
  });

  it('a dismissal is visible immediately, without waiting for the write', () => {
    markTipDismissed(gameTipId(2));
    expect(isTipDismissed(gameTipId(2))).toBe(true);
    expect(isTipDismissed(gameTipId(3))).toBe(false);
  });

  it('survives a reload — a fresh hydration from storage', async () => {
    markTipDismissed(gameTipId(1));
    markTipDismissed(BOARD_HINT_ID);
    await new Promise((r) => setTimeout(r, 0));
    __resetTipsCacheForTest();               // a new app launch: nothing in memory
    expect(isTipDismissed(gameTipId(1))).toBe(false);  // before hydration, err toward SHOWING
    await loadDismissedTips();
    expect(isTipDismissed(gameTipId(1))).toBe(true);
    expect(isTipDismissed(BOARD_HINT_ID)).toBe(true);
    expect(isTipDismissed(gameTipId(4))).toBe(false);
  });

  it('a corrupt value re-teaches rather than silencing onboarding for ever', async () => {
    store.set(TIPS_DISMISSED_KEY, '{not json');
    await loadDismissedTips();
    expect(isTipDismissed(gameTipId(1))).toBe(false);
  });

  it('the replay control clears everything', async () => {
    markTipDismissed(gameTipId(1)); markTipDismissed(BOARD_HINT_ID);
    await resetDismissedTips();
    expect(isTipDismissed(gameTipId(1))).toBe(false);
    expect(isTipDismissed(BOARD_HINT_ID)).toBe(false);
    expect(store.has(TIPS_DISMISSED_KEY)).toBe(false);
  });
});

describe('the screens consult it', () => {
  const game = code('app/game.tsx');
  const board = code('components/BoardArrangement.tsx');

  it('dismissing a game tip records it', () => {
    expect(game).toContain('markTipDismissed(gameTipId(tooltipStep));');
  });

  it('a tip is only made visible when it has not been dismissed', () => {
    expect(game).toContain('setTooltipVisible(!isTipDismissed(gameTipId(step)));');
    // and no step transition may bypass showTip by forcing visibility on
    expect(game).not.toMatch(/setTooltipStep\(\d\);\s*setTooltipVisible\(true\)/);
  });

  it('the board hint retires on the action it describes, not on the hand counter', () => {
    expect(board).toContain('!isTipDismissed(BOARD_HINT_ID)');
    expect(board).not.toContain('gamesPlayed < 1');
    expect(game).toContain('markTipDismissed(BOARD_HINT_ID);');
  });

  it('the dismissed set is hydrated in the same await as the counter', () => {
    expect(game).toMatch(/AsyncStorage\.getItem\(GUIDED_FORCED_KEY\),[\s\S]{0,200}loadDismissedTips\(\)/);
  });

  it('the tip count comes from the data, never a literal', () => {
    expect(game).toContain('tooltipStep <= TIPS.length');
    expect(game).not.toMatch(/tooltipStep <= 6/);
  });

  it('both existing replay controls replay the tips too — no third control was added', () => {
    expect(code('app/settings.tsx')).toContain('resetDismissedTips()');
    expect(code('app/(tabs)/index.tsx')).toContain('resetDismissedTips()');
    // SUPERSEDED 2026-09-06. This line used to assert that NO tips control existed anywhere,
    // written when the previous sprint concluded the bug fix made a switch unnecessary. That
    // conclusion was mine to report, not to make: Roye asked for the button and still wants it.
    // The standing rule it was guarding — Settings went 42 controls to 23, so anything added back
    // must earn its place alone — is now enforced by the "exactly ONE control" block below.
  });
});

describe('the Show tips switch', () => {
  it('is ON when nothing has ever been stored — "off" is never a default', async () => {
    await loadDismissedTips();
    expect(areTipsEnabled()).toBe(true);
  });

  it('only an explicit false turns it off; a corrupt value still teaches', async () => {
    store.set(TIPS_ENABLED_KEY, 'banana');
    await loadDismissedTips();
    expect(areTipsEnabled()).toBe(true);
  });

  it('off suppresses EVERY explanation, not just the ones already seen', async () => {
    await setTipsEnabled(false);
    for (let i = 1; i <= 6; i++) expect(isTipDismissed(gameTipId(i))).toBe(true);
    expect(isTipDismissed(BOARD_HINT_ID)).toBe(true);
  });

  it('turning it back ON shows them again — otherwise it works once and is not a switch', async () => {
    markTipDismissed(gameTipId(1));
    markTipDismissed(BOARD_HINT_ID);
    await setTipsEnabled(false);
    await setTipsEnabled(true);
    expect(areTipsEnabled()).toBe(true);
    expect(isTipDismissed(gameTipId(1))).toBe(false);
    expect(isTipDismissed(BOARD_HINT_ID)).toBe(false);
    // and the onboarding overlay comes back with them
    expect(store.has('has_seen_interactive_tutorial')).toBe(false);
  });

  it('the state survives a relaunch', async () => {
    await setTipsEnabled(false);
    __resetTipsCacheForTest();
    expect(areTipsEnabled()).toBe(true);        // default until hydration
    await loadDismissedTips();
    expect(areTipsEnabled()).toBe(false);       // and then the stored answer
  });

  it('the onboarding key string cannot drift from the component that owns it', () => {
    const tutorial = readFileSync(join(ROOT, 'components/InteractiveTutorial.tsx'), 'utf8');
    const declared = /INTERACTIVE_TUTORIAL_KEY = '([^']+)'/.exec(tutorial)?.[1];
    const mirrored = /ONBOARDING_SEEN_KEY = '([^']+)'/.exec(readFileSync(join(ROOT, 'utils/tipsSeen.ts'), 'utf8'))?.[1];
    expect(declared).toBe('has_seen_interactive_tutorial');
    expect(mirrored).toBe(declared);
  });
});

describe('exactly ONE control was added', () => {
  const settings = code('app/settings.tsx');

  it('the switch exists, is a switch, and is reachable by accessibility label', () => {
    expect(settings).toContain('function ShowTipsToggle()');
    expect(settings).toContain('<ShowTipsToggle />');
    expect(settings).toContain("accessibilityRole=\"switch\"");
    expect(settings).toContain('testID="settings-show-tips"');
  });

  it('is mounted exactly once', () => {
    expect((settings.match(/<ShowTipsToggle \/>/g) ?? []).length).toBe(1);
  });

  it('adds no second tips control — no per-tip preference crept in', () => {
    expect(settings).not.toMatch(/ShowTutorialToggle|TipStyleSelector|PerTipToggle|tipsFrequency/);
  });

  it('the home overlay obeys the same switch', () => {
    expect(code('app/(tabs)/index.tsx')).toContain('if (!val && areTipsEnabled()) setShowInteractiveTutorial(true);');
  });

  it('both languages carry the new strings', () => {
    const i18n = readFileSync(join(ROOT, 'utils/i18n.ts'), 'utf8');
    expect((i18n.match(/setShowTips:/g) ?? []).length).toBe(3);      // interface + 2 tables
    expect((i18n.match(/setShowTipsHint:/g) ?? []).length).toBe(3);
  });
});
