/**
 * THE I18N LOOP — Roye's language rule, measured in a real browser.
 *
 * THE RULE IS ASYMMETRIC, and this instrument encodes that asymmetry:
 *   1. ENGLISH MUST NEVER SHOW HEBREW. Zero tolerance, no allowlist. One Hebrew character
 *      rendered on an English screen is a defect.
 *   2. Hebrew showing an English word is ACCEPTABLE — English terms are internationally
 *      legible — so those are reported as GAPS to fill, at lower severity, not as failures.
 *   3. Hand-rank names ("Pair of Kings", "Full House") and the CAPS loanwords stay English in
 *      BOTH languages by standing product rule. They are allowlisted out of the Hebrew-mode
 *      gap list so the gap count means something.
 *
 * RENDERED, NOT GREPPED. The gold pass proved a source read misclassifies what the DOM shows:
 * a style named like a swatch turned out to be painting a Pressable. This reads text nodes out
 * of the live DOM in both languages.
 *
 * CANARY FIRST: a planted page with a known Hebrew string on an "English" screen and a known
 * English string on a "Hebrew" screen. Both detectors must fire or the run aborts.
 *
 *   node tests/i18n-loop.mjs [dist] [outdir]
 *   WIDTHS=393 ENGINES=chromium node tests/i18n-loop.mjs      # fast pass
 */
import { chromium, webkit } from 'playwright';
import { serve } from '../tools/content-lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.argv[2] || '/tmp/webship';
const OUT = process.argv[3] || 'docs/full-i18n/loop';
const PORT = Number(process.env.PORT || 8999);
const WIDTHS = (process.env.WIDTHS || '320,375,393,430').split(',').map(Number);
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',');

/** Every screen a player can reach, plus the dev screens, so nothing hides. */
const ROUTES = [
  '/', '/play', '/profile', '/settings', '/shop', '/chip-store', '/leaderboard', '/stats',
  '/achievements', '/missions', '/rank', '/hand-history', '/referral', '/coaching',
  '/theme-pick', '/orientation-pick', '/lobby', '/lobby/private', '/friends', '/cups',
  '/battle-pass', '/replay', '/results', '/gameover', '/spectate', '/game',
];

/** English that is CORRECT inside Hebrew — product rules, not gaps. */
const EN_OK_IN_HE = [
  // HAND-RANK NAMES — a standing product rule: poker terminology stays English in BOTH languages.
  // Matching is per WORD, so every word of every rank name must be here or a correct string like
  // "ROYAL FLUSH" is counted as a gap. (It was, on the first pass. The list was wrong, not the app.)
  'high', 'card', 'pair', 'two', 'three', 'four', 'five', 'of', 'a', 'kind', 'straight', 'flush',
  'full', 'house', 'royal', 'beats', 'and', 'over', 'ace', 'aces', 'king', 'kings', 'queen',
  'queens', 'jack', 'jacks', 'ten', 'tens', 'nine', 'nines', 'eight', 'eights', 'seven', 'sevens',
  'six', 'sixes', 'fives', 'fours', 'threes', 'twos', 'deuces',
  // BRAND AND LOANWORDS the Hebrew table itself deliberately keeps in English.
  'caps', 'poker', 'complete', 'elo', 'xp', 'vs', 'ok', 'id', 'sit', 'go', 'bot', 'bots',
  // THEME NAMES — names, not descriptions. CLASSIC / FIVE-O / STREET are the products' names.
  'classic', 'five', 'o', 'street', 'fiveo',
];

fs.mkdirSync(OUT, { recursive: true });

