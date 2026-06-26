// VAMOS-CAPS-PLACEMENT-UI-FIX — live placement-screen verify.
// Two contexts at different widths (A=320 narrow Android, B=390 iPhone) join the public
// pool 2P table -> both reach /multiplayer-game placement. A sends an emote so B shows a
// chat bubble. Screenshots both at placement to confirm: hand fully visible, emote strip
// in its own row (not over cards), bubble at the top (off the board), no collision.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT = 'tests/screenshots/placement-verify';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[placement]', ...a);
const shot = async (p, n) => { try { await p.screenshot({ path: `${OUT}/${n}.png` }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismiss(page) {
  for (const l of ['Skip', 'SKIP', 'דלג', 'Got it', 'Continue', 'Maybe later', 'Not now', 'Close', '✕', '×']) {
    try { const e = page.getByText(l, { exact: false }).first(); if (await e.isVisible({ timeout: 200 }).catch(() => false)) { await e.click({ timeout: 400 }).catch(() => {}); await sleep(120); } } catch {}
  }
  await page.keyboard.press('Escape').catch(() => {});
}
async function bootLobby(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000); await dismiss(page);
  await page.goto(BASE + '/lobby', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText(/LOBBY/).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await sleep(2000);
}
const inArranging = async (p) => {
  try {
    await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 30000 });
    await p.locator('[data-testid^="board-"]').first().waitFor({ state: 'visible', timeout: 20000 });
    return true;
  } catch { return false; }
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const A = await (await browser.newContext({ viewport: { width: 320, height: 720 } })).newPage(); // narrow Android
  const B = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); // iPhone
  const res = { hostCode: null, hostArranging: false, guestArranging: false, emoteSent: false };

  try {
    await bootLobby(A); await bootLobby(B);
    // A joins first public 2P table -> host
    const firstJoin = A.getByLabel(/^Join table [A-Z0-9]{4}$/).first();
    const lbl = await firstJoin.getAttribute('aria-label').catch(() => '');
    res.hostCode = (lbl || '').match(/Join table ([A-Z0-9]{4})/)?.[1] || null;
    await firstJoin.click();
    await A.getByText(/TABLE CODE/i).first().waitFor({ state: 'visible', timeout: 15000 });
    log('A host on', res.hostCode);
    // B joins same table
    await B.getByLabel(new RegExp(`^Join table ${res.hostCode}$`)).first().click();
    log('B joined', res.hostCode);

    res.hostArranging = await inArranging(A);
    res.guestArranging = await inArranging(B);
    await sleep(1500);
    await shot(A, 'A-320-placement');
    await shot(B, 'B-390-placement');
    log('hostArranging', res.hostArranging, 'guestArranging', res.guestArranging);

    // A sends an emote -> B shows a top bubble
    if (res.hostArranging && res.guestArranging) {
      const emote = A.getByLabel(/Send .* emote/).first();
      if (await emote.isVisible({ timeout: 4000 }).catch(() => false)) { await emote.click().catch(() => {}); res.emoteSent = true; log('A sent emote'); }
      await sleep(1200);
      await shot(A, 'A-320-after-emote');
      await shot(B, 'B-390-with-bubble');
    }
  } catch (e) {
    log('ERROR', e.message); await shot(A, 'A-err'); await shot(B, 'B-err');
  } finally {
    log('RESULT', JSON.stringify(res));
    await browser.close();
  }
}
run();
