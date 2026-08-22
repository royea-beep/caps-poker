/**
 * ITERATION 37 — ONE CONTINUOUS END-TO-END PASS on the shipping build.
 *
 * Every verification in this loop measured one thing deeply while whole-app state drifted —
 * the same gap that let build_history die in May unnoticed until August. This walks the whole
 * first-tester path in a single session and reports what actually rendered.
 *
 * SURVEY, NOT REPAIR. Defects go on a list; fixing inside a survey is how surveys stop
 * finishing.
 *
 *   node tests/pretester-survey.mjs
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const textsExpr = `(() => [...document.querySelectorAll('*')].filter(e => !e.children.length)
  .map(e => (e.textContent || '').trim()).filter(Boolean))()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const errs = [];
const log = (...a) => console.log(...a);

// ── 2. ONBOARDING, SEED CLEARED — never once observed in 37 iterations ────────────────────
const fresh = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const p0 = await fresh.newPage();
p0.on('pageerror', (e) => errs.push('onboarding: ' + String(e).slice(0, 90)));
await p0.goto(URL, { waitUntil: 'load', timeout: 120000 });
await p0.waitForTimeout(12000);
const onb = await measure(p0, `(() => ({
  kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
  texts: [...document.querySelectorAll('*')].filter(e => !e.children.length)
    .map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 22)
}))()`, { label: 'onboarding' });
log('\n== 2. ONBOARDING (seed CLEARED) ==');
log('   #root children:', onb.kids);
log('   on screen:', JSON.stringify(onb.texts));
await fresh.close();

// ── seeded context for the rest ───────────────────────────────────────────────────────────
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('app: ' + String(e).slice(0, 90)));

// ── 1 + 3. FRESH LOAD, HOME ───────────────────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);
const home = await measure(page, `(() => {
  const leaf = [...document.querySelectorAll('*')].filter(e => !e.children.length);
  const txt = leaf.map(e => (e.textContent || '').trim()).filter(Boolean);
  const MENU = ['PLAY ONLINE','BATTLE PASS','STATS','HAND HISTORY','COACHING','SPECTATOR','SETTINGS','TUTORIAL','SIGN OUT'];
  return { kids: document.getElementById('root').children.length,
           menuFound: MENU.filter(m => txt.includes(m)).length, menuTotal: MENU.length,
           condCTAs: ['+ ז\\'יטונים','ההתקדמות שלי','תחרות'].filter(c => txt.includes(c)),
           tagline: txt.find(t => /board|card|poker/i.test(t) && t.length > 18) || null };
})()`, { label: 'home' });
log('\n== 1+3. FRESH LOAD / HOME ==');
log('   #root children:', home.kids, '| side-menu labels:', home.menuFound + '/' + home.menuTotal);
log('   tagline:', JSON.stringify(home.tagline));
log('   conditional CTAs present:', JSON.stringify(home.condCTAs));

// ── 5. ALL FIVE TABS ──────────────────────────────────────────────────────────────────────
log('\n== 5. TABS ==');
for (const r of ['/', '/play', '/friends', '/cups', '/profile']) {
  try {
    await page.goto(URL + r, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4500);
    const s = await measure(page, `(() => ({ kids: document.getElementById('root').children.length,
      len: (document.body.innerText||'').trim().length,
      err: /something went wrong|crash details|unmatched/i.test(document.body.innerText||'') }))()`, { label: 'tab' + r });
    log(`   ${r.padEnd(9)} kids=${s.kids} textLen=${s.len} errorState=${s.err}`);
  } catch (e) { log(`   ${r.padEnd(9)} FAILED: ${String(e).slice(0, 70)}`); }
}

// ── 4 + TASK 3. ONE HAND AT 3P, AND CARD SIZES AT EACH BOARD COUNT ────────────────────────
log('\n== 4 + TASK 3. HAND + CARD SIZES (375px) ==');
for (const players of ['2', '3', '4']) {
  await page.goto(`${URL}/game?practice=true&players=${players}&fresh=1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(8000);
  const sz = await measure(page, `(() => {
    const cards = [...document.querySelectorAll('*')].filter(e => {
      const t = (e.textContent || '').trim();
      return /^[♠♥♦♣]$/.test(t);
    }).map(e => { const p = e.parentElement ? e.parentElement.getBoundingClientRect() : null;
      return p ? { w: Math.round(p.width), h: Math.round(p.height) } : null; }).filter(Boolean);
    const hs = cards.map(c => c.h).filter(h => h > 8);
    return { n: cards.length, minH: hs.length ? Math.min(...hs) : null, maxH: hs.length ? Math.max(...hs) : null,
             kids: document.getElementById('root').children.length };
  })()`, { label: 'cards' + players });
  const boards = players === '2' ? 4 : players === '3' ? 3 : 2;
  log(`   ${players}P (${boards} boards) card-node heights min=${sz.minH} max=${sz.maxH} n=${sz.n} kids=${sz.kids}`);
}

log('\n== PAGE ERRORS ==');
log('   ' + (errs.length ? JSON.stringify([...new Set(errs)].slice(0, 6)) : 'none'));
await browser.close();
