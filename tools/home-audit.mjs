/**
 * THE CONTROL: the home screen as it ships, measured — before anyone proposes replacing it.
 *
 * Every concept in this sprint is judged against these numbers, so they are taken from the REAL
 * export driven through the app's own onboarding state, not from reading the JSX. The front-door
 * sprint found twelve controls on this exact screen invisible to assistive tech; that count is
 * re-taken here rather than quoted.
 *
 *   node tools/home-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './content-lib.mjs';

const PORT = Number(process.env.PORT || 8992);
const DIST = process.env.DIST || 'web-tie-dist';
const OUT = process.env.OUT_DIR || '/tmp/home-audit';
fs.mkdirSync(OUT, { recursive: true });

const server = await serve(DIST, PORT);
const browser = await launch();

const seed = JSON.stringify((() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  return st;
})());

const results = [];
for (const width of [393, 320]) {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.addInitScript((blob) => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
      localStorage.setItem('caps-poker-storage', blob);
    } catch (_) {}
  }, seed);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(6000);
  const shot = path.join(OUT, `home-control-${width}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const audit = await page.evaluate(() => {
    const CTRL = 'button,[role="button"],a,input,select,textarea,[role="radio"],[role="tab"],[role="link"],[role="checkbox"],[role="switch"]';
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
    const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
      el.textContent?.trim() || el.getAttribute('title') || '').trim();
    const controls = [...document.querySelectorAll(CTRL)].filter(vis);
    const small = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
    const unnamed = controls.filter((el) => !name(el));
    // every visible text node, for the contrast pass
    const texts = [...document.querySelectorAll('*')].filter((el) =>
      vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    return {
      controlCount: controls.length,
      controls: controls.map((el) => ({ name: name(el).slice(0, 46),
        w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
      under44: small.map((el) => ({ name: name(el).slice(0, 34),
        w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
      unnamed: unnamed.length,
      textCount: texts.length,
      pageHeight: Math.round(document.documentElement.scrollHeight),
      // what a stranger actually sees without scrolling
      aboveFold: [...document.querySelectorAll('*')].filter((el) => vis(el) &&
        el.getBoundingClientRect().top < 852 &&
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((el) => el.textContent.trim().slice(0, 40)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 40),
    };
  });
  results.push({ width, shot, ...audit });
  await ctx.close();
}
await browser.close(); server.close();

for (const r of results) {
  console.log(`\n══ HOME AS IT SHIPS — ${r.width}pt ══  (page is ${r.pageHeight}px tall; viewport 852)`);
  console.log(`  exposed controls: ${r.controlCount}   under 44pt: ${r.under44.length}   unnamed: ${r.unnamed}`);
  console.log(`  text elements: ${r.textCount}`);
  if (r.under44.length) {
    console.log(`  UNDER 44pt:`);
    for (const c of r.under44) console.log(`    ${String(c.w).padStart(4)}x${String(c.h).padStart(3)}  ${c.name}`);
  }
  console.log(`  ABOVE THE FOLD, in order:`);
  r.aboveFold.forEach((t, i) => console.log(`    ${String(i + 1).padStart(2)}. ${t.replace(/\n/g, ' ⏎ ')}`));
}
fs.writeFileSync(path.join(OUT, 'control.json'), JSON.stringify(results, null, 2));
console.log(`\n  screenshots + control.json in ${OUT}\n`);
