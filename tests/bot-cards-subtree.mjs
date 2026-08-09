/**
 * ITERATION 19 / BUG 2 — count bot cards inside each bot row's OWN DOM SUBTREE.
 *
 * Iteration 16 counted by vertical position, so the final section label swallowed every glyph
 * below it (Bot 1 = 28, Bot 2 = 125 — known-bad). Each bot row is
 * `<View style={styles.section}>` whose first child is the label carrying
 * data-testid="reveal-section-label" (BoardReveal.tsx:791), so the row container is simply
 * that label's parentElement. Counting within it cannot leak across sections.
 *
 *   PLAYERS=3 node tests/bot-cards-subtree.mjs
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Per section: the label, its container, and the card count INSIDE that container only.
const subtree = `(() => {
  const out = [];
  for (const lab of document.querySelectorAll('[data-testid="reveal-section-label"]')) {
    const box = lab.parentElement;
    if (!box) { out.push({ label: (lab.textContent||'').trim(), container: null }); continue; }
    const leaves = [...box.querySelectorAll('*')].filter(e => !e.children.length);
    const suits = leaves.filter(e => /^[♠♥♦♣]$/.test((e.textContent||'').trim())).length;
    const ranks = leaves.filter(e => /^(10|[2-9AKQJ])$/.test((e.textContent||'').trim())).length;
    const r = box.getBoundingClientRect();
    out.push({
      label: (lab.textContent||'').trim(),
      suitGlyphs: suits,
      rankGlyphs: ranks,
      containerH: Math.round(r.height),
      containerKids: box.children.length,
    });
  }
  return out;
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1200);
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(10000);

const out = { players: PLAYERS, url: URL };
try { out.sections = await measure(page, subtree, { label: 'bot-subtree' }); }
catch (e) { out.harnessError = e instanceof HarnessError ? e.message : String(e); }

console.log(`PLAYERS=${PLAYERS}`);
console.log(show(out.sections));
await browser.close();
