/**
 * ALIGN-THE-CELEBRATION — proof on the case that exposed it.
 *
 * The divergence measured in production was a FOUR-PLAYER hand where two seats each took one
 * board and each netted +50. At four players the board count is 2 (2P=4, 3P=3, 4P=2), so
 * "one board each" is simply a 1-1 split — which this harness can reach by playing real
 * four-player hands until one comes up. No fixture, no forced state: the actual shape.
 *
 * Every surface is read from the RENDERED SCREEN or from the intercepted network call, never from
 * the source. The analytics value is captured by intercepting the track_event RPC body, because
 * "the event now carries 'tie'" is exactly the kind of claim that has to be evidence, not a claim.
 *
 * Captures per hand:
 *   split        the board split, from the score line the player actually sees
 *   headline     result-headline testID
 *   overlay      the win overlay's own text node - present or absent
 *   xpWinBonus   whether the XP banner breakdown credits "Win: +"
 *   net          the Net Result figure
 *   analytics    the `result` field of result_viewed_duration, read off the wire on unmount
 *
 * ENGINE=webkit PLAYERS=4 HANDS=12 node tests/align-celebration-proof.mjs
 */
import { webkit, chromium } from 'playwright';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'chromium';
const PLAYERS = process.env.PLAYERS || '4';
const HANDS = Number(process.env.HANDS || 12);
const engine = ENGINE === 'webkit' ? webkit : chromium;

const fire = `(el) => { for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) {
  el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); } }`;

const browser = await engine.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });
// The ?players= param is honoured ONLY in practice (game.tsx:122). A REAL hand takes its seat
// count from the persisted preference, so the seat count is seeded here instead. The first run of
// this harness asked for four players, got four BOARDS - which is two players - and would have
// "proved" the alignment on the wrong table size entirely.
await ctx.addInitScript((n) => {
  try {
    const k = 'caps-poker-storage';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    // numberOfPlayers lives under state.CONFIG, and only `config` is in the store's partialize.
    // Setting state.numberOfPlayers directly - the obvious guess - persists nothing at all.
    cur.state = { ...(cur.state || {}), config: { ...((cur.state || {}).config || {}), numberOfPlayers: n } };
    cur.version = cur.version ?? 0;
    localStorage.setItem(k, JSON.stringify(cur));
  } catch {}
}, Number(PLAYERS));
let page = await ctx.newPage();

// Read the analytics payload off the wire. The event fires on UNMOUNT, so it is captured when we
// navigate away, not while /results is open.
let lastAnalytics = null;
function attachListeners(p) {
  p.on('dialog', async (d) => { await d.dismiss(); });
  p.on('request', (req) => {
  if (!/rpc\/track_event/.test(req.url())) return;
  try {
    const body = JSON.parse(req.postData() || '{}');
      // track_event sends p_data, NOT p_properties. Reading the wrong key returned null on every
      // hand of the first run and would have read as "the event stopped firing".
      const props = body.p_data || body.p_properties || body.properties || {};
      if (Object.prototype.hasOwnProperty.call(props, 'result')) {
        lastAnalytics = `${body.p_event || body.event || '?'}=${props.result}`;
      }
    } catch {}
  });
}
attachListeners(page);

const rows = [];

