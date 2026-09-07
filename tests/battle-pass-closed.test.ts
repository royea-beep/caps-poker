/**
 * THE BATTLE PASS IS CLOSED BY A REDIRECT, AND THE SCREEN IS KEPT.
 *
 * Roye's ruling 2026-09-07. This test exists because the decision has two halves and losing
 * either one silently is easy:
 *   · the ROUTE must not render the screen — it renders a countdown nobody can act on, in a game
 *     with no seasons, and a premium button asking 5,000 chips when the richest player in the
 *     database holds 3,250;
 *   · the SCREEN, store and config must SURVIVE — the battle pass ranked third of five in the
 *     monetisation model, so this is a closed door, not a demolition.
 *
 * ⚠️ It also pins the reopen note. A closed door with no note becomes a mystery somebody reopens
 * blind, and that is how a hollow feature ships twice.
 */
import fs from 'fs';

const ROUTE = 'app/battle-pass.tsx';
const SCREEN = 'components/BattlePassScreen.tsx';

describe('battle pass — closed, not deleted', () => {
  const route = fs.readFileSync(ROUTE, 'utf8');

  it('the route redirects to Home', () => {
    expect(route).toMatch(/<Redirect\s+href="\/"\s*\/>/);
  });

  it('the reopen note still shows the one line that restores it', () => {
    expect(route).toContain('<BattlePassScreen />');
  });

  /**
   * ⚠️ COMMENTS ARE STRIPPED FIRST, and the first version of this test did not do that — it
   * failed on the reopen note, which quite deliberately contains the line you would type to
   * reopen. An assertion that fires on its own documentation is a bad assertion, and the fix is
   * to test the code rather than the file.
   */
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the route does NOT render the battle pass screen', () => {
    expect(code).not.toMatch(/<BattlePassScreen/);
  });

  it.each([
    SCREEN,
    'stores/battlePassStore.ts',
    'constants/battlePassConfig.ts',
    'utils/battlePass.ts',
  ])('keeps %s — this is a redirect, not a delete', (file) => {
    expect(fs.existsSync(file)).toBe(true);
  });

  it('the kept screen is still the real screen, not a stub', () => {
    const screen = fs.readFileSync(SCREEN, 'utf8');
    expect(screen).toContain('export default function BattlePassScreen');
    expect(screen).toContain('getSeasonTimeRemaining');
    expect(screen.split('\n').length).toBeGreaterThan(500);
  });

  it('leaves a note saying what must be true to reopen it', () => {
    for (const phrase of ['REAL PLAYERS', 'CALIBRATED ECONOMY', 'REWARDS THAT RESOLVE', 'ROLLS OVER'])
      expect(route.toUpperCase()).toContain(phrase);
  });

  it('records why it closed, with the number that decided it', () => {
    expect(route).toContain('3,250');
    expect(route).toMatch(/5,?000/);
  });

  /**
   * ⚠️ XP IS THE HALF THAT WORKS. results.tsx credits it after every hand and the results screen
   * shows it. Closing the route must never touch that.
   */
  it('XP still accrues after a hand — results.tsx calls addXP', () => {
    expect(fs.readFileSync('app/results.tsx', 'utf8')).toMatch(/bpStore\.addXP\(/);
  });

  it('XP is still displayed on the results screen', () => {
    expect(fs.readFileSync('app/results.tsx', 'utf8')).toMatch(/<XPBar/);
  });

  /**
   * ⚠️ THE SEASON COUNTDOWN MUST HAVE EXACTLY ONE READER, and it must be the screen that is now
   * behind the redirect. If a second consumer ever appears — a home widget, a notification — it
   * will show an expired season the moment the clock runs out, and nobody will be looking.
   */
  it('nothing outside the closed screen reads the season clock', () => {
    const dirs = ['app', 'components', 'utils', 'stores', 'constants'];
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !p.includes('__tests__')) {
          if (/getSeasonTimeRemaining\s*\(/.test(fs.readFileSync(p, 'utf8'))) hits.push(p);
        }
      }
    };
    dirs.forEach(walk);
    expect(hits.sort()).toEqual([SCREEN, 'utils/battlePass.ts'].sort());
  });
});
