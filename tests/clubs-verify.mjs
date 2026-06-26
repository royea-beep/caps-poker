// VAMOS-CAPS-FRIENDS-CLUBS — live 2-context club verify (prod).
// A creates a club -> code. B joins by code -> both members. A starts a 2P club table.
// C (non-member) must NOT see it; B (member) sees + joins. A+B play one hand -> results
// -> the club mini-league updates. Captures club_code + room_code for DB trace.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT = 'tests/screenshots/clubs';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[clubs]', ...a);
const shot = async (p, n) => { try { await p.screenshot({ path: `${OUT}/${n}.png` }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismiss(page) {
  for (const l of ['Skip', 'SKIP', 'דלג', 'Got it', 'Continue', 'Maybe later', 'Not now', 'Close', '✕', '×']) {
    try { const e = page.getByText(l, { exact: false }).first(); if (await e.isVisible({ timeout: 200 }).catch(() => false)) { await e.click({ timeout: 400 }).catch(() => {}); await sleep(120); } } catch {}
  }
  await page.keyboard.press('Escape').catch(() => {});
}
async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000); await dismiss(page);
}
async function gotoFriends(page) {
  await page.goto(BASE + '/friends', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText(/CLUBS/).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await sleep(1200);
}
const codeFromUrl = (page) => { const m = page.url().match(/\/club\/([A-Z0-9]{4})/i); return m ? m[1].toUpperCase() : null; };
const roomFromUrl = (page) => { const m = page.url().match(/roomCode=([A-Z0-9]{4})/i); return m ? m[1].toUpperCase() : null; };
const inGame = async (p) => { try { await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 30000 }); return true; } catch { return false; } };
const onResults = async (p) => { try { await p.waitForFunction(() => location.pathname.includes('results'), { timeout: 70000 }); return true; } catch { return false; } };

async function playHand(A) {
  // A places 16 cards via board testIDs, waits for READY, presses it. B auto-fills on timeout.
  const boards = await A.locator('[data-testid^="board-"]').count().catch(() => 0);
  log('A board count', boards);
  for (let i = 0; i < boards; i++) {
    const b = A.locator(`[data-testid="board-${i}"]`).first();
    for (let c = 0; c < 4; c++) { await b.click({ timeout: 1500, position: { x: 30, y: 60 } }).catch(() => {}); await sleep(150); }
  }
  const ready = A.getByText(/^READY$/).first();
  const got = await ready.waitFor({ state: 'visible', timeout: 45000 }).then(() => true).catch(() => false);
  if (got) { await ready.click().catch(() => {}); log('A pressed READY'); }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const mk = async () => (await browser.newContext({ viewport: { width: 430, height: 920 } })).newPage();
  const A = await mk(), B = await mk(), C = await mk();
  for (const [t, p] of [['A', A], ['B', B], ['C', C]]) p.on('console', (m) => { if (m.type() === 'error') { const x = m.text(); if (!/message channel closed/i.test(x)) console.log(`[${t}:err]`, x.slice(0, 160)); } });

  const res = { clubCode: null, bJoined: false, bSeesClub: false, roomCode: null, memberSeesTable: false, nonMemberSeesTable: null, hostInGame: false, guestInGame: false, hostResults: false, guestResults: false };
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  const clubName = `QAClub${suffix}`;

  try {
    await boot(A); await boot(B); await boot(C);

    // A creates a club
    await gotoFriends(A);
    await A.getByLabel(/New club name/i).fill(clubName);
    await A.getByLabel(/^Create club$/i).click();
    await A.waitForFunction(() => location.pathname.startsWith('/club/'), { timeout: 15000 }).catch(() => {});
    res.clubCode = codeFromUrl(A);
    log('A created club', clubName, '=>', res.clubCode);
    await shot(A, 'A-club');
    if (!res.clubCode) throw new Error('no club code');

    // B joins by code
    await gotoFriends(B);
    await B.getByLabel(/Club code to join/i).fill(res.clubCode);
    await B.getByLabel(/^Join club$/i).click();
    await B.waitForFunction(() => location.pathname.startsWith('/club/'), { timeout: 15000 }).catch(() => {});
    res.bJoined = codeFromUrl(B) === res.clubCode;
    log('B joined =>', codeFromUrl(B));
    // B's my_clubs shows the club
    await gotoFriends(B);
    res.bSeesClub = await B.getByText(new RegExp(`#${res.clubCode}`)).first().isVisible({ timeout: 6000 }).catch(() => false);
    await shot(B, 'B-myclubs');

    // A starts a 2P club table
    await A.goto(`${BASE}/club/${res.clubCode}?name=${encodeURIComponent(clubName)}`, { waitUntil: 'domcontentloaded' });
    await A.getByLabel(/Start a 2-player club table/i).first().waitFor({ state: 'visible', timeout: 12000 });
    await A.getByLabel(/Start a 2-player club table/i).first().click();
    await A.waitForFunction(() => location.pathname.includes('/lobby/table'), { timeout: 15000 }).catch(() => {});
    res.roomCode = roomFromUrl(A);
    log('A started club table', res.roomCode);
    await shot(A, 'A-tableroom');

    // C (non-member) opens the club by code -> must NOT see the table
    await C.goto(`${BASE}/club/${res.clubCode}?name=${encodeURIComponent(clubName)}`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    res.nonMemberSeesTable = res.roomCode ? await C.getByLabel(new RegExp(`Join club table ${res.roomCode}`)).first().isVisible({ timeout: 3000 }).catch(() => false) : null;
    await shot(C, 'C-nonmember');
    log('C (non-member) sees table =', res.nonMemberSeesTable);

    // B (member) opens the club -> sees + joins the table
    await B.goto(`${BASE}/club/${res.clubCode}?name=${encodeURIComponent(clubName)}`, { waitUntil: 'domcontentloaded' });
    const joinBtn = B.getByLabel(new RegExp(`Join club table ${res.roomCode}`)).first();
    res.memberSeesTable = await joinBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    log('B (member) sees table =', res.memberSeesTable);
    if (res.memberSeesTable) await joinBtn.click();
    await shot(B, 'B-join');

    // both auto-start into the synced club game
    res.hostInGame = await inGame(A);
    res.guestInGame = await inGame(B);
    await sleep(1200);
    await shot(A, 'A-game'); await shot(B, 'B-game');
    log('hostInGame', res.hostInGame, 'guestInGame', res.guestInGame);

    // play one hand -> both to results (so record_club_result fires)
    if (res.hostInGame && res.guestInGame) {
      await playHand(A);
      res.hostResults = await onResults(A);
      res.guestResults = await onResults(B);
      await sleep(1500);
      await shot(A, 'A-results'); await shot(B, 'B-results');
      log('hostResults', res.hostResults, 'guestResults', res.guestResults);
    }
  } catch (e) {
    log('ERROR', e.message); await shot(A, 'A-err'); await shot(B, 'B-err'); await shot(C, 'C-err');
  } finally {
    log('RESULT', JSON.stringify(res));
    writeFileSync(`${OUT}/result.json`, JSON.stringify({ ...res, clubName }, null, 2));
    await browser.close();
  }
}
run();
