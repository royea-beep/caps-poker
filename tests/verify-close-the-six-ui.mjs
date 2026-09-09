/**
 * CLOSE-THE-SIX · SECTION 3 — the two UI fixes, measured against the recorded BEFORE.
 *
 * Both were found by the VERIFY-EVERYTHING sweep, and that sweep's raw output is still on disk at
 * docs/verify-everything/full-loop.json. So this is not "measure it and hope it looks better" —
 * the before numbers are READ BACK FROM THAT FILE and printed beside the after, per route, per
 * width, per engine. A fix that moved nothing would be obvious.
 *
 *   /settings   "Privacy policy" 68x12 and "Terms of use" 65x12  ->  must be >= 44pt tall
 *   /game       one focusable element with NO accessible name    ->  must be named, or gone
 *
 * WHY THE HEIGHT AND NOT hitSlop. react-native-web implements hitSlop only in its legacy
 * `Touchable` export, never in `Pressable` — which is what this app uses. So on web hitSlop is a
 * no-op, and a target "fixed" with it stays 12pt here while looking fine on iOS. The fix grows the
 * box, so the same number is true on both platforms and a harness can see it.
 *
 * Usage: xvfb-run -a node tests/verify-close-the-six-ui.mjs
 */

import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('dist');
const WIDTHS = [320, 375, 393, 430];
const BEFORE_FILE = path.resolve('docs/verify-everything/full-loop.json');

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
if (!/<script type="module"/.test(html)) {
  console.error('ABORT — dist/index.html is unpatched. Run: npx expo export -p web && node scripts/fix-web-html.js');
  process.exit(2);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/** The same interactive-element scan the full sweep used, so before and after are comparable. */
const SCAN = `(() => {
  const out = { targets: [], unnamed: [] };
  const sel = 'button,a[href],input,select,textarea,[role=button],[role=link],[role=tab],[role=switch],[tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && cs.opacity !== '0' && el.getAttribute('aria-hidden') !== 'true';
    if (!visible) continue;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title')
      || el.innerText || el.getAttribute('alt') || el.value || '').trim();
    out.targets.push({ label: label.slice(0, 44), w: Math.round(r.width), h: Math.round(r.height) });
    if (!label) out.unnamed.push({ w: Math.round(r.width), h: Math.round(r.height),
      tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '' });
  }
  return out;
})()`;

/** BEFORE, read back from the sweep that found these — never retyped from the report. */
const before = fs.existsSync(BEFORE_FILE) ? JSON.parse(fs.readFileSync(BEFORE_FILE, 'utf8')) : null;
const beforeFor = (route, needle) => {
  if (!before) return null;
  const hits = [];
  for (const row of before.rows) {
    if (row.route !== route) continue;
    for (const t of row.tinyTargets) if ((t.label || '').includes(needle)) hits.push(`${t.w}x${t.h}`);
  }
  return [...new Set(hits)].join(', ') || null;
};
const beforeUnnamed = (route) => {
  if (!before) return null;
  return before.rows.filter((r) => r.route === route).reduce((n, r) => n + r.unnamed.length, 0);
};

const results = { legal: [], botcard: [] };
for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch({
    headless: engine === 'webkit',
    executablePath: engine === 'chromium' ? process.env.CAPS_BROWSER_PATH : undefined,
  });
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('caps_games_played', '9');
        localStorage.setItem('caps_onboarding_complete', 'true');
        localStorage.removeItem('guidedModeForced');
      } catch {}
    });

    // ── /settings — the two legal links
    let p = await ctx.newPage();
    await p.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(2600);
    const s = await p.evaluate(SCAN);
    for (const needle of ['Privacy policy', 'Terms of use']) {
      const hit = s.targets.find((t) => t.label.toLowerCase().includes(needle.toLowerCase()));
      results.legal.push({ engine, width, needle, ...(hit ?? { w: null, h: null }) });
    }
    await p.close();

    // ── /game — the face-down bot card
    p = await ctx.newPage();
    await p.goto(`${BASE}/game?practice=1&players=2&fresh=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(4200);
    const g = await p.evaluate(SCAN);
    // ⚠️ THE ELEMENT IS THE EMPTY CARD SLOT, NOT THE BOT CARD. The first run of this probe
    // reported "STILL UNNAMED" 8/8 while the new bot-card label was demonstrably in the bundle,
    // so the DOM was dumped instead of re-read: the unnamed nodes are dashed 36x42 boxes — the
    // sixteen placement slots (4 boards x 4). The sweep's original attribution to Board.tsx:796
    // was mine and it was wrong; it came from reading source rather than asking the page.
    const named = g.targets.filter((t) => /empty slot \d+ of/i.test(t.label));
    results.botcard.push({ engine, width, unnamed: g.unnamed.length, namedBotCards: named.length,
      sample: named[0]?.label ?? null });
    await p.close();
    await ctx.close();
  }
  await browser.close();
}
server.close();

console.log('\nCLOSE-THE-SIX · UI FIXES — after, beside the recorded before\n');

console.log('  1. /settings legal links — Apple review opens exactly these');
console.log(`     before (docs/verify-everything/full-loop.json): Privacy ${beforeFor('/settings','Privacy policy')} · Terms ${beforeFor('/settings','Terms of use')}`);
let short = 0;
for (const r of results.legal) {
  const ok = r.h !== null && r.h >= 44;
  if (!ok) short++;
  console.log(`     ${r.engine.padEnd(9)} @${String(r.width).padEnd(4)} ${r.needle.padEnd(16)} ${r.w === null ? 'NOT FOUND' : `${r.w}x${r.h}`}  ${ok ? '✓ >= 44pt' : '✗ STILL UNDER 44'}`);
}

console.log('\n  2. /game empty card slots — the only unnamed controls in the 33-route sweep');
console.log(`     before: ${beforeUnnamed('/game')} unnamed elements across the 8 /game cells`);
let stillUnnamed = 0;
for (const r of results.botcard) {
  if (r.unnamed > 0) stillUnnamed += r.unnamed;
  console.log(`     ${r.engine.padEnd(9)} @${String(r.width).padEnd(4)} unnamed=${r.unnamed}  named slots=${r.namedBotCards}  ${r.unnamed === 0 ? '✓' : '✗ STILL UNNAMED'}`);
  if (r.sample) console.log(`        label: "${r.sample}"`);
}

console.log(`\n  legal links still under 44pt : ${short} of ${results.legal.length} (must be 0)`);
console.log(`  unnamed controls on /game    : ${stillUnnamed} (must be 0)\n`);
process.exit(short === 0 && stillUnnamed === 0 ? 0 : 1);
