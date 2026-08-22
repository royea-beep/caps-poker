/**
 * GAME SCREEN, CONTROL BY CONTROL, PHASE BY PHASE.
 *
 * A single pass over /game is not an enumeration: a control's presence AND meaning change with the
 * phase of the hand. This walks one real hand and surveys at every phase:
 *
 *   P1 dealt / empty        P2 partly placed        P3 fully placed
 *   P4 ready armed          P5 during the reveal    P6 after (results)
 *
 * For each phase it records what the page EXPOSES as an operable control (role + accessible name),
 * what is focusable but exposed as nothing, and the route. Anchored on declared roles and labels —
 * never on shape, position, or "things that look like a button".
 *
 * This ENUMERATES every phase. It does not operate every control at every phase: reaching a
 * mid-hand phase costs a full hand, so operating N controls x 6 phases from fresh loads is a
 * different budget. Controls that are operated are marked; everything else is reported as
 * enumerated-not-operated, which is the honest boundary.
 *
 *   ENGINE=webkit VIEWPORT=430 node tests/game-phases.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire, readyIsArmed, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const PLAYERS = process.env.PLAYERS || '3';
const engine = ENGINE === 'chromium' ? chromium : webkit;
const tag = `${ENGINE}/${VW}/${PLAYERS}p`;

const browser = await engine.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: 900 } })).newPage();
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 70)}`); await d.dismiss(); });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));

const SURVEY = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34);
  const exposed = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="switch"],[role="link"]')]
    .filter(vis).map((e) => `${e.getAttribute('role') || e.tagName.toLowerCase()}:${name(e)}` +
      (e.getAttribute('aria-disabled') === 'true' || e.disabled ? ' [DISABLED]' : ''));
  const bare = [...document.querySelectorAll('[tabindex="0"]')]
    .filter(vis).filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON').map(name);
  const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    path: location.pathname,
    head: lines.slice(0, 4),
    lineCount: lines.length,
    exposed, exposedN: exposed.length,
    bare, bareN: bare.length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollW: document.documentElement.scrollWidth,
  };
};

const phases = [];
const snap = async (label) => {
  const s = await page.evaluate(SURVEY);
  phases.push({ label, ...s });
  console.log(`\n── ${tag} · ${label} · ${s.path} · ${s.lineCount} lines`);
  console.log(`   sees      : ${JSON.stringify(s.head)}`);
  console.log(`   EXPOSED(${s.exposedN}): ${JSON.stringify(s.exposed)}`);
  console.log(`   UNEXPOSED(${s.bareN}): ${JSON.stringify(s.bare.slice(0, 10))}`);
  if (s.overflowX) console.log(`   ⚠ HORIZONTAL OVERFLOW: scrollWidth ${s.scrollW} > viewport ${VW}`);
  return s;
};

await page.goto(`${SITE}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
await snap('P1 dealt / empty boards');

// P2 — partly placed: ONE per-board chip only (never the ALL control).
await installFire(page);
const oneBoard = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>{const t=(x.getAttribute('aria-label')||'')+' '+(x.textContent||'');
            return /auto.?place/i.test(t) && !/all/i.test(t);});
  if(!b) return false; window.__f(b); return true;})()`);
await page.waitForTimeout(2500);
await snap(`P2 partly placed (one board filled=${oneBoard})`);

// P3 — fully placed
await installFire(page);
const all = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
  if(!b) return false; window.__f(b); return true;})()`);
await page.waitForTimeout(3000);
await snap(`P3 fully placed (auto-place all=${all})`);

// P4 — ready armed
let armed = false;
for (let i = 0; i < 20 && !armed; i++) { armed = await readyIsArmed(page); if (!armed) await page.waitForTimeout(500); }
await snap(`P4 ready armed=${armed}`);

// P5 — during the reveal
await installFire(page);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
let sawReveal = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1200);
  const w = await where(page);
  if (w.inReveal && !sawReveal) { sawReveal = true; await snap('P5 during the reveal'); }
  if (w.path === '/results') break;
}
if (!sawReveal) console.log(`\n   ⚠ never observed the reveal phase`);

// P6 — after
await page.waitForTimeout(3000);
await snap('P6 after (results)');

console.log(`\n══ ${tag} EXPOSED-CONTROL COUNT PER PHASE`);
for (const p of phases) console.log(`   ${String(p.exposedN).padStart(3)} exposed · ${String(p.bareN).padStart(3)} unexposed · ${p.label}`);
console.log(`   reveal navigable (exposed>0 during P5): ${phases.find((p) => /P5/.test(p.label))?.exposedN > 0 ? 'YES' : 'NO'}`);
console.log(`   dialogs=${JSON.stringify(dialogs)} pageerrors=${errs.length}`);
if (errs.length) console.log(`   errors: ${JSON.stringify(errs.slice(0, 3))}`);
console.log(`   DEVICE: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await browser.close();
