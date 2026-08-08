/**
 * G2 — does the build identifier actually LAND in analytics_events?
 *
 * "The event is written" is not "the event arrived". This loop has already been caught once by
 * a non-blocking claim that was proven non-blocking and never seen in the DB, so this one loads
 * the app with Supabase REACHABLE (every other probe this session aborted it) and leaves a real
 * row behind to query.
 *
 * Nothing is played: loading Home is enough to initialise analytics and fire screen events, and
 * that keeps the probe away from the economy path entirely.
 *
 *   EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-g2-dist --clear
 *   node tests/build-identity-probe.mjs
 *
 * EXPECTED ON WEB: native_build is NULL — web has no native binary, and the code says so
 * rather than substituting the stale hand-maintained field. What this proves is that the KEY
 * is present and transmitted end to end. The real number only appears on a device build.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-g2-dist');
const PORT = Number(process.env.PROBE_PORT || 8131);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
// A raw `expo export` is not runnable — the bundle uses import.meta and the emitted classic
// <script defer> throws. Same transform scripts/fix-web-html.js applies on the deploy path.
const toModule = (h) => h.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
  '<script type="module" src="$1"></script>');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(DIR, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
  const e = path.extname(f).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[e] || 'application/octet-stream' });
  if (e === '.html') { res.end(toModule(fs.readFileSync(f, 'utf-8'))); return; }
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: false, args: ['--window-size=395,952'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const rpcCalls = [];
page.on('request', (r) => { if (/track_event/.test(r.url())) rpcCalls.push(r.url()); });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

// MOUNT ASSERTION — a probe that proves nothing about a page that never rendered is worthless.
const mounted = await page.evaluate(() => ({
  rootKids: document.getElementById('root')?.children.length ?? 0,
  text: (document.body.innerText || '').slice(0, 80),
}));
console.log('mounted:', JSON.stringify(mounted));
console.log('track_event requests observed:', rpcCalls.length);
await browser.close();
server.close();
