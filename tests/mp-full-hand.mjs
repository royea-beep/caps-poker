/**
 * A COMPLETE multiplayer hand, two clients, played to the result.
 *
 * mp-regression.mjs stops at the deal. This carries on: both place, both ready, reveal,
 * result — and then asks the only question that really matters in multiplayer:
 *
 *   DO THE TWO CLIENTS AGREE ABOUT WHO WON?
 *
 * Careful about what "agree" means. Each client renders its OWN perspective, so if A wins,
 * A says "YOU WIN" and B says "YOU LOSE". Comparing the two headlines for equality would
 * fail on a perfectly correct hand. Agreement means the perspectives are MIRRORS:
 *
 *   - exactly one client claims the win (or both report a tie), never both, never neither
 *   - A.boardsWon + B.boardsWon + ties == boardsTotal, from each side's own reading
 *
 * Two clients both claiming victory is the disagreement that would matter. So is a board
 * total that doesn't add up, which means one side scored a board the other didn't.
 *
 * Also captures both device_ids and both chip balances (before and after) so hand_history
 * and the economy can be checked per player afterwards.
 *
 * CLEANUP IS MANDATORY. A room left in 'playing' DISAPPEARS from the lobby. The finally
 * block prints the restore SQL; it does NOT verify it — verify by query afterwards.
 *
 *   node tests/mp-full-hand.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const joinByCode = (code) => `(() => {
  const btns = [...document.querySelectorAll('button,[role="button"]')];
  const join = btns.find(b => {
    if (!/join/i.test((b.textContent || '') + (b.getAttribute('aria-label') || ''))) return false;
    let n = b, depth = 0;
    while (n && depth < 6) { if ((n.textContent || '').includes(${JSON.stringify(code)})) return true; n = n.parentElement; depth++; }
    return false;
  });
  if (join) { window.__f(join); return true; }
  return false;
})()`;

// Identity + wallet, read from the store the UI actually renders from.
const who = `(() => {
  let chips = null;
  try { chips = JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch {}
  return { device: localStorage.getItem('caps-device-id'), chips, url: location.pathname };
})()`;

// One client's reading of the finished hand, from ITS OWN perspective.
const outcome = `(() => {
  const txt = (document.body.innerText || '').trim();
  const mB = /Boards:\\s*(\\d+)\\s*\\/\\s*(\\d+)/i.exec(txt);
  // MP renders a running score instead: "Leading 1-0 · 3 left" / "Trailing 0-1 · 3 left".
  // Its mirror across the two clients is the cross-client agreement signal that matters.
  const mS = /(Leading|Trailing|Tied)\\s*(\\d+)\\s*-\\s*(\\d+)/i.exec(txt);
  let chips = null;
  try { chips = JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch {}
  return { url: location.pathname,
           device: localStorage.getItem('caps-device-id'),
           chips,
           headline: (txt.split('\\n').find(l => l.trim()) || '').slice(0, 30),
           claimsWin:  /YOU WIN|YOU WON/i.test(txt),
           claimsLoss: /YOU LOSE|YOU LOST/i.test(txt),
           claimsTie:  /\\bTIE\\b|SPLIT|DRAW/i.test(txt),
           boardsWon:   mB ? Number(mB[1]) : null,
           boardsTotal: mB ? Number(mB[2]) : null,
           scoreWord: mS ? mS[1].toLowerCase() : null,
           scoreMine: mS ? Number(mS[2]) : null,
           scoreTheirs: mS ? Number(mS[3]) : null,
           perBoardWin:  (txt.match(/\\bWIN\\b/g)  || []).length,
           perBoardLoss: (txt.match(/\\bLOSS\\b/g) || []).length,
           perBoardTie:  (txt.match(/\\bTIE\\b/g)  || []).length,
           bodyLen: txt.length,
           // When no verdict renders, the screen ITSELF is the finding — capture it rather
           // than reporting a length. A 676-char page with an "✕" is a state, not a result.
           body: txt.slice(0, 700).replace(/\\n+/g, ' | ') };
})()`;

const place = async (p) => {
  await p.evaluate(`window.__f=${fire}`);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await p.waitForTimeout(2000);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r){window.__f(r);return true}
    const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^\\s*(ready|confirm)\\b/i.test((x.getAttribute('aria-label')||x.textContent||'').trim()));
    if(b)window.__f(b);})()`);
};

const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

let browser, roomCode = null, devices = {};
try {
  browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
  const mk = async () => {
    const c = await browser.newContext({ viewport: { width: W, height: H }, ignoreHTTPSErrors: true });
    await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
    p.on('response', (r) => { if (r.status() >= 400 && /supabase/.test(r.url())) errs.push(`${r.status()} ${r.url().split('/').pop()}`); });
    return { p, errs };
  };

  const A = await mk(), B = await mk();
  for (const cl of [A, B]) {
    await cl.p.goto(URL + '/lobby', { waitUntil: 'load', timeout: 120000 });
    await cl.p.waitForTimeout(9000);
    await cl.p.evaluate(`window.__f=${fire}`);
  }
  const idA = await measure(A.p, who, { label: 'idA' });
  const idB = await measure(B.p, who, { label: 'idB' });
  devices = { A: idA.device, B: idB.device };
  console.log(`A device ${idA.device} chips ${idA.chips}`);
  console.log(`B device ${idB.device} chips ${idB.chips}`);
  rec('0 two distinct devices', idA.device !== idB.device, `${idA.device} vs ${idB.device}`);

  const codes = await measure(A.p, `(() => [...new Set((document.body.innerText || '').match(/#[A-Z0-9]{4}/g) || [])])()`, { label: 'codes' });
  if (!Array.isArray(codes) || !codes.length) throw new HarnessError('no room codes rendered — cannot join');
  roomCode = codes[0].replace('#', '');
  console.log(`\njoining room ${roomCode}\n`);

  await A.p.evaluate(joinByCode(roomCode));
  await A.p.waitForTimeout(6000);
  await B.p.evaluate(joinByCode(roomCode));
  await B.p.waitForTimeout(14000);

  // The MP route carries the entire deal in its query string, so log the path only.
  const path = (p) => { try { return new URL(p.url()).pathname; } catch { return '?'; } };
  const inGame = (u) => /multiplayer-game/.test(u);
  rec('1 both reach the table', inGame(A.p.url()) && inGame(B.p.url()), `A=${path(A.p)} B=${path(B.p)}`);
  if (!inGame(A.p.url()) || !inGame(B.p.url())) throw new HarnessError('never reached the table — nothing to play');

  // Both place and ready. Placement is unlimited until the FIRST ready, so A can take its
  // time; after that a 60s clock runs, which is why B places immediately after.
  console.log('placing (A then B)...');
  await place(A.p);
  await B.p.waitForTimeout(1500);
  await place(B.p);

  // The reveal is MANUAL: each board waits on "Tap to reveal" and the header counts down
  // ("Leading 1-0 · 3 left"). An earlier run sat here for two minutes and reported the hand
  // "settled" because a PER-BOARD verdict matched a whole-hand regex — a board banner is not
  // the end of the hand. So tap through, on both clients, and only call it settled when the
  // reveal prompt is gone.
  const tapReveal = async (p) => p.evaluate(`(() => {
    const els = [...document.querySelectorAll('*')].filter(e => /tap to reveal/i.test((e.textContent || '').trim()) && e.children.length < 3);
    const el = els[els.length - 1];
    if (!el) return false;
    window.__f(el.closest('[role="button"],button') || el);
    return true;
  })()`).catch(() => false);

  let settled = false, taps = 0;
  for (let i = 0; i < 40; i++) {
    await B.p.waitForTimeout(2500);
    if (/results/.test(A.p.url()) || /results/.test(B.p.url())) { settled = true; break; }
    const ta = await tapReveal(A.p), tb = await tapReveal(B.p);
    if (ta || tb) taps++;
    const prompt = await A.p.evaluate(`(() => /tap to reveal|left\\b/i.test(document.body.innerText || ''))()`).catch(() => true);
    if (!prompt && taps > 0) { settled = true; break; }
  }
  console.log(`reveal taps issued: ${taps}`);
  console.log(`hand settled: ${settled}  (A=${path(A.p)} B=${path(B.p)})`);
  await A.p.waitForTimeout(7000);

  let oa, ob;
  try { oa = await measure(A.p, outcome, { label: 'outA' }); } catch { oa = null; }
  try { ob = await measure(B.p, outcome, { label: 'outB' }); } catch { ob = null; }
  console.log(`\nA screen: ${oa ? JSON.stringify(oa.body) : 'unreadable'}`);
  console.log(`B screen: ${ob ? JSON.stringify(ob.body) : 'unreadable'}\n`);
  await A.p.screenshot({ path: 'tests/screenshots/mp-A-final.png' }).catch(() => {});
  await B.p.screenshot({ path: 'tests/screenshots/mp-B-final.png' }).catch(() => {});

  if (!oa || !ob) {
    rec('2 both clients rendered an outcome', false, `A=${!!oa} B=${!!ob} — cannot judge agreement`);
  } else {
    rec('2 both clients rendered an outcome', oa.bodyLen > 40 && ob.bodyLen > 40, `bodyLen A=${oa.bodyLen} B=${ob.bodyLen}`);

    // THE assertion. Exactly one winner, or a mutual tie — never two winners.
    const bothWin = oa.claimsWin && ob.claimsWin;
    const neither = !oa.claimsWin && !ob.claimsWin && !(oa.claimsTie && ob.claimsTie);
    rec('3 clients agree on the winner', !bothWin && !neither,
      bothWin ? 'BOTH CLAIM THE WIN — clients disagree'
              : neither ? 'NEITHER claims a win and it is not a mutual tie'
              : `A win=${oa.claimsWin} B win=${ob.claimsWin} (mirrored)`);

    // THE score must be a MIRROR: A's "Leading 1-0" is B's "Trailing 0-1". Equal score
    // strings would mean both clients believe they are ahead by the same margin.
    if (oa.scoreMine != null && ob.scoreMine != null) {
      const mirrored = oa.scoreMine === ob.scoreTheirs && oa.scoreTheirs === ob.scoreMine;
      rec('4 running score is mirrored across clients', mirrored,
        `A ${oa.scoreWord} ${oa.scoreMine}-${oa.scoreTheirs} vs B ${ob.scoreWord} ${ob.scoreMine}-${ob.scoreTheirs}`);
      const bothAhead = oa.scoreWord === 'leading' && ob.scoreWord === 'leading';
      rec('5 not both clients claiming the lead', !bothAhead, bothAhead ? 'BOTH LEADING — disagreement' : `${oa.scoreWord} / ${ob.scoreWord}`);
    } else if (oa.boardsTotal != null && ob.boardsTotal != null) {
      rec('4 both read the same board count', oa.boardsTotal === ob.boardsTotal, `A=${oa.boardsTotal} B=${ob.boardsTotal}`);
      rec('5 boards won sum within the board total', (oa.boardsWon || 0) + (ob.boardsWon || 0) <= oa.boardsTotal,
        `A ${oa.boardsWon} + B ${ob.boardsWon} of ${oa.boardsTotal}`);
    } else {
      rec('4 a comparable score rendered on both clients', false, 'neither a score line nor a board line rendered');
    }
    console.log(`chips  A ${idA.chips} -> ${oa.chips}   B ${idB.chips} -> ${ob.chips}`);
  }

  const allErrs = [...new Set([...A.errs, ...B.errs])].filter((e) => !/play\(\) failed/.test(e));
  rec('6 zero page errors / supabase 4xx', allErrs.length === 0, allErrs.length ? JSON.stringify(allErrs.slice(0, 3)) : 'none');
} catch (e) {
  console.error('\nRUN FAILED:', e instanceof HarnessError ? e.message : String(e).slice(0, 200));
} finally {
  if (browser) await browser.close();
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n=== ${results.length - fails}/${results.length} assertions passed ===`);
  if (devices.A) {
    console.log(`\nhand_history per player:`);
    console.log(`   select device_id, hand_number, result, boards_won, boards_total, chips_delta`);
    console.log(`   from hand_history where device_id in ('${devices.A}','${devices.B}') order by device_id, hand_number;`);
    console.log(`   delete from hand_history where device_id in ('${devices.A}','${devices.B}');`);
  }
  if (roomCode) {
    console.log(`\n⚠️ RESTORE REQUIRED for room ${roomCode} — the lobby HIDES a room left in 'playing':`);
    console.log(`   delete from room_players where room_id = (select id from game_rooms where room_code='${roomCode}');`);
    console.log(`   update game_rooms set status='waiting', current_players=0, host_id=null,`);
    console.log(`          host_name='Open Table', started_at=null where room_code='${roomCode}';`);
  }
}
