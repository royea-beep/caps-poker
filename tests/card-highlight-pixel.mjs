/**
 * THE LINE ABOVE THE CARDS — pixel verification.
 *
 * The strategist measured a 51x1 element at rgba(255,255,255,0.9) rendering (255,254,254)
 * against a (252,250,245) cream card face, at y=115 / x=51,107,163 at 390px.
 *
 * This does NOT hardcode y=115. Hardcoded coordinates were how iterations 27-28 measured the
 * wrong elements. It FINDS the 1px element in the DOM (height 1, inset 1px each side, inside a
 * card), then samples the ACTUAL PAINTED PIXEL at its centre by drawing the screenshot into a
 * canvas in-page — the same technique that settled the intermission wash question.
 *
 *   node tests/card-highlight-pixel.mjs
 *
 * PASS = the sampled RGB sits at or near the card face (252,250,245), i.e. a visibly softer
 * step than pure white. It also samples the face itself 5px below, so the comparison is against
 * THIS run's card, not a remembered number.
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

// Find every 1px-tall element that is inset 1px on both sides of its parent — the signature of
// the highlight View, independent of its colour (which is exactly what we are changing).
const findLines = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (Math.round(r.height) !== 1 || r.width < 20 || r.width > 200) continue;
    const p = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
    if (!p) continue;
    if (Math.abs(r.top - p.top) > 1.5) continue;              // sits at the parent's top edge
    if (Math.abs(r.width - (p.width - 2)) > 1.5) continue;     // inset 1px each side
    const cs = getComputedStyle(el);
    out.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top),
               w: Math.round(r.width), parentW: Math.round(p.width), parentH: Math.round(p.height),
               bg: cs.backgroundColor, op: cs.opacity });
  }
  return out;
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},960`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const lines = await page.evaluate(findLines);
if (!Array.isArray(lines) || !lines.length) {
  console.error('NO 1px INSET ELEMENTS FOUND — failed measurement, not a negative result.');
  console.error('Either the placement screen did not render, or the element moved. Do not read');
  console.error('this as "the line is gone".');
  await browser.close(); process.exit(2);
}

console.log(`viewport=${VW}  found ${lines.length} candidate highlight elements`);
console.log('computed style of the first: bg=%s opacity=%s (parent %dx%d)',
  lines[0].bg, lines[0].op, lines[0].parentW, lines[0].parentH);

const buf = await page.screenshot();
const b64 = buf.toString('base64');

// Sample the painted pixel ON the line, and the card face 5px below it, for each candidate.
const px = await page.evaluate(async ({ b64, pts }) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
  return pts.map((p) => ({ x: p.x, y: p.y, line: at(p.x, p.y), face: at(p.x, p.y + 5) }));
}, { b64, pts: lines.slice(0, 6) });

console.log('\n   x |   y | LINE pixel      | card FACE 5px below | delta');
for (const p of px) {
  const d = Math.max(...p.line.map((v, i) => Math.abs(v - p.face[i])));
  console.log(`${String(p.x).padStart(4)} | ${String(p.y).padStart(3)} | (${p.line.join(',')})`.padEnd(38) +
    `| (${p.face.join(',')})`.padEnd(22) + `| ${d}`);
}

const worst = Math.max(...px.map((p) => Math.max(...p.line.map((v, i) => Math.abs(v - p.face[i])))));
console.log(`\nlargest line-vs-face channel delta: ${worst}`);
console.log(worst <= 6
  ? 'SOFTENED — the line now sits within a few units of the card face. It reads as a gloss.'
  : worst <= 14
    ? 'PARTIALLY SOFTENED — visibly softer than the (255,254,254) bar, but still a step.'
    : 'STILL A HARD BAR — the change did not take, or the deploy has not landed yet.');
await browser.close();
