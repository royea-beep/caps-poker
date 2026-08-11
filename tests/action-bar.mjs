/**
 * The placement action bar AFTER cards are placed — where `Cancel` is clipped to `ancel` and
 * `Auto-Place ALL` sits on top of the Cancel/Confirm row.
 *
 * This state only exists post-placement, which is exactly why every single-sample probe missed
 * it. Auto-Place is one click away, so unlike the win banner this is cheap to reach.
 *
 * Reports every control's box, flags anything crossing the viewport edge, and reports vertical
 * overlap between Auto-Place and the action row.
 *
 *   VIEWPORT=320 node tests/action-bar.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const expr = `(() => {
  const VW = ${VW};
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  // MEASURE DIVS TOO. Only two nodes on this screen are real buttons; the chips — and possibly
  // Cancel/Confirm — are DIVs. A button-only sweep reports them as absent, which reads as "no
  // collision" when it actually means "not looked at".
  const seen = new Set();
  const out = [];
  const add = (el) => {
    if (seen.has(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !vis(el)) return;
    seen.add(el);
    const t = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim().slice(0, 34);
    out.push({ t, l: Math.round(r.left), r: Math.round(r.right), tp: Math.round(r.top),
               b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height),
               clipped: r.left < -0.5 || r.right > VW + 0.5 });
  };
  for (const el of document.querySelectorAll('button,[role="button"]')) add(el);

  // MEASURE THE PILL, NOT THE WORD. Measuring the leaf text node said "Auto-Place ALL vs Cancel:
  // gap 6px" while the screenshot plainly showed the Auto-Place pill lying across the tops of both
  // buttons. The label is 63x21; the tappable pill behind it is far bigger and starts higher, and
  // it is the pill that collides. Cancel/Confirm are not <button> elements, so the button sweep
  // never saw them and the leaf sweep only saw their text — blind spot #1, still open, producing a
  // clean reading from a real defect.
  // Walk up from the label to the nearest ancestor that actually paints a pill (a background or a
  // border-radius) and is wider than the text.
  const pillOf = (leaf) => {
    let n = leaf.parentElement, d = 0;
    const lr = leaf.getBoundingClientRect();
    while (n && d < 6) {
      const c = getComputedStyle(n), r = n.getBoundingClientRect();
      const paints = (c.backgroundColor && c.backgroundColor !== 'rgba(0, 0, 0, 0)')
                  || parseFloat(c.borderTopLeftRadius) > 0 || parseFloat(c.borderTopWidth) > 0;
      if (paints && r.width > lr.width + 4) return n;
      n = n.parentElement; d++;
    }
    return null;
  };
  for (const el of document.querySelectorAll('div,span')) {
    if (el.children.length !== 0) continue;
    const txt = (el.textContent || '');
    if (!/^\\s*(cancel|confirm|ready|auto.?place( all)?)\\s*$/i.test(txt)) continue;
    add(el);
    const pill = pillOf(el);
    if (pill && !seen.has(pill)) {
      const r = pill.getBoundingClientRect();
      if (r.width && r.height && vis(pill)) {
        seen.add(pill);
        out.push({ t: '[pill] ' + txt.trim().slice(0, 26), l: Math.round(r.left), r: Math.round(r.right),
                   tp: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width),
                   h: Math.round(r.height), clipped: r.left < -0.5 || r.right > VW + 0.5, pill: true });
      }
    }
  }
  return { url: location.pathname, vw: VW, controls: out };
})()`;

// HEIGHT IS A DIMENSION OF THIS BUG, NOT A CONSTANT. 812 was hardcoded, so every previous run
// measured one viewport height and called the result "320px" / "390px". The win-banner fix turned
// on exactly this: height is what moves bottom-anchored layers toward each other. Roye's device is
// not guaranteed to be 812 tall.
const VH = Number(process.env.VH || 812);
const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},${VH + 90}`] });
// MOBILE=1 emulates a real handset — touch, mobile UA, deviceScaleFactor 3 — because every run so
// far used a DESKTOP context at a narrow width, which is not the same thing. A desktop context at
// 320 renders desktop font metrics; text clipped to "ancel" on a real phone is the signature of a
// label wider than its box, and label width is exactly what font metrics decide.
const MOBILE = process.env.MOBILE === '1';
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: MOBILE ? 3 : 1,
  isMobile: MOBILE, hasTouch: MOBILE,
  ...(MOBILE ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : {}),
});
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);

// PARTIAL PLACEMENT — deliberately NOT "Auto-Place ALL". That shortcut places every card, which
// HIDES Auto-Place ALL, landing in the one state where the collision cannot exist. That is how
// the previous run produced a false all-clear. The per-board ⚡ chips fill ONE board and leave
// the rest, so Cancel/Confirm appears while Auto-Place ALL is still on screen — both layers
// coexisting, which is the state Roye photographed.
// THE CHIPS ARE NOT BUTTONS. Searching 'button,[role="button"]' returned 0 per-board chips while
// happily finding Auto-Place ALL, so the probe concluded the route did not exist. Enumerated: the
// whole screen has exactly TWO button nodes (Leave game, Auto-Place ALL); the three per-board
// chips are plain DIVs at y≈97/270/443 carrying "⚡" and "Auto-Place" as separate leaf nodes.
// Same family as blind spot #1 — the query decided the answer before the page did.
// So: find the leaf DIV whose text is exactly "Auto-Place" (never "...ALL"), then fire on its
// ancestors outward, because react-native-web hangs the handler on the Pressable wrapper rather
// than the text node.
const chips = await measure(page, `(() => {
  const leaves = [...document.querySelectorAll('div,span')].filter((x) =>
    x.children.length === 0 && /^\\s*auto.?place\\s*$/i.test(x.textContent || ''));
  const n = Math.min(${Number(process.env.CHIPS || 1)}, leaves.length);
  const boxes = [];
  for (let i = 0; i < n; i++) {
    let node = leaves[i];
    for (let up = 0; up < 4 && node; up++) { window.__f(node); node = node.parentElement; }
    const r = leaves[i].getBoundingClientRect();
    boxes.push(Math.round(r.left) + ',' + Math.round(r.top));
  }
  return { found: leaves.length, clicked: n, labels: boxes };
})()`, { label: 'chips' });
console.log(`per-board fill chips found: ${chips.found}, clicked: ${chips.clicked} ${JSON.stringify(chips.labels)}`);
await page.waitForTimeout(2500);

// ASSERT THE STATE before measuring anything. A clean reading from the wrong screen is worse
// than no reading — it is exactly what produced the false all-clear last round.
const state = await measure(page, `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  // buttons AND leaf divs — see the note on the measurement sweep
  const all = [...document.querySelectorAll('button,[role="button"],div,span')]
    .filter((x) => x.tagName !== 'DIV' && x.tagName !== 'SPAN' ? true : x.children.length === 0)
    .filter(vis);
  const lbl = (x) => ((x.getAttribute('aria-label') || '') + ' ' + (x.textContent || '')).trim();
  return { autoPlaceAll: all.some((x) => /auto.?place all/i.test(lbl(x))),
           actionRow: all.some((x) => /^\\s*(cancel|confirm|ready)\\s*$/i.test(lbl(x))),
           placedHint: (document.body.innerText.match(/place\\s+\\d+\\s+cards?/i) || [''])[0] };
})()`, { label: 'state' });
console.log(`state check — Auto-Place ALL present: ${state.autoPlaceAll} | Cancel/Confirm row present: ${state.actionRow} | hint: ${JSON.stringify(state.placedHint)}`);
if (!state.autoPlaceAll || !state.actionRow) {
  console.error('\nNOT IN THE TARGET STATE — both must be present. This is a FAILED MEASUREMENT,');
  console.error('not a clean result. Adjust CHIPS= or the placement route and re-run.');
  await page.screenshot({ path: `tests/screenshots/actionbar-WRONGSTATE-${VW}.png` });
  await browser.close();
  process.exit(2);
}

let d;
try { d = await measure(page, expr, { label: 'bar' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await page.screenshot({ path: `tests/screenshots/actionbar-${VW}x${VH}.png`, clip: { x: 0, y: Math.max(0, VH - 260), width: VW, height: 260 } });
await browser.close();

console.log(`${PLAYERS}P @${VW} — post-placement controls, sorted by y\n`);
console.log('  y range   | x range   | w x h   | clipped | label');
for (const c of d.controls.sort((a, b) => a.tp - b.tp)) {
  console.log(`  ${String(c.tp).padStart(4)}-${String(c.b).padStart(4)} | ${String(c.l).padStart(4)}-${String(c.r).padStart(4)} | ${String(c.w).padStart(3)}x${String(c.h).padStart(3)} | ${c.clipped ? 'CLIPPED' : '   -   '} | ${JSON.stringify(c.t)}`);
}
const clipped = d.controls.filter((c) => c.clipped);
console.log(`\nclipped controls: ${clipped.length ? clipped.map((c) => `${JSON.stringify(c.t)} x${c.l}..${c.r}`).join(' | ') : 'NONE'}`);
// MUST be Auto-Place ALL, not a per-board chip. /auto-place/ matches the y≈264 chip first and
// reported a 488px "gap" against it — a number about the wrong pair of boxes, which would have
// read as a clean result.
// Compare PILL to PILL. Prefer the pill box; fall back to the label only if no pill was resolved,
// and say which was used — a gap measured between two words is not a statement about two buttons.
const ap = d.controls.find((c) => c.pill && /auto.?place all/i.test(c.t))
        || d.controls.find((c) => /auto-place all boards/i.test(c.t))
        || d.controls.find((c) => /auto.?place all/i.test(c.t));
const rowPills = d.controls.filter((c) => c.pill && /(cancel|confirm|ready)/i.test(c.t));
const row = rowPills.length ? rowPills : d.controls.filter((c) => /^\s*(cancel|confirm|ready)\s*$/i.test(c.t));
console.log(`\ncomparing: ${JSON.stringify(ap && ap.t)} vs ${JSON.stringify(row.map((r) => r.t))}  (pill boxes: ${rowPills.length ? 'YES' : 'NO — labels only, treat as unmeasured'})`);
if (ap && row.length) {
  for (const r of row) {
    const ov = Math.min(ap.b, r.b) - Math.max(ap.tp, r.tp);
    console.log(`Auto-Place (${ap.tp}-${ap.b}) vs ${JSON.stringify(r.t)} (${r.tp}-${r.b}): vertical overlap ${ov > 0 ? ov + 'px OVERLAP' : 'none, gap ' + (-ov) + 'px'}`);
  }
} else console.log(`Auto-Place found: ${!!ap} | action-row controls found: ${row.length}`);
console.log(`screenshot -> tests/screenshots/actionbar-${VW}x${VH}.png`);
