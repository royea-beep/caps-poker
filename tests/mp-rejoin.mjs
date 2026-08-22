// MID-GAME REJOIN — real disconnects, not simulated ones.
//   MODE=close    the guest's tab is closed and re-opened in the SAME context (same storage, same
//                 device id), then it re-enters through the table route the app itself uses.
//   MODE=offline  the guest's context goes offline mid-hand and comes back.
//   MODE=host     the HOST closes and re-enters.
// The assertion that matters: the returning player holds its ORIGINAL hole cards, not a fresh deal.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const MODE = process.env.MODE ?? 'close';
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

async function newSeat(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/lobby/private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  return { ctx, page, deviceId: await page.evaluate(() => localStorage.getItem('caps-device-id')) };
}

const browser = await engine.launch();
const out = { engine: engineName, mode: MODE, measured: false };
try {
  const host = await newSeat(browser);
  const guest = await newSeat(browser);
  out.hostDevice = host.deviceId; out.guestDevice = guest.deviceId;

  await host.page.getByLabel('Create a 2-player private table').first().click();
  await host.page.waitForTimeout(7000);
  const code = new URL(host.page.url()).searchParams.get('roomCode');
  out.code = code;
  if (!code) throw new Error('no room code');

  await guest.page.getByLabel('Enter a table code').first().fill(code);
  await guest.page.getByLabel('Join by code').first().click();
  await guest.page.waitForURL('**/multiplayer-game**', { timeout: 90000 });
  await host.page.waitForURL('**/multiplayer-game**', { timeout: 90000 });
  await guest.page.waitForTimeout(3000);

  const victim = MODE === 'host' ? host : guest;
  out.before = {
    community: await text(victim.page, 'community-row-0'),
    hole: await text(victim.page, 'hand-row'),
  };
  out.measured = true;
  if (!out.before.hole) throw new Error('no hole cards captured before the drop');

  if (MODE === 'offline') {
    await victim.ctx.setOffline(true);
    await victim.page.waitForTimeout(9000);
    await victim.ctx.setOffline(false);
    await victim.page.waitForTimeout(12000);
    out.urlAfter = victim.page.url();
    out.stayedInGame = out.urlAfter.includes('multiplayer-game');
  } else {
    // A real tab close: the page is destroyed. The context (storage, device id) survives, as it
    // would on a phone that locked and came back.
    await victim.page.close();
    // Short on purpose. The host auto-readies a disconnected player mid-hand (CAPS 10) and the
    // table moves on, so a slow return lands in the NEXT hand — correct behaviour, but it tests
    // nothing about returning to the hand you left.
    await new Promise((r) => setTimeout(r, Number(process.env.GAP ?? 1200)));
    const back = await victim.ctx.newPage();
    await back.addInitScript(SEED);
    await back.goto(`${SITE}/lobby/table?roomCode=${code}&playerCount=2&isHost=${MODE === 'host'}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    await back.waitForURL('**/multiplayer-game**', { timeout: 90000 }).catch(() => {});
    victim.page = back;
    out.urlAfter = back.url();
    out.rejoined = out.urlAfter.includes('multiplayer-game');
    if (!out.rejoined) out.screen = (await back.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  }

  await victim.page.waitForTimeout(2500);
  out.after = {
    community: await text(victim.page, 'community-row-0'),
    hole: await text(victim.page, 'hand-row'),
  };
  out.sameCommunity = !!out.after.community && out.after.community === out.before.community;
  out.sameHole = !!out.after.hole && out.after.hole === out.before.hole;
  // Whether this was the SAME hand is a DB fact, not an inference from card text.
  out.handsDealtInRoom = 'query game_hands for ' + code;
} catch (e) {
  out.error = String(e).slice(0, 300);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
if (!out.measured) { console.error('MEASURED NOTHING'); process.exit(2); }
