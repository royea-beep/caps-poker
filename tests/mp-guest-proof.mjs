// MP GUEST PROOF — two contexts, private invite-code table, assertions on the GUEST.
// ENGINE=webkit to run the WebKit pass.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const SEED = () => {
  try {
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('hasSeenOnboarding', 'true');
    localStorage.setItem('caps_onboarding_done', 'true');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('caps_games_played', '5');
    localStorage.setItem('guidedModeForced', 'false');
  } catch { /* ignore */ }
};

const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const engineName = process.env.ENGINE === 'webkit' ? 'webkit' : 'chromium';

async function open(browser) {
  // separate contexts => separate storage => separate device ids
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const page = await c.newPage();
  await page.addInitScript(SEED);
  await page.goto(`${SITE}/lobby/private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  return { page, deviceId: await page.evaluate(() => localStorage.getItem('caps-device-id')), log: [] };
}

const txt = async (loc) => (await loc.count().catch(() => 0)) ? (await loc.first().innerText()).replace(/\s+/g, ' ').trim() : '(none)';

async function playHand(c) {
  const auto = c.page.getByLabel('Auto-place all boards').first();
  await auto.waitFor({ state: 'visible', timeout: 60000 });
  c.hole = await txt(c.page.getByTestId('hand-row'));
  c.community = await txt(c.page.getByTestId('community-row-0'));
  await auto.click();
  await c.page.waitForTimeout(1000);
  const ready = c.page.getByTestId('ready-button').first();
  await ready.waitFor({ state: 'visible', timeout: 30000 });
  await ready.click();
  c.log.push('ready');
  for (let i = 0; i < 45 && !c.page.url().includes('/results'); i++) {
    await c.page.waitForTimeout(2500);
    if (c.page.url().includes('/results')) break;
    const hint = c.page.getByTestId('reveal-tap-hint').first();
    const surface = c.page.getByTestId('reveal-skip-surface').first();
    if (await hint.count().catch(() => 0)) await hint.click({ timeout: 2000 }).catch(() => {});
    else if (await surface.count().catch(() => 0)) await surface.click({ timeout: 2000 }).catch(() => {});
  }
  c.reachedResults = c.page.url().includes('/results');
  if (c.reachedResults) {
    await c.page.waitForTimeout(2500);
    c.headline = (await c.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120);
  }
}

const browser = await engine.launch();
const out = { engine: engineName };
try {
  const host = await open(browser);
  const guest = await open(browser);
  out.hostDevice = host.deviceId;
  out.guestDevice = guest.deviceId;

  await host.page.getByLabel('Create a 2-player private table').first().click();
  await host.page.waitForTimeout(7000);
  const code = new URL(host.page.url()).searchParams.get('roomCode');
  out.code = code;
  if (!code) throw new Error('no room code');

  await guest.page.getByLabel('Enter a table code').first().fill(code);
  await guest.page.getByLabel('Join by code').first().click();
  await guest.page.waitForURL('**/multiplayer-game**', { timeout: 90000 }).catch(() => {});
  out.guestReachedGame = guest.page.url().includes('multiplayer-game');
  out.guestUrl = guest.page.url();
  if (!out.guestReachedGame) {
    out.guestScreen = (await guest.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  }

  await Promise.all([playHand(host), out.guestReachedGame ? playHand(guest) : Promise.resolve()]);
  out.host = { hole: host.hole, community: host.community, results: host.reachedResults, headline: host.headline };
  out.guest = { hole: guest.hole, community: guest.community, results: guest.reachedResults, headline: guest.headline };
  if (out.guestReachedGame) {
    out.sameCommunity = host.community === guest.community;
    out.differentHole = host.hole !== guest.hole;
  }
} catch (e) {
  out.error = String(e).slice(0, 300);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
