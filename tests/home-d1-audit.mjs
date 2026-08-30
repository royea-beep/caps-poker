/**
 * D1 HOME — the built thing, measured at four widths on both engines.
 *
 * This audits the REAL EXPORT, not a concept render. Roye approves what ships, and every prior
 * sprint's pictures were HTML mock-ups of the app rather than the app.
 *
 * ── THE INSTRUMENT PROVES ITSELF FIRST ──────────────────────────────────────────────────────
 * Three of this project's own measurement tools have been caught reporting confident nonsense —
 * a ground sampled inside the glyphs, an emoji scored on a colour it does not use, a vignette
 * mistaken for a background. So every run here ends with a CANARY PASS: two spans are injected
 * onto the finished page, one knowably illegible and one knowably fine, and the same audit that
 * produced the real numbers must flag exactly the first. If it does not, the run is VOID and no
 * number in it may be quoted. The canary is injected AFTER the real audit so it cannot pollute it.
 *
 * ── WHAT IS MEASURED ────────────────────────────────────────────────────────────────────────
 *   wordmark   D1's whole point. Its rendered width against the frame, so overflow is a number
 *              rather than an impression — `adjustsFontSizeToFit` rescues native and is a NO-OP
 *              ON WEB, which is where these renders run.
 *   contrast   WCAG luminance against a GROUND SHOT taken with every glyph made transparent.
 *   44pt       every control's real box, both dimensions.
 *   naming     every control has an accessible name.
 *
 * Usage: xvfb-run -a node tests/home-d1-audit.mjs <distDir> [--engine=chromium|webkit]
 */

