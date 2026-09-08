/**
 * WHAT THE TESTER ASKED FOR TWELVE TIMES, AND WHAT BUILD 515 ACTUALLY DRAWS.
 *
 * Between 2026-03-21 and 2026-03-28 one tester filed the same request in reports 9, 22, 70, 72,
 * 73, 74, 75, 77, 78, 81 and the 7-report MASTER (#7), then again as a 1-star in May (#713):
 *
 *     "remove the small rank and suit in the top-left corner of every card — leave only the
 *      big rank and the big suit in the middle — then the cards can shrink and everything fits"
 *
 * This measures the CARD AS RENDERED rather than reading Card.tsx, because the source has been
 * wrong about itself before: its own header comment "still said NO corners / large centered RANK
 * long after V2 shipped a top-left corner" (Card.tsx:12).
 *
 * Per card it classifies every painted glyph by where it actually sits inside the card box:
 * top-left index, bottom-right index, or centre. It reports the counts and the pixel sizes.
 *
 * CANARY: the run aborts unless it finds cards at all AND the centre glyph it finds is a suit
 * symbol rather than a rank character — otherwise "no centre rank" would be true of an empty page.
 *
 *   node tests/card-corner-probe.mjs                       # against the live site
 *
 * Offline, from a built dist/ (what this run used, because the browser cannot reach the live host
 * through this container's proxy even though curl can):
 *   node scripts/fix-web-html.js                            # the export is unpatched without this
 *   mkdir -p dist/game && cp dist/index.html dist/game/      # plain servers do not SPA-rewrite
 *   python3 -m http.server 8899 --directory dist &
 *   CAPS_URL=http://127.0.0.1:8899 CAPS_GAME_PATH=/game/ CHROME_PATH=/opt/pw-browsers/chromium \
 *     node tests/card-corner-probe.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const OUT = 'docs/read-the-204';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
// '/game' against a real host; '/game/' when serving dist/ from a plain static server.
const GAME = process.env.CAPS_GAME_PATH || '/game';
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = ['A','K','Q','J','T','2','3','4','5','6','7','8','9','10'];

const READ = `(() => {
  const suits = ${JSON.stringify(SUITS)};
  // A card is the smallest box that contains a card-pip (the centre suit glyph).
  const pips = [...document.querySelectorAll('[data-testid="card-pip"]')];
  const cards = [];
  for (const pip of pips) {
    let box = pip.parentElement;
    // climb until the box is meaningfully bigger than the pip = the card face
    for (let i = 0; i < 6 && box; i++) {
      const r = box.getBoundingClientRect();
      if (r.width >= pip.getBoundingClientRect().width * 1.4 && r.width > 20) break;
      box = box.parentElement;
    }
    if (!box) continue;
    const cr = box.getBoundingClientRect();
    if (cr.width < 15 || cr.width > 200) continue;
    const glyphs = [];
    for (const el of box.querySelectorAll('*')) {
      if (el.children.length) continue;
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cs = getComputedStyle(el);
      // position of the glyph's centre as a fraction of the card box
      const fx = (r.left + r.width / 2 - cr.left) / cr.width;
      const fy = (r.top + r.height / 2 - cr.top) / cr.height;
      glyphs.push({ txt, fx: +fx.toFixed(2), fy: +fy.toFixed(2),
                    px: Math.round(parseFloat(cs.fontSize)),
                    isSuit: suits.includes(txt) });
    }
    if (!glyphs.length) continue;
    const zone = (g) => (g.fx < 0.4 && g.fy < 0.4) ? 'topLeft'
                      : (g.fx > 0.6 && g.fy > 0.6) ? 'bottomRight'
                      : (g.fx > 0.25 && g.fx < 0.75 && g.fy > 0.25 && g.fy < 0.75) ? 'centre' : 'other';
    cards.push({ w: Math.round(cr.width), h: Math.round(cr.height),
                 glyphs: glyphs.map(g => ({ ...g, zone: zone(g) })) });
  }
  return cards;
})()`;

async function run(players) {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  const p = await ctx.newPage();
  await ctx.route(/supabase\.co|ftable\.co\.il|google/, r => r.abort());
  await p.goto(`${URL}${GAME}?practice=true&players=${players}`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(6000);
  const cards = await p.evaluate(READ);
  await p.screenshot({ path: `${OUT}/cards-${players}p.png`, fullPage: false });
  await b.close();
  return cards;
}

const report = {};
let abort = null;
for (const players of [2, 3]) {
  const cards = await run(players);
  if (!cards.length) { abort = `CANARY: found 0 cards at ${players}P — the probe cannot answer.`; break; }

  const widths = [...new Set(cards.map(c => c.w))].sort((a, b) => a - b);
  const tl = cards.filter(c => c.glyphs.some(g => g.zone === 'topLeft')).length;
  const br = cards.filter(c => c.glyphs.some(g => g.zone === 'bottomRight')).length;
  const centreGlyphs = cards.flatMap(c => c.glyphs.filter(g => g.zone === 'centre'));
  const centreSuits = centreGlyphs.filter(g => g.isSuit).length;
  const centreRanks = centreGlyphs.filter(g => !g.isSuit && RANKS.includes(g.txt)).length;
  const cornerPx = cards.flatMap(c => c.glyphs.filter(g => g.zone === 'topLeft').map(g => g.px));
  const centrePx = centreGlyphs.map(g => g.px);

  if (!centreSuits) { abort = `CANARY: no centre SUIT glyph found at ${players}P — classification is wrong, not the app.`; break; }

  report[`${players}P`] = {
    cards: cards.length, cardWidths: widths,
    cardsWithTopLeftIndex: tl, cardsWithBottomRightIndex: br,
    centreSuitGlyphs: centreSuits, centreRankGlyphs: centreRanks,
    topLeftFontPx: [...new Set(cornerPx)].sort((a,b)=>a-b),
    centreFontPx: [...new Set(centrePx)].sort((a,b)=>a-b),
  };
}

if (abort) { console.error(abort); process.exit(3); }
fs.writeFileSync(`${OUT}/card-corner-probe.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
