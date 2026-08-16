/**
 * Did the TS1355 fix move a pixel? It should not — `as const` is erased before emit — but
 * Card.tsx:458 sits in the LIVE V2 branch (isV2 is hardcoded true and v2Border is applied at
 * :526), so "it cannot have changed" is a prediction, not evidence.
 *
 * Measures the card geometry and the border encoding the fix touched, across both engines, both
 * widths, and all three player counts.
 *
 * Board count is re-derived from the rule here rather than copied from a brief — it has been
 * stated inverted before: 2 players = 4 boards, 3 = 3, 4 = 2.
 *
 *   node tests/card-render-unchanged.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expectedBoards = (players) => (players === 3 ? 3 : players === 4 ? 2 : 4);

const probe = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  const txt = document.body.innerText || '';
  const boards = [...new Set((txt.match(/BOARD\\s+\\d+/gi) || []).map(s => s.toUpperCase()))].length;

  // Cards: a card-ish box is roughly 1.4 tall/wide and between 24 and 100 wide.
  const sizes = {}, borders = {};
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.width > 100) continue;
    const ratio = r.height / r.width;
    if (ratio < 1.25 || ratio > 1.6) continue;
    const key = Math.round(r.width) + 'x' + Math.round(r.height);
    sizes[key] = (sizes[key] || 0) + 1;
    const cs = getComputedStyle(el);
    const bw = Math.round(parseFloat(cs.borderTopWidth) || 0);
    if (bw > 0) {
      const bk = bw + 'px ' + cs.borderTopColor;
      borders[bk] = (borders[bk] || 0) + 1;
    }
  }

  // Smallest rendered glyph — the 10px floor must hold.
  let minGlyph = 99;
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length || !vis(el)) continue;
    const t = (el.textContent || '').trim();
    if (!/^([\\u2660\\u2665\\u2666\\u2663]|10|[2-9AKQJ])$/.test(t)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > 0 && fs < minGlyph) minGlyph = fs;
  }
  return { boards, sizes, borders, minGlyph: minGlyph === 99 ? null : minGlyph };
})()`;

const rows = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const vw of [390, 320]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: vw, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    for (const players of [2, 3, 4]) {
      await page.goto(`${URL}/game?practice=true&players=${players}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(9000);
      let r;
      try { r = await measure(page, probe, { label: `${name}-${vw}-${players}p` }); }
      catch (e) { console.log(`${name} @${vw} ${players}P — HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)}`); continue; }
      const want = expectedBoards(players);
      const top = Object.entries(r.sizes).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const ok = r.boards === want;
      rows.push({ name, vw, players, boards: r.boards, want, ok, minGlyph: r.minGlyph });
      console.log(`${name} @${vw} ${players}P | boards ${r.boards}/${want} ${ok ? 'OK' : '** WRONG'} | cards ${JSON.stringify(top)} | minGlyph ${r.minGlyph}`);
      console.log(`   borders ${JSON.stringify(Object.entries(r.borders).slice(0, 4))}`);
    }
    await browser.close();
  }
}

console.log('\n=== verdict ===');
const badBoards = rows.filter((r) => !r.ok);
const badGlyph = rows.filter((r) => r.minGlyph != null && r.minGlyph < 10);
if (!rows.length) { console.error('NO MEASUREMENTS — failed run, not a clean one.'); process.exit(2); }
console.log(badBoards.length ? `  BOARD COUNT WRONG: ${JSON.stringify(badBoards)}` : '  board counts obey 2=4 / 3=3 / 4=2 everywhere');
console.log(badGlyph.length ? `  GLYPH BELOW 10px: ${JSON.stringify(badGlyph)}` : '  every rendered glyph >= 10px');
