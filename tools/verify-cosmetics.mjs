/**
 * THE FIFTH WAY: VISIBLY APPLIED — and the winner cue re-measured afterwards.
 *
 * A purchase that debits, writes a row and shows Owned has still done nothing if the pixel does
 * not change. That standard came from the shop sprint and it caught a real gap; four of five is
 * not done.
 *
 * It also re-measures the three cue widths, because the brief is right that a new card back is the
 * one to be careful with: the back is the largest neutral surface on the table, it sits directly
 * inside the border the cue draws, and the cue is settled at gold 3 / mint 2 / neutral 1.
 *
 *   node tools/verify-cosmetics.mjs
 */
import fs from 'node:fs';
import { serve, launch, openGame, autoPlaceAll, pressReady, tapThroughReveal } from './content-lib.mjs';

const PORT = Number(process.env.PORT || 8983);
const DIST = process.env.DIST || 'web-509-dist';
const engine = process.env.CAPS_ENGINE || 'chromium';
const BACK = process.env.BACK || 'graphite';

const server = await serve(DIST, PORT);
const browser = await launch();

// Seed the persisted store with the chosen back, exactly as the picker would.
const seeded = (() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  st.state.cardBack = BACK;
  return JSON.stringify(st);
})();

// SEEDED IN AN INIT SCRIPT, NOT AFTER LOAD. The rig's own opener re-seeds caps-poker-storage on
// EVERY navigation, so a value written with page.evaluate() is silently overwritten by the next
// reload — which is exactly what happened on the first run of this tool and made a correctly
// applied back look like a fallback to CLASSIC.
const { page } = await openGame(browser, { port: PORT, players: 2, seed: 8, settle: 500 });
await page.addInitScript((blob) => { try { localStorage.setItem('caps-poker-storage', blob); } catch (_) {} }, seeded);
await page.reload({ waitUntil: 'load' });          // <- SURVIVES RELOAD, the fifth check
await page.waitForTimeout(7000);
const persisted = await page.evaluate(`(() => JSON.parse(localStorage.getItem('caps-poker-storage')||'{}')?.state?.cardBack)`);
console.log(`\n  cardBack persisted through the reload: ${JSON.stringify(persisted)}`);

// ── the back, measured off the painted pixel ──────────────────────────────────────────────
const backPx = await page.evaluate(`(() => {
  const bg = (el) => getComputedStyle(el).backgroundColor;
  // face-down cards render the back's bg; find the most common dark card-sized box
  const boxes = [...document.querySelectorAll('div')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 14 && r.width < 90 && r.height > r.width && r.height < 130;
  });
  const counts = {};
  for (const el of boxes) { const c = bg(el); if (/rgb/.test(c)) counts[c] = (counts[c] || 0) + 1; }
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
})()`);

await autoPlaceAll(page); await pressReady(page); await tapThroughReveal(page);
await page.waitForTimeout(2500);

// ── THE CUE, RE-MEASURED ──────────────────────────────────────────────────────────────────
const cue = await page.evaluate(`(() => {
  const out = { gold: [], mint: [], neutral: [], other: [] };
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    const w = parseFloat(s.borderTopWidth) || 0;
    if (w <= 0) continue;
    const c = s.borderTopColor;
    const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); if (!m) continue;
    const [r,g,b] = [ +m[1], +m[2], +m[3] ];
    const key = (r > 150 && g > 130 && b < 120) ? 'gold'
              : (r < 140 && g > 170 && b > 130) ? 'mint'
              : (Math.abs(r-g) < 24 && Math.abs(g-b) < 24) ? 'neutral' : 'other';
    out[key].push(+w.toFixed(2));
  }
  const mode = (a) => { const c = {}; for (const v of a) c[v] = (c[v]||0)+1;
    return Object.entries(c).sort((x,y)=>y[1]-x[1]).map(([v,n]) => v+'px x'+n).slice(0,4); };
  return { gold: mode(out.gold), mint: mode(out.mint), neutral: mode(out.neutral) };
})()`);

await page.screenshot({ path: `/tmp/cos-${engine}-${BACK}.png`, fullPage: true });
await browser.close(); server.close();

console.log(`\n  engine ${engine}   card back "${BACK}"`);
console.log(`  most common card-sized backgrounds (the back is the top one):`);
for (const [c, n] of backPx) console.log(`     ${String(n).padStart(3)}x  ${c}`);
console.log(`\n  WINNER CUE, re-measured after the new back:`);
console.log(`     gold    ${JSON.stringify(cue.gold)}`);
console.log(`     mint    ${JSON.stringify(cue.mint)}`);
console.log(`     neutral ${JSON.stringify(cue.neutral)}`);
console.log(`\n  screenshot /tmp/cos-${engine}-${BACK}.png\n`);
