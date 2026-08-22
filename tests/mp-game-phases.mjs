/**
 * multiplayer-game — control by control, phase by phase, with TWO real clients.
 *
 * MP has diverged from solo before, so nothing measured on /game is assumed to transfer. Two
 * contexts join the same heads-up table; it auto-starts when full; client A is surveyed at each
 * phase and client B is surveyed once for a second perspective.
 *
 * CLEANUP IS MANDATORY: a room left in 'playing' DISAPPEARS from the lobby. The room code and both
 * device ids are printed, and the restore is asserted in SQL afterwards — printing it is not doing
 * it.
 *
 *   node tests/mp-game-phases.mjs
 */
import { chromium } from 'playwright';
import { installFire, readyIsArmed, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = 393;

const SURVEY = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 36);
  const exposed = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="switch"]')]
    .filter(vis).map((e) => name(e) + (e.getAttribute('aria-disabled') === 'true' ? ' [DISABLED]' : ''));
  const bare = [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
    .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON').map(name);
  const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    path: location.pathname, head: lines.slice(0, 5), lineCount: lines.length,
    exposed, exposedN: exposed.length, bare, bareN: bare.length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
};

const browser = await chromium.launch({ headless: false });
const mk = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
  const pg = await ctx.newPage();
  pg.on('dialog', async (d) => { console.log(`   [${label}] DIALOG ${d.type()}: ${d.message().slice(0, 60)}`); await d.dismiss(); });
  pg.on('pageerror', (e) => { (pg.__errs ||= []).push(String(e).slice(0, 70)); });
  await pg.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(10000);
  const dev = await pg.evaluate(`localStorage.getItem('caps-device-id')`);
  console.log(`   [${label}] device ${dev}`);
  return { pg, dev, label };
};

const phases = [];
const snap = async (who, label) => {
  const s = await who.pg.evaluate(SURVEY);
  phases.push({ who: who.label, label, ...s });
  console.log(`\n── MP ${who.label} · ${label} · ${s.path} · ${s.lineCount} lines`);
  console.log(`   sees      : ${JSON.stringify(s.head)}`);
  console.log(`   EXPOSED(${s.exposedN}): ${JSON.stringify(s.exposed)}`);
  console.log(`   UNEXPOSED(${s.bareN}): ${JSON.stringify(s.bare.slice(0, 8))}`);
  if (s.overflowX) console.log(`   ⚠ HORIZONTAL OVERFLOW`);
  return s;
};

const A = await mk('A');
const B = await mk('B');

const joinHeadsUp = async (who) => {
  await who.pg.goto(SITE + '/lobby', { waitUntil: 'domcontentloaded' });
  await who.pg.waitForTimeout(8000);
  await installFire(who.pg);
  return who.pg.evaluate(() => {
    const b = [...document.querySelectorAll('button,[role="button"]')]
      .find((x) => /^join table /i.test((x.getAttribute('aria-label') || '').trim()));
    if (!b) return null;
    window.__f(b);
    return (b.getAttribute('aria-label') || '').trim();
  });
};

const jA = await joinHeadsUp(A);
console.log(`\n   A joined: ${JSON.stringify(jA)}`);
await A.pg.waitForTimeout(6000);
await snap(A, 'waiting, 1 of 2 seated');

const jB = await joinHeadsUp(B);
console.log(`\n   B joined: ${JSON.stringify(jB)}`);
await B.pg.waitForTimeout(10000);

// Wait for the auto-start into /multiplayer-game.
let started = false;
for (let i = 0; i < 30 && !started; i++) {
  await A.pg.waitForTimeout(2000);
  started = /multiplayer-game/.test((await where(A.pg)).path);
}
console.log(`\n   reached /multiplayer-game: ${started}`);
if (!started) {
  console.log(`   A is at ${(await where(A.pg)).path}; B is at ${(await where(B.pg)).path}`);
}

if (started) {
  await snap(A, 'MP-P1 dealt / empty boards');
  await snap(B, 'MP-P1 (client B perspective)');

  await installFire(A.pg);
  await A.pg.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
  await A.pg.waitForTimeout(3000);
  await snap(A, 'MP-P3 fully placed');

  const armed = await readyIsArmed(A.pg);
  await snap(A, `MP-P4 ready armed=${armed}`);

  // B places and readies too, so the hand can actually advance.
  await installFire(B.pg);
  await B.pg.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
  await B.pg.waitForTimeout(2500);
  for (const who of [A, B]) {
    await installFire(who.pg);
    await who.pg.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
    await who.pg.waitForTimeout(1200);
  }

  let sawReveal = false;
  for (let i = 0; i < 45; i++) {
    await A.pg.waitForTimeout(1200);
    const w = await where(A.pg);
    if (w.inReveal && !sawReveal) { sawReveal = true; await snap(A, 'MP-P5 during the reveal'); }
    if (w.path === '/results') break;
  }
  if (!sawReveal) console.log(`\n   ⚠ never observed the MP reveal phase`);
  await A.pg.waitForTimeout(3000);
  await snap(A, 'MP-P6 after');
}

console.log(`\n══ MP EXPOSED-CONTROL COUNT PER PHASE`);
for (const p of phases) console.log(`   ${String(p.exposedN).padStart(3)} exposed · ${String(p.bareN).padStart(3)} unexposed · [${p.who}] ${p.label}`);
console.log(`\n   A errs=${(A.pg.__errs || []).length} B errs=${(B.pg.__errs || []).length}`);
console.log(`   ROOM: ${JSON.stringify(jA)}   DEVICES: ${A.dev} , ${B.dev}`);
await browser.close();
