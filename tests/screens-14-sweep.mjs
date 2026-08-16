/**
 * The 14 screens no visual review has covered.
 *
 * Five checks that have each found a real defect before: text under 10px, text off-screen, clipped
 * text (scrollWidth > clientWidth), touch targets under 44px, and overlap.
 *
 * ARTIFACT FILTERS — five findings in this project turned out to be measurement errors, and each
 * one is filtered here by name:
 *
 *   drawer      the parked side menu carries transform matrix(1,0,0,1,293,0) and pointerEvents
 *               none. It produced 22 phantom off-screen items and 3 phantom overlaps on home.
 *   decorative  ♠♥♦♣ background art and the rank/suit glyphs inside a card face are SUPPOSED to
 *               be small; they are not unreadable text.
 *   containers  a touch target is the pressable box, not the text node inside it. Cancel's
 *               container measured 2.7x its text.
 *   nested      every card matches TWO elements (outer frame, inner face). Counting both is what
 *               made the first highlight probe find nothing. Overlap pairs are deduped by box.
 *   unsettled   three /game overlaps vanished with no code change, so each screen is given time
 *               and re-read once before anything is reported.
 *
 * Occlusion (content behind an opaque later sibling) is NOT filtered — it cannot be detected from
 * styles alone, so overlaps are reported as candidates, never as confirmed defects.
 *
 * Exits non-zero if it measured nothing. A run that collects no nodes looks exactly like a clean
 * one, which is the failure this project keeps rediscovering.
 *
 *   node tests/screens-14-sweep.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

// The 14 unreviewed screens. Dev-only routes (debug, simulate) and club/[code] (needs a real club
// code) are deliberately excluded and reported as not checked.
const SCREENS = [
  '/cups', '/play', '/profile', '/achievements', '/chip-store', '/hand-history', '/missions',
  '/rank', '/referral', '/stats', '/theme-pick', '/orientation-pick', '/gameover', '/lobby/private',
];

const probe = `(() => {
  const GLYPH = /^([\\u2660\\u2665\\u2666\\u2663]|10|[2-9AKQJ])$/;   // decorative: suits + card ranks
  const parked = (el) => { let n = el, d = 0; while (n && d < 14) { const c = getComputedStyle(n);
    // the drawer: translated far off-axis, and/or inert
    if (/matrix\\(1, 0, 0, 1, [1-9]\\d{2}/.test(c.transform || '')) return true;
    if (c.pointerEvents === 'none') return true;
    n = n.parentElement; d++; } return false; };
  const vis = (el) => { let n = el, d = 0; while (n && d < 14) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };

  const vw = innerWidth;
  const all = [...document.querySelectorAll('*')];
  const leaves = all.filter((e) => !e.children.length && vis(e) && !parked(e));

  const tiny = [], off = [], clipped = [];
  const boxes = [];
  for (const e of leaves) {
    const t = (e.textContent || '').trim();
    if (!t) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const decorative = GLYPH.test(t);
    if (!decorative && fs < 10) tiny.push({ t: t.slice(0, 18), fs });
    if (!decorative && (r.right > vw + 0.5 || r.left < -0.5)) off.push({ t: t.slice(0, 18), l: Math.round(r.left), r: Math.round(r.right) });
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) clipped.push({ t: t.slice(0, 18), sw: e.scrollWidth, cw: e.clientWidth });
    if (!decorative) boxes.push({ t: t.slice(0, 16), l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width * r.height });
  }

  // Touch targets: measure the PRESSABLE CONTAINER, never the text inside it.
  const small = [];
  for (const el of all) {
    const role = el.getAttribute('role');
    const isBtn = el.tagName === 'BUTTON' || el.tagName === 'A' || role === 'button';
    if (!isBtn || !vis(el) || parked(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < 44 || r.height < 44) small.push({ t: (el.textContent || '').trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) });
  }

  // Overlap candidates, deduped by box so nested duplicates cannot inflate the count.
  const seen = new Set(); const uniq = [];
  for (const b of boxes) {
    const k = Math.round(b.l) + '|' + Math.round(b.tp) + '|' + Math.round(b.r) + '|' + Math.round(b.b);
    if (seen.has(k)) continue; seen.add(k); uniq.push(b);
  }
  const overlaps = [];
  for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
    const A = uniq[i], B = uniq[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l), oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    if ((ow * oh) / Math.min(A.a, B.a) < 0.35) continue;
    if (overlaps.length < 4) overlaps.push(A.t + ' / ' + B.t);
  }

  return {
    url: location.pathname,
    nodes: leaves.length,
    bodyLen: (document.body.innerText || '').trim().length,
    tiny, off, clipped, small, overlaps,
  };
})()`;

const rows = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const vw of [390, 320]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: vw, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    console.log(`\n################ ${name} @${vw} ################`);
    console.log('screen            | nodes | tiny | off | clip | tap<44 | ovl');
    for (const s of SCREENS) {
      let r;
      try {
        await page.goto(URL + s, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(7000);
        await measure(page, probe, { label: 'settle' });   // unsettled-layout guard: read, wait, re-read
        await page.waitForTimeout(2500);
        r = await measure(page, probe, { label: `${name}${s}` });
      } catch (e) {
        console.log(`${s.padEnd(17)} | HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)}`);
        rows.push({ name, vw, s, harness: true });
        continue;
      }
      rows.push({ name, vw, s, ...r });
      console.log(`${s.padEnd(17)} | ${String(r.nodes).padStart(5)} | ${String(r.tiny.length).padStart(4)} | ${String(r.off.length).padStart(3)} | ${String(r.clipped.length).padStart(4)} | ${String(r.small.length).padStart(6)} | ${String(r.overlaps.length).padStart(3)}`);
      if (r.tiny.length) console.log(`     tiny: ${JSON.stringify(r.tiny.slice(0, 3))}`);
      if (r.off.length) console.log(`     off:  ${JSON.stringify(r.off.slice(0, 3))}`);
      if (r.clipped.length) console.log(`     clip: ${JSON.stringify(r.clipped.slice(0, 3))}`);
      if (r.small.length) console.log(`     tap:  ${JSON.stringify(r.small.slice(0, 3))}`);
      if (r.overlaps.length) console.log(`     ovl:  ${JSON.stringify(r.overlaps.slice(0, 2))}`);
    }
    await browser.close();
  }
}

const measured = rows.filter((r) => !r.harness && r.nodes > 0);
console.log(`\n=== ${measured.length} of ${rows.length} screen/engine/width combinations measured ===`);
if (!measured.length) { console.error('NOTHING MEASURED — failed run, not a clean one.'); process.exit(2); }
const tot = (k) => measured.reduce((n, r) => n + (r[k]?.length ?? 0), 0);
console.log(`  tiny<10 ${tot('tiny')} | off-screen ${tot('off')} | clipped ${tot('clipped')} | tap<44 ${tot('small')} | overlap candidates ${tot('overlaps')}`);
const blank = rows.filter((r) => !r.harness && (r.nodes === 0 || r.bodyLen < 20));
if (blank.length) console.log(`  BLANK/UNMOUNTED: ${JSON.stringify(blank.map((b) => `${b.name}@${b.vw}${b.s}`))}`);
