// MP REGRESSION NET — the signal that tells us server-side dealing landed.
//
// It runs the full two-context journey and reports six criteria. It is written to be run BEFORE
// the fix (EXPECT=broken, today's known state) and AFTER it (EXPECT=fixed). Exit 0 means "the
// observed state matched what was expected"; exit 2 means either a mismatch or — just as
// important — that the run measured NOTHING, which otherwise looks identical to a clean pass.
//
// A private invite-code table is used deliberately: create_table makes a NEW room that expires in
// 30 minutes and is is_public=false, so the 11 public lobby rooms are never touched.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const EXPECT = process.env.EXPECT === 'fixed' ? 'fixed' : 'broken';
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const engineName = process.env.ENGINE === 'webkit' ? 'webkit' : 'chromium';

const SEED = () => {
  try {
    localStorage.setItem('caps_onboarding_done', 'true');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '5');
    localStorage.setItem('hasSeenOnboarding', 'true');
    localStorage.setItem('guidedModeForced', 'false');
  } catch { /* ignore */ }
};

async function seat(browser, path) {
  // separate context => separate storage => a distinct device id, as two real phones would be
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  // A green workflow is not a mounted page: assert #root actually has content.
  const rootLen = await page.evaluate(() => (document.getElementById('root')?.innerHTML ?? '').length);
  return { page, rootLen, deviceId: await page.evaluate(() => localStorage.getItem('caps-device-id')) };
}

const text = async (loc) => ((await loc.count().catch(() => 0)) ? (await loc.first().innerText()).replace(/\s+/g, ' ').trim() : null);

async function playHand(s) {
  const auto = s.page.getByLabel('Auto-place all boards').first();
  await auto.waitFor({ state: 'visible', timeout: 60000 });
  s.community = await text(s.page.getByTestId('community-row-0'));
  s.hole = await text(s.page.getByTestId('hand-row'));
  await auto.click();
  await s.page.waitForTimeout(1000);
  const ready = s.page.getByTestId('ready-button').first();
  await ready.waitFor({ state: 'visible', timeout: 30000 });
  await ready.click();
  for (let i = 0; i < 45 && !s.page.url().includes('/results'); i++) {
    await s.page.waitForTimeout(2500);
    if (s.page.url().includes('/results')) break;
    const hint = s.page.getByTestId('reveal-tap-hint').first();
    const surf = s.page.getByTestId('reveal-skip-surface').first();
    if (await hint.count().catch(() => 0)) await hint.click({ timeout: 2000 }).catch(() => {});
    else if (await surf.count().catch(() => 0)) await surf.click({ timeout: 2000 }).catch(() => {});
  }
  s.results = s.page.url().includes('/results');
  if (s.results) { await s.page.waitForTimeout(2500); s.summary = (await s.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 100); }
}

const browser = await engine.launch();
const r = { engine: engineName, expect: EXPECT, measured: false, criteria: {} };
try {
  const host = await seat(browser, '/lobby/private');
  const guest = await seat(browser, '/lobby/private');
  r.hostDevice = host.deviceId; r.guestDevice = guest.deviceId;
  r.rootMounted = { host: host.rootLen, guest: guest.rootLen };
  if (!host.rootLen || !guest.rootLen) throw new Error('#root empty — the page did not mount');

  await host.page.getByLabel('Create a 2-player private table').first().click();
  await host.page.waitForTimeout(7000);
  r.roomCode = new URL(host.page.url()).searchParams.get('roomCode');
  if (!r.roomCode) throw new Error('host never reached the waiting room — no roomCode in the URL');

  await guest.page.getByLabel('Enter a table code').first().fill(r.roomCode);
  await guest.page.getByLabel('Join by code').first().click();
  await guest.page.waitForURL('**/multiplayer-game**', { timeout: 90000 }).catch(() => {});
  r.measured = true;                                   // we got far enough to observe an outcome
  r.criteria.guestReachesGame = guest.page.url().includes('multiplayer-game');
  r.guestScreen = r.criteria.guestReachesGame ? null : (await guest.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);

  await Promise.all([playHand(host), r.criteria.guestReachesGame ? playHand(guest) : Promise.resolve()]);

  r.criteria.sameCommunity = r.criteria.guestReachesGame ? (!!host.community && host.community === guest.community) : false;
  r.criteria.differentHole = r.criteria.guestReachesGame ? (!!host.hole && !!guest.hole && host.hole !== guest.hole) : false;
  r.criteria.bothReachResults = !!host.results && !!guest.results;
  r.criteria.mirroredSummary = !!host.summary && !!guest.summary && host.summary !== guest.summary;
  r.detail = { host: { hole: host.hole, community: host.community, summary: host.summary },
               guest: { hole: guest.hole, community: guest.community, summary: guest.summary } };
} catch (e) {
  r.error = String(e).slice(0, 300);
}
await browser.close();

// hand_history is asserted by SQL after the run (the table is service-role read only)
const wanted = EXPECT === 'fixed';
const pass = r.measured && Object.values(r.criteria).every((v) => v === wanted);
r.verdict = !r.measured ? 'MEASURED NOTHING — inconclusive'
  : pass ? `matches EXPECT=${EXPECT}` : `DIVERGED from EXPECT=${EXPECT}`;
console.log(JSON.stringify(r, null, 1));
process.exit(pass ? 0 : 2);