for (let hand = 0; hand < HANDS; hand++) {
  try {
    await page.goto(`${SITE}/game?fresh=${hand === 0 ? 1 : 0}`, { waitUntil: 'load', timeout: 120000 });
  } catch (e) {
    // A long run crashes the tab eventually. Losing the run at hand 2 of 12 is an instrument
    // failure, not a result, so the page is rebuilt and the hand retried once.
    console.log(`hand ${hand}: page died (${String(e).slice(0, 60)}) - rebuilding`);
    try { await page.close(); } catch {}
    page = await ctx.newPage();
    attachListeners(page);
    await page.goto(`${SITE}/game?fresh=0`, { waitUntil: 'load', timeout: 120000 });
  }
  await page.waitForTimeout(7000);
  await page.evaluate(`window.__f=${fire}`);

  // Place every card, then confirm.
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(2500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r){window.__f(r);return}
    const b=[...document.querySelectorAll('button,[role="button"]')]
      .find(x=>/^\\s*(ready|confirm)\\b/i.test((x.getAttribute('aria-label')||x.textContent||'').trim()));if(b)window.__f(b);})()`);

  // Walk the reveal to /results.
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1500);
    if (/results/.test(page.url())) break;
    await page.evaluate(`(()=>{const e=[...document.querySelectorAll('*')]
      .filter(x=>/tap to reveal/i.test((x.textContent||'').trim())&&x.children.length<3);
      const el=e[e.length-1]; if(el) window.__f(el.closest('[role="button"],button')||el);})()`).catch(() => {});
  }
  if (!/results/.test(page.url())) { rows.push({ hand, note: 'never reached results' }); continue; }

  // The overlay is on a timer, so sample across its whole window rather than at one instant.
  let overlaySeen = false;
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(700);
    const seen = await page.evaluate(`!!document.querySelector('[data-testid="win-dot"]')
      || /You won .*(chips|the hand)!/.test(document.body.innerText||'')`);
    if (seen) { overlaySeen = true; break; }
  }
  await page.waitForTimeout(2500);

  const snap = await page.evaluate(`(() => {
    const txt = document.body.innerText || '';
    const head = document.querySelector('[data-testid="result-headline"]');
    const score = (txt.match(/^\\s*(\\d+)\\s*[-–]\\s*(\\d+)\\s*$/m) || []);
    const boards = (txt.match(/Boards:\\s*(\\d+)\\s*\\/\\s*(\\d+)/) || []);
    const net = (txt.match(/Net Result\\s*([+\\-±]?[\\d,]+)/) || [])[1] || null;
    return {
      headline: head ? (head.textContent || '').trim() : null,
      score: score.length ? score[1] + '-' + score[2] : null,
      boardsWon: boards.length ? Number(boards[1]) : null,
      boardsTotal: boards.length ? Number(boards[2]) : null,
      net,
      xpWinBonus: /\\|\\s*Win:\\s*\\+/.test(txt),
      tieBonus: /Tie bonus:/.test(txt),
    };
  })()`);

  // Unmount /results so the analytics event fires, then read what went over the wire.
  lastAnalytics = null;
  await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3500);

  const store = await page.evaluate(`(() => {
    try {
      const bp = JSON.parse(localStorage.getItem('caps-battle-pass') || '{}');
      const st = bp.state || bp;
      return { xp: st.currentXP ?? null, gamesWon: (st.missionProgress || {}).games_won ?? null };
    } catch { return {}; }
  })()`);

  rows.push({ hand, ...snap, overlay: overlaySeen, analytics: lastAnalytics, bpXP: store.xp, gamesWon: store.gamesWon });
  console.log(`hand ${hand}: split=${snap.score} boards=${snap.boardsWon}/${snap.boardsTotal} headline="${snap.headline}" net=${snap.net} overlay=${overlaySeen} xpWin=${snap.xpWinBonus} analytics=${lastAnalytics} games_won=${store.gamesWon}`);
}

console.log('\n===== SUMMARY (' + ENGINE + '/' + PLAYERS + 'p) =====');
const byOutcome = { win: [], loss: [], tie: [] };
for (const r of rows) {
  if (r.boardsWon == null) continue;
  const others = r.boardsTotal - r.boardsWon;
  const o = r.headline === 'YOU WIN' || r.headline === 'PERFECT!' ? 'win' : r.headline === 'YOU LOSE' ? 'loss' : 'tie';
  byOutcome[o].push(r);
}
for (const k of ['win', 'loss', 'tie']) {
  console.log(`\n-- ${k.toUpperCase()} (${byOutcome[k].length})`);
  for (const r of byOutcome[k]) {
    console.log(`   boards ${r.boardsWon}/${r.boardsTotal} net=${r.net} overlay=${r.overlay} xpWin=${r.xpWinBonus} analytics=${r.analytics} tieBonus=${r.tieBonus}`);
  }
}
console.log('\nCONSISTENCY CHECK');
const bad = [];
for (const k of ['win', 'loss', 'tie']) {
  for (const r of byOutcome[k]) {
    if (k === 'win' && (!r.overlay || !r.xpWinBonus || !String(r.analytics||'').endsWith('=win'))) bad.push(`win hand disagrees: overlay=${r.overlay} xpWin=${r.xpWinBonus} analytics=${r.analytics}`);
    if (k === 'tie' && (r.overlay || r.xpWinBonus || !String(r.analytics||'').endsWith('=tie'))) bad.push(`TIE hand still celebrating: overlay=${r.overlay} xpWin=${r.xpWinBonus} analytics=${r.analytics}`);
    if (k === 'loss' && (r.overlay || r.xpWinBonus || !String(r.analytics||'').endsWith('=lose'))) bad.push(`loss hand disagrees: overlay=${r.overlay} xpWin=${r.xpWinBonus} analytics=${r.analytics}`);
  }
}
console.log(bad.length ? bad.map((b) => '   FAIL ' + b).join('\n') : '   all sampled hands agree across headline / overlay / XP / analytics');
await browser.close();
