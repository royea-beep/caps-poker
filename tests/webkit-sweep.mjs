/**
 * WEBKIT — the engine family iOS Safari uses, and the one this project has NEVER tested.
 *
 * All ~40 iterations of measurement have run on Chromium. Testers on iPhones get WebKit, and
 * nothing has confirmed the app even mounts there. This runs the core sweep on BOTH engines in
 * one process so differences are read within a single run rather than compared across sessions
 * — cross-run comparison is blind spot #4 and it already produced one phantom finding.
 *
 * Asserts each screen actually mounted before reporting anything about it: an engine that fails
 * to boot produces zero nodes, which reads exactly like a clean screen.
 *
 *   node tests/webkit-sweep.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const ROUTES = ['/', '/play', '/lobby', '/settings'];

const probe = `(() => {
  const hiddenBy = (el) => { let n = el, d = 0; while (n && d < 12) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
    if (cs.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(cs.transform)) return true;
    n = n.parentElement; d++; } return false; };
  const vw = innerWidth;
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && !hiddenBy(e));
  let tiny = 0, off = 0, clipped = 0;
  for (const e of leaves) {
    const t = (e.textContent || '').trim();
    if (!t) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 10 && !/^([♠♥♦♣]|10|[2-9AKQJC])$/.test(t)) tiny++;
    if (r.right > vw + 0.5 || r.left < -0.5) off++;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) clipped++;
  }
  let small = 0;
  for (const el of document.querySelectorAll('button,[role="button"],a')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || hiddenBy(el)) continue;
    if (r.width < 44 || r.height < 44) small++;
  }
  return { kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
           bodyLen: (document.body.innerText || '').trim().length,
           nodes: leaves.length, tiny, off, clipped, small, url: location.pathname };
})()`;

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

async function sweep(engine, name, VW) {
  const browser = await engine.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 110)));

  const rows = [];
  for (const route of ROUTES) {
    let r;
    try {
      await page.goto(URL + route, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(route === '/' ? 12000 : 8000);
      r = await measure(page, probe, { label: name + route });
    } catch (e) {
      r = { kids: -1, bodyLen: -1, nodes: -1, tiny: -1, off: -1, clipped: -1, small: -1,
            url: 'THREW: ' + (e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)) };
    }
    rows.push({ route, ...r });
  }

  // One full hand through to /results.
  let hand = { reached: false, dealt: false };
  try {
    await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(10000);
    await page.evaluate(`window.__f=${fire}`);
    hand.dealt = await page.evaluate(`(() => /PLACE \\d+ CARDS|BOARD 1/i.test(document.body.innerText || ''))()`);
    await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
    await page.waitForTimeout(1500);
    await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(3000);
      const u = await page.evaluate(`(()=>location.pathname)()`);
      if (/results/.test(u)) { hand.reached = true; break; }
    }
  } catch (e) { hand.err = String(e).slice(0, 70); }

  // Do animations actually run? Sample a transform/opacity twice and see if it changes.
  let anim = 'not sampled';
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(7000);
    const s1 = await page.evaluate(`(() => [...document.querySelectorAll('*')].slice(0, 400).map((e) => getComputedStyle(e).transform).join('|').length)()`);
    await page.waitForTimeout(1200);
    const s2 = await page.evaluate(`(() => [...document.querySelectorAll('*')].slice(0, 400).map((e) => getComputedStyle(e).transform).join('|').length)()`);
    anim = s1 !== s2 ? 'transforms changing (animating)' : 'no transform change in 1.2s';
  } catch { anim = 'sample failed'; }

  await page.screenshot({ path: `tests/screenshots/${name}-${VW}.png` });
  await browser.close();
  return { rows, hand, anim, errs: [...new Set(errs)] };
}

for (const VW of [390, 320]) {
  const wk = await sweep(webkit, 'webkit', VW);
  const cr = await sweep(chromium, 'chromium', VW);
  console.log(`\n################ ${VW}px ################`);
  console.log('route      | engine   | kids | bodyLen | nodes | tiny | off | clip | tap<44');
  for (let i = 0; i < wk.rows.length; i++) {
    for (const [eng, set] of [['webkit  ', wk], ['chromium', cr]]) {
      const r = set.rows[i];
      console.log(`${String(r.route).padEnd(10)} | ${eng} | ${String(r.kids).padStart(4)} | ${String(r.bodyLen).padStart(7)} | ${String(r.nodes).padStart(5)} | ${String(r.tiny).padStart(4)} | ${String(r.off).padStart(3)} | ${String(r.clipped).padStart(4)} | ${String(r.small).padStart(6)}`);
    }
  }
  console.log(`hand -> /results : webkit ${wk.hand.reached} (dealt ${wk.hand.dealt}) | chromium ${cr.hand.reached} (dealt ${cr.hand.dealt})`);
  console.log(`animations       : webkit "${wk.anim}" | chromium "${cr.anim}"`);
  console.log(`page errors webkit  : ${wk.errs.length ? JSON.stringify(wk.errs.slice(0, 3)) : 'none'}`);
  console.log(`page errors chromium: ${cr.errs.length ? JSON.stringify(cr.errs.slice(0, 3)) : 'none'}`);
  const only = wk.errs.filter((e) => !cr.errs.includes(e));
  console.log(`>>> WEBKIT-ONLY errors: ${only.length ? JSON.stringify(only) : 'NONE'}`);
}
