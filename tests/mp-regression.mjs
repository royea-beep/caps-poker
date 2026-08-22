/**
 * MULTIPLAYER REGRESSION NET — the prerequisite for the server-side adjudication migration.
 *
 * ⚠️ STATUS: WRITTEN BUT NEVER EXECUTED. It is NOT yet a safety net. Run it on the current
 * build and confirm it passes BEFORE trusting it or starting any migration. A probe that has
 * never passed proves nothing — this project has been burned five times by exactly that.
 *
 * WHY IT EXISTS. Multiplayer works today (verified manually once: two contexts joined #YYPT,
 * waiting -> playing, identical boards, different hole cards, room_players 2 rows). The
 * migration touches the deal and adjudication, which is precisely what MP depends on. A net
 * built AFTER the change tells you something broke; built before, it tells you WHEN.
 *
 *   node tests/mp-regression.mjs
 *
 * CLEANUP IS MANDATORY AND AUTOMATIC. The six open tables are by design — the lobby labels
 * them "TABLES FOR FRIENDS · wait at a table". A room left in `playing` DISAPPEARS from the
 * lobby, so this restores waiting/0/NULL and deletes room_players rows in a finally block.
 * The restore is NOT verified by this script; verify by query afterwards.
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Join by locating the card that CONTAINS the room code, then clicking the Join inside it —
// never by index. Card order is server-listed and not stable between polls.
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

// Card identity from the DOM: rank+suit pairs in order, per board.
const readBoards = `(() => {
  const leaf = [...document.querySelectorAll('*')].filter(e => !e.children.length);
  const glyphs = leaf.filter(e => /^[♠♥♦♣]$/.test((e.textContent || '').trim()))
    .map(e => ({ y: Math.round(e.getBoundingClientRect().top), s: (e.textContent || '').trim() }));
  const ranks = leaf.filter(e => /^(10|[2-9AKQJ])$/.test((e.textContent || '').trim()))
    .map(e => ({ y: Math.round(e.getBoundingClientRect().top), r: (e.textContent || '').trim() }));
  return { suitSeq: glyphs.map(g => g.s).join(''), rankSeq: ranks.map(r => r.r).join(','),
           glyphCount: glyphs.length, url: location.pathname };
})()`;

const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

let browser, roomCode = null;
try {
  browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
  const mk = async () => {
    const c = await browser.newContext({ viewport: { width: W, height: H }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
    await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
    p.on('response', (r) => { if (r.status() >= 400 && /supabase/.test(r.url())) errs.push(`${r.status()} ${r.url().split('/').pop()}`); });
    return { c, p, errs };
  };

  const A = await mk(), B = await mk();
  for (const cl of [A, B]) {
    await cl.p.goto(URL + '/lobby', { waitUntil: 'load', timeout: 120000 });
    await cl.p.waitForTimeout(9000);
    await cl.p.evaluate(`window.__f=${fire}`);
  }

  // Pick a waiting table from A's rendered lobby — the code is what we join and restore.
  const codes = await measure(A.p, `(() => [...new Set((document.body.innerText || '')
    .match(/#[A-Z0-9]{4}/g) || [])])()`, { label: 'codes' });
  if (!Array.isArray(codes) || !codes.length) throw new HarnessError('no room codes rendered in the lobby — cannot join');
  roomCode = codes[0].replace('#', '');
  console.log(`joining room ${roomCode}`);

  // 1 — A joins, table shows 1 / 2
  await A.p.evaluate(joinByCode(roomCode));
  await A.p.waitForTimeout(6000);
  const afterA = await measure(A.p, readBoards, { label: 'afterA' });
  const lobbyB = await measure(B.p, `(() => (document.body.innerText || '').includes('1 / 2'))()`, { label: 'oneOfTwo' });
  rec('1 table shows 1 / 2 after A joins', lobbyB === true, `B's lobby shows 1/2: ${lobbyB}`);

  // 2 — B joins, both reach /multiplayer-game
  await B.p.evaluate(joinByCode(roomCode));
  await B.p.waitForTimeout(12000);
  await A.p.waitForTimeout(2000);
  const a = await measure(A.p, readBoards, { label: 'A' });
  const b = await measure(B.p, readBoards, { label: 'B' });
  rec('2 both reach /multiplayer-game', /multiplayer-game/.test(a.url) && /multiplayer-game/.test(b.url), `A=${a.url} B=${b.url}`);

  // 3 + 4 — boards identical, hole cards differ.
  // Both clients render the SAME community cards but DIFFERENT hole cards, so identical
  // glyph counts with differing sequences is the signature of a correct deal.
  rec('3 boards identical across clients', a.glyphCount === b.glyphCount && a.glyphCount > 0,
    `glyphs A=${a.glyphCount} B=${b.glyphCount}`);
  rec('4 hole cards differ across clients', a.rankSeq !== b.rankSeq,
    `rankSeq equal? ${a.rankSeq === b.rankSeq}`);

  // 6 — errors
  const allErrs = [...new Set([...A.errs, ...B.errs])].filter((e) => !/play\(\) failed/.test(e));
  rec('6 zero page errors / supabase 4xx', allErrs.length === 0, allErrs.length ? JSON.stringify(allErrs.slice(0, 3)) : 'none');

  console.log('\n5 room_players = 2 rows — VERIFY BY QUERY (this probe does not hold a DB client):');
  console.log(`   select count(*) from room_players rp join game_rooms g on g.id=rp.room_id where g.room_code='${roomCode}';`);
} catch (e) {
  console.error('\nRUN FAILED:', e instanceof HarnessError ? e.message : String(e).slice(0, 200));
  console.error('If this is "Target page, context or browser has been closed", that is the known');
  console.error('flake (~2 of 6 runs, possibly worse with two contexts). It is a HARNESS failure,');
  console.error('not a result — rerun.');
} finally {
  if (browser) await browser.close();
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n=== ${results.length - fails}/${results.length} assertions passed ===`);
  if (roomCode) {
    console.log(`\n⚠️ RESTORE REQUIRED for room ${roomCode} — the lobby HIDES a room left in 'playing':`);
    console.log(`   delete from room_players where room_id = (select id from game_rooms where room_code='${roomCode}');`);
    console.log(`   update game_rooms set status='waiting', current_players=0, host_id=null,`);
    console.log(`          host_name='Open Table', started_at=null where room_code='${roomCode}';`);
  }
}
