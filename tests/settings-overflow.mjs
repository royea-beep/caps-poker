/**
 * SETTINGS OVERFLOW — what is actually wider than the viewport, and which box causes it?
 *
 * Reported: "× 4 boards = 100" at x 390..484 and "% of buy-in" at x 390..455 on a 390px
 * viewport — both starting EXACTLY at the viewport edge, which is the signature of a row whose
 * right-hand column was pushed out rather than one that is merely too wide.
 *
 * Walks up from each offending text node reporting every ancestor's box, so the fix targets the
 * container that actually overflows instead of the text that happens to be visible at the end
 * of it.
 *
 *   VIEWPORT=390 node tests/settings-overflow.mjs
 *   VIEWPORT=320 node tests/settings-overflow.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const VW = ${VW};
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right <= VW + 0.5) continue;              // fits
    const chain = [];
    let n = el, d = 0;
    while (n && d < 5) {
      const q = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      chain.push({ tag: n.tagName.toLowerCase(), l: Math.round(q.left), r: Math.round(q.right),
                   w: Math.round(q.width), flex: cs.flexGrow + '/' + cs.flexShrink,
                   dir: cs.flexDirection, minW: cs.minWidth });
      n = n.parentElement; d++;
    }
    bad.push({ t: t.slice(0, 34), l: Math.round(r.left), r: Math.round(r.right), chain });
  }
  return { vw: VW, bad };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/settings`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);

let d;
try { d = await measure(page, expr, { label: 'overflow' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

console.log(`viewport=${d.vw}  text nodes extending past the right edge: ${d.bad.length}\n`);
for (const b of d.bad) {
  console.log(`"${b.t}"  x ${b.l}..${b.r}   (overflow ${b.r - d.vw}px)`);
  b.chain.forEach((c, i) => console.log(`   ^${i} <${c.tag}> x ${c.l}..${c.r} w=${c.w} grow/shrink=${c.flex} dir=${c.dir} minW=${c.minW}`));
  console.log('');
}
if (!d.bad.length) console.log('nothing overflows — but confirm the page actually rendered before reading this as a pass.');
