/**
 * The home screen's first 200px — render order, duplicates, and the primary action's position.
 *
 * Reports each node's CONTAINER box (the painting ancestor), not the text node — Cancel's
 * container measured 2.7x its text node, so text-node geometry understates badly.
 *
 * Also reports, for every candidate duplicate, whether it is actually VISIBLE: the side menu is
 * parked off-screen behind `transform: matrix(1,0,0,1,293,0)` with `pointerEvents: none`, and
 * 22 of its items previously read as "off-screen findings" when they are by design. A duplicate
 * that only exists in a hidden drawer is not a duplicate on screen.
 *
 * Asserts it collected nodes before reporting — a run that measures nothing looks identical to
 * a clean one.
 *
 *   VIEWPORT=390 node tests/home-fold.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const TAG = process.env.TAG || 'now';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const hiddenBy = (el) => {
    let n = el, d = 0;
    while (n && d < 12) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 'display/visibility';
      if (parseFloat(cs.opacity) === 0) return 'opacity 0';
      if (cs.transform && cs.transform !== 'none' && /matrix\\(1, 0, 0, 1, [1-9]/.test(cs.transform)) return 'translated ' + cs.transform;
      if (cs.pointerEvents === 'none' && cs.position === 'absolute') return 'pointerEvents none';
      n = n.parentElement; d++;
    }
    return null;
  };
  const paints = (el) => { const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    return ((bg && bg !== 'rgba(0, 0, 0, 0)') || parseFloat(cs.borderTopWidth) > 0) && parseFloat(cs.borderTopLeftRadius) > 0; };
  const container = (el) => { let n = el, d = 0; while (n && d < 6) { if (paints(n)) return n; n = n.parentElement; d++; } return el; };
  const boxOf = (el) => { const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom),
             w: Math.round(r.width), h: Math.round(r.height) }; };

  const nodes = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const hid = hiddenBy(el);
    nodes.push({ t: t.slice(0, 30), box: boxOf(el), cbox: boxOf(container(el)), hidden: hid });
  }
  nodes.sort((a, b) => a.box.t - b.box.t || a.box.l - b.box.l);

  const visible = nodes.filter((n) => !n.hidden);
  const fold = visible.filter((n) => n.box.t < 200);
  const practice = visible.find((n) => /Practice vs Bots/i.test(n.t));
  const chipish = visible.filter((n) => /🪙|💰|chips/i.test(n.t));
  const avatars = nodes.filter((n) => n.t === '👤');
  return { total: nodes.length, visibleCount: visible.length, fold, practice, chipish, avatars };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 844 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);

let d;
try { d = await measure(page, expr, { label: 'fold' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
if (!d.total) { console.error('NO NODES COLLECTED — failed measurement, not a clean result.'); await browser.close(); process.exit(2); }
await page.screenshot({ path: `tests/screenshots/home-${TAG}-${VW}.png` });
await browser.close();

console.log(`@${VW} — ${d.total} text nodes, ${d.visibleCount} visible\n`);
console.log('FIRST 200px (visible only), by y:');
for (const n of d.fold) console.log(`  y ${String(n.box.t).padStart(3)}  x ${String(n.box.l).padStart(3)}  ${JSON.stringify(n.t)}`);
console.log(`\nPractice vs Bots: ${d.practice ? `y ${d.practice.box.t}  container ${d.practice.cbox.w}x${d.practice.cbox.h} at y${d.practice.cbox.t}` : 'NOT FOUND'}`);
console.log(`\nchip-ish nodes (visible): ${d.chipish.length}`);
for (const c of d.chipish) console.log(`  y ${String(c.box.t).padStart(3)}  ${JSON.stringify(c.t)}  container ${c.cbox.w}x${c.cbox.h}`);
console.log(`\n👤 nodes (ALL, incl. hidden): ${d.avatars.length}`);
for (const a of d.avatars) console.log(`  y ${String(a.box.t).padStart(3)}  x ${String(a.box.l).padStart(3)}  hidden: ${a.hidden ?? 'NO — visible'}`);
console.log(`\nscreenshot -> tests/screenshots/home-${TAG}-${VW}.png`);
