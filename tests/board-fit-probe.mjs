/**
 * WHERE THE 44 PIXELS ARE — the whole vertical budget of the placement screen, measured.
 *
 * READ-THE-204 found board 4 overflowing at 2P/393x852: the boards scroller reports
 * clientHeight 512 against scrollHeight 556. Roye has ruled the card face and card sizes stay, so
 * the only honest question is whether 44px of slack exists ANYWHERE ELSE on the screen, or whether
 * the content genuinely does not fit at the settled sizes.
 *
 * This measures every horizontal band from the top of the viewport to the bottom, so the answer is
 * arithmetic rather than opinion. Run before and after any change: BEFORE is the control.
 *
 *   CAPS_URL=http://127.0.0.1:8899 CAPS_GAME_PATH=/game/ CHROME_PATH=/opt/pw-browsers/chromium \
 *     node tests/board-fit-probe.mjs
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const GAME = process.env.CAPS_GAME_PATH || '/game';
const OUT = process.env.FIT_OUT || 'docs/reporter-and-board4/board-fit.json';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const MEASURE = `(() => {
  const vh = window.innerHeight, vw = window.innerWidth;
  // the boards scroller = the scrollable box that contains a BOARD label
  // ⚠️ FIND IT BY ACTUAL OVERFLOW, NOT BY overflow-y ALONE. The first version of this probe
  // matched any element whose computed overflowY was auto/scroll and that contained a BOARD label
  // — which the document element satisfies — and dutifully reported 0px of overflow, contradicting
  // a measurement already taken by hand. A scroller that is not scrolling is not the scroller.
  const cands = [...document.querySelectorAll('*')]
    .filter((e) => e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 100
                   && /BOARD\\s*\\d/i.test(e.innerText || ''))
    .sort((a, b) => a.clientHeight - b.clientHeight);   // innermost / tightest box first
  const sc = cands[0] || null;
  const r = (e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  // every BOARD panel, to see which are fully inside the scroller viewport
  const labels = [...document.querySelectorAll('*')].filter((e) => !e.children.length && /^BOARD\\s*\\d+$/i.test((e.textContent||'').trim()));
  const boards = labels.map((e) => ({ label: (e.textContent||'').trim(), ...r(e) }));
  const hand = [...document.querySelectorAll('*')].find((e) => !e.children.length && /YOUR HAND/i.test(e.textContent||''));
  const confirm = [...document.querySelectorAll('*')].find((e) => !e.children.length && /^Confirm$/i.test((e.textContent||'').trim()));
  return {
    viewport: { w: vw, h: vh },
    scroller: sc ? { ...r(sc), clientH: sc.clientHeight, scrollH: sc.scrollHeight,
                     overflowPx: sc.scrollHeight - sc.clientHeight,
                     scrolls: sc.scrollHeight > sc.clientHeight + 1 } : null,
    scrollerCandidates: cands.length,
    boards,
    handLabelTop: hand ? r(hand).top : null,
    confirmBottom: confirm ? r(confirm).bottom : null,
    // dead space: viewport height minus the bottom of the lowest thing we can find
    tailGap: confirm ? vh - r(confirm).bottom : null,
  };
})()`;

async function run(engine, name, width, height, players) {
  const b = await engine.launch(process.env.CHROME_PATH && name === 'chromium' ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  await ctx.route(/supabase\.co|ftable\.co\.il|google/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${URL}${GAME}?practice=true&players=${players}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(6500);
  const m = await p.evaluate(MEASURE);
  await p.screenshot({ path: `${OUT.replace(/\.json$/, '')}-${name}-${width}-${players}p.png` });
  await b.close();
  return m;
}

const out = {};
let canary = false;
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const width of [320, 393]) {
    for (const players of [2, 3, 4]) {
      const key = `${name}-${width}-${players}P`;
      try {
        const m = await run(engine, name, width, width === 320 ? 568 : 852, players);
        out[key] = m;
        if (m.boards.length) canary = true;
      } catch (e) { out[key] = { error: String(e).slice(0, 140) }; }
    }
  }
}
if (!canary) { console.error('CANARY: no BOARD panels found in ANY cell — the probe cannot answer.'); process.exit(3); }
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  if (v.error) { console.log(k.padEnd(22), 'ERROR', v.error); continue; }
  const s = v.scroller;
  console.log(k.padEnd(22), 'boards=' + v.boards.length,
    s ? `scroll=${s.scrolls} over=${s.overflowPx}px (${s.clientH}/${s.scrollH})` : 'scroll=NONE',
    'tailGap=' + v.tailGap);
}
