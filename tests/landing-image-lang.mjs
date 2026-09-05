/**
 * LANDING-LANG-BUG — does the ENGLISH landing page show any HEBREW *inside an image*?
 *
 * WHY THIS EXISTS. The tap-list sweep and the landing loop both passed this page while the live
 * English page was showing a fully Hebrew screenshot. Neither could have caught it: a DOM text
 * scan reads text NODES, and a word baked into a PNG is not a text node. The landing loop did
 * check the image `src` — but a filename is a claim about content, not the content. This reads
 * the pixels.
 *
 * THE DETECTOR, AND WHY IT IS NOT A UNICODE-RANGE COUNT. The first version counted characters in
 * the Hebrew Unicode block returned by the `heb` OCR model, and it reported 61 Hebrew characters
 * in a screenshot that is entirely English: a Hebrew-trained model transliterates Latin glyphs
 * into Hebrew-looking ones ("ALL CARDS PLACED" came back as "ופפסאום 5םאאס"). A range count is
 * therefore useless here. This matches the app's OWN Hebrew strings instead — every Hebrew token
 * of 3+ characters in the `he` table of utils/i18n.ts — so a hit means the screenshot contains a
 * word the product actually renders, not OCR noise. The vocabulary comes from the product, so it
 * cannot drift away from what the screens say.
 *
 * CANARY FIRST, BOTH DIRECTIONS, as this project's probes are required to:
 *   · a known-Hebrew fixture (the image the LIVE page was serving on 2026-09-05) must be FLAGGED
 *   · a known-English asset must come back CLEAN
 * If either canary misbehaves the run aborts and reports nothing about the page.
 *
 * COST. OCR is slow and an image's content does not change with viewport or engine, so each
 * distinct file is read ONCE and cached; the per-combination work is only "which file is visible".
 *
 * DEPENDENCY. tesseract.js is NOT in package.json — package.json is outside this sprint's edit
 * scope, and this probe is not part of the jest suite. Install it alongside, un-saved:
 *
 *   npm i --no-save tesseract.js
 *   node tests/landing-image-lang.mjs                    # the working tree's public/landing.html
 *   TARGET=live node tests/landing-image-lang.mjs        # the deployed page, fetched over HTTPS
 */
