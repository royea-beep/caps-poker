/**
 * ITERATION 9 — assert Hebrew on the surfaces BEHIND onboarding.
 *
 * THE HARNESS WAS THE BLOCKER, NOT THE STRINGS. Four surfaces across two iterations were
 * shipped tsc-clean and never once observed rendering, every time with the same sentence:
 * "probe never left onboarding". This seeds the persisted flags before the page loads, so
 * the probe lands on the tab bar.
 *
 * The keys are NOT invented — they are the ones tests/visual/caps_unify3_proof2.spec.ts
 * already uses (`caps_onboarding_done`, `caps_tutorial_seen`,
 * `has_seen_interactive_tutorial`). NO app code was added for this; there is no skip flag in
 * the bundle.
 *
 *   PROBE_DIR=web-heb-dist node tests/hebrew-first-run-verify.mjs
 *   CAPS_URL=https://caps.ftable.co.il node tests/hebrew-first-run-verify.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const LIVE = process.env.CAPS_URL || null;
const DIR = path.resolve(process.env.PROBE_DIR || 'web-heb-dist');
const PORT = Number(process.env.PROBE_PORT || 8142);
const W = 375, H = 812;

let base = LIVE, server = null;
if (!LIVE) {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
  const toModule = (h) => h.replace(/<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
    '<script type="module" src="$1"></script>');
  server = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    let f = path.join(DIR, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
    const e = path.extname(f).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[e] || 'application/octet-stream' });
    if (e === '.html') { res.end(toModule(fs.readFileSync(f, 'utf-8'))); return; }
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  base = `http://localhost:${PORT}`;
}

const SEED = {
  caps_tutorial_seen: 'true',
  caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true',
  caps_games_played: '99',
};

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// For each wanted string: is it on screen, and does it FIT? clientWidth vs scrollWidth at 375px.
// A clipped Hebrew label is worse than the English one it replaced, so this is the real test.
const check = `(wanted)=>{const res={};
for(const wtxt of wanted){res[wtxt]={found:false};
  for(const el of document.querySelectorAll('*')){
    if(el.children.length) continue;
    const t=(el.textContent||'').trim();
    if(t!==wtxt && !t.startsWith(wtxt+' ') && !t.startsWith(wtxt+'·')) continue;
    const r=el.getBoundingClientRect();
    res[wtxt]={found:true, text:t.slice(0,70), clientW:Math.round(r.width), scrollW:el.scrollWidth,
               clipped: el.scrollWidth > Math.ceil(r.width)+1};
    break;}}
return res;}`;

const englishSweep = `()=>{const bad=[];
for(const el of document.querySelectorAll('*')){
  if(el.children.length) continue;
  const t=(el.textContent||'').trim();
  if(/^[A-Za-z][A-Za-z0-9 ,.'!?&%:+-]{2,}$/.test(t)) bad.push(t.slice(0,44));}
return [...new Set(bad)];}`;

const tap = async (page, label) => {
  await page.evaluate(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()===${JSON.stringify(label)});if(el)window.__f(el);})()`);
  await page.waitForTimeout(2500);
};

const out = { base, ts: new Date().toISOString(), steps: {} };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
// SEED BEFORE ANY PAGE SCRIPT RUNS — this is what gets us past onboarding.
await ctx.addInitScript((seed) => {
  for (const [k, v] of Object.entries(seed)) { try { localStorage.setItem(k, v); } catch {} }
}, SEED);

const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);
await page.evaluate(`window.__c=${check}; window.__f=${fire}; window.__e=${englishSweep}`);

out.steps.mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
out.steps.pastOnboarding = await page.evaluate(() => !/Continue/.test(document.body.innerText || ''));
out.steps.home = await page.evaluate(`window.__c(["+ ז'יטונים","ההתקדמות שלי","תחרות","הקוד שלך"])`);
out.steps.homeEnglish = await page.evaluate(`window.__e()`);

await page.goto(base + '/play', { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(6000); await page.evaluate(`window.__c=${check}; window.__f=${fire}; window.__e=${englishSweep}`);
out.steps.playMenu = await page.evaluate(`window.__c(["שחקן יחיד","לובי מרובה משתתפים","שולחן פרטי מהיר"])`);
out.steps.playEnglish = await page.evaluate(`window.__e()`);

await page.goto(base + '/profile', { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(6000); await page.evaluate(`window.__c=${check}; window.__f=${fire}; window.__e=${englishSweep}`);
out.steps.profile = await page.evaluate(`window.__c(["פרופיל","ידיים","אחוז ניצחון","רצף"])`);
out.steps.profileEnglish = await page.evaluate(`window.__e()`);

console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('tests/hebrew-first-run-result.json', JSON.stringify(out, null, 1));
await browser.close();
if (server) server.close();
