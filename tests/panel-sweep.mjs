/**
 * CLIP-AWARE OVERLAP SWEEP, WITH A PRE-CHANGE CONTROL.
 *
 * A panel colour cannot move a box — but saying so is not evidence, so this measures it. Every
 * variant is swept at both widths and at all three board counts (2P=4, 3P=3, 4P=2 — never
 * assumed), and P0 is swept identically as the pre-change control. A pair that appears in the
 * control as well as in a variant is pre-existing; only a pair the control does not have belongs
 * to the change. Asserting "this adds none" without the control is the mistake this exists to
 * avoid.
 *
 * VISIBILITY-AWARE, because a box comparison that ignores ancestor opacity manufactures defects:
 * the scan that once reported "all five tab icons render twice" was comparing nodes where exactly
 * one of each pair sat under an `opacity: 0` cross-fade ancestor. Five reported, zero visible.
 *
 * CLIP-AWARE, because a node whose box extends past an `overflow: hidden` ancestor is not drawn
 * out there. Each rect is intersected with every clipping ancestor before any pair is considered,
 * so two nodes that only "overlap" in a region neither one actually paints are not counted.
 *
 *   node tests/panel-sweep.mjs
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// SHIP-V1 2026-08-27 — SECOND ENGINE. Handoffs 108-113 all said WebKit was unavailable because
// "its download host closes the connection". That was WRONG: the download always succeeded and it
// was the host DEPENDENCY check that failed. `npx playwright install-deps webkit` fixes it and
// WebKit 26.4 launches. CAPS_ENGINE=webkit selects it; Chromium stays the default so every earlier
// number remains comparable. executablePath is Chromium-specific, so it is only passed to Chromium.
const ENGINE = process.env.CAPS_ENGINE === 'webkit' ? webkit : chromium;
const LAUNCH = process.env.CAPS_ENGINE === 'webkit'
  ? { headless: true }
  : { headless: true, ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) };


const VARIANTS = (process.env.VARIANTS || 'P0,P0S,V1,V2,V3').split(',');
const MIN_FRAC = 0.35;
const PORT0 = Number(process.env.PORT || 8890);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const serve = (DIR, PORT) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(DIR, url);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const asHtml = path.join(DIR, url.replace(/\/$/, '') + '.html');
      file = fs.existsSync(asHtml) ? asHtml : path.join(DIR, 'index.html');
    }
    if (path.extname(file) === '.html') {
      const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  s.listen(PORT, () => resolve(s));
});

const SCAN = `(() => {
  const visible = (el) => {
    let n = el, d = 0;
    while (n && d < 12) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      n = n.parentElement; d++;
    }
    return true;
  };
  /** The rect a node can actually paint into: its own box, clipped by every scrolling or
   *  overflow-hidden ancestor. */
  const clipped = (el) => {
    let r = el.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    let n = el.parentElement, d = 0;
    while (n && d < 12) {
      const cs = getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        const p = n.getBoundingClientRect();
        box = { l: Math.max(box.l, p.left), t: Math.max(box.t, p.top),
                r: Math.min(box.r, p.right), b: Math.min(box.b, p.bottom) };
      }
      n = n.parentElement; d++;
    }
    return box;
  };
  const nodes = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    if (!visible(el)) continue;
    const c = clipped(el);
    const w = c.r - c.l, h = c.b - c.t;
    if (w <= 0 || h <= 0) continue;
    if (c.b < 0 || c.t > innerHeight) continue;
    nodes.push({ t: t.slice(0, 40), l: c.l, r: c.r, tp: c.t, b: c.b, a: w * h,
                 fs: getComputedStyle(el).fontSize });
  }
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const A = nodes[i], B = nodes[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l);
    const oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    const frac = (ow * oh) / Math.min(A.a, B.a);
    if (frac < ${MIN_FRAC}) continue;
    pairs.push({ a: A.t, b: B.t, pct: Math.round(frac * 100),
                 boxA: [Math.round(A.l), Math.round(A.tp)], boxB: [Math.round(B.l), Math.round(B.tp)] });
  }
  return { count: nodes.length, pairs, url: location.pathname };
})()`;

const seedState = (() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  return JSON.stringify(st);
})();

const browser = await ENGINE.launch(LAUNCH);

const all = {};
let port = PORT0;
for (const v of VARIANTS) {
  const server = await serve(path.resolve(process.env[`DIST_${v}`] || `web-${v.toLowerCase()}-dist`), ++port);
  all[v] = {};
  for (const W of [393, 320]) {
    for (const players of [2, 3, 4]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: 852 }, deviceScaleFactor: 1 });
      await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
      // THE DEAL MUST BE PINNED HERE TOO. The first run of this sweep did not pin it, so every
      // variant dealt a different hand and the pair counts wandered (1, 3, 2, 1, 2) purely with
      // the cards. Since a pair is keyed by its glyphs AND its coordinates, an unpinned deal makes
      // every pair look "new" and the control worthless — the same class of mistake as comparing
      // two shares that were both zero.
      await ctx.addInitScript((seed) => {
        let a = seed >>> 0;
        Math.random = () => {
          a = (a + 0x6D2B79F5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }, Number(process.env.SEED || 20260827));
      await ctx.addInitScript((blob) => {
        try {
          localStorage.setItem('has_seen_interactive_tutorial', 'true');
          localStorage.setItem('caps_games_played', '25');
          localStorage.setItem('caps-poker-storage', blob);
        } catch (_) { /* unavailable */ }
      }, seedState);
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${port}/game?practice=true&players=${players}&fresh=1`,
        { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(5000);
      const r = await page.evaluate(SCAN);
      all[v][`${W}-${players}`] = r;
      await ctx.close();
    }
  }
  server.close();
  console.log(`swept ${v}`);
}
await browser.close();

