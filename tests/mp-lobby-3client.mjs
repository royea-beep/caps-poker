// VAMOS-CAPS-MP-LOBBY TASK 3E — 3-player smoke (Tier 1: all three reach the synced game).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:8093';
const OUT = 'tests/screenshots/mp-lobby';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[3p]', ...a);

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000);
  await page.goto(BASE + '/lobby', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText(/LOBBY/).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await sleep(1200);
}
const inGame = (page) => page.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 30000 }).then(() => true).catch(() => false);

const browser = await chromium.launch({ headless: true });
const pages = [];
for (let i = 0; i < 3; i++) pages.push(await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage());
const [A, B, C] = pages;
const res = { code: null, a: false, b: false, c: false };
try {
  await Promise.all(pages.map(boot));
  log('A creates 3-player table');
  await A.getByLabel(/Create a 3-player table/i).first().click();
  await A.getByText(/TABLE CODE/i).first().waitFor({ state: 'visible', timeout: 15000 });
  res.code = (await A.getByText(/^[A-Z0-9]{4}$/).first().textContent()).trim();
  log('code', res.code);
  for (const [name, p] of [['B', B], ['C', C]]) {
    const input = p.getByLabel(/Enter a table code/i).first();
    await input.fill(res.code);
    await p.getByLabel(/Join by code/i).first().click();
    log(name, 'joined');
    await sleep(800);
  }
  res.a = await inGame(A); res.b = await inGame(B); res.c = await inGame(C);
  await sleep(1200);
  await A.screenshot({ path: `${OUT}/3p-A-game.png` });
  await B.screenshot({ path: `${OUT}/3p-B-game.png` });
  await C.screenshot({ path: `${OUT}/3p-C-game.png` });
} catch (e) { log('ERROR', e.message); }
finally { log('RESULT', JSON.stringify(res)); await browser.close(); }
