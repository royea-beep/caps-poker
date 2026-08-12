/**
 * Six routes no audit has ever loaded: shop, battle-pass, coaching, replay, heatmap, spectate.
 *
 * Reports mount, errors, overlaps, clipping, off-screen text and sub-44px targets — and two
 * things a screen scan usually forgets: whether the route is REACHABLE from the UI at all, and
 * whether it looks finished. A route that exists but cannot be navigated to is a different
 * finding from a broken one.
 *
 * Both engines, both widths. Asserts each screen mounted before reporting on it — an unmounted
 * screen produces zero of everything, which reads exactly like a clean one.
 *
 *   node tests/unopened-screens.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const ROUTES = ['/shop', '/battle-pass', '/coaching', '/replay', '/heatmap', '/spectate'];

const probe = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    if (c.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(c.transform)) return false;
    n = n.parentElement; d++; } return true; };
  const GLYPH = /^([♠♥♦♣]|10|[2-9AKQJC])$/;
  const vw = innerWidth;
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && vis(e));
  const boxes = []; let tiny = 0, off = 0, clipped = 0;
  for (const e of leaves) {
    const t = (e.textContent || '').trim(); if (!t) continue;
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 10 && !GLYPH.test(t)) tiny++;
    if (r.right > vw + 0.5 || r.left < -0.5) off++;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) clipped++;
    if (!GLYPH.test(t)) boxes.push({ t: t.slice(0, 18), l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width * r.height });
  }
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l), oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    if ((ow * oh) / Math.min(A.a, B.a) >= 0.35) overlaps++;
  }
  let small = 0;
  for (const el of document.querySelectorAll('button,[role="button"],a')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !vis(el)) continue;
    if (r.width < 44 || r.height < 44) small++;
  }
  const txt = (document.body.innerText || '').trim();
  return { url: location.pathname, kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
           bodyLen: txt.length, nodes: leaves.length, tiny, off, clipped, overlaps, small,
           // "Looks finished" heuristics: an empty state, a placeholder, or an error message.
           emptyish: /coming soon|not available|empty|no data|nothing here|todo|placeholder|shop is empty/i.test(txt),
           errorish: /something went wrong|unmatched route|error|crash/i.test(txt),
           sample: txt.slice(0, 90).replace(/\\n/g, ' ') };
})()`;

// Which of these routes can actually be reached by tapping, from home or the side menu?
const reachable = `(() => {
  const out = {};
  const els = [...document.querySelectorAll('a,button,[role="button"]')];
  for (const r of ${JSON.stringify(ROUTES)}) {
    const word = r.replace('/', '').replace('-', ' ');
    out[r] = els.some((e) => {
      const href = e.getAttribute('href') || '';
      const label = ((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')).toLowerCase();
      return href.includes(r) || label.includes(word);
    });
  }
  return out;
})()`;

for (const VW of [390, 320]) {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    const errsByRoute = {};
    let current = 'init';
    page.on('pageerror', (e) => { (errsByRoute[current] ||= []).push(String(e).slice(0, 70)); });

    console.log(`\n################ ${name} @${VW} ################`);
    // Reachability is judged from home, where the nav and the side menu live.
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(11000);
    let reach = {};
    try { reach = await measure(page, reachable, { label: 'reach' }); } catch { reach = {}; }

    console.log('route         | kids | body | nodes | ovl | clip | off | tiny | tap<44 | reachable | note');
    for (const route of ROUTES) {
      current = route;
      let r;
      try {
        await page.goto(URL + route, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(7000);
        r = await measure(page, probe, { label: name + route });
      } catch (e) {
        r = { kids: -1, bodyLen: -1, nodes: -1, overlaps: -1, clipped: -1, off: -1, tiny: -1, small: -1,
              emptyish: false, errorish: true, sample: 'THREW/NOT MOUNTED: ' + (e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)) };
      }
      const note = r.errorish ? 'ERROR TEXT' : r.emptyish ? 'empty/placeholder' : r.bodyLen < 40 ? 'nearly blank' : 'renders content';
      console.log(`${route.padEnd(13)} | ${String(r.kids).padStart(4)} | ${String(r.bodyLen).padStart(4)} | ${String(r.nodes).padStart(5)} | ${String(r.overlaps).padStart(3)} | ${String(r.clipped).padStart(4)} | ${String(r.off).padStart(3)} | ${String(r.tiny).padStart(4)} | ${String(r.small).padStart(6)} | ${String(!!reach[route]).padStart(9)} | ${note}`);
      if (r.sample) console.log(`              -> ${JSON.stringify(r.sample)}`);
      const es = errsByRoute[route];
      if (es && es.length) console.log(`              !! page errors: ${JSON.stringify([...new Set(es)].slice(0, 2))}`);
    }
    await browser.close();
  }
}
