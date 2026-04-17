/**
 * Visual Audit — CAPS Poker
 * Screenshots every screen at 375 / 393 / 430 px.
 *
 * Run:  node --loader ts-node/esm tests/visual-audit.spec.ts
 *   or: npx tsx tests/visual-audit.spec.ts
 *
 * Output: tests/screenshots/<viewport>_<screen>.png
 */
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:8082';

const VIEWPORTS = [
  { width: 375, height: 667, label: '375_iPhone-SE' },
  { width: 393, height: 852, label: '393_iPhone-15' },
  { width: 430, height: 932, label: '430_iPhone-16ProMax' },
];

const GAME_STATE = JSON.stringify({
  state: {
    chips: 1200, bestChips: 1200,
    config: {
      numberOfPlayers: 2, potPerBoard: 25, arrangementTime: 60,
      boardRevealDuration: 5, turnRevealDelay: 800, completeBonusDisplay: 3,
      startingChips: 1000, completeBonusPercent: 50, botSpeedMin: 1500,
      botSpeedMax: 4000, soundEnabled: false, soundVolume: 0,
      revealSpeed: 'normal', botDifficulty: 'easy',
    },
    handsPlayed: 10, handsWon: 6, biggestWin: 75,
    playerName: 'Player', playerAvatar: 'P',
    notificationsEnabled: false, cardTheme: 'v1', homeTheme: 'dark_gold',
    buttonStyle: 'solid', friendsBg: 'none', fourColorSuits: false,
    colorblindMode: false, handSortMethod: 'caps', orientation: 'portrait',
    visualTheme: 'classic', lastDailyRewardClaim: null, dailyRewardStreak: 0,
    lastFreeRefill: null, totalChipsEarned: 200, totalChipsSpent: 100,
    unlockedAchievements: [], currentWinStreak: 2, bestWinStreak: 3,
  },
  version: 0,
});

// All routes to screenshot — skip lobby/* (require navigation state)
const SCREENS: Array<{ route: string; label: string; waitFor?: string; setup?: (p: Page) => Promise<void> }> = [
  { route: '/',                label: 'home' },
  { route: '/play',            label: 'play' },
  { route: '/friends',         label: 'friends' },
  { route: '/cups',            label: 'cups' },
  { route: '/profile',         label: 'profile' },
  { route: '/missions',        label: 'missions' },
  { route: '/achievements',    label: 'achievements' },
  { route: '/rank',            label: 'rank' },
  { route: '/hand-history',    label: 'hand-history' },
  { route: '/stats',           label: 'stats' },
  { route: '/settings',        label: 'settings' },
  { route: '/battle-pass',     label: 'battle-pass' },
  { route: '/leaderboard',     label: 'leaderboard' },
  { route: '/chip-store',      label: 'chip-store' },
  { route: '/sit-and-go-lobby', label: 'sit-and-go-lobby' },
  { route: '/results',         label: 'results' },
];

async function mkPage(browser: Browser, width: number, height: number): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.addInitScript((gs: string) => {
    localStorage.setItem('caps_language', 'he');
    localStorage.setItem('caps-poker-storage', gs);
    localStorage.setItem('caps_games_played', '99');
    localStorage.setItem('caps_onboarding_done', 'true');
  }, GAME_STATE);
  return { ctx, page };
}

async function screenshot(page: Page, outDir: string, filename: string): Promise<void> {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, filename), fullPage: false });
}

async function main(): Promise<void> {
  const outDir = path.join('tests', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  console.log('=== CAPS Visual Audit ===');
  console.log(`Output: ${outDir}/\n`);

  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.label} (${vp.width}×${vp.height}) ──`);

    for (const screen of SCREENS) {
      const filename = `${vp.label}_${screen.label}.png`;
      try {
        const { ctx, page } = await mkPage(browser, vp.width, vp.height);
        await page.goto(`${BASE_URL}${screen.route}`, { waitUntil: 'networkidle', timeout: 20000 });
        if (screen.setup) await screen.setup(page);
        await screenshot(page, outDir, filename);
        console.log(`  ✓ ${screen.label}`);
        passed++;
        await ctx.close().catch(() => {});
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
        console.error(`  ✗ ${screen.label} — ${msg}`);
        failures.push(`${vp.label}/${screen.label}: ${msg}`);
        failed++;
      }
    }
  }

  await browser.close();

  console.log(`\n=== DONE: ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
