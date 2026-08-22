// FUNNEL VERIFICATION — MULTIPLAYER, two live contexts.
// A PRIVATE invite-code table is used deliberately: create_table makes a brand-new room that
// expires on its own in 30 minutes, so none of the 11 public lobby rooms is consumed or altered.
import { chromium } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const SEED = () => {
  try {
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('hasSeenOnboarding', 'true');
    localStorage.setItem('guidedModeForced', 'false');
  } catch { /* ignore */ }
};

async function ctx(browser, name) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(SEED);
  await page.goto(`${SITE}/lobby/private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const deviceId = await page.evaluate(() => localStorage.getItem('caps-device-id'));
  return { name, page, deviceId, log: [] };
}

async function playHand(c) {
  const auto = c.page.getByLabel('Auto-place all boards').first();
  await auto.waitFor({ state: 'visible', timeout: 60000 });
  await auto.click();
  c.log.push('auto-place-all');
  await c.page.waitForTimeout(900);
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
  c.log.push(c.page.url().includes('/results') ? '/results' : `STUCK ${c.page.url()}`);
}

const browser = await chromium.launch();
const out = {};
try {
  const host = await ctx(browser, 'host');
  const guest = await ctx(browser, 'guest');
  out.host = { deviceId: host.deviceId };
  out.guest = { deviceId: guest.deviceId };

  await host.page.getByLabel('Create a 2-player private table').first().click();
  host.log.push('created 2P private table');
  await host.page.waitForTimeout(7000);
  out.hostUrl = host.page.url();
  // the room code is shown on the waiting screen
  const body = (await host.page.locator('body').innerText()).replace(/\s+/g, ' ');
  out.hostScreen = body.slice(0, 220);
  // Read it from the waiting-room URL, not the screen text: "TABLE CODE" matched the 4-letter
  // pattern before the code itself did.
  const code = new URL(host.page.url()).searchParams.get('roomCode');
  out.code = code ?? null;
  if (!code) throw new Error(`no room code found in: ${body.slice(0, 200)}`);

  await guest.page.getByLabel('Enter a table code').first().fill(code);
  await guest.page.getByLabel('Join by code').first().click();
  guest.log.push(`joined ${code}`);
  // The guest is the half most likely to stall: give it a real window and record what it shows.
  const gErrors = [];
  guest.page.on('console', (m) => { if (m.type() === 'error') gErrors.push(m.text().slice(0, 160)); });
  await guest.page.waitForURL('**/multiplayer-game**', { timeout: 120000 }).catch(() => {});
  out.guestUrl = guest.page.url();
  out.guestReachedGame = out.guestUrl.includes('multiplayer-game');
  if (!out.guestReachedGame) {
    out.guestScreen = (await guest.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260);
    out.guestErrors = gErrors.slice(0, 6);
  }

  await Promise.all([playHand(host), out.guestReachedGame ? playHand(guest) : Promise.resolve()]);
  out.host.log = host.log; out.guest.log = guest.log;
  out.host.url = host.page.url(); out.guest.url = guest.page.url();
} catch (e) {
  out.error = String(e).slice(0, 400);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
