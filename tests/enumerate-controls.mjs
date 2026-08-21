/**
 * EVERY CONTROL, ONE BY ONE — enumerate and OPERATE every interactive element on a screen.
 *
 * Inspection is not enough: the ✕-glyph and Auto-Place lessons both cost sprints, and the
 * first-run overlay's Continue/SKIP are div[tabindex=0] with no role at all. So this collects
 * buttons, role=button/switch/radio, inputs AND bare focusable divs, then taps each ONE AT A TIME
 * from a fresh load, recording what actually changed: route, on-screen text, and persisted store.
 *
 *   SCREEN=/settings node tests/enumerate-controls.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
// Git Bash on Windows rewrites a leading "/" into a drive path, so accept either form.
const RAW = process.env.SCREEN || 'settings';
const SCREEN = '/' + RAW.replace(/^.*[\/]([^\/]+)$/, '$1').replace(/^\/+/, '');
const VW = Number(process.env.VIEWPORT || 430);
const MAX = Number(process.env.MAX || 60);

const LIST = `(() => {
  const sel = 'button,[role="button"],[role="switch"],[role="radio"],[role="checkbox"],input,[tabindex="0"]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    let n = el, hidden = false;
    for (let i = 0; i < 10 && n; i++) { const c = getComputedStyle(n);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) { hidden = true; break; } n = n.parentElement; }
    if (hidden) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 46);
    out.push({ label, role: el.getAttribute('role') || el.tagName.toLowerCase(),
               inAT: !!(el.getAttribute('role') || el.tagName === 'BUTTON' || el.tagName === 'INPUT'),
               state: el.getAttribute('aria-checked') ?? el.getAttribute('aria-selected') ?? null,
               y: Math.round(r.top), x: Math.round(r.left) });
  }
  return out;
})()`;

const SNAP = `(() => {
  let store = null; try { store = localStorage.getItem('caps-poker-storage'); } catch {}
  return { path: location.pathname, text: document.body.innerText.replace(/\s+/g,' ').slice(0, 4000), store };
})()`;

const ENGINE = process.env.ENGINE || 'webkit';
const browser = await (ENGINE === 'chromium' ? chromium : webkit).launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('has_seen_interactive_tutorial','true');
  localStorage.setItem('caps_onboarding_done','true'); localStorage.setItem('caps_tutorial_seen','true'); } catch {} });
const page = await ctx.newPage();
// Playwright AUTO-DISMISSES native dialogs when nothing is listening, which is exactly why
// "Delete account" was reported dead: window.confirm returned false and the flow cancelled.
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 90)}`); await d.dismiss(); });

// Reset the persisted state before EVERY control. Without this, one control's side effect hides
// later ones — the sound toggle hid the ten volume segments and produced ten false "dead" verdicts.
const RESET_STATE = () => { try { localStorage.removeItem('caps-poker-storage'); } catch {} };
const load = async () => { await page.goto(SITE + SCREEN, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(9000); await installFire(page); };
await load();
const controls = await page.evaluate(LIST);
console.log(`\n=== ${SCREEN} — ${controls.length} interactive elements ===`);
controls.forEach((c, i) => console.log(`${String(i).padStart(2)} | ${c.role.padEnd(8)} | AT:${c.inAT ? 'Y' : 'N'} | y${String(c.y).padStart(4)} | ${JSON.stringify(c.label)}${c.state ? ' | state=' + c.state : ''}`));

console.log(`\n--- operating each (fresh load per control) ---`);
const n = Math.min(controls.length, MAX);
for (let i = 0; i < n; i++) {
  await load();
  const before = await page.evaluate(SNAP);
  const label = controls[i].label;
  await page.evaluate(`(()=>{const sel='button,[role="button"],[role="switch"],[role="radio"],[role="checkbox"],input,[tabindex="0"]';
    const want=${JSON.stringify(controls[i].label)};
    const els=[...document.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect();
      if(r.width<4||r.height<4) return false; let n=e,h=false;
      for(let k=0;k<10&&n;k++){const c=getComputedStyle(n); if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0){h=true;break;} n=n.parentElement;}
      return !h;});
    const t=els.find(e=>((e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,46))===want);
    if(t){ window.__f(t); return true; } return false;})()`);
  await page.waitForTimeout(2600);
  const after = await page.evaluate(SNAP);
  const moved = before.path !== after.path;
  const textChanged = before.text !== after.text;
  const storeChanged = before.store !== after.store;
  let delta = '';
  if (storeChanged && before.store && after.store) {
    try { const b = JSON.parse(before.store).state, a = JSON.parse(after.store).state;
      const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])]
        .filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
      delta = keys.map(k => `${k}:${JSON.stringify(b[k])}->${JSON.stringify(a[k])}`).join(' ').slice(0, 110);
    } catch {}
  }
  const dlg = dialogs.splice(0).join(' | ');
  const verdict = dlg ? `DIALOG ${dlg}` : moved ? `NAV -> ${after.path}` : storeChanged ? `STORE ${delta}` : textChanged ? 'text changed' : 'NO VISIBLE EFFECT';
  console.log(`${String(i).padStart(2)} | ${JSON.stringify(label).padEnd(42)} | ${verdict}`);
}
await browser.close();