import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=')));
const DIST = path.resolve(process.argv[2] || '');
const ENGINE = args.engine || 'chromium';
const WIDTHS = [320, 375, 393, 430];
const PORT = 4700 + Math.floor(Math.random() * 250);
const OUT = path.resolve(new URL('../docs/d1-home', import.meta.url).pathname);
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`no export at ${DIST}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Collect text nodes and controls. Shared by the real pass and the canary pass. */
const COLLECT = () => {
  const px = (s) => parseFloat(s) || 0;
  const out = { text: [], controls: [], wordmark: null };
  for (const el of document.querySelectorAll('*')) {
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim()).join(' ');
    if (!direct) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const gradientText = s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || s.color === 'rgba(0, 0, 0, 0)';
    const emojiOnly = !/[a-z0-9]/i.test(direct) && /\p{Extended_Pictographic}/u.test(direct);
    const rec = { text: direct.slice(0, 44), fg: s.color, gradientText, emojiOnly,
      size: px(s.fontSize), weight: s.fontWeight, family: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
    out.text.push(rec);
    // D1's wordmark: the CAPS text node, identified by content and by being the largest on screen.
    if (direct === 'CAPS' && (!out.wordmark || rec.size > out.wordmark.size)) {
      out.wordmark = { ...rec, scrollW: el.scrollWidth, clientW: el.clientWidth,
        letterSpacing: s.letterSpacing, lineHeight: s.lineHeight };
    }
  }
  for (const el of document.querySelectorAll('button,[role="button"],a[href],[tabindex="0"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.controls.push({ name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 44),
      w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
};

const engine = ENGINE === 'webkit' ? webkit : chromium;
const exe = process.env.CAPS_BROWSER_PATH;
const browser = await engine.launch({ headless: false, ...(exe && ENGINE === 'chromium' ? { executablePath: exe } : {}) });
const report = { engine: ENGINE, dist: path.basename(DIST), ts: new Date().toISOString(), widths: {} };

for (const W of WIDTHS) {
  const H = Math.round(W * 852 / 393);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const seed = JSON.parse(fs.readFileSync(new URL('./caps-onboarded.json', import.meta.url), 'utf8'));
  const store = seed.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value;
  await p.addInitScript((blob) => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
      localStorage.setItem('caps-poker-storage', blob);
    } catch (_) { /* unavailable */ }
  }, store);
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(7000);

  const shot = path.join(OUT, `home-d1-${W}-${ENGINE}.png`);
  await p.screenshot({ path: shot });
  const raw = await p.evaluate(COLLECT);

  // GROUND SHOT — background with every glyph made transparent, so contrast is not measured
  // against the letterforms themselves.
  const gp = path.join(OUT, `.ground-${W}-${ENGINE}.png`);
  await p.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' });
  await p.screenshot({ path: gp });
  const img = PNG.sync.read(fs.readFileSync(gp));
  fs.unlinkSync(gp);
  const groundsFor = (box) => {
    const [x, y, w, h] = box.map((v) => v * 2);
    const pts = [];
    for (let i = 1; i <= 4; i++) for (let j = 1; j <= 3; j++) {
      const px2 = Math.min(img.width - 1, Math.max(0, Math.round(x + w * i / 5)));
      const py2 = Math.min(img.height - 1, Math.max(0, Math.round(y + h * j / 4)));
      const o = (img.width * py2 + px2) << 2;
      pts.push(lum(img.data[o], img.data[o + 1], img.data[o + 2]));
    }
    return pts.sort((a, b) => a - b);
  };
  const parseC = (c) => { const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const score = (t) => {
    if (t.emojiOnly) return { ...t, cls: 'EMOJI' };
    if (t.gradientText) return { ...t, cls: 'GRADIENT_TEXT' };
    const fg = parseC(t.fg); if (!fg) return { ...t, cls: 'UNPARSED' };
    const large = t.size >= 24 || (t.size >= 18.66 && +t.weight >= 700);
    const need = large ? 3 : 4.5;
    const g = groundsFor(t.box);
    const worst = Math.min(...g.map((v) => ratio(lum(...fg), v)));
    const med = ratio(lum(...fg), g[Math.floor(g.length / 2)]);
    return { ...t, need, worst: +worst.toFixed(2), median: +med.toFixed(2),
      cls: worst >= need ? 'PASS' : med >= need ? 'EDGE' : 'FAIL' };
  };
  const scored = raw.text.map(score);

  /**
   * ── CANARY ────────────────────────────────────────────────────────────────────────────────
   * Run on a FRESH BLANK PAGE, after the real numbers are taken.
   *
   * ⚠️ THE FIRST VERSION OF THIS BLOCK HAD THE EXACT BUG IT EXISTS TO CATCH, and reported VOID
   * because of it. It injected the canaries into the audited page — where the ground-shot style
   * tag (`* { color: transparent !important }`) was still in force. Both canaries rendered
   * invisible, `getComputedStyle().color` returned transparent for both, and they scored an
   * identical 1.06: the good one failed for the same wrong reason as the bad one.
   *
   * So it now loads a blank page, captures each canary's real colour BEFORE hiding anything,
   * then takes a ground shot with the canary glyphs made transparent — the same discipline the
   * real text gets, which is the only way the canary tests the real scoring path.
   */
  await p.goto('about:blank', { waitUntil: 'load' });
  await p.evaluate(() => {
    document.body.style.cssText = 'margin:0;background:#0a0a0a;height:100vh';
    const mk = (id, colour, top) => {
      const d = document.createElement('div');
      d.setAttribute('data-canary', id);
      d.textContent = id === 'bad' ? 'CANARY MUST FAIL' : 'CANARY MUST PASS';
      d.style.cssText = `position:fixed;left:8px;top:${top}px;font:400 15px sans-serif;` +
        `color:${colour};background:#0a0a0a;padding:2px 6px`;
      document.body.appendChild(d);
    };
    mk('bad', '#2a2a2a', 8);     // ~1.4:1 on #0a0a0a — must FAIL a 4.5 bar
    mk('good', '#f0ead6', 48);   // ~16:1 on #0a0a0a — must PASS
  });
  await p.waitForTimeout(150);
  const cRaw = await p.evaluate(() => [...document.querySelectorAll('[data-canary]')].map((el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { id: el.getAttribute('data-canary'), fg: s.color, size: parseFloat(s.fontSize),
      weight: s.fontWeight, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  }));
  const cGroundPath = path.join(OUT, `.canary-ground-${W}-${ENGINE}.png`);
  await p.addStyleTag({ content: '[data-canary]{color:transparent!important;-webkit-text-fill-color:transparent!important}' });
  await p.screenshot({ path: cGroundPath });
  const cImg = PNG.sync.read(fs.readFileSync(cGroundPath));
  fs.unlinkSync(cGroundPath);
  const cScored = cRaw.map((c) => {
    const [x, y, w, h] = c.box.map((v) => v * 2);
    const pts = [];
    for (let i = 1; i <= 4; i++) for (let j = 1; j <= 3; j++) {
      const px2 = Math.min(cImg.width - 1, Math.max(0, Math.round(x + w * i / 5)));
      const py2 = Math.min(cImg.height - 1, Math.max(0, Math.round(y + h * j / 4)));
      const o = (cImg.width * py2 + px2) << 2;
      pts.push(lum(cImg.data[o], cImg.data[o + 1], cImg.data[o + 2]));
    }
    pts.sort((a, b) => a - b);
    const fg = parseC(c.fg);
    const r = Math.min(...pts.map((v) => ratio(lum(...fg), v)));
    return { id: c.id, fg: c.fg, ratio: +r.toFixed(2), need: 4.5, verdict: r >= 4.5 ? 'PASS' : 'FAIL' };
  });
  const canaryOk = cScored.find((c) => c.id === 'bad')?.verdict === 'FAIL'
                && cScored.find((c) => c.id === 'good')?.verdict === 'PASS';

  const fails = scored.filter((c) => c.cls === 'FAIL');
  const small = raw.controls.filter((c) => c.w < 44 || c.h < 44);
  const unnamed = raw.controls.filter((c) => !c.name);
  const wm = raw.wordmark;

  report.widths[W] = {
    shot: path.basename(shot),
    canary: { ok: canaryOk, detail: cScored },
    wordmark: wm ? {
      fontSize: wm.size, family: wm.family, letterSpacing: wm.letterSpacing,
      renderedW: wm.box[2], frameW: W,
      fractionOfFrame: +(wm.box[2] / W).toFixed(3),
      overflowsFrame: wm.box[0] < 0 || (wm.box[0] + wm.box[2]) > W,
      clipped: wm.scrollW > wm.clientW + 1,
    } : 'WORDMARK NOT FOUND',
    floor: {
      controls: raw.controls.length,
      contrastFailures: fails.map((f) => ({ text: f.text, worst: f.worst, median: f.median, need: f.need })),
      edges: scored.filter((c) => c.cls === 'EDGE').map((c) => c.text),
      under44: small, unnamed: unnamed.length,
      pass: fails.length === 0 && small.length === 0 && unnamed.length === 0,
    },
    pageErrors: errs.filter((e) => !/NotAllowedError/.test(e)),
  };
  const r = report.widths[W];
  console.log(`${String(W).padEnd(4)} ${ENGINE.padEnd(8)} wordmark ${String(r.wordmark.fontSize).padStart(3)}pt ` +
    `${String(r.wordmark.renderedW).padStart(3)}/${W} (${(r.wordmark.fractionOfFrame * 100).toFixed(0)}%) ` +
    `${r.wordmark.overflowsFrame ? 'OVERFLOWS ' : ''}${r.wordmark.clipped ? 'CLIPPED ' : ''}` +
    `[${r.wordmark.family}]  floor=${r.floor.pass ? 'PASS' : 'FAIL'} ` +
    `${r.floor.contrastFailures.length ? `contrast:${r.floor.contrastFailures.length} ` : ''}` +
    `${r.floor.under44.length ? `small:${r.floor.under44.length} ` : ''}` +
    `canary=${canaryOk ? 'OK' : '*** VOID ***'}`);
  await ctx.close();
}

await browser.close();
server.close();
const allCanariesOk = Object.values(report.widths).every((w) => w.canary.ok);
report.VOID = allCanariesOk ? undefined : 'CANARY FAILED — the instrument did not catch a planted failure. No number here is quotable.';
fs.writeFileSync(path.join(OUT, `floor-${ENGINE}.json`), JSON.stringify(report, null, 2));
if (!allCanariesOk) process.exitCode = 1;
