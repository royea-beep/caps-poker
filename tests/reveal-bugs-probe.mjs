/**
 * ITERATION 15 — evidence for BUG 1 (text over cards) and BUG 2 (bot cards missing).
 *
 * Reproduces Roye's exact URL. Counts rendered cards per section and measures whether the
 * board counter / win banner geometrically OVERLAP the community card row — overlap is a
 * box-intersection fact, not an opinion about a screenshot.
 *
 *   PLAYERS=3 node tests/reveal-bugs-probe.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// A card is any node carrying a rank+suit glyph pair. Sections are labelled by
// reveal-section-label; cards are attributed to the nearest preceding label.
const inspect = `()=>{
const labels=[...document.querySelectorAll('[data-testid="reveal-section-label"]')].map(e=>({
  t:(e.textContent||'').trim(), y:e.getBoundingClientRect().top}));
// count leaf nodes that look like a suit glyph, grouped by the label above them
const suits=[...document.querySelectorAll('*')].filter(e=>!e.children.length && /^[♠♥♦♣]$/.test((e.textContent||'').trim()))
  .map(e=>({y:e.getBoundingClientRect().top, x:e.getBoundingClientRect().left}));
const sections=labels.map((l,i)=>{
  const next=labels[i+1]? labels[i+1].y : Infinity;
  return {label:l.t, suitGlyphs:suits.filter(s=>s.y>=l.y && s.y<next).length};});

const box=(sel)=>{const e=document.querySelector(sel); if(!e) return null;
  const r=e.getBoundingClientRect(); return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),h:Math.round(r.height)};};
const byText=(re)=>{for(const e of document.querySelectorAll('*')){ if(e.children.length) continue;
  const t=(e.textContent||'').trim(); if(re.test(t)){const r=e.getBoundingClientRect();
    return {text:t,top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right)};}} return null;};

const boardNum = byText(/^Board \\d+$/);
const banner   = byText(/(YOU WIN|YOU LOSE|TIE)/i);
// community row = the horizontal band holding the most suit glyphs near the top
const rows={}; for(const s of suits){const k=Math.round(s.y/8)*8; rows[k]=(rows[k]||0)+1;}
const bands=Object.entries(rows).map(([y,n])=>({y:+y,n})).sort((a,b)=>b.n-a.n);
const commTop = bands.length? bands[0].y : null;
const overlaps=(a,b)=> a&&b ? !(a.bottom<=b.top || b.bottom<=a.top) : null;
const commBox = commTop!==null ? {top:commTop, bottom:commTop+70} : null;
return {sections, boardNum, banner, commBandTop:commTop, commGlyphsInBand: bands[0]?.n ?? 0,
        boardNumOverlapsCommunity: overlaps(boardNum, commBox),
        bannerOverlapsCommunity: overlaps(banner, commBox)};}`;

const out = { url: URL, players: PLAYERS, ts: new Date().toISOString() };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const net404 = [];
page.on('response', (r) => { if (r.status() === 404) net404.push(`${r.request().method()} ${r.url()}`); });

await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1200);
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(9000);

out.reveal = await page.evaluate(inspect);
out.net404 = [...new Set(net404)];
out.pageErrors = errs.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(`tests/reveal-bugs-${PLAYERS}p.json`, JSON.stringify(out, null, 1));
await browser.close();
