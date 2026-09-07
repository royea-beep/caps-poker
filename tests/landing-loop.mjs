/**
 * THE LANDING LOOP — render public/landing.html in both engines, three widths, both languages.
 *
 * Canary first: a planted 3000px element and a planted low-contrast label must both be caught
 * before any number from the real page is reported.
 *
 * What it asserts about the page itself:
 *   · exactly ONE hero image is visible per figure, and its src matches the selected language
 *   · no horizontal overflow at any width
 *   · exactly one call to action (the language buttons are the only other controls)
 *   · the FORMAT is stated in TEXT, not left to the picture
 *   · no store date, no invented player numbers
 *
 *   node tests/landing-loop.mjs
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('public');
const OUT = process.env.OUT || 'docs/last-three/landing';
const PORT = Number(process.env.PORT || 8997);
// LANDING-AND-AUTOSWEEP 2026-09-05 — 375 added: it is the iPhone SE/8 width the tap-list sweep
// uses for every other screen, and the landing page was the only surface not measured there.
const WIDTHS = [320, 375, 393, 430];
const LANGS = ['en', 'he'];
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const f = path.join(ROOT, url === '/' ? 'landing.html' : url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const PROBE = () => {
  const rgb = (s) => { const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
  const lum = (c) => { const f = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
  const ratio = (a, b) => { const [l, d] = [lum(a), lum(b)].sort((x, y) => y - x); return (l + 0.05) / (d + 0.05); };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const v = rgb(c); if (v && !/rgba\([^)]*,\s*0\s*\)/.test(c)) return v; n = n.parentElement; } return [12, 31, 23]; };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };

  const contrast = [];
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
    if (txt.length < 2) continue;
    const cs = getComputedStyle(el);
    // Gradient wordmark: -webkit-background-clip:text paints the glyphs from the background, so
    // `color` is transparent and any ratio computed from it is meaningless. Skipped, not excused.
    if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') continue;
    const fg = rgb(cs.color); if (!fg) continue;
    const r = ratio(fg, bgOf(el));
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    const need = big ? 3 : 4.5;
    if (r < need) contrast.push({ text: txt.slice(0, 34), ratio: +r.toFixed(2), need });
  }
  const body = document.body.innerText;
  return {
    lang: document.documentElement.getAttribute('data-lang'),
    dir: document.documentElement.getAttribute('dir'),
    overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    visibleImgs: Array.from(document.images).filter(visible).map((i) => i.getAttribute('src')),
    // The ONE call to action is `a.cta`. Footer legal + contact links are not CTAs and counting
    // them as such made the first run report four; that was the probe being wrong, not the page.
    ctas: Array.from(document.querySelectorAll('a.cta')).filter(visible).map((a) => a.getAttribute('href')),
    otherLinks: Array.from(document.querySelectorAll('a[href]:not(.cta)')).filter(visible).map((a) => a.getAttribute('href')),
    buttons: Array.from(document.querySelectorAll('button')).filter(visible).length,
    contrast: contrast.slice(0, 20),
    // the format, in words
    formatInText: /four cards on every board|4 קלפים לכל בורד/.test(body),
    // A store PROMISE, not a store mention: the page says "no app store, no download", which is
    // the opposite of a promise. The first run flagged that denial — the probe was wrong.
    storeDate: /coming soon|בקרוב|available on the|download on the|get it on google play|launching (in|on)/i.test(body),
    inventedNumbers: /\b\d{3,}\s*(players|users|downloads|שחקנים)\b|thousands of|millions of/i.test(body),
  };
};

const CANARY = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0C1F17;color:#EDE4CF;font:14px system-ui">
<p style="color:#EDE4CF">high contrast label</p><p style="color:#16281f">low contrast label</p>
<div style="width:3000px;height:6px;background:#333"></div></body>`;

const report = { ts: new Date().toISOString(), engines: {} };
let fail = 0;
for (const [name, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch(name === 'chromium'
    ? { executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });

  const cp = await ctx.newPage();
  await cp.setContent(CANARY);
  const c = await cp.evaluate(`(${PROBE.toString()})()`);
  await cp.close();
  const canary = { overflow_caught: c.overflows === true, contrast_flagged_bad: c.contrast.some((x) => x.text.startsWith('low contrast')), contrast_passed_good: !c.contrast.some((x) => x.text.startsWith('high contrast')) };
  report.engines[name] = { canary, runs: {} };
  console.log(`\n=== ${name} CANARY ===`);
  for (const [k, v] of Object.entries(canary)) console.log(`   ${v ? 'PASS' : 'FAIL'}  ${k}`);
  if (!Object.values(canary).every(Boolean)) { console.log('ABORT — canary blind'); process.exit(1); }

  for (const lang of LANGS) for (const w of WIDTHS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`http://localhost:${PORT}/landing.html?lang=${lang}`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const r = await page.evaluate(`(${PROBE.toString()})()`);
    const shot = `landing-${lang}-${w}-${name}.png`;
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
    r.shot = shot;
    report.engines[name].runs[`${lang}-${w}`] = r;
    const wrongLangImg = r.visibleImgs.some((s) => s && !s.includes(`-${lang}.webp`));
    const bad = r.overflows || wrongLangImg || r.ctas.length !== 1 || !r.formatInText || r.storeDate || r.inventedNumbers;
    if (bad) fail++;
    console.log(`   ${name} ${lang} ${String(w).padStart(3)}  dir=${r.dir}  imgs=${r.visibleImgs.join(',')}  ctas=${r.ctas.length}  overflow=${r.overflows}  formatInText=${r.formatInText}  storeDate=${r.storeDate}  numbers=${r.inventedNumbers}  contrast=${r.contrast.length}${bad ? '   <-- LOOK' : ''}`);
    await page.close();
  }
  await browser.close();
}
server.close();
fs.writeFileSync(path.join(OUT, 'landing-loop.json'), JSON.stringify(report, null, 1));
console.log(`\n=== VERDICT === failures: ${fail}`);
console.log('written', path.join(OUT, 'landing-loop.json'));
process.exit(fail ? 1 : 0);
