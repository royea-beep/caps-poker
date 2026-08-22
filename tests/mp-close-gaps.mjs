/**
 * CLOSE-THE-GAPS — the three lobby/MP states handoff 95 named as boundaries.
 *
 *   A. TWO SEATED, then SOMEONE LEAVES. Uses a 3-max table so the room does NOT auto-start,
 *      which is the only way to hold "two players seated" still enough to survey, and to watch
 *      what the REMAINING player sees when the other one goes.
 *   B. FULL TABLE + AUTO-START, measured CLEAN. Uses a 2-max table. No game_rooms row is touched
 *      before, during or after — the previous attempt's confound was my own manual restore
 *      between runs, so this run must not edit anything for its result to mean anything.
 *   C. MP PHASE COUNTS AFTER the ready-button/Cancel/per-board-chip fix, both clients.
 *
 * NOTHING in this file writes to the database. Rooms are left exactly as the app leaves them.
 *
 *   node tests/mp-close-gaps.mjs
 */
import { chromium } from 'playwright';
import { installFire, readyIsArmed, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = 393;

const SURVEY = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const exposed = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="switch"]')]
    .filter(vis).map((e) => name(e) + (e.getAttribute('aria-disabled') === 'true' || e.disabled ? ' [DISABLED]' : ''));
  const bare = [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
    .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON').map(name);
  const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  return { path: location.pathname, head: lines.slice(0, 7), lineCount: lines.length,
           exposed, exposedN: exposed.length, bare, bareN: bare.length };
};

const browser = await chromium.launch({ headless: false });
const mk = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
  const pg = await ctx.newPage();
  pg.__errs = [];
  pg.on('dialog', async (d) => { console.log(`   [${label}] DIALOG ${d.type()}: ${d.message().slice(0, 60)}`); await d.dismiss(); });
  pg.on('pageerror', (e) => pg.__errs.push(String(e).slice(0, 70)));
  await pg.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(10000);
  const dev = await pg.evaluate(`localStorage.getItem('caps-device-id')`);
  console.log(`   [${label}] device ${dev}`);
  return { pg, dev, label };
};

const snap = async (who, label) => {
  const s = await who.pg.evaluate(SURVEY);
  console.log(`\n── [${who.label}] ${label} · ${s.path} · ${s.lineCount} lines`);
  console.log(`   sees      : ${JSON.stringify(s.head)}`);
  console.log(`   EXPOSED(${s.exposedN}): ${JSON.stringify(s.exposed)}`);
  console.log(`   UNEXPOSED(${s.bareN}): ${JSON.stringify(s.bare.slice(0, 8))}`);
  return s;
};

/** Join a table whose declared label matches `pick` (a regex on the aria-label). */
const join = async (who, pick) => {
  await who.pg.goto(SITE + '/lobby', { waitUntil: 'domcontentloaded' });
  await who.pg.waitForTimeout(8000);
  await installFire(who.pg);
  return who.pg.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const b = [...document.querySelectorAll('button,[role="button"]')]
      .filter((x) => /^join table /i.test((x.getAttribute('aria-label') || '').trim()))
      .find((x) => re.test((x.getAttribute('aria-label') || '').trim()));
    if (!b) return null;
    window.__f(b);
    return (b.getAttribute('aria-label') || '').trim();
  }, pick);
};

const A = await mk('A');
const B = await mk('B');

// ══ A. TWO SEATED ON A 3-MAX TABLE, THEN ONE LEAVES ═══════════════════════════
console.log(`\n════════ A. TWO SEATED, THEN SOMEONE LEAVES (3-max table, no auto-start) ════════`);
const THREE = 'CZ9Z|SWKR';
console.log(`   A joins: ${JSON.stringify(await join(A, THREE))}`);
await A.pg.waitForTimeout(7000);
await snap(A, 'ONE seated');
console.log(`   B joins: ${JSON.stringify(await join(B, THREE))}`);
await B.pg.waitForTimeout(9000);
const aTwo = await snap(A, 'TWO seated — the remaining player, before anyone leaves');
await snap(B, 'TWO seated — the joiner');