import { chromium, webkit } from 'playwright';
import { createWorker } from 'tesseract.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// TARGET=livesnapshot serves the bytes actually DEPLOYED, fetched with curl and dropped in a
// directory. The container's browser cannot open caps.ftable.co.il (the agent proxy resets the
// tunnel) while curl to the same URL returns 200, so "render the live page" means "render the
// live page's exact bytes" — verified byte-identical by md5 against what the CDN served.
const ROOT = path.resolve(process.env.ROOT || (process.env.TARGET === 'livesnapshot' ? '/tmp/live-snapshot' : 'public'));
const PORT = Number(process.env.PORT || 8977);
const OUT = process.env.OUT || 'docs/landing-lang-2026-09-05';
const WIDTHS = [320, 393];
const LANGS = ['en', 'he'];
const TARGET = process.env.TARGET || 'local';
const TMP = '/tmp/landing-image-lang';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ── the product's own Hebrew vocabulary ──────────────────────────────────────────────────────
const i18n = fs.readFileSync('utils/i18n.ts', 'utf-8');
const VOCAB = [...new Set(
  [...i18n.matchAll(/'([^']*[֐-׿][^']*)'/g)]
    .flatMap((m) => m[1].match(/[֐-׿']{3,}/g) ?? [])
    .map((w) => w.replace(/'/g, ''))
    .filter((w) => w.length >= 3),
)];

let worker = null;
const cache = new Map();
async function hebrewWordsIn(file) {
  if (cache.has(file)) return cache.get(file);
  // cachePath keeps the ~15MB heb.traineddata OUT of the repo root, where the first run
  // otherwise drops it and the next sweep reports an untracked file.
  worker ??= await createWorker('heb', undefined, { cachePath: TMP });
  const { data } = await worker.recognize(file);
  const text = data.text.replace(/\s+/g, ' ');
  const hits = VOCAB.filter((w) => text.includes(w));
  const out = { hits, hitCount: hits.length, sample: text.slice(0, 90) };
  cache.set(file, out);
  return out;
}

// ── CANARY ───────────────────────────────────────────────────────────────────────────────────
const canary = { vocabSize: VOCAB.length };
{
  const hebFixture = 'tests/fixtures/live-2026-09-05-game-boards.webp';
  const engAsset = 'public/shots/game-boards-en.webp';
  const toPng = (src, name) => {
    const dst = `${TMP}/${name}.png`;
    execFileSync('ffmpeg', ['-y', '-i', src, dst], { stdio: 'ignore' });
    return dst;
  };
  canary.knownHebrew = await hebrewWordsIn(toPng(hebFixture, 'canary-he'));
  canary.knownEnglish = await hebrewWordsIn(toPng(engAsset, 'canary-en'));
  canary.flagsHebrew = canary.knownHebrew.hitCount > 0;
  canary.clearsEnglish = canary.knownEnglish.hitCount === 0;
  if (!canary.flagsHebrew || !canary.clearsEnglish) {
    console.log(JSON.stringify({ CANARY_FAILED: canary }, null, 1));
    process.exit(2);
  }
}

// ── serve the working tree, or point at the deployed page ────────────────────────────────────
const MIME = { '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css',
  '.js': 'text/javascript', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const f = path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const BASE = TARGET === 'live' ? 'https://caps.ftable.co.il' : `http://localhost:${PORT}`;

const rows = [];
const failures = [];
const notes = [];
for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await launcher.launch(engine === 'chromium'
    ? { executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  for (const lang of LANGS) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/landing.html?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);
    // EVERY image, not just the hero — and only the ones actually PAINTED.
    const shown = await page.evaluate(() => [...document.querySelectorAll('img')]
      .filter((i) => { const r = i.getBoundingClientRect(); const cs = getComputedStyle(i);
        return r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0; })
      .map((i) => ({ src: new URL(i.getAttribute('src'), location.href).pathname, alt: (i.alt || '').slice(0, 40) })));
    const backgrounds = await page.evaluate(() => [...document.querySelectorAll('*')]
      .map((e) => getComputedStyle(e).backgroundImage)
      .filter((v) => v && v !== 'none' && /url\(/.test(v)).length);

    const perImage = [];
    for (const im of shown) {
      const name = path.basename(im.src).replace(/\W+/g, '_');
      const local = TARGET === 'live'
        ? (() => { const p2 = `${TMP}/live-${name}`;
            if (!fs.existsSync(p2)) execFileSync('curl', ['-s', '-o', p2, `${BASE}${im.src}`, '--max-time', '60']);
            return p2; })()
        : path.join(ROOT, im.src);
      const png = `${TMP}/${TARGET}-${name}.png`;
      if (!fs.existsSync(png)) execFileSync('ffmpeg', ['-y', '-i', local, png], { stdio: 'ignore' });
      perImage.push({ src: im.src, ...(await hebrewWordsIn(png)) });
    }
    const hebrewInImages = perImage.reduce((n, i) => n + i.hitCount, 0);
    const row = { engine, lang, width: w, images: shown.length, cssBackgroundImages: backgrounds,
      srcs: shown.map((s) => path.basename(s.src)), hebrewWordsInImages: hebrewInImages,
      words: [...new Set(perImage.flatMap((i) => i.hits))].slice(0, 8) };
    rows.push(row);
    // ROYE'S RULE, ENCODED WITH ITS ASYMMETRY INTACT: "It cannot be that someone picks English and
    // one thing shows in Hebrew. The other way round is acceptable."
    //   BLOCKING — Hebrew inside an image on the ENGLISH page. Zero tolerance.
    //   NOTE     — the Hebrew page showing English screenshots. ACCEPTABLE, so it is not a failure;
    //              it is still reported, because on a page that DOES swap it means the swap broke.
    if (lang === 'en' && hebrewInImages > 0) failures.push({ ...row, why: 'Hebrew inside an image on the ENGLISH page' });
    if (shown.length === 0) failures.push({ ...row, why: 'no images painted at all' });
    if (lang === 'he' && hebrewInImages === 0) notes.push({ ...row, why: 'Hebrew page is showing English screenshots — acceptable under the rule, but the swap is not happening' });

    await page.screenshot({ path: `${OUT}/${TARGET}-${lang}-${w}-${engine}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
}
if (worker) await worker.terminate();
await new Promise((r) => server.close(r));

const report = { target: TARGET, base: BASE, canary, rows, failures, failureCount: failures.length,
  notes, noteCount: notes.length };
fs.writeFileSync(`${OUT}/image-lang-${TARGET}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(failures.length ? 1 : 0);
