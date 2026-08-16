/**
 * Does the gold read as chrome — and if so, is it the hue or the contrast?
 *
 * Measures PAINTED pixels (getComputedStyle resolves to rgb), never hex literals, because this
 * project's standing lesson is that a colour on screen is not the colour in the picker.
 *
 * For every gold-ish paint it also walks up for the first opaque backdrop and computes the WCAG
 * contrast ratio. "Looks like chrome" is usually a colour sitting too close to what is behind it,
 * not a wrong hue — so the backdrop is the measurement that decides which fix is right.
 *
 * The winner border only exists on a WON card, so this plays a practice hand through to /results
 * rather than sampling a placement screen and reporting that gold is absent.
 *
 *   node tests/gold-contrast.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const sample = `(() => {
  const parse = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s || ''); if (!m) return null;
    const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  // Gold-ish: warm, red>blue by a clear margin, not near-white and not near-black.
  const goldish = (c) => c && c.a > 0.15 && c.r > 120 && c.g > 90 && c.r - c.b > 45 && !(c.r > 245 && c.g > 245 && c.b > 245);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2); };
  const backdrop = (el) => { let n = el.parentElement, d = 0;
    while (n && d < 14) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a >= 0.9) return c; n = n.parentElement; d++; }
    return { r: 10, g: 10, b: 10, a: 1 }; };  // the app paints a near-black root felt
  const rgb = (c) => 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';

  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cands = [
      ['text', parse(cs.color), (el.textContent || '').trim().slice(0, 14)],
      ['border', parse(cs.borderTopColor), cs.borderTopWidth],
      ['bg', parse(cs.backgroundColor), ''],
    ];
    for (const [kind, c, extra] of cands) {
      if (kind === 'border' && (parseFloat(cs.borderTopWidth) || 0) === 0) continue;
      if (kind === 'text' && !(el.textContent || '').trim()) continue;
      if (kind === 'text' && el.children.length) continue;
      if (!goldish(c)) continue;
      const bg = backdrop(el);
      out.push({ kind, paint: rgb(c), alpha: c.a, on: rgb(bg), contrast: ratio(c, bg), extra: String(extra).slice(0, 14) });
    }
  }
  // Collapse to distinct paint/backdrop pairs — the same token repeated 40 times is one site.
  const seen = {};
  for (const o of out) {
    const k = o.kind + '|' + o.paint + '|on ' + o.on;
    if (!seen[k]) seen[k] = { ...o, count: 0 };
    seen[k].count++;
  }
  return { url: location.pathname, sites: Object.values(seen).sort((a, b) => b.count - a.count).slice(0, 12) };
})()`;

const run = async (name, engine, vw) => {
  const browser = await engine.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: vw, height: 844 } });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const page = await ctx.newPage();
  const report = async (label) => {
    let r; try { r = await measure(page, sample, { label }); }
    catch (e) { console.log(`  ${label}: HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)}`); return; }
    console.log(`  ${label} (${r.url})`);
    for (const s of r.sites) {
      const flag = s.contrast < 3 ? '  ** LOW CONTRAST' : '';
      console.log(`    ${s.kind.padEnd(6)} ${s.paint.padEnd(18)} on ${s.on.padEnd(18)} contrast ${String(s.contrast).padStart(5)}:1  x${String(s.count).padStart(3)} ${JSON.stringify(s.extra)}${flag}`);
    }
  };

  console.log(`\n######## ${name} @${vw} ########`);
  for (const [label, path] of [['home', '/'], ['leaderboard', '/leaderboard']]) {
    await page.goto(URL + path, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(11000);
    await report(label);
  }

  // A won card only exists after a hand. 2 players = 4 boards (re-derived from the rule).
  await page.goto(`${URL}/game?practice=true&players=2`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  for (let i = 0; i < 22; i++) { await page.waitForTimeout(2500); if (/results/.test(page.url())) break; }
  await page.waitForTimeout(6000);
  await report('results (2P, 4 boards)');
  await browser.close();
};

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const vw of [390, 320]) await run(name, engine, vw);
}