// B gives up the seat. A must notice.
await installFire(B.pg);
const bLeft = await B.pg.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/leave table/i.test(x.getAttribute('aria-label')||'')); if(!b) return false; window.__f(b); return true;})()`);
console.log(`\n   B tapped "Leave table and give up your seat": ${bLeft}`);
await A.pg.waitForTimeout(10000);
const aAfter = await snap(A, 'AFTER the other player left — what A sees now');
console.log(`   did A's screen change? seated-line before=${JSON.stringify(aTwo.head.find((l) => /seated/i.test(l)))} after=${JSON.stringify(aAfter.head.find((l) => /seated/i.test(l)))}`);

// A leaves too, so nothing is held.
await installFire(A.pg);
await A.pg.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/leave table/i.test(x.getAttribute('aria-label')||'')); if(b) window.__f(b);})()`);
await A.pg.waitForTimeout(6000);

// ══ B. FULL TABLE + AUTO-START, CLEAN ════════════════════════════════════════
console.log(`\n════════ B. FULL TABLE + AUTO-START, CLEAN (2-max, no DB edits anywhere) ════════`);
const TWO = process.env.TWO_MAX || 'YZQ3|GEH6|WKZS';
console.log(`   A joins: ${JSON.stringify(await join(A, TWO))}`);
await A.pg.waitForTimeout(7000);
console.log(`   B joins: ${JSON.stringify(await join(B, TWO))}`);

// Catch the FULL state before auto-start pulls both clients away.
let full = null;
for (let i = 0; i < 24; i++) {
  await A.pg.waitForTimeout(700);
  const w = await where(A.pg);
  if (/lobby\/table/.test(w.path)) full = await A.pg.evaluate(SURVEY);
  else break;
}
if (full) {
  console.log(`\n── [A] FULL TABLE (last frame before auto-start) · ${full.path}`);
  console.log(`   sees      : ${JSON.stringify(full.head)}`);
  console.log(`   EXPOSED(${full.exposedN}): ${JSON.stringify(full.exposed)}`);
  console.log(`   UNEXPOSED(${full.bareN}): ${JSON.stringify(full.bare)}`);
}

let started = false;
for (let i = 0; i < 40 && !started; i++) {
  await A.pg.waitForTimeout(1500);
  started = /multiplayer-game/.test((await where(A.pg)).path);
}
console.log(`\n   AUTO-START -> /multiplayer-game: ${started}`);
console.log(`   A at ${(await where(A.pg)).path} · B at ${(await where(B.pg)).path}`);

// ══ C. MP PHASE COUNTS AFTER THE FIX ═════════════════════════════════════════
if (started) {
  console.log(`\n════════ C. MP PHASES AFTER THE FIX ════════`);
  const p1a = await snap(A, 'MP-P1 dealt');
  const p1b = await snap(B, 'MP-P1 dealt (client B)');
  await installFire(A.pg);
  await A.pg.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
  await A.pg.waitForTimeout(3000);
  const p3 = await snap(A, 'MP-P3 fully placed');
  const armed = await readyIsArmed(A.pg);
  const p4 = await snap(A, `MP-P4 ready armed=${armed}`);

  const named = (s, re) => s.exposed.filter((x) => re.test(x));
  console.log(`\n══ NAMED IN MP AFTER THE FIX`);
  console.log(`   ready-button        : ${JSON.stringify(named(p4, /READY|Confirm/i))}`);
  console.log(`   Cancel              : ${JSON.stringify(named(p4, /Cancel/i))}`);
  console.log(`   per-board chips     : ${JSON.stringify(named(p1a, /Auto-Place — Board/i))}`);
  console.log(`   client B P1 matches A: ${p1b.exposedN === p1a.exposedN}`);
  console.log(`\n══ MP PHASE COUNTS AFTER`);
  for (const [l, s] of [['MP-P1 [A]', p1a], ['MP-P1 [B]', p1b], ['MP-P3', p3], ['MP-P4', p4]]) {
    console.log(`   ${String(s.exposedN).padStart(3)} exposed · ${String(s.bareN).padStart(3)} unexposed · ${l}`);
  }
}

console.log(`\n   A errs=${A.pg.__errs.length} B errs=${B.pg.__errs.length}`);
console.log(`   DEVICES: ${A.dev} , ${B.dev}`);
console.log(`   NOTE: no game_rooms or room_players row was written by this script.`);
await browser.close();
