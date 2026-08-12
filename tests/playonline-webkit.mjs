/**
 * What actually collapses the Play Online card on WebKit?
 *
 * The proposed cause — "row gap unsupported in WebKit" — is DISPROVEN by
 * tests/gap-capability.mjs: row children land at 0/70/140 with a 20px gap in BOTH engines, and
 * CSS.supports('gap','20px') is true in both. So the 295-site gap conversion would fix nothing.
 *
 * This measures the real thing: the Play Online card and its ancestors on both engines, in one
 * process, reporting height, flexDirection, alignItems, and the computed gap actually in effect.
 * Whatever differs IS the cause.
 *
 *   node tests/playonline-webkit.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
  const el = leaves.find((e) => /^Play Online$/i.test((e.textContent || '').trim()));
  if (!el) return { found: false, sample: leaves.map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 12) };
  const chain = [];
  let n = el, d = 0;
  while (n && d < 6) {
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    chain.push({ tag: n.tagName.toLowerCase(), h: Math.round(r.height), w: Math.round(r.width),
                 top: Math.round(r.top),
                 dir: cs.flexDirection, gap: cs.gap, rowGap: cs.rowGap, colGap: cs.columnGap,
                 jc: cs.justifyContent, ai: cs.alignItems, disp: cs.display,
                 minH: cs.minHeight, flex: cs.flexGrow + '/' + cs.flexShrink + '/' + cs.flexBasis });
    n = n.parentElement; d++;
  }
  // Count genuinely visible text overlaps (>=35% of the smaller box).
  const vis = (e) => { let m = e, k = 0; while (m && k < 12) { const c = getComputedStyle(m);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    if (c.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(c.transform)) return false;
    m = m.parentElement; k++; } return true; };
  const boxes = [];
  for (const e of leaves) {
    const t = (e.textContent || '').trim(); if (!t || !vis(e)) continue;
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    boxes.push({ t: t.slice(0, 22), l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width * r.height });
  }
  let overlaps = 0; const pairs = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l), oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    if ((ow * oh) / Math.min(A.a, B.a) < 0.35) continue;
    overlaps++; if (pairs.length < 4) pairs.push(A.t + ' / ' + B.t);
  }
  return { found: true, chain, overlaps, pairs };
})()`;

for (const VW of [390, 320]) {
  for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(12000);
    let d;
    try { d = await measure(page, expr, { label: name + VW }); }
    catch (e) { console.log(`\n### ${name} @${VW} — HARNESS: ${e instanceof HarnessError ? e.message : String(e).slice(0, 60)}`); await browser.close(); continue; }
    console.log(`\n### ${name} @${VW} — visible text overlaps: ${d.overlaps}${d.pairs && d.pairs.length ? '  e.g. ' + JSON.stringify(d.pairs) : ''}`);
    if (!d.found) { console.log(`  "Play Online" NOT FOUND. on screen: ${JSON.stringify(d.sample)}`); }
    else d.chain.forEach((c, i) => console.log(`  ^${i} <${c.tag}> ${c.w}x${c.h} @y${c.top} dir=${c.dir} gap=${c.gap} jc=${c.jc} ai=${c.ai} minH=${c.minH} flex=${c.flex}`));
    await page.screenshot({ path: `tests/screenshots/po-${name}-${VW}.png` });
    await browser.close();
  }
}