// ── report: only pairs the CONTROL does not also have belong to the change ──────────────────
const key = (p) => `${p.a}|${p.b}|${p.boxA}|${p.boxB}`;
console.log('\n=== CLIP-AWARE OVERLAP SWEEP — P0 is the pre-change control ===\n');
console.log('  cell        ' + VARIANTS.map((v) => v.padStart(8)).join('') + '     new vs control');
let anyNew = false;
for (const cell of Object.keys(all[VARIANTS[0]])) {
  const ctrl = new Set(all.P0[cell].pairs.map(key));
  const news = [];
  for (const v of VARIANTS) {
    if (v === 'P0') continue;
    for (const p of all[v][cell].pairs) if (!ctrl.has(key(p))) news.push(`${v}:${p.a}/${p.b}`);
  }
  if (news.length) anyNew = true;
  console.log(`  ${cell.padEnd(12)}` + VARIANTS.map((v) => String(all[v][cell].pairs.length).padStart(8)).join('') +
    `     ${news.length ? news.join(', ') : 'none'}`);
}
console.log(`\n  pairs introduced by any variant: ${anyNew ? 'SEE ABOVE' : 'NONE'}`);
console.log('  (a pair present in the control is pre-existing and is not this change\'s)\n');

// name the pre-existing pairs once, so "3 pairs" is not left as an unexplained number
const sample = all.P0[Object.keys(all.P0).find((c) => all.P0[c].pairs.length)];
if (sample) {
  console.log('  pre-existing pairs, named:');
  const seen = new Set();
  for (const p of sample.pairs) {
    const k = p.a + '|' + p.b;
    if (seen.has(k)) continue; seen.add(k);
    console.log(`    ${String(p.pct).padStart(3)}%  ${JSON.stringify(p.a)} over ${JSON.stringify(p.b)}`);
  }
}
fs.writeFileSync('panel-compare/sweep.json', JSON.stringify(all, null, 2));
console.log('\nwrote panel-compare/sweep.json\n');
