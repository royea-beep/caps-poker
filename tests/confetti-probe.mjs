/**
 * CK2 / E1 — measure the win-burst's FRAME COST in a visible browser.
 *
 * More particles is the classic way to turn a celebration into a stutter, so the count went
 * 8 -> 20 and this checks what that bought. Rule 14a preamble first; frames judged by SPREAD
 * against the local cadence, never a hardcoded 32ms budget (this environment runs ~30fps, so
 * an over-32ms counter flags every frame and means nothing).
 *
 * RN Animated, not Reanimated — the KILL_* flags do not gate it — but rAF drives both on web,
 * so the preamble applies identically.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const TARGET = 'https://caps.ftable.co.il/';
const W = Number(process.argv[2] || 375);
const H = Number(process.argv[3] || 812);

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

async function preamble(page) {
  return page.evaluate(async () => {
    const s = performance.now(); let raf = 0;
    await new Promise((r) => { const l = () => { raf++; performance.now() - s < 2000 ? requestAnimationFrame(l) : r(); };
      requestAnimationFrame(l); setTimeout(r, 2500); });
    return { hidden: document.hidden, rafCount: raf, innerWidth, innerHeight, ok: document.hidden === false && raf > 0 };
  });
}
async function frames(page, ms) {
  return page.evaluate(async (ms) => {
    const g = []; let last = performance.now(); const s = last;
    await new Promise((r) => { const l = () => { const n = performance.now(); g.push(n - last); last = n;
      n - s < ms ? requestAnimationFrame(l) : r(); }; requestAnimationFrame(l); setTimeout(r, ms + 500); });
    const x = g.slice(2); if (!x.length) return { frames: 0 };
    const med = x.slice().sort((a, b) => a - b)[Math.floor(x.length / 2)];
    return { frames: x.length, medianMs: +med.toFixed(1), maxMs: +Math.max(...x).toFixed(1), spreadMs: +(Math.max(...x) - med).toFixed(1) };
  }, ms);
}

const out = { viewport: { W, H }, ts: new Date().toISOString() };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  out.precondition = await preamble(page);
  if (!out.precondition.ok) { out.ABORT = 'preamble failed'; throw new Error('preamble failed'); }
  out.bundle = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop()).filter(x => x.startsWith('index-'))[0]);

  // play a full hand: 2P -> Play -> auto-place -> READY -> long-press to skip the reveal
  await page.evaluate(`(()=>{window.__f=${fire};
    const p=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^(✓ )?2P$/.test((e.textContent||'').trim()));
    if(p){let n=p;for(let i=0;i<3&&n;i++){window.__f(n);n=n.parentElement;}}})()`);
  await page.waitForTimeout(600);
  await page.evaluate(`(()=>{const p=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^Play$/.test((x.getAttribute('aria-label')||x.textContent||'').trim()));if(p)window.__f(p);})()`);
  await page.waitForTimeout(2500);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(800);
  await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
  await page.waitForTimeout(3000);

  // long-press the reveal surface to reach /results fast
  await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="reveal-skip-surface"]');
    if(!el)return; const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
    const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
    ['pointerdown','mousedown'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));
    setTimeout(()=>['pointerup','mouseup'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent))),700);})()`);
  await page.waitForTimeout(2500);

  // CL1 — anchored by testID now, not geometry. Also samples TRANSFORM over a window so
  // "the dots exist" and "the dots move" are separate, provable claims.
  out.onResults = await page.evaluate(async () => {
    const headline = (document.querySelector('[data-testid="result-headline"]') || {}).textContent || null;
    const series = [];
    const t0 = performance.now();
    await new Promise((res) => {
      const loop = () => {
        const d = [...document.querySelectorAll('[data-testid="win-dot"]')];
        if (d.length) series.push({ t: +(performance.now() - t0).toFixed(0), n: d.length,
          tf: getComputedStyle(d[0]).transform, op: +parseFloat(getComputedStyle(d[0]).opacity).toFixed(3) });
        performance.now() - t0 < 1600 ? requestAnimationFrame(loop) : res();
      };
      requestAnimationFrame(loop); setTimeout(res, 2200);
    });
    // E2 BASELINE — what the loss screen is made of, and whether anything moves on it
    const headlineEl = document.querySelector('[data-testid="result-headline"]');
    const hs = headlineEl ? getComputedStyle(headlineEl) : null;
    const buttons = [...document.querySelectorAll('button,[role="button"]')]
      .map(b => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 26)).filter(Boolean);
    return {
      headline,
      dotCount: series.length ? Math.max(...series.map(s => s.n)) : 0,
      dotSamples: series.length,
      distinctDotTransforms: [...new Set(series.map(s => s.tf))].length,
      dotOpacityRange: series.length ? [Math.min(...series.map(s => s.op)), Math.max(...series.map(s => s.op))] : null,
      headlineColor: hs ? hs.color : null,
      headlineFontSize: hs ? hs.fontSize : null,
      headlineTransform: hs ? hs.transform : null,
      buttons,
    };
  });
  out.framesOnResults = await frames(page, 3000);
} catch (e) { out.error = String(e && e.message || e); }
finally { await browser.close(); }

fs.writeFileSync(new URL('./confetti-probe-result.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
