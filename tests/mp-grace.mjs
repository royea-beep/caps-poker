// GRACE WINDOW — both branches, with a real disconnect.
//   BRANCH=A  the guest closes its tab and returns at ~10s: it must resume THE SAME hand.
//   BRANCH=B  the guest never returns: the hand must resolve after ~30s, not ~5s, with the absent
//             player's cards AUTO-PLACED (a hand_history row for them, not a forfeit).
// The delay is measured from presence loss to the hand resolving, read from game_hands/hand_history.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const BRANCH = process.env.BRANCH === 'B' ? 'B' : 'A';
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const engineName = process.env.ENGINE === 'webkit' ? 'webkit' : 'chromium';

const SEED = () => {
  try {
    localStorage.setItem('caps_onboarding_done', 'true');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '5');
    localStorage.setItem('hasSeenOnboarding', 'true');
  } catch { /* ignore */ }
};

const text = async (page, tid) => {
  const l = page.getByTestId(tid);
  return (await l.count().catch(() => 0)) ? (await l.first().innerText()).replace(/\s+/g, ' ').trim() : null;
};

async function seat(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/lobby/private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  return { ctx, page, deviceId: await page.evaluate(() => localStorage.getItem('caps-device-id')) };
}

const browser = await engine.launch();
const out = { engine: engineName, branch: BRANCH, measured: false };
try {
  const host = await seat(browser);
  const guest = await seat(browser);
  out.hostDevice = host.deviceId; out.guestDevice = guest.deviceId;

  await host.page.getByLabel('Create a 2-player private table').first().click();
  await host.page.waitForTimeout(7000);
  const code = new URL(host.page.url()).searchParams.get('roomCode');
  out.code = code;
  await guest.page.getByLabel('Enter a table code').first().fill(code);
  await guest.page.getByLabel('Join by code').first().click();
  await guest.page.waitForURL('**/multiplayer-game**', { timeout: 90000 });
  await host.page.waitForURL('**/multiplayer-game**', { timeout: 90000 });
  await guest.page.waitForTimeout(3000);

  out.before = { community: await text(guest.page, 'community-row-0'), hole: await text(guest.page, 'hand-row') };
  out.measured = true;

  // The host confirms its own placement so the hand is waiting only on the guest.
  await host.page.getByLabel('Auto-place all boards').first().click().catch(() => {});
  await host.page.waitForTimeout(900);
  await host.page.getByTestId('ready-button').first().click().catch(() => {});

  const t0 = Date.now();
  await guest.page.close();                      // real disconnect: the page is destroyed
  out.droppedAt = new Date().toISOString();

  // What the REMAINING player is told during the window.
  await host.page.waitForTimeout(6000);
  const hostBody = (await host.page.locator('body').innerText()).replace(/\s+/g, ' ');
  out.hostSeesAway = /disconnected — the hand continues shortly|disconnected/i.test(hostBody);
  out.hostLine = (hostBody.match(/[^.]*disconnected[^.]*/i) ?? ['(none)'])[0].slice(0, 90);

  if (BRANCH === 'A') {
    await new Promise((r) => setTimeout(r, Math.max(0, 10000 - (Date.now() - t0))));
    const back = await guest.ctx.newPage();
    await back.addInitScript(SEED);
    await back.goto(`${SITE}/lobby/table?roomCode=${code}&playerCount=2&isHost=false`,
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    await back.waitForURL('**/multiplayer-game**', { timeout: 90000 }).catch(() => {});
    out.returnedAfterMs = Date.now() - t0;
    out.rejoined = back.url().includes('multiplayer-game');
    await back.waitForTimeout(2500);
    out.after = { community: await text(back, 'community-row-0'), hole: await text(back, 'hand-row') };
    out.sameCommunity = !!out.after.community && out.after.community === out.before.community;
    out.sameHole = !!out.after.hole && out.after.hole === out.before.hole;
    // finish the hand so hand_history can be checked
    await back.getByLabel('Auto-place all boards').first().click().catch(() => {});
    await back.waitForTimeout(900);
    await back.getByTestId('ready-button').first().click().catch(() => {});
  }

  // Wait for the host to reach /results, and time it from the drop.
  await host.page.waitForURL('**/results**', { timeout: 180000 }).catch(() => {});
  out.hostReachedResults = host.page.url().includes('/results');
  out.secondsFromDropToResults = Math.round((Date.now() - t0) / 100) / 10;
  // record_hand_result_d is fire-and-forget from the results screen; closing the browser the
  // instant the URL changes cuts it off. Give it room to land before asserting on rows.
  await host.page.waitForTimeout(7000);
} catch (e) {
  out.error = String(e).slice(0, 300);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
if (!out.measured) { console.error('MEASURED NOTHING'); process.exit(2); }