const PROBE = (enOk) => {
  const HEB = /[֐-׿]/;
  const LAT = /[A-Za-z]{2}/;
  const okSet = new Set(enOk);
  const out = { hebrew: [], latin: [], nodes: 0 };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;         // not painted
    const t = (n.textContent || '').trim();
    if (!t) continue;
    out.nodes++;
    if (HEB.test(t)) out.hebrew.push(t.slice(0, 60));
    else if (LAT.test(t)) {
      // strip digits/punctuation, then check the word set
      const words = t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
      if (words.length && !words.every((w) => okSet.has(w))) out.latin.push(t.slice(0, 60));
    }
  }
  out.hebrew = [...new Set(out.hebrew)];
  out.latin = [...new Set(out.latin)];
  return out;
};

const CANARY = `<!doctype html><meta charset=utf-8><body style="background:#111;color:#eee;font:14px system-ui">
<p>plain english label</p><p>מחרוזת בעברית</p><p style="display:none">מוסתר לא נספר</p></body>`;

const report = { dist: DIST, ts: new Date().toISOString(), engines: {} };
const server = await serve(DIST, PORT);
let aborted = null;

for (const name of ENGINES) {
  const launcher = name === 'webkit' ? webkit : chromium;
  const browser = await launcher.launch(name === 'chromium'
    ? { executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US' });
  await ctx.route('**/*supabase.co/**', (r) => r.abort());
  await ctx.route('**/*ftable.co.il/**', (r) => r.abort());

  const cp = await ctx.newPage();
  await cp.setContent(CANARY);
  const c = await cp.evaluate(`(${PROBE.toString()})(${JSON.stringify(EN_OK_IN_HE)})`);
  await cp.close();
  const canary = {
    hebrew_caught: c.hebrew.some((s) => /מחרוזת/.test(s)),
    latin_caught: c.latin.some((s) => /plain english/.test(s)),
    hidden_not_counted: !c.hebrew.some((s) => /מוסתר/.test(s)),
  };
  report.engines[name] = { canary, runs: {} };
  console.log(`\n=== ${name} CANARY ===`);
  for (const [k, v] of Object.entries(canary)) console.log(`   ${v ? 'PASS' : 'FAIL'}  ${k}`);
  if (!Object.values(canary).every(Boolean)) { aborted = `${name} canary blind`; await browser.close(); break; }

  for (const lang of ['en', 'he']) for (const w of WIDTHS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 852 });
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('caps_language', l);
        localStorage.setItem('caps-device-id', 'I18N-PROBE');
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('caps_games_played', '25');
      } catch (_) {}
    }, lang);
    for (const route of ROUTES) {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const r = await page.evaluate(`(${PROBE.toString()})(${JSON.stringify(EN_OK_IN_HE)})`);
      const key = `${lang}-${w}-${route}`;
      report.engines[name].runs[key] = r;
      if (lang === 'en' && r.hebrew.length) {
        console.log(`   ❌ ${name} EN ${w} ${route}  HEBREW ON AN ENGLISH SCREEN x${r.hebrew.length}`);
        for (const s of r.hebrew) console.log(`         ${JSON.stringify(s)}`);
      }
    }
    await page.close();
  }
  await browser.close();
}
server.close();
fs.writeFileSync(path.join(OUT, 'i18n-loop.json'), JSON.stringify(report, null, 1));

console.log('\n=== VERDICT ===');
if (aborted) { console.log('ABORTED:', aborted); process.exit(1); }
let enHeb = 0, heGapRoutes = new Map();
for (const e of Object.values(report.engines))
  for (const [k, r] of Object.entries(e.runs)) {
    const [lang, , ...rest] = k.split('-');
    const route = k.slice(k.indexOf('/'));
    if (lang === 'en') enHeb += r.hebrew.length;
    else if (r.latin.length) heGapRoutes.set(route, Math.max(heGapRoutes.get(route) || 0, r.latin.length));
  }
console.log(`HEBREW RENDERED ON ENGLISH SCREENS: ${enHeb}   (must be 0)`);
console.log(`Hebrew screens still showing English, by route (gaps, lower severity):`);
for (const [r, n] of [...heGapRoutes].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${r}`);
console.log('written', path.join(OUT, 'i18n-loop.json'));
