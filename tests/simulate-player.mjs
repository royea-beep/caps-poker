/**
 * A PLAYER, not a screen. One continuous context, never reset between steps.
 *
 * Every previous audit loaded a screen, measured it, and moved on. That is structurally blind to
 * anything that ACCUMULATES: totals that drift over a session, a screen revisited while already
 * dirty, state that survives a reload wrongly. This walks a real first session and then returns
 * as the same player.
 *
 * Runs on BOTH engines because one forgives what the other exposes — the rowGap-on-a-row bug
 * survived forty iterations purely because Chromium ignored it and WebKit did not.
 *
 * Asserts each step actually rendered before recording it: a step that measured nothing looks
 * exactly like a clean step.
 *
 *   ENGINE=webkit node tests/simulate-player.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = (process.env.ENGINE || 'chromium').toLowerCase();
const VW = Number(process.env.VIEWPORT || 390);
const engine = ENGINE === 'webkit' ? webkit : chromium;

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// One snapshot: visible-only, drawer-filtered, decorative-glyph-aware.
const snap = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    if (c.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(c.transform)) return false;
    n = n.parentElement; d++; } return true; };
  const GLYPH = /^([♠♥♦♣]|10|[2-9AKQJC])$/;
  const vw = innerWidth;
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && vis(e));
  const boxes = [];
  let clipped = 0, off = 0;
  for (const e of leaves) {
    const t = (e.textContent || '').trim(); if (!t) continue;
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) clipped++;
    if (r.right > vw + 0.5 || r.left < -0.5) off++;
    if (!GLYPH.test(t)) boxes.push({ t: t.slice(0, 20), l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width * r.height });
  }
  let overlaps = 0; const pairs = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l), oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    if ((ow * oh) / Math.min(A.a, B.a) < 0.35) continue;
    overlaps++; if (pairs.length < 3) pairs.push(A.t + ' / ' + B.t);
  }
  let chips = null, hands = null, device = null;
  try { const s = JSON.parse(localStorage.getItem('caps-poker-storage')).state;
        chips = s.chips; hands = s.handsPlayed; } catch {}
  try { device = localStorage.getItem('caps-device-id'); } catch {}
  return { url: location.pathname, nodes: leaves.length,
           bodyLen: (document.body.innerText || '').trim().length,
           overlaps, pairs, clipped, off, chips, hands, device,
           hasXpBanner: /Hand won!|You won \\d+ chips!/i.test(document.body.innerText || ''),
           hasOuts: /\\d+ OUTS/i.test(document.body.innerText || '') };
})()`;

const browser = await engine.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
// NO SEED — a genuinely cold arrival, exactly what a friend clicking a link gets.
const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));

const steps = [];
let xpBannerSeen = false, outsSeen = false;
const record = async (label) => {
  let s;
  try { s = await measure(page, snap, { label }); }
  catch (e) { steps.push({ label, failed: e instanceof HarnessError ? 'NOT MOUNTED' : String(e).slice(0, 40) }); return null; }
  if (s.hasXpBanner) xpBannerSeen = true;
  if (s.hasOuts) outsSeen = true;
  steps.push({ label, ...s });
  return s;
};

const playHand = async (tag) => {
  await page.goto(`${URL}/game?practice=true&players=3`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2500);
    const s = await page.evaluate(snap);           // raw during the reveal, to catch transient UI
    if (s.hasXpBanner) xpBannerSeen = true;
    if (s.hasOuts) outsSeen = true;
    if (/results/.test(s.url)) break;
  }
  await page.waitForTimeout(3000);
  return record(tag);
};

// ── TASK 1 ────────────────────────────────────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(14000);
const cold = await record('1 cold arrival');

for (let h = 1; h <= 3; h++) await playHand(`3 hand ${h} -> results`);

for (const tab of ['/', '/play', '/friends', '/cups', '/profile']) {
  await page.goto(URL + tab, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(6500);
  await record(`4 tab ${tab}`);
}

await page.goto(URL + '/settings', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(7000);
await record('5 settings');
await page.evaluate(`window.__f=${fire}`);
const speedSet = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^fast$/i.test(((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')).trim()));if(b){window.__f(b);return true;}return false;})()`);
await page.waitForTimeout(2000);
await playHand('5 hand after settings change');

await page.goto(URL + '/lobby', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(8000);
await record('6 lobby');
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(6000);
await record('6 back home');

// ── TASK 2 — the RETURNING player: same context, reloaded ─────────────────────────────────
const before = steps[steps.length - 1];
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(13000);
const after = await record('T2 reopened');
await playHand('T2 hand after return');

await browser.close();

// ── report ────────────────────────────────────────────────────────────────────────────────
console.log(`\n################ ${ENGINE} @${VW} ################`);
if (!steps.length) { console.error('NO STEPS RECORDED — failed run, not a clean one.'); process.exit(2); }
console.log('step                          | url          | nodes | body | ovl | clip | off | chips | hands');
for (const s of steps) {
  if (s.failed) { console.log(`${s.label.padEnd(29)} | *** ${s.failed} ***`); continue; }
  console.log(`${s.label.padEnd(29)} | ${String(s.url).padEnd(12)} | ${String(s.nodes).padStart(5)} | ${String(s.bodyLen).padStart(4)} | ${String(s.overlaps).padStart(3)} | ${String(s.clipped).padStart(4)} | ${String(s.off).padStart(3)} | ${String(s.chips).padStart(5)} | ${String(s.hands).padStart(5)}`);
}
const withPairs = steps.filter((s) => s.pairs && s.pairs.length);
if (withPairs.length) { console.log('\noverlapping pairs seen:'); for (const s of withPairs) console.log(`  ${s.label}: ${JSON.stringify(s.pairs)}`); }
console.log(`\npage errors: ${errs.length ? JSON.stringify([...new Set(errs)].slice(0, 5)) : 'none'}`);
console.log(`device_id stable across the session: ${new Set(steps.filter((s) => s.device).map((s) => s.device)).size === 1}`);
console.log(`settings "Fast" clicked: ${speedSet}`);
console.log(`XP banner seen: ${xpBannerSeen} | outs row seen: ${outsSeen}`);
const handsSeq = steps.filter((s) => s.hands != null).map((s) => s.hands);
const chipSeq = steps.filter((s) => s.chips != null).map((s) => s.chips);
console.log(`handsPlayed sequence: ${JSON.stringify(handsSeq)}`);
console.log(`chips sequence      : ${JSON.stringify(chipSeq)}`);
console.log(`monotonic handsPlayed? ${handsSeq.every((v, i, a) => i === 0 || v >= a[i - 1])}`);
