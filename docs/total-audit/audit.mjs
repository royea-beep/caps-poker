import { chromium } from 'playwright-core';
import fs from 'fs';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:8099';
const OUT = '/home/user/caps-poker/docs/total-audit';
const LANG = process.argv[2] || 'en';
const W = parseInt(process.argv[3] || '393', 10);

const seedBase = (lang, skipTut) => `try{
  localStorage.setItem('caps-poker-storage', JSON.stringify({state:{handsPlayed:9, config:{numberOfPlayers:3}}, version:2}));
  localStorage.setItem('caps_language','${lang}');
  ${skipTut ? "localStorage.setItem('has_seen_interactive_tutorial','true');" : "localStorage.removeItem('has_seen_interactive_tutorial');"}
}catch(e){}`;

// In-page audit: overflow, exposed (unnamed) controls, tiny touch targets
const AUDIT_FN = () => {
  const accName = (el) => {
    const al = (el.getAttribute('aria-label')||'').trim();
    if (al) return al;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const r = lb.split(/\s+/).map(id=>{const e=document.getElementById(id);return e?e.textContent.trim():'';}).join(' ').trim(); if(r) return r; }
    const txt = (el.textContent||'').replace(/\s+/g,' ').trim();
    if (txt) return txt;
    const title = (el.getAttribute('title')||'').trim();
    if (title) return title;
    const img = el.querySelector && el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
    return '';
  };
  const isVisible = (el) => {
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) return false;
    const s = getComputedStyle(el);
    if (s.visibility==='hidden' || s.display==='none' || parseFloat(s.opacity) < 0.05) return false;
    // Horizontal clip only (excludes the off-canvas side drawer, which is translateX off-screen).
    // No vertical clip: RN-web ScrollViews scroll internally so below-fold controls keep
    // document height = viewport; excluding by y would undercount long screens (results).
    if (b.right < 0 || b.left > window.innerWidth+50) return false;
    return true;
  };
  const nodes = [...document.querySelectorAll('[role="button"],[role="link"],button,a[href]')];
  const controls = nodes.filter(isVisible);
  const unnamed = [];
  const tiny = [];
  const seenBox = new Set();
  for (const el of controls) {
    const b = el.getBoundingClientRect();
    const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
    const name = accName(el);
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    if (!name) unnamed.push({ role, x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height), html: el.outerHTML.slice(0,80) });
    // tiny target: dedupe by box (nested pressables), only count leaf-ish
    if ((b.width < 44 || b.height < 44)) {
      tiny.push({ name: name.slice(0,32), role, w:Math.round(b.width), h:Math.round(b.height) });
    }
  }
  return {
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    controlCount: controls.length,
    unnamedCount: unnamed.length, unnamed: unnamed.slice(0,12),
    tinyCount: tiny.length, tiny: tiny.slice(0,20),
  };
};

const results = { lang: LANG, width: W, screens: {} };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--force-device-scale-factor=1'] });

async function newPage(skipTut) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 852 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,120)); });
  page.on('pageerror', e=>errs.push('PAGEERR:'+e.message.slice(0,120)));
  await page.addInitScript(seedBase(LANG, skipTut));
  page._errs = errs;
  return page;
}

async function record(page, name) {
  const a = await page.evaluate(AUDIT_FN);
  a.consoleErrors = page._errs.length;
  results.screens[name] = a;
  await page.screenshot({ path: `${OUT}/D-${LANG}-${W}-${name}.png`, fullPage: name==='results' });
  console.log(`[${LANG}/${W}] ${name}: overflow=${a.overflow}(sw${a.sw}/iw${a.iw}) controls=${a.controlCount} unnamed=${a.unnamedCount} tiny=${a.tinyCount}`);
  return a;
}

// ---- HOME (tutorial skipped) ----
let page = await newPage(true);
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await record(page, 'home');
await page.context().close();

// ---- ONBOARDING (tutorial shown) ----
page = await newPage(false);
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await record(page, 'onboarding');
await page.context().close();

// ---- GAME FLOW: placement -> reveal -> results ----
page = await newPage(true);
await page.goto(BASE + `/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await record(page, 'placement');
// auto-place all + ready
try { await page.getByRole('button', { name: /Auto-Place ALL|מלא הכל|השלם/i }).click({timeout:4000}); await page.waitForTimeout(1200);} catch(e){ console.log('autoplace fail', e.message.slice(0,40)); }
try { await page.getByRole('button', { name: /READY|Confirm|מוכן|אשר/i }).click({timeout:4000}); await page.waitForTimeout(2800);} catch(e){ console.log('ready fail', e.message.slice(0,40)); }
await record(page, 'reveal');
// tap through reveal to results
for (let i=0;i<12;i++){
  if (page.url().includes('/results')) break;
  try { await page.mouse.click(Math.round(W/2), 430); } catch(e){}
  await page.waitForTimeout(2200);
}
await page.waitForTimeout(1500);
if (page.url().includes('/results')) {
  await record(page, 'results');
} else {
  results.screens.results = { error: 'did not reach results', url: page.url() };
  console.log('DID NOT REACH RESULTS, url=', page.url());
}
await page.context().close();

fs.writeFileSync(`${OUT}/audit-${LANG}-${W}.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log('WROTE', `audit-${LANG}-${W}.json`);
