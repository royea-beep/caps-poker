// FUNNEL VERIFICATION — play a real hand on each route on the LIVE build, using IN-APP navigation
// only (one page load per context). A page.goto to /game creates a NEW JS context and therefore a
// new analytics session, which is not what a player does and would defeat the once-per-session
// guard on game_started.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';

async function dismissOnboarding(page) {
  for (let i = 0; i < 4; i++) {
    let clicked = false;
    for (const label of ['Skip', 'Got it', 'Start playing', 'Continue']) {
      const l = page.getByText(label, { exact: false }).first();
      if (await l.count().catch(() => 0)) { await l.click({ timeout: 3000 }).catch(() => {}); clicked = true; await page.waitForTimeout(700); }
    }
    if (!clicked) break;
  }
}

async function playHand(page, log) {
  const auto = page.getByLabel('Auto-place all boards').first();
  await auto.waitFor({ state: 'visible', timeout: 40000 });
  await auto.click();
  log.push('auto-place-all');
  await page.waitForTimeout(900);
  const ready = page.getByTestId('ready-button').first();
  await ready.waitFor({ state: 'visible', timeout: 20000 });
  await ready.click();
  log.push('ready');
  // The reveal advances board-by-board on a tap. Poll slowly — a 1.2s click loop crashed the
  // renderer on the previous attempt.
  for (let i = 0; i < 45 && !page.url().includes('/results'); i++) {
    await page.waitForTimeout(2500);
    if (page.url().includes('/results')) break;
    const hint = page.getByTestId('reveal-tap-hint').first();
    const surface = page.getByTestId('reveal-skip-surface').first();
    if (await hint.count().catch(() => 0)) await hint.click({ timeout: 2000 }).catch(() => {});
    else if (await surface.count().catch(() => 0)) await surface.click({ timeout: 2000 }).catch(() => {});
  }
  const ok = page.url().includes('/results');
  log.push(ok ? '/results' : `STUCK ${page.url()}`);
  return ok;
}

async function backHome(page, log) {
  const b = page.getByLabel('Back to home').first();
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); log.push('back to home'); }
  await page.waitForTimeout(3500);
}

async function run(engine, engineName, route) {
  const b = await engine.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const log = [];
  const out = { route: route.name, engine: engineName };
  try {
    // Seed the first-run flags the same way tests/visual-proof.mjs does, so the run starts on Home
    // as a returning player rather than inside onboarding's guided hand.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('hasSeenOnboarding', 'true');
        localStorage.setItem('guidedModeForced', 'false');
      } catch { /* ignore */ }
    });
    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await dismissOnboarding(page);
    out.deviceId = await page.evaluate(() => localStorage.getItem('caps-device-id'));

    // Onboarding deals a guided hand. Finish it, then return home IN-APP for the route proper.
    if (page.url().includes('/game')) { log.push('onboarding hand in progress'); await playHand(page, log); await backHome(page, log); }

    if (route.viaLobby) {
      const online = page.getByLabel('Play online, open the multiplayer lobby').first();
      await online.waitFor({ state: 'visible', timeout: 20000 });
      await online.click();
      log.push('opened lobby');
      await page.waitForTimeout(6000);
      // The instant bot rows read "🤖 BOT · Practice vs Bots · 2P · 4 boards · instant · Play now"
      const play = page.getByText('Play now', { exact: false });
      const n = await play.count().catch(() => 0);
      if (n) { await play.nth(route.botRow ?? 0).click(); log.push(`tapped bot table row ${route.botRow ?? 0} of ${n}`); }
      else {
        const txt = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
        log.push(`no Play now row; lobby text: ${txt}`);
      }
      await page.waitForTimeout(5000);
    } else {
      const sel = page.getByLabel(`${route.players} players`).first();
      await sel.waitFor({ state: 'visible', timeout: 20000 });
      await sel.click();
      log.push(`selected ${route.players} players`);
      await page.waitForTimeout(800);
      const play = page.getByLabel('Play', { exact: true }).first();
      await play.click();
      log.push('tapped Play');
      await page.waitForTimeout(6000);
    }
    out.url = page.url();
    out.completed = await playHand(page, log);
  } catch (e) {
    out.error = String(e).slice(0, 240);
  }
  out.log = log;
  await b.close();
  return out;
}

const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const engineName = process.env.ENGINE === 'webkit' ? 'webkit' : 'chromium';
const routes = [
  { name: '2P practice', players: 2 },
  { name: '3P practice', players: 3 },
  { name: 'lobby bot table', viaLobby: true },
];
const results = [];
for (const r of routes) results.push(await run(engine, engineName, r));
console.log(JSON.stringify(results, null, 1));
if (results.some((r) => r.error || !r.completed)) { console.error('INCOMPLETE RUN'); process.exit(2); }
