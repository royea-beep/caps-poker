/**
 * The loop's four screens do not reach /results or /hand-history, which is where the two share
 * controls that were recoloured actually live. This plays a real practice hand through the app's
 * own controls and measures the SAME detectors on the screens that follow.
 */
import { serve, openGame, autoPlaceAll, pressReady, tapThroughReveal, readOutcome } from '../tools/content-lib.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';

const PORT = 8993;
const OUT = 'docs/last-three/loop';
process.env.CAPS_BROWSER_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const DETECT = () => {
  const rgb = (s) => { const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s || ''); return m ? [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])] : null; };
  const alpha = (s) => { const m = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(s || ''); return m ? +m[1] : 1; };
  const isGold = (s) => { const c = rgb(s); if (!c || alpha(s) === 0) return false; return Math.abs(c[0]-255)<=6 && Math.abs(c[1]-215)<=10 && Math.abs(c[2]-0)<=12; };
  const controls = () => Array.from(document.querySelectorAll('button, a[href], [role="button"], [role="radio"], [role="switch"], [role="link"], [tabindex]:not([tabindex="-1"])'));
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-testid') || (el.innerText||'').trim().slice(0,40) || '(unnamed)');
  const gold = controls().map((el) => {
    const cs = getComputedStyle(el); const w = [];
    if (isGold(cs.backgroundColor)) w.push('background');
    if (isGold(cs.borderTopColor)) w.push('border');
    if (isGold(cs.color)) w.push('text');
    for (const t of el.querySelectorAll('*')) if (isGold(getComputedStyle(t).color)) { w.push('childText'); break; }
    return w.length ? { label: label(el), where: [...new Set(w)] } : null;
  }).filter(Boolean);
  return { url: location.pathname, controls: controls().length, gold,
           controlLabels: controls().map(label) };
};

const server = await serve('/tmp/webloop2', PORT);
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH });
const out = {};

for (const seed of [4, 20260827]) {
  const { ctx, page, errs } = await openGame(browser, { port: PORT, players: 2, seed });
  await autoPlaceAll(page);
  await pressReady(page);
  await tapThroughReveal(page);
  await page.waitForTimeout(3000);
  const outcome = await readOutcome(page);
  const det = await page.evaluate(`(${DETECT.toString()})()`);
  await page.screenshot({ path: `${OUT}/results-seed${seed}-393-chromium.png` });
  out[`seed${seed}`] = { outcome, det, pageErrors: errs.slice(0, 4) };
  console.log(`\n--- seed ${seed} : ${det.url}`);
  console.log('   outcome  ', JSON.stringify(outcome));
  console.log('   controls ', det.controls, '  GOLD ON CONTROLS:', det.gold.length, JSON.stringify(det.gold));

  // hand history, from the same session
  await page.goto(`http://localhost:${PORT}/hand-history`, { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(3000);
  const hh = await page.evaluate(`(${DETECT.toString()})()`);
  const hhText = await page.evaluate(() => document.body.innerText.slice(0, 700));
  await page.screenshot({ path: `${OUT}/hand-history-seed${seed}-393-chromium.png` });
  out[`seed${seed}`].handHistory = { gold: hh.gold, text: hhText };
  console.log('   /hand-history gold:', hh.gold.length);
  console.log('   /hand-history text:', JSON.stringify(hhText.slice(0, 260)));
  await ctx.close();
}

fs.writeFileSync(`${OUT}/results-probe.json`, JSON.stringify(out, null, 1));
await browser.close(); server.close();
console.log('\nwritten', `${OUT}/results-probe.json`);
