/**
 * LANDING-DEPLOY — verify the LIVE page, on the LIVE URL, by looking inside its images.
 *
 * Not localhost, not a local export, not the branch. https://caps.ftable.co.il/landing.html.
 *
 * TWO ENGINES, TWO ROUTES TO THE SAME BYTES, and the difference is stated rather than hidden:
 *   · WEBKIT loads the live https:// URL DIRECTLY. Measured: it works from this container.
 *   · CHROMIUM cannot — the agent proxy's relay closes its tunnel mid-exchange
 *     (`ws_closed_mid_exchange` for caps.ftable.co.il:443), which is a container defect, not a
 *     site defect: curl and node fetch to the same URL return 200. So Chromium is served through
 *     a localhost reverse proxy that fetches from the live origin AT REQUEST TIME and streams the
 *     bytes through untouched. Every proxied response is md5'd against a direct fetch of the same
 *     URL in the same run, and the run FAILS if any pair differs — so "what Chromium rendered" is
 *     provably what production served, not a snapshot taken earlier.
 *
 * THE DETECTOR is the one built in LANDING-LANG-BUG: OCR (tesseract.js, Hebrew model) matched
 * against the product's OWN Hebrew vocabulary — every Hebrew token of 3+ characters in the `he`
 * table of utils/i18n.ts. A raw Unicode-range count is useless here: a Hebrew-trained model
 * transliterates Latin glyphs and reported 61 "Hebrew characters" in an entirely English
 * screenshot. Canary runs first, both directions, and the run aborts if either misbehaves.
 *
 *   npm i --no-save tesseract.js
 *   node tests/live-landing-verify.mjs
 */
import { chromium, webkit } from 'playwright';
import { createWorker } from 'tesseract.js';
import { createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ORIGIN = process.env.ORIGIN || 'https://caps.ftable.co.il';
const PAGE = '/landing.html';
const PORT = Number(process.env.PORT || 8961);
const OUT = process.env.OUT || 'docs/landing-deploy-2026-09-05';
const TAG = process.env.TAG || 'live';
const WIDTHS = [320, 393];
const LANGS = ['en', 'he'];
const TMP = '/tmp/live-landing-verify';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const fetchLive = async (p) => Buffer.from(await (await fetch(ORIGIN + p)).arrayBuffer());

// ── the product's own Hebrew vocabulary ──────────────────────────────────────────────────────
const VOCAB = [...new Set(
  [...fs.readFileSync('utils/i18n.ts', 'utf-8').matchAll(/'([^']*[֐-׿][^']*)'/g)]
    .flatMap((m) => m[1].match(/[֐-׿']{3,}/g) ?? [])
    .map((w) => w.replace(/'/g, '')).filter((w) => w.length >= 3))];

let worker = null;
const ocrCache = new Map();
async function hebrewWordsIn(pngPath, key) {
  if (ocrCache.has(key)) return ocrCache.get(key);
  worker ??= await createWorker('heb', undefined, { cachePath: TMP });
  const { data } = await worker.recognize(pngPath);
  const text = data.text.replace(/\s+/g, ' ');
  const hits = VOCAB.filter((w) => text.includes(w));
  const out = { hits, hitCount: hits.length };
  ocrCache.set(key, out);
  return out;
}

// ── CANARY, both directions, before anything is said about the live page ─────────────────────
const canary = { vocabSize: VOCAB.length };
{
  const conv = (src, name) => { const d = `${TMP}/${name}.png`; execFileSync('ffmpeg', ['-y', '-i', src, d], { stdio: 'ignore' }); return d; };
  canary.knownHebrew = await hebrewWordsIn(conv('tests/fixtures/live-2026-09-05-game-boards.webp', 'can-he'), 'can-he');
  canary.knownEnglish = await hebrewWordsIn(conv('public/shots/game-boards-en.webp', 'can-en'), 'can-en');
  canary.flagsHebrew = canary.knownHebrew.hitCount > 0;
  canary.clearsEnglish = canary.knownEnglish.hitCount === 0;
  if (!canary.flagsHebrew || !canary.clearsEnglish) {
    console.log(JSON.stringify({ CANARY_FAILED: canary }, null, 1)); process.exit(2);
  }
}

// ── the pass-through, with byte-identity proved on every response ────────────────────────────
const byteChecks = [];
const server = http.createServer(async (req, res) => {
  const p = (req.url || '/').split('?')[0];
  try {
    const body = await fetchLive(p);
    const direct = await fetchLive(p);          // second, independent fetch of the same URL
    byteChecks.push({ path: p, proxied: md5(body), direct: md5(direct), identical: md5(body) === md5(direct) });
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html'
      : p.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(502); res.end('upstream'); }
});
await new Promise((r) => server.listen(PORT, r));

const rows = [];
const failures = [];
for (const [engine, L, base, how] of [
  ['webkit', webkit, `${ORIGIN}`, 'the live https:// URL, loaded directly'],
  ['chromium', chromium, `http://localhost:${PORT}`, 'live bytes streamed at request time (Chromium cannot open the origin in this container)'],
]) {
  const b = await L.launch(engine === 'chromium'
    ? { executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  for (const lang of LANGS) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${base}${PAGE}?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(3000);
    // Force the lazy figure to paint so the committed screenshot shows what a scrolling visitor sees.
    await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 1200)); window.scrollTo(0, 0); });
    await page.waitForTimeout(900);

    const shown = await page.evaluate(() => [...document.querySelectorAll('img')]
      .filter((i) => { const r = i.getBoundingClientRect(); const cs = getComputedStyle(i);
        return r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0; })
      .map((i) => new URL(i.getAttribute('src'), location.href).pathname));

    let hebrew = 0; const words = new Set();
    for (const src of shown) {
      const name = path.basename(src);
      const bin = `${TMP}/${TAG}-${name}`;
      if (!fs.existsSync(bin)) fs.writeFileSync(bin, await fetchLive(src));   // ALWAYS from the live origin
      const png = `${bin}.png`;
      if (!fs.existsSync(png)) execFileSync('ffmpeg', ['-y', '-i', bin, png], { stdio: 'ignore' });
      const r = await hebrewWordsIn(png, `${TAG}-${name}`);
      hebrew += r.hitCount; r.hits.forEach((h) => words.add(h));
    }
    const row = { engine, how, lang, width: w, images: shown.length,
      srcs: shown.map((s) => path.basename(s)), hebrewWordsInImages: hebrew, words: [...words].slice(0, 8) };
    rows.push(row);
    if (lang === 'en' && hebrew > 0) failures.push({ ...row, why: 'HEBREW INSIDE AN IMAGE ON THE ENGLISH PAGE' });
    if (shown.length === 0) failures.push({ ...row, why: 'no images painted' });

    await page.screenshot({ path: `${OUT}/${TAG}-${lang}-${w}-${engine}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
}
if (worker) await worker.terminate();
await new Promise((r) => server.close(r));

const byteMismatch = byteChecks.filter((c) => !c.identical);
if (byteMismatch.length) failures.push({ why: 'proxied bytes differed from a direct fetch', byteMismatch });
const report = { origin: ORIGIN, tag: TAG, canary, rows, failures, failureCount: failures.length,
  byteIdentityChecks: byteChecks.length, byteMismatches: byteMismatch.length };
fs.writeFileSync(`${OUT}/live-verify-${TAG}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(failures.length ? 1 : 0);
