/**
 * EMPTY REGIONS — classify before changing anything.
 *
 * A gap number alone cannot tell you whether a screen is an EMPTY STATE (little content, wants
 * centring), a LAYOUT BUG (a container stretching or content pinned top), or INTENTIONAL.
 * So this reports the evidence needed to tell them apart:
 *   - where content actually ends vs the viewport
 *   - whether the screen SCROLLS (a scroll view with content shorter than its frame is a very
 *     different thing from a fixed screen with a stretched container)
 *   - the root container chain's flex/justify, which is what decides top-pinned vs distributed
 *   - how many content nodes there are (2 nodes + a big gap = empty state; 30 nodes + a big gap
 *     mid-screen = something is wrong)
 *
 *   VIEWPORT=390 node tests/empty-regions.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const ROUTES = (process.env.ROUTES || '/friends,/profile,/play,/cups').split(',');
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };

  const nodes = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!t) continue;
    if (!vis(el)) continue;
    nodes.push({ t: t.slice(0, 26), tp: Math.round(r.top), b: Math.round(r.bottom) });
  }
  nodes.sort((a, b) => a.tp - b.tp);

  // Gaps between occupied bands.
  const gaps = []; let cur = 0;
  for (const n of nodes) { if (n.tp - cur > 70) gaps.push({ from: cur, to: n.tp, px: n.tp - cur, next: n.t }); cur = Math.max(cur, n.b); }
  const contentBottom = nodes.length ? Math.max(...nodes.map(n => n.b)) : 0;

  // Does anything scroll, and is its content shorter than its frame?
  const scrollers = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowY)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 120) continue;
    scrollers.push({ h: Math.round(r.height), sh: el.scrollHeight, ch: el.clientHeight,
                     jc: cs.justifyContent, fg: cs.flexGrow, cls: (el.className||'').toString().slice(0,26) });
  }

  // Root chain: what governs vertical distribution.
  const chain = [];
  let n = nodes.length ? [...document.querySelectorAll('*')].find(e => !e.children.length && (e.textContent||'').trim() === nodes[0].t) : null;
  let d = 0;
  while (n && d < 7) { const cs = getComputedStyle(n); const r = n.getBoundingClientRect();
    chain.push({ tag: n.tagName.toLowerCase(), h: Math.round(r.height), dir: cs.flexDirection,
                 jc: cs.justifyContent, fg: cs.flexGrow, ovf: cs.overflowY });
    n = n.parentElement; d++; }

  return { url: location.pathname, vh: innerHeight, n: nodes.length, contentBottom, gaps, scrollers, chain,
           first: nodes.slice(0,3).map(x=>x.t), last: nodes.slice(-3).map(x=>x.t) };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();

for (const route of ROUTES) {
  await page.goto(URL + route, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(7000);
  let r;
  try { r = await measure(page, expr, { label: 'er' + route }); }
  catch (e) { console.log(`\n### ${route}  HARNESS FAIL: ${e instanceof HarnessError ? e.message : String(e).slice(0,70)}`); continue; }
  console.log(`\n### ${route}  (${r.url})  viewport ${r.vh}px`);
  console.log(`  content: ${r.n} visible text nodes, ends at y=${r.contentBottom}  (${r.vh - r.contentBottom}px below it)`);
  console.log(`  first: ${JSON.stringify(r.first)}  last: ${JSON.stringify(r.last)}`);
  console.log(`  gaps>70: ${r.gaps.length ? r.gaps.map(g=>`${g.px}px @${g.from}-${g.to} before "${g.next}"`).join(' | ') : 'none'}`);
  console.log(`  scrollers: ${r.scrollers.length ? r.scrollers.map(s=>`h${s.h} scrollH${s.sh} jc=${s.jc} grow=${s.fg}`).join(' | ') : 'none'}`);
  console.log(`  chain (leaf->root): ${r.chain.map(c=>`${c.tag}[h${c.h} ${c.dir} jc=${c.jc} grow=${c.fg}]`).join(' < ')}`);
  // A gap going 455 -> 218/256 says nothing about whether it LOOKS right. That is Roye's call
  // to make with his eyes, so every measured screen gets a screenshot.
  const f = `tests/screenshots/empty-${route.replace(/\//g,'') || 'home'}-${VW}.png`;
  await page.screenshot({ path: f });
  console.log(`  screenshot -> ${f}`);
}
await browser.close();
