/**
 * CONTROL for the card top-highlight fix.
 *
 * After softening the highlight the top line reads (239,238,235) — DARKER than the card face,
 * where it used to read (255,254,254), brighter. My first PASS threshold ("line should match
 * the face") was miscalibrated: a card's extreme top row blends with the dark board through
 * edge anti-aliasing, so it is darker than the face NO MATTER WHAT the highlight does.
 *
 * So the real question is not "does the top line match the face" but "is the top line now
 * indistinguishable from an ordinary card edge?" The LEFT edge is the control — same 1px
 * card-to-board transition, and it carries no highlight at all.
 *
 *   node tests/card-edge-control.mjs
 */
import { chromium } from 'playwright';

const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const findCard = `(() => {
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (Math.round(r.height) !== 1 || r.width < 20 || r.width > 200) continue;
    const q = el.parentElement && el.parentElement.getBoundingClientRect();
    if (!q || Math.abs(r.top - q.top) > 1.5 || Math.abs(r.width - (q.width - 2)) > 1.5) continue;
    return { l: Math.round(q.left), t: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) };
  }
  return null;
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,960'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto('https://caps.ftable.co.il/game?practice=true&players=3&fresh=1', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const box = await page.evaluate(findCard);
if (!box) { console.error('NO CARD FOUND — failed measurement, not a negative.'); await browser.close(); process.exit(2); }
const buf = await page.screenshot();

const r = await page.evaluate(async ({ b64, q }) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
  const my = q.t + Math.round(q.h / 2);
  return { board: at(q.l + Math.round(q.w / 2), q.t - 3),   // dark board above the card
           topLine: at(q.l + Math.round(q.w / 2), q.t),      // the element we changed
           face: at(q.l + Math.round(q.w / 2), q.t + 5),     // cream card face
           leftEdge: at(q.l, my),                            // CONTROL: same 1px transition
           leftIn: at(q.l + 2, my) };                        // face, 2px inside the left edge
}, { b64: buf.toString('base64'), q: box });

console.log(`card ${box.w}x${box.h} at (${box.l},${box.t})`);
for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(9)} (${v.join(',')})`);

const dev = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const top = dev(r.topLine, r.face), left = dev(r.leftEdge, r.leftIn);
console.log(`\ntop line vs face:      ${top}`);
console.log(`left edge vs face:     ${left}   <- CONTROL, no highlight on this edge`);
console.log(top <= left + 6
  ? '\nPASS — the top line is now within normal card-edge behaviour. The bright bar is gone.'
  : `\nSTILL DISTINCT — the top line deviates ${top - left} more than an ordinary edge does.`);
await browser.close();
