/**
 * ITERATION 8 — did the Hebrew actually RENDER, and does it fit at 375px?
 *
 * tsc-clean is not evidence a string reached a screen. Iteration 7 shipped Hebrew that was
 * tsc-clean and never seen; one string (the lobby header) is still unrendered because the
 * walk never reached multiplayer. So this reads the DOM, and it also measures each element's
 * box against its scrollWidth — a translated label that clips is worse than an English one.
 *
 *   PROBE_DIR=web-heb-dist node tests/hebrew-first-run-verify.mjs
 *   CAPS_URL=https://caps.ftable.co.il node tests/hebrew-first-run-verify.mjs   (live)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const LIVE = process.env.CAPS_URL || null;
const DIR = path.resolve(process.env.PROBE_DIR || 'web-heb-dist');
const PORT = Number(process.env.PROBE_PORT || 8140);
const W = 375, H = 812;

let base = LIVE;
let server = null;
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

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Reports every element containing `txt`, with its rendered box vs its content width.
// clipped = the text is wider than the box it sits in, i.e. truncated on screen.
const measure = `(txt)=>{const out=[];
for(const el of document.querySelectorAll('*')){
  if(el.children.length) continue;
  const t=(el.textContent||'').trim();
  if(!t.includes(txt)) continue;
  const r=el.getBoundingClientRect();
  out.push({text:t.slice(0,60), w:Math.round(r.width), scrollW:el.scrollWidth,
            clipped: el.scrollWidth > Math.ceil(r.width)+1, lines: Math.round(r.height/parseFloat(getComputedStyle(el).lineHeight||'0'))||null});
}
return out;}`;

const out = { base, ts: new Date().toISOString(), steps: {} };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'load', timeout: 120000 });
await page.evaluate(`window.__m=${measure}; window.__f=${fire}`);

// 1 — splash. It repaints fast, so sample immediately and again after settle.
await page.waitForTimeout(1200);
out.steps.splashEarly = await page.evaluate(`window.__m('כבוש כל לוח')`);
await page.waitForTimeout(9000);

out.steps.mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
// 2 — home CTAs
out.steps.home = await page.evaluate(`[].concat(window.__m('ז\\'יטונים'), window.__m('ההתקדמות שלי'), window.__m('תחרות'))`);

// 3 — play menu (tab 2)
await page.evaluate(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='שחק');if(el)window.__f(el);})()`);
await page.waitForTimeout(2500);
out.steps.playMenu = await page.evaluate(`[].concat(window.__m('שחקן יחיד'), window.__m('לובי מרובה משתתפים'), window.__m('שולחן פרטי מהיר'))`);

// 5 — profile tab
await page.evaluate(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='פרופיל');if(el)window.__f(el);})()`);
await page.waitForTimeout(2500);
out.steps.profile = await page.evaluate(`[].concat(window.__m('פרופיל'), window.__m('אחוז ניצחון'), window.__m('רצף'), window.__m('ידיים'))`);

// English still visible anywhere on the surfaces walked
out.steps.englishOnScreen = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (/^[A-Za-z][A-Za-z ,.'!?&%-]{3,}$/.test(t)) bad.push(t.slice(0, 40));
  }
  return [...new Set(bad)].slice(0, 20);
});

console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('tests/hebrew-first-run-result.json', JSON.stringify(out, null, 1));
await browser.close();
if (server) server.close();
