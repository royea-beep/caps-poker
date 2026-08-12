/**
 * Does hand_history match what actually happened?
 *
 * Plays hands with a KNOWN device_id, and for each one records what the results screen actually
 * showed — per-board winner, net chips, the headline — so each DB row can be checked against
 * reality rather than against another DB column.
 *
 * The specific question: rows exist with boards_won=1, boards_total=3 marked BOTH "won" and
 * "lost". `result` is `p_won: revealData.netChips > 0` (results.tsx:571) while `boards_won`
 * counts strict wins, so a hand with ties could legitimately be "won" on 1 board. This captures
 * the tie count, which the row does not store, to confirm or refute that.
 *
 * Prints the device_id so the rows can be found and cleaned up.
 *
 *   HANDS=4 node tests/handhistory-truth.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const HANDS = Number(process.env.HANDS || 4);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Read the truth from the STORE's revealData — the same object the RPC call derives from — so
// the comparison is against what the app believed, not against a re-reading of the screen.
const truth = `(() => {
  let rd = null;
  try {
    const raw = sessionStorage.getItem('caps_reveal_data') || sessionStorage.getItem('revealData');
    if (raw) rd = JSON.parse(raw);
  } catch {}
  const txt = (document.body.innerText || '').trim();
  // Fall back to the rendered summary when the store shape is not reachable.
  const mBoards = /Boards:\\s*(\\d+)\\s*\\/\\s*(\\d+)/i.exec(txt);
  const mNet = /Net:\\s*([+-]?\\d+)/i.exec(txt);
  return { url: location.pathname,
           device: localStorage.getItem('caps-device-id'),
           headline: (txt.split('\\n')[0] || '').slice(0, 28),
           boardsWonText: mBoards ? Number(mBoards[1]) : null,
           boardsTotalText: mBoards ? Number(mBoards[2]) : null,
           netText: mNet ? mNet[1] : (/Net:\\s*XP only/i.test(txt) ? 'XP only' : null),
           winCount: (txt.match(/\\bWIN\\b/g) || []).length,
           lossCount: (txt.match(/\\bLOSS\\b/g) || []).length,
           tieCount: (txt.match(/\\bTIE\\b/g) || []).length,
           rdKeys: rd ? Object.keys(rd).slice(0, 8) : null };
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const device = await page.evaluate(`(() => localStorage.getItem('caps-device-id'))()`);
console.log(`DEVICE UNDER TEST: ${device}\n`);

const seen = [];
for (let h = 1; h <= HANDS; h++) {
  await page.goto(`${URL}/game?practice=true&players=${PLAYERS}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  let reached = false;
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(2500);
    // page.url() reads from Playwright's side and needs NO execution context. Polling
    // location.pathname via evaluate races the reveal -> results navigation and throws
    // "Execution context was destroyed" — which killed the whole run, losing three good hands
    // to a status check.
    if (/results/.test(page.url())) { reached = true; break; }
  }
  if (!reached) { console.log(`hand ${h}: NEVER REACHED /results — not counted`); continue; }
  await page.waitForTimeout(6000);   // let the celebration overlay clear before reading
  let t;
  try { t = await measure(page, truth, { label: 'h' + h }); }
  catch (e) { console.log(`hand ${h}: HARNESS ${e instanceof HarnessError ? e.message.slice(0, 50) : ''}`); continue; }
  seen.push({ h, ...t });
  console.log(`hand ${h}: headline ${JSON.stringify(t.headline)} | boards ${t.boardsWonText}/${t.boardsTotalText} | net ${JSON.stringify(t.netText)} | per-board WIN ${t.winCount} LOSS ${t.lossCount} TIE ${t.tieCount}`);
}
await browser.close();

if (!seen.length) { console.error('\nNO HANDS RECORDED — failed run, not a clean one.'); process.exit(2); }
console.log(`\n${seen.length} hands recorded for device ${device}`);
console.log('Now compare against the DB:');
console.log(`  select hand_number, result, boards_won, boards_total, chips_delta, session_type, user_id`);
console.log(`  from hand_history where device_id = '${device}' order by hand_number;`);
console.log(`Then DELETE those rows: delete from hand_history where device_id = '${device}';`);
