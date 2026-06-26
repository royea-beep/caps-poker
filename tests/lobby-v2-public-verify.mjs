// VAMOS-CAPS-LOBBY-V2-CLIENT — live 2-client verify on the SEEDED PUBLIC POOL.
// Two isolated contexts (= two distinct anon device-ids):
//   A joins a seeded Heads-Up table via the PUBLIC lobby  -> becomes HOST (first joiner)
//   B joins the SAME table (by its code) via the public lobby -> becomes GUEST
//   fill -> autostart -> both land in the synced /multiplayer-game.
// A 3rd context C joins a 4P public table then LEAVES, to prove a public table is NOT
// deleted on leave. Captures room_codes for DB cross-trace. Screenshots into OUT.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT = 'tests/screenshots/lobby-v2';
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('[verify]', ...a);
const shot = async (p, n) => { try { await p.screenshot({ path: `${OUT}/${n}.png` }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissOverlays(page) {
  for (const label of ['Skip', 'SKIP', 'דלג', 'Got it', 'Continue', 'Maybe later', 'Not now', 'Close', '✕', '×']) {
    try {
      const el = page.getByText(label, { exact: false }).first();
      if (await el.isVisible({ timeout: 200 }).catch(() => false)) { await el.click({ timeout: 400 }).catch(() => {}); await sleep(150); }
    } catch {}
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function bootLobby(page, who) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000); // boot + anon auth + device id
  await dismissOverlays(page);
  await page.goto(BASE + '/lobby', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText(/LOBBY/).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await sleep(2000); // first list_public_tables poll
  await shot(page, `${who}-1-lobby`);
}

// Returns the room code of the first ENABLED "Join table XXXX" button matching a filter,
// after clicking it.
async function joinFirst(page, codeRe, who) {
  const btns = page.getByLabel(/^Join table [A-Z0-9]{4}$/);
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    const label = await b.getAttribute('aria-label').catch(() => '');
    const m = (label || '').match(/Join table ([A-Z0-9]{4})/);
    if (m) {
      const code = m[1];
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        log(`${who}: tapped Join table ${code}`);
        return code;
      }
    }
  }
  return null;
}

async function joinByCode(page, code, who) {
  const btn = page.getByLabel(new RegExp(`^Join table ${code}$`)).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  log(`${who}: tapped Join table ${code}`);
}

const inGame = async (p) => { try { await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 30000 }); return true; } catch { return false; } };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const mk = async () => (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const A = await mk(), B = await mk(), C = await mk();
  const rt = (t) => /\[RT|READY|ROOM_STATE|broadcast|deal|host|presence/i.test(t);
  for (const [tag, pg] of [['A', A], ['B', B], ['C', C]]) {
    pg.on('console', (m) => { const t = m.text(); if (m.type() === 'error') console.log(`[${tag}:err]`, t.slice(0, 180)); else if (rt(t)) console.log(`[${tag}]`, t.slice(0, 140)); });
  }

  const res = { hostCode: null, hostReachedRoom: false, guestJoined: false, hostInGame: false, guestInGame: false, leaveCode: null, leaveDone: false };

  try {
    // ---- PART 1: A host via public Join, B guest joins same table ----
    log('booting A + B into public /lobby');
    await bootLobby(A, 'A');
    await bootLobby(B, 'B');

    // A: join the first available Heads-Up (2P) table. The 2P section renders first, so
    // the first two Join buttons are 2P; take the first.
    res.hostCode = await joinFirst(A, /./, 'A');
    if (!res.hostCode) throw new Error('A found no public table to join');
    await A.getByText(/TABLE CODE/i).first().waitFor({ state: 'visible', timeout: 15000 });
    res.hostReachedRoom = true;
    await shot(A, 'A-2-tableroom');

    // B: join the SAME table from its public lobby (poll refresh shows it at 1/2).
    await joinByCode(B, res.hostCode, 'B');
    res.guestJoined = true;
    await sleep(1500);
    await shot(B, 'B-2-joining');

    // both auto-start into the synced game
    log('waiting for both clients to reach /multiplayer-game...');
    res.hostInGame = await inGame(A);
    res.guestInGame = await inGame(B);
    await sleep(1200);
    await shot(A, 'A-3-game');
    await shot(B, 'B-3-game');
    log('hostInGame=', res.hostInGame, 'guestInGame=', res.guestInGame);

    // ---- PART 2: leave-persistence on a 4P public table ----
    log('booting C into public /lobby for leave test');
    await bootLobby(C, 'C');
    // C: find a 4P table. The 4P section is last; scroll down and pick a Join whose code
    // is a 4P seed. We just take the LAST enabled Join button (4P renders last).
    const btns = C.getByLabel(/^Join table [A-Z0-9]{4}$/);
    const cn = await btns.count();
    for (let i = cn - 1; i >= 0; i--) {
      const b = btns.nth(i);
      const label = await b.getAttribute('aria-label').catch(() => '');
      const m = (label || '').match(/Join table ([A-Z0-9]{4})/);
      if (m && await b.isVisible().catch(() => false)) { res.leaveCode = m[1]; await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click().catch(() => {}); log('C: tapped Join table', res.leaveCode); break; }
    }
    if (res.leaveCode) {
      await C.getByText(/TABLE CODE/i).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      await shot(C, 'C-2-tableroom');
      await sleep(1000);
      // Leave the table -> leaveTable RPC (public tables must NOT be deleted).
      const leave = C.getByLabel(/Leave table/i).first();
      if (await leave.isVisible({ timeout: 4000 }).catch(() => false)) { await leave.click().catch(() => {}); res.leaveDone = true; log('C: left the table'); }
      await sleep(2000);
      await shot(C, 'C-3-afterleave');
    }
  } catch (e) {
    log('ERROR:', e.message);
    await shot(A, 'A-error'); await shot(B, 'B-error'); await shot(C, 'C-error');
  } finally {
    log('RESULT', JSON.stringify(res));
    writeFileSync(`${OUT}/result.json`, JSON.stringify(res, null, 2));
    await browser.close();
  }
}

run();
