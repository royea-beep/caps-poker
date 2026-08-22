// FAILURE PATHS — new this stage, so they are tested rather than assumed.
// A blocked deal_hand must surface as an error and must NOT fall back to the local dealer.
// The block is a per-page network route abort: nothing on the server changes.
import { chromium } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const SEED = () => {
  try {
    localStorage.setItem('caps_onboarding_done', 'true');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '5');
    localStorage.setItem('hasSeenOnboarding', 'true');
  } catch { /* ignore */ }
};

const WHO = process.env.WHO === 'guest' ? 'guest' : 'host';

async function seat(browser, block) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  if (block) await page.route('**/rest/v1/rpc/deal_hand*', (route) => route.abort('failed'));
  await page.goto(`${SITE}/lobby/private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  return page;
}

const browser = await chromium.launch();
const out = { blocked: WHO };
try {
  const host = await seat(browser, WHO === 'host');
  const guest = await seat(browser, WHO === 'guest');

  await host.getByLabel('Create a 2-player private table').first().click();
  await host.waitForTimeout(7000);
  const code = new URL(host.url()).searchParams.get('roomCode');
  out.code = code;

  await guest.getByLabel('Enter a table code').first().fill(code);
  await guest.getByLabel('Join by code').first().click();
  await host.waitForTimeout(25000);

  const victim = WHO === 'host' ? host : guest;
  out.url = victim.url();
  // THE FALLBACK TEST: if a local deal had quietly replaced the server one, this page would be
  // sitting in /multiplayer-game holding cards. It must not be.
  out.reachedGameAnyway = out.url.includes('multiplayer-game');
  out.screen = (await victim.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 220);
  out.showsError = /Could not deal the hand|Could not get your cards/i.test(out.screen);
  // dealAndGo resets startedRef on failure so a retry is possible — the screen offers its way back
  out.hasWayBack = /Back to Lobby|‹ Back|Leave table/i.test(out.screen);
} catch (e) {
  out.error = String(e).slice(0, 300);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
if (out.reachedGameAnyway) { console.error('FELL BACK TO A LOCAL DEAL'); process.exit(2); }
if (!out.showsError) { console.error('NO ERROR SURFACED'); process.exit(2); }
