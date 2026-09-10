/**
 * FIRST SESSION AS A STRANGER — read as a person, not a scanner.
 *
 * ⚠️ BOUNDARY STATED UP FRONT: this container's browser cannot reach Supabase or
 * caps.ftable.co.il (proven: fetch THREW "Failed to fetch" for both, while curl reaches both).
 * So the app runs here with the BACKEND DARK. Everything backend-shaped — the 2,000 grant, the
 * shop catalogue, the balance — is NOT verifiable this way, and reading an empty screen as a
 * product defect is exactly the error that produced the false "the shop is empty" finding.
 * What IS verifiable: does every route render, is the copy honest, is anything truncated,
 * contradictory or overpromising, and is anything stranded.
 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8899';
const ROUTES = ['/', '/play', '/profile', '/game', '/results', '/shop', '/lobby', '/settings',
  '/leaderboard', '/achievements', '/stats', '/hand-history', '/rank', '/cups', '/friends',
  '/referral', '/battle-pass', '/missions', '/heatmap', '/simulate', '/chip-store',
  '/multiplayer-game', '/gameover', '/lobby/private', '/lobby/table', '/club/DEMO',
  '/theme-pick', '/orientation-pick', '/coaching', '/replay', '/spectate', '/debug', '/nope-xyz'];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const consoleErrors = [];
p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });
p.on('pageerror', e => consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 120)));

const rows = [];
for (const r of ROUTES) {
  await p.goto(BASE + r, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.waitForTimeout(1400);
  const info = await p.evaluate(() => {
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    // a clipped element: scrollWidth meaningfully exceeds clientWidth on a text node's box
    let clipped = [];
    for (const el of document.querySelectorAll('*')) {
      const t = (el.innerText || '').trim();
      if (!t || t.length > 60 || el.children.length) continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) clipped.push(t.slice(0, 40));
    }
    return { url: location.pathname, chars: txt.length, head: txt.slice(0, 150),
             clipped: [...new Set(clipped)].slice(0, 4) };
  });
  rows.push({ asked: r, ...info });
}
console.log(JSON.stringify({ rows, consoleErrors: [...new Set(consoleErrors)].slice(0, 12) }, null, 1));
await b.close();
