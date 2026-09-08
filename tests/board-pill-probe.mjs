/**
 * DOES THE "more boards below" AFFORDANCE ACTUALLY APPEAR, AND DOES TAPPING IT HELP?
 *
 * The fit probe proves the overflow is unchanged (it must be — the pill is absolutely positioned).
 * This proves the pill itself: present exactly where content is hidden, absent where it is not,
 * and one tap moves the scroller. Iron Rule 10 — watch it run.
 *
 * CANARY: the run fails unless the pill is ABSENT in at least one non-overflowing cell. A pill that
 * is always on would pass a naive "is it there" check while telling the player nothing.
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';
const URL = process.env.CAPS_URL || 'http://127.0.0.1:8899';
const GAME = process.env.CAPS_GAME_PATH || '/game/';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const PILL = /more board|בורדים למטה/i;

const FIND = `(() => {
  const el = [...document.querySelectorAll('*')].find(
    (e) => !e.children.length && /▼/.test(e.textContent || ''));
  const cands = [...document.querySelectorAll('*')]
    .filter((e) => e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 100 && /BOARD\\s*\\d/i.test(e.innerText||''))
    .sort((a,b) => a.clientHeight - b.clientHeight);
  const sc = cands[0] || null;
  return { pill: el ? (el.textContent||'').trim() : null,
           scrollTop: sc ? Math.round(sc.scrollTop) : null,
           over: sc ? sc.scrollHeight - sc.clientHeight : 0 };
})()`;

const out = {};
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const [w, h] of [[320, 568], [393, 852]]) {
    for (const players of [2, 3, 4]) {
      const b = await engine.launch(process.env.CHROME_PATH && name === 'chromium' ? { executablePath: process.env.CHROME_PATH } : {});
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
      await ctx.route(/supabase\.co|ftable\.co\.il|google/, (r) => r.abort());
      const p = await ctx.newPage();
      await p.goto(`${URL}${GAME}?practice=true&players=${players}`, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(6500);
      const before = await p.evaluate(FIND);
      let after = null;
      if (before.pill) {
        const el = await p.locator('text=/▼/').first();
        await el.click({ timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(900);
        after = await p.evaluate(FIND);
      }
      out[`${name}-${w}-${players}P`] = { over: before.over, pill: before.pill,
        scrollBefore: before.scrollTop, scrollAfter: after ? after.scrollTop : null };
      await b.close();
    }
  }
}

const rows = Object.entries(out);
const shown = rows.filter(([, v]) => v.pill);
const hidden = rows.filter(([, v]) => !v.pill);
// CANARY — a pill that never hides is not an affordance, it is decoration.
if (!hidden.length) { console.error('CANARY: the pill appeared in EVERY cell — it is not gated.'); process.exit(3); }
if (!shown.length)  { console.error('CANARY: the pill appeared in NO cell — it never renders.'); process.exit(3); }

let bad = [];
for (const [k, v] of rows) {
  const shouldShow = v.over > 8;
  if (shouldShow !== !!v.pill) bad.push(`${k}: over=${v.over} pill=${v.pill ? 'shown' : 'absent'}`);
  if (v.pill && v.scrollAfter !== null && v.scrollAfter <= v.scrollBefore) bad.push(`${k}: tap did not scroll (${v.scrollBefore} -> ${v.scrollAfter})`);
  console.log(k.padEnd(22), 'over=' + String(v.over).padStart(4),
    (v.pill ? 'PILL "' + v.pill + '"' : 'no pill').padEnd(34),
    v.pill ? `scroll ${v.scrollBefore} -> ${v.scrollAfter}` : '');
}
fs.writeFileSync('docs/reporter-and-board4/board-pill.json', JSON.stringify(out, null, 2));
if (bad.length) { console.error('\nFAIL:\n' + bad.join('\n')); process.exit(1); }
console.log('\nOK — pill shown in', shown.length, 'overflowing cell(s), absent in', hidden.length, 'that fit; every tap scrolled.');
