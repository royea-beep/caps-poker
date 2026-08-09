/**
 * ITERATION 12 — ONE QUESTION: does he-IL actually make the app render Hebrew?
 *
 * getLanguage() (utils/i18n.ts:24-37) reads the device locale and falls back to 'en'. Every
 * probe this project has ever run was en-US, so the Hebrew path has never once been executed.
 * This gates the tester round: Roye's testers are Israelis on Hebrew devices.
 *
 * Runs the SAME surfaces in BOTH locales so the comparison is like-for-like. Exact match only
 * — substring matching once reported "ידיים" found inside "מיידיים", a false pass.
 *
 *   node tests/locale-he-verify.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = {
  caps_tutorial_seen: 'true',
  caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true',
  caps_games_played: '99',
};

// The t() values already present in utils/i18n.ts — if the he path works, these must appear.
const WANT_HE = ['שחק אונליין', 'יציאה', 'היסטוריית ידיים', 'שחקן יחיד', 'פרופיל', 'אחוז ניצחון'];
const WANT_EN = ['Play Online', 'Sign Out', 'Hand History', 'Single Player', 'Profile', 'Win Rate'];

const check = `(wanted)=>{const res={};
for(const w of wanted){res[w]={found:false};
  for(const el of document.querySelectorAll('*')){
    if(el.children.length) continue;
    const t=(el.textContent||'').trim();
    if(t!==w && !t.startsWith(w+' ') && !t.startsWith(w+'·')) continue;
    const r=el.getBoundingClientRect();
    res[w]={found:true,text:t.slice(0,60),clientW:Math.round(r.width),scrollW:el.scrollWidth,
            clipped: el.scrollWidth>Math.ceil(r.width)+1};
    break;}}
return res;}`;

async function run(locale) {
  const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`, `--lang=${locale}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const page = await ctx.newPage();
  const r = { locale };
  await page.goto(URL + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
  r.navigatorLanguage = await page.evaluate(() => navigator.language);
  r.mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
  await page.evaluate(`window.__c=${check}`);
  r.home = await page.evaluate(`window.__c(${JSON.stringify(WANT_HE)})`);
  r.homeEn = await page.evaluate(`window.__c(${JSON.stringify(WANT_EN)})`);

  for (const route of ['play', 'profile']) {
    await page.goto(`${URL}/${route}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.evaluate(`window.__c=${check}`);
    r[route] = await page.evaluate(`window.__c(${JSON.stringify(WANT_HE)})`);
    r[route + 'En'] = await page.evaluate(`window.__c(${JSON.stringify(WANT_EN)})`);
  }
  await browser.close();
  return r;
}

const out = { url: URL, ts: new Date().toISOString(), runs: [] };
for (const loc of ['he-IL', 'en-US']) out.runs.push(await run(loc));

const fmt = (o) => Object.entries(o).filter(([, v]) => v.found)
  .map(([k, v]) => `${k}(${v.clientW}/${v.scrollW}${v.clipped ? ' CLIPPED' : ''})`).join(' · ') || '(none)';
for (const r of out.runs) {
  console.log(`\n== ${r.locale}  navigator.language=${r.navigatorLanguage}  mounted=${r.mounted}`);
  for (const s of ['home', 'play', 'profile']) {
    console.log(`  ${s.padEnd(8)} HE: ${fmt(r[s])}`);
    console.log(`  ${''.padEnd(8)} EN: ${fmt(r[s + 'En'])}`);
  }
}
fs.writeFileSync('tests/locale-he-result.json', JSON.stringify(out, null, 1));
