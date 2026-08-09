/**
 * ITERATION 14 — is the MIXED UI gone on live, and does the lobby header render?
 *
 * Sweeps every first-session surface for Hebrew. Expected: NONE, apart from the pre-existing
 * `isHE ? ... : ...` bilingual blocks in (tabs)/index.tsx, which resolve to English anyway.
 * Anything else is leftover mixing.
 *
 * Also resolves the lobby header, unchecked for SEVEN iterations: visit /lobby and report what
 * renders, or establish that it needs a second player. "Not attempted" is not an answer.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Any leaf node containing a Hebrew character = a candidate leftover.
const hebrewSweep = `()=>{const out=[];
for(const el of document.querySelectorAll('*')){
  if(el.children.length) continue;
  const t=(el.textContent||'').trim();
  if(!t || !/[\\u0590-\\u05FF]/.test(t)) continue;
  const r=el.getBoundingClientRect();
  out.push({t:t.slice(0,50), w:Math.round(r.width), sw:el.scrollWidth, clipped: el.scrollWidth>Math.ceil(r.width)+1});}
return out;}`;

// Width census for a named set of English labels (side menu has never been measured).
const widths = `(names)=>{const out=[];
for(const el of document.querySelectorAll('*')){
  if(el.children.length) continue;
  const t=(el.textContent||'').trim();
  if(!names.includes(t)) continue;
  const r=el.getBoundingClientRect();
  out.push({t, w:Math.round(r.width), sw:el.scrollWidth, clipped: el.scrollWidth>Math.ceil(r.width)+1});}
return out;}`;

const MENU = ['PLAY ONLINE','BATTLE PASS','STATS','HAND HISTORY','COACHING','SPECTATOR','SETTINGS','TUTORIAL','SIGN OUT'];

const out = { url: URL, ts: new Date().toISOString(), steps: {} };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

const arm = () => page.evaluate(`window.__h=${hebrewSweep}; window.__w=${widths}; window.__f=${fire}`);
const visit = async (route, waitMs = 7000) => {
  await page.goto(URL + route, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(waitMs);
  await arm();
};

await visit('/', 11000);
out.steps.mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
out.steps.homeHebrew = await page.evaluate(`window.__h()`);
out.steps.sideMenuWidths = await page.evaluate(`window.__w(${JSON.stringify(MENU)})`);

for (const r of ['/play', '/profile']) {
  await visit(r);
  out.steps[r + 'Hebrew'] = await page.evaluate(`window.__h()`);
}

// TASK 4 — the lobby header, unchecked for seven iterations. Resolve it.
await visit('/lobby', 9000);
out.steps.lobby = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
  const hdr = [...document.querySelectorAll('*')].filter((e) => !e.children.length)
    .map((e) => (e.textContent || '').trim())
    .filter((t) => /^(LOBBY|לובי|‹ Back|‹ חזרה)$/.test(t));
  return { rootKids: document.getElementById('root')?.children.length ?? 0, headerNodes: hdr, sample: txt.slice(0, 200) };
});
out.steps.lobbyHebrew = await page.evaluate(`window.__h()`);

out.pageErrors = errs.slice(0, 4);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('tests/live-unmix-result.json', JSON.stringify(out, null, 1));
await browser.close();
