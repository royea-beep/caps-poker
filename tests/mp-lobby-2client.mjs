// VAMOS-CAPS-MP-LOBBY TASK 3E — 2-client runtime verify.
// Drives two browser contexts (host + guest) through: lobby -> create/join table ->
// realtime auto-start -> both land in the synced /multiplayer-game. Best-effort plays
// a hand to /results. Screenshots every step into tests/screenshots/mp-lobby/.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://localhost:8093';
const OUT = 'tests/screenshots/mp-lobby';
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('[harness]', ...a);
const shot = async (page, name) => { try { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissOverlays(page) {
  // Best-effort: clear first-run landing/tutorial/daily overlays that cover fresh contexts.
  for (const label of ['Skip', 'SKIP', 'Close', '✕', '×', 'X', 'Got it', 'Continue', 'Maybe later', 'Not now', 'דלג', 'סגור']) {
    try {
      const el = page.getByText(label, { exact: false }).first();
      if (await el.isVisible({ timeout: 250 }).catch(() => false)) { await el.click({ timeout: 500 }).catch(() => {}); await sleep(200); }
    } catch {}
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function gotoLobby(page, who) {
  // Boot the app at root first so supabase client + device id + (anon) auth initialize.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000); // boot + anon auth
  // Then navigate to the lobby (SPA fallback serves it on a hard load too).
  await page.goto(BASE + '/lobby', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText(/LOBBY/).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await sleep(1500);
  await shot(page, `${who}-1-lobby`);
}

async function clickByLabel(page, labelRe, timeout = 8000) {
  const el = page.getByLabel(labelRe).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.click();
}

async function waitForText(page, re, timeout = 20000) {
  await page.getByText(re).first().waitFor({ state: 'visible', timeout });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const rtFilter = (t) => /\[RT |READY|countdown|ALL_READY|ROOM_STATE|broadcast/i.test(t);
  A.on('console', (m) => { const t = m.text(); if (m.type() === 'error') console.log('[A:err]', t.slice(0, 200)); else if (rtFilter(t)) console.log('[A]', t.slice(0, 160)); });
  B.on('console', (m) => { const t = m.text(); if (m.type() === 'error') console.log('[B:err]', t.slice(0, 200)); else if (rtFilter(t)) console.log('[B]', t.slice(0, 160)); });

  const result = { hostReachedRoom: false, code: null, guestJoined: false, hostInGame: false, guestInGame: false, hostResults: false, guestResults: false };

  try {
    log('booting both clients into /lobby...');
    await gotoLobby(A, 'A');
    await gotoLobby(B, 'B');

    // --- A creates a Heads-Up (2P) table ---
    log('A: create 2-player table');
    await clickByLabel(A, /Create a 2-player table/i);
    await waitForText(A, /TABLE CODE/i, 15000);
    result.hostReachedRoom = true;
    await shot(A, 'A-2-tableroom');

    // read the 4-char code from the table room
    const codeText = await A.getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => null);
    result.code = (codeText || '').trim();
    log('A: table code =', result.code);

    // --- B joins by code ---
    log('B: join by code', result.code);
    const input = B.getByLabel(/Enter a table code/i).first();
    await input.waitFor({ state: 'visible', timeout: 8000 });
    await input.fill(result.code);
    await clickByLabel(B, /Join by code/i);
    result.guestJoined = true;
    await sleep(1500);
    await shot(B, 'B-2-joining');

    // --- both should auto-start into the synced game ---
    log('waiting for both clients to reach /multiplayer-game...');
    // The game screen shows the board / "Place ... cards" / READY area; detect by URL + boards.
    const inGame = async (page) => {
      try {
        await page.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 25000 });
        return true;
      } catch { return false; }
    };
    result.hostInGame = await inGame(A);
    result.guestInGame = await inGame(B);
    await sleep(1500);
    await shot(A, 'A-3-game');
    await shot(B, 'B-3-game');
    log('hostInGame=', result.hostInGame, 'guestInGame=', result.guestInGame);

    // --- Tier 2 (best effort): A places all cards + READY; guest B auto-fills on
    // timeout (exercises the TASK 3D placement-timer fix); both -> /results ---
    if (result.hostInGame && result.guestInGame) {
      log('Tier 2: A places 16 cards via board testIDs...');
      const boardCount = await A.locator('[data-testid^="board-"]').count().catch(() => 0);
      log('A: board count =', boardCount);
      // 4 cards per board. Click each board until full (extra clicks are no-ops).
      for (let i = 0; i < boardCount; i++) {
        const board = A.locator(`[data-testid="board-${i}"]`).first();
        for (let c = 0; c < 4; c++) {
          await board.click({ timeout: 1500, position: { x: 30, y: 60 } }).catch(() => {});
          await sleep(150);
        }
      }
      await shot(A, 'A-4-placed');
      // READY appears after the 30s free-time window — wait for it, then press.
      const ready = A.getByText(/^READY$/).first();
      const gotReady = await ready.waitFor({ state: 'visible', timeout: 40000 }).then(() => true).catch(() => false);
      log('A: READY visible =', gotReady);
      if (gotReady) { await ready.click().catch(() => {}); log('A: pressed READY'); }
      await sleep(800);
      await shot(A, 'A-5-afterready');
      // Both should reach /results: A immediately after reveal, B via 30s countdown
      // auto-fill (it never placed) then host reveal.
      const onResults = async (page) => {
        try { await page.waitForFunction(() => location.pathname.includes('results'), { timeout: 60000 }); return true; } catch { return false; }
      };
      result.hostResults = await onResults(A);
      result.guestResults = await onResults(B);
      await sleep(1500);
      await shot(A, 'A-6-results');
      await shot(B, 'B-6-results');
      log('hostResults=', result.hostResults, 'guestResults=', result.guestResults);
    }
  } catch (e) {
    log('ERROR:', e.message);
    await shot(A, 'A-error');
    await shot(B, 'B-error');
  } finally {
    log('RESULT', JSON.stringify(result, null, 2));
    await browser.close();
  }
}

run();
