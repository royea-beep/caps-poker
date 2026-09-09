/**
 * WHAT THE EMPTY SLOT OUTLINE IS ACTUALLY DRAWN ON — established, not assumed.
 *
 * The neutral cue was once measured against the FELT when it sits on the CARD, and that error
 * nearly shipped as "the cue fails on all three felts". So nothing here is reasoned from source:
 * the slot elements are located by asking the DOM for their boxes, and the outline, the fill it
 * encloses, and the ground just outside it are read out of the rendered PNG at those coordinates.
 *
 * WHY IT IS NOT A SIMPLE PAIR. The resting slot is a 1px DASHED border (rgba(255,255,255,0.30))
 * around a near-transparent fill (rgba(255,255,255,0.045)). So the line has two different
 * neighbours — the fill on the inside, the board panel on the outside — and it is dashed, so along
 * its own length it alternates with the fill showing through. A single "outline vs panel" figure
 * describes only one of those edges. All three are measured and reported separately.
 *
 * ANTIALIASING IS PART OF THE ANSWER, NOT NOISE. A 1px line at deviceScaleFactor 2 does not
 * necessarily render as the composited token value; if the painted pixel is weaker than the token
 * predicts, the token is not what a player sees. The analytic composite is computed alongside the
 * sampled one and both are reported.
 *
 *   DIST=web-ship-dist node tests/slot-probe.mjs
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ENGINE = process.env.CAPS_ENGINE === 'webkit' ? webkit : chromium;
const LAUNCH = process.env.CAPS_ENGINE === 'webkit'
  ? { headless: true }
  : { headless: true, ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) };

const DIR = path.resolve(process.env.DIST || 'web-ship-dist');
const OUT = path.resolve(process.env.OUT_DIR || 'slot-probe');
const PORT = Number(process.env.PORT || 8941);
const W = Number(process.env.W || 393);
const PLAYERS = Number(process.env.PLAYERS || 2);
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

const browser = await ENGINE.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: W, height: 852 }, deviceScaleFactor: DSF });
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
await page.goto(`http://localhost:${PORT}/game?practice=true&players=${PLAYERS}&fresh=1`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(Number(process.env.CAPS_SETTLE || 6000));

/** Find the empty slots by their COMPUTED STYLE rather than by a testID they do not have: an
 *  element whose border is dashed and whose borderColor is the slot-dash token. Asking the DOM
 *  which elements are slots beats guessing at coordinates, which is how "the felt" once turned
 *  out to be a gold border. */
const found = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.borderTopStyle !== 'dashed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) continue;
    out.push({
      x: r.x, y: r.y, w: r.width, h: r.height,
      borderColor: cs.borderTopColor, borderWidth: cs.borderTopWidth,
      bg: cs.backgroundColor, radius: cs.borderTopLeftRadius,
    });
  }
  return out;
});
console.log(`empty slots found: ${found.length}`);
if (found.length) {
  const s = found[0];
  console.log(`  first slot  ${Math.round(s.w)}x${Math.round(s.h)} @${Math.round(s.x)},${Math.round(s.y)}`);
  console.log(`  border ${s.borderWidth} ${s.borderColor}   fill ${s.bg}   radius ${s.radius}`);
}
const shot = path.join(OUT, `slots-${W}-${PLAYERS}p${process.env.CAPS_ENGINE === 'webkit' ? '-wk' : ''}.png`);
await page.screenshot({ path: shot });
await browser.close(); server.close();

if (!found.length) { console.log('NO SLOTS FOUND — nothing measured, and no number is reported.'); process.exit(1); }

// ── read the three regions out of the render ────────────────────────────────────────────────
const PY = `
import sys, json
from PIL import Image
req = json.loads(sys.argv[1])
im = Image.open(req["shot"]).convert("RGB"); px = im.load()
d = req["dsf"]
def avg(pts):
    pts = [(x,y) for (x,y) in pts if 0 <= x < im.size[0] and 0 <= y < im.size[1]]
    if not pts: return None
    return [round(sum(px[x,y][k] for (x,y) in pts)/len(pts),1) for k in range(3)]
def brightest(pts):
    pts = [(x,y) for (x,y) in pts if 0 <= x < im.size[0] and 0 <= y < im.size[1]]
    if not pts: return None
    best = max(pts, key=lambda p: sum(px[p[0],p[1]]))
    return list(px[best[0],best[1]])
res = []
for s in req["slots"]:
    x0,y0 = s["x"]*d, s["y"]*d
    x1,y1 = (s["x"]+s["w"])*d, (s["y"]+s["h"])*d
    xs = [int(x0+ (x1-x0)*t) for t in [0.35,0.4,0.45,0.5,0.55,0.6,0.65]]
    # THE LINE: the top border row. Dashed, so the DASH is the brightest pixel along it and the
    # gap is the fill — averaging the row would blend the two and understate the line.
    line_pts = [(x,int(y0)) for x in xs] + [(x,int(y0)+1) for x in xs]
    # INSIDE: the slot fill, a few px in from the border
    in_pts   = [(x,int(y0)+8) for x in xs] + [(x,int(y0)+10) for x in xs]
    # OUTSIDE: the board panel, a few px out
    out_pts  = [(x,int(y0)-6) for x in xs] + [(x,int(y0)-8) for x in xs]
    res.append({"lineDash": brightest(line_pts), "lineAvg": avg(line_pts),
                "inside": avg(in_pts), "outside": avg(out_pts)})
print(json.dumps(res))
`;
const sampled = JSON.parse(execFileSync('python3', ['-c', PY,
  JSON.stringify({ shot, dsf: DSF, slots: found.slice(0, 6) })], { encoding: 'utf8' }));

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const r2 = (n) => n.toFixed(2).padStart(5);

console.log('\n=== SAMPLED — the outline and BOTH of its neighbours, per slot ===\n');
console.log('  slot   dash pixel        fill inside       panel outside     dash/fill  dash/panel');
const acc = { df: [], dp: [] };
sampled.forEach((s, i) => {
  if (!s.lineDash || !s.inside || !s.outside) return;
  const df = ratio(s.lineDash, s.inside), dp = ratio(s.lineDash, s.outside);
  acc.df.push(df); acc.dp.push(dp);
  const f = (v) => `rgb(${v.map(Math.round).join(',')})`.padEnd(17);
  console.log(`  ${String(i).padEnd(6)} ${f(s.lineDash)} ${f(s.inside)} ${f(s.outside)} ${r2(df)}      ${r2(dp)}`);
});
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`\n  mean   dash vs fill ${r2(mean(acc.df))}   dash vs panel ${r2(mean(acc.dp))}`);

// analytic, for comparison with what the renderer actually painted
const panel = sampled[0].outside.map(Math.round);
const fill = over([255, 255, 255], 0.045, panel);
const dash = over([255, 255, 255], 0.30, panel);
console.log('\n=== ANALYTIC from the tokens, over the measured panel ===');
console.log(`  panel ${JSON.stringify(panel)}  fill ${JSON.stringify(fill)}  dash ${JSON.stringify(dash)}`);
console.log(`  dash vs panel ${r2(ratio(dash, panel))}   dash vs fill ${r2(ratio(dash, fill))}`);
console.log(`\n  sampled dash pixel vs analytic dash: ` +
  `${JSON.stringify(sampled[0].lineDash.map(Math.round))} vs ${JSON.stringify(dash)}`);
fs.writeFileSync(path.join(OUT, 'slots.json'), JSON.stringify({ found, sampled }, null, 2));
console.log(`\nwrote ${OUT}\n`);
