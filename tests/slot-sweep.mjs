/**
 * WHAT ACTUALLY PAINTS 3:1 — a parameter sweep on the real slot, in the real app.
 *
 * The token does not predict the pixel here. A 1px rounded DASHED border at deviceScaleFactor 2
 * paints at roughly 63% of its nominal alpha: rgba(255,255,255,0.30) should composite to
 * rgb(93,116,105) over the panel and actually renders rgb(68,95,81). So choosing a new alpha by
 * arithmetic would choose it against a number the renderer does not honour — which is the same
 * mistake as measuring a cue against the wrong substrate, one layer down.
 *
 * So this sweeps the live element instead: it walks alpha, width and border-style on the actual
 * slots in the running app and reads the PAINTED contrast back out of a screenshot each time,
 * against BOTH neighbours — the fill it encloses and the panel outside it. The winner is then
 * written into the token and re-verified from a real export, because an injected style is
 * evidence about the renderer, not about the shipped build.
 *
 *   DIST=web-ship-dist node tests/slot-sweep.mjs
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ENGINE = process.env.CAPS_ENGINE === 'webkit' ? webkit : chromium;
const LAUNCH = process.env.CAPS_ENGINE === 'webkit'
  ? { headless: true }
  : { headless: true, ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) };

const DIR = path.resolve(process.env.DIST || 'web-ship-dist');
const OUT = path.resolve(process.env.OUT_DIR || 'slot-probe');
const PORT = Number(process.env.PORT || 8943);
const DSF = 2;
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
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
await new Promise((r) => server.listen(PORT, r));

const seedState = (() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  return JSON.stringify(st);
})();

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const browser = await ENGINE.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: DSF });
await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
const page = await ctx.newPage();
await page.addInitScript((seed) => {
  let a = seed >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, Number(process.env.SEED || 20260827));
await page.addInitScript((blob) => {
  try {
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '25');
    localStorage.setItem('caps-poker-storage', blob);
  } catch (_) { /* unavailable */ }
}, seedState);
await page.goto(`http://localhost:${PORT}/game?practice=true&players=2&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(Number(process.env.CAPS_SETTLE || 6000));

// tag the slots once, by computed style rather than by a guessed selector
const n = await page.evaluate(() => {
  let i = 0;
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.borderTopStyle !== 'dashed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) continue;
    el.setAttribute('data-slot', String(i++));
  }
  return i;
});
console.log(`slots tagged: ${n}`);
if (!n) { console.log('NO SLOTS — nothing swept.'); await browser.close(); server.close(); process.exit(1); }

const box = await page.evaluate(() => {
  const el = document.querySelector('[data-slot="0"]');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

/** Read the dash core, the fill inside and the panel outside for the current styling. */
async function measure(tag) {
  const file = path.join(OUT, `sweep-${tag}.png`);
  await page.screenshot({ path: file });
  const { execFileSync } = await import('node:child_process');
  const PY = `
import sys, json
from PIL import Image
r = json.loads(sys.argv[1]); im = Image.open(r["f"]).convert("RGB"); px = im.load()
d, b = r["d"], r["b"]
x0, x1 = int(b["x"]*d)+6, int((b["x"]+b["w"])*d)-6
y0 = int(b["y"]*d)
def mx(y):
    row=[px[x,y] for x in range(x0,x1)]
    return list(max(row,key=sum))
def av(y):
    row=[px[x,y] for x in range(x0,x1)]
    return [round(sum(p[k] for p in row)/len(row)) for k in range(3)]
# the line can spread over a few device rows once width changes; take the brightest row it reaches
dash = max([mx(y0+k) for k in range(0,7)], key=sum)
print(json.dumps({"dash": dash, "inside": av(y0+14), "outside": av(y0-6)}))
`;
  return JSON.parse(execFileSync('python3', ['-c', PY, JSON.stringify({ f: file, d: DSF, b: box })], { encoding: 'utf8' }));
}

const apply = (css) => page.evaluate((c) => {
  for (const el of document.querySelectorAll('[data-slot]')) {
    if (c.color) el.style.setProperty('border-color', c.color, 'important');
    if (c.width) el.style.setProperty('border-width', c.width, 'important');
    if (c.style) el.style.setProperty('border-style', c.style, 'important');
  }
}, css);

const CANDIDATES = [
  { tag: 'ship-0.30-1px-dashed', color: 'rgba(255,255,255,0.30)', width: '1px', style: 'dashed' },
  { tag: 'a0.45-1px-dashed',     color: 'rgba(255,255,255,0.45)', width: '1px', style: 'dashed' },
  { tag: 'a0.60-1px-dashed',     color: 'rgba(255,255,255,0.60)', width: '1px', style: 'dashed' },
  { tag: 'a0.75-1px-dashed',     color: 'rgba(255,255,255,0.75)', width: '1px', style: 'dashed' },
  { tag: 'a0.90-1px-dashed',     color: 'rgba(255,255,255,0.90)', width: '1px', style: 'dashed' },
  { tag: 'a0.45-2px-dashed',     color: 'rgba(255,255,255,0.45)', width: '2px', style: 'dashed' },
  { tag: 'a0.55-2px-dashed',     color: 'rgba(255,255,255,0.55)', width: '2px', style: 'dashed' },
  { tag: 'a0.45-1px-solid',      color: 'rgba(255,255,255,0.45)', width: '1px', style: 'solid' },
  { tag: 'a0.55-1px-solid',      color: 'rgba(255,255,255,0.55)', width: '1px', style: 'solid' },
];

console.log('\n=== PAINTED contrast per candidate — against BOTH neighbours ===\n');
console.log('  candidate                dash painted      vs fill   vs panel   effective alpha');
const rows = [];
for (const c of CANDIDATES) {
  await apply(c);
  await page.waitForTimeout(220);
  const m = await measure(c.tag);
  const vf = ratio(m.dash, m.inside), vp = ratio(m.dash, m.outside);
  // back out the alpha the renderer actually laid down, from the green channel (largest span)
  const eff = (m.dash[1] - m.outside[1]) / (255 - m.outside[1]);
  rows.push({ ...c, dash: m.dash, vf, vp, eff });
  console.log(`  ${c.tag.padEnd(24)} rgb(${m.dash.join(',')})`.padEnd(52) +
    `${vf.toFixed(2).padStart(6)}   ${vp.toFixed(2).padStart(6)}   ${eff.toFixed(3).padStart(6)}` +
    (vf >= 3 && vp >= 3 ? '   <- clears 3:1 both' : ''));
}
fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify({ box, rows }, null, 2));
await browser.close(); server.close();
console.log(`\nwrote ${path.join(OUT, 'sweep.json')}\n`);
