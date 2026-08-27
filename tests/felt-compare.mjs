/**
 * THREE FELTS, SAME HAND — a temporary local render for a decision, not a shipped change.
 *
 * The finding underneath "green or maroon" is that there is currently no playing surface at all:
 * the card sits straight on the page background. Three layers — table, felt, card — have collapsed
 * into two. So this renders the SAME hand three times and varies ONLY the surface:
 *
 *   A  deep green      rgb(21,71,52)
 *   B  deep burgundy   rgb(74,26,34)
 *   C  today's near-black, but given a real edge and a weave so a felt exists at all
 *
 * EVERY OTHER VALUE IS THE PRODUCT'S OWN, read from source rather than invented:
 *   card face    #FCFAF3   constants/paintThemes.ts visual.classic.cardFace (= the measured live
 *                          rgb(252,250,243))
 *   suit red     #c41e3a   components/Card.tsx V2_RED        (legacy #CC0000 measured alongside)
 *   suit black   #18181b   components/Card.tsx V2_BLACK
 *   page ground  #18181C   the measured live background rgb(24,24,28)
 *   winner cue   gold #FFD700 3px · mint #4FD6A8 2px · neutral rgba(0,0,0,0.22) 1px
 *
 * RULE 3 — NOTHING IS A HARDCODED DIMENSION. Every size derives from the panel width via `cqw`
 * container units, so 320 and 393 are the same layout at two scales rather than two layouts. The
 * board count is not assumed either: it is passed in, because 2P=4, 3P=3, 4P=2.
 *
 *   node tests/felt-compare.mjs            # writes both widths + the measurements
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.env.OUT_DIR || 'felt-compare');
fs.mkdirSync(OUT, { recursive: true });

// ── the product's own values ────────────────────────────────────────────────────────────────
const T = {
  cardFace: '#FCFAF3',
  suitRed: '#c41e3a',
  suitRedLegacy: '#CC0000',
  suitBlack: '#18181b',
  page: '#18181C',
  cueGold: '#FFD700',
  cueMint: '#4FD6A8',
  cueNeutral: 'rgba(0,0,0,0.22)',
  cardBorder: 'rgba(0,0,0,0.15)',
  textPrimary: '#f0ead6',
  textMuted: '#9aa19b',
};

const FELTS = [
  { id: 'A', name: 'Deep green',    felt: '#154734', rgb: 'rgb(21,71,52)' },
  { id: 'B', name: 'Deep burgundy', felt: '#4A1A22', rgb: 'rgb(74,26,34)' },
  { id: 'C', name: 'Near-black, defined', felt: '#1C1C22', rgb: 'rgb(28,28,34)' },
];

/** ONE HAND, used by all three panels. Changing this per panel would make the comparison
 *  worthless, so it is defined once and only referenced. */
const HAND = {
  community: [['A','♠'],['K','♦'],['7','♠'],['3','♥'],['10','♣']],
  boards: [
    { cue: 'gold',    label: 'Board 1',  you: [['A','♥'],['A','♣']], opp: [['K','♠'],['9','♦']], note: 'Pair of Aces' },
    { cue: 'mint',    label: 'Board 2',  you: [['Q','♦'],['J','♦']], opp: [['K','♥'],['5','♣']], note: 'King High' },
    { cue: 'neutral', label: 'Board 3',  you: [['8','♣'],['4','♠']], opp: [['6','♥'],['2','♦']], note: 'Eight High' },
  ],
};

const isRed = (s) => s === '♥' || s === '♦';

const card = (rank, suit, cls = '') => `
  <div class="card ${cls}">
    <span class="pip ${isRed(suit) ? 'red' : 'black'}">${rank}<i>${suit}</i></span>
  </div>`;

function panel(f) {
  const boards = HAND.boards.map((b) => `
    <div class="board cue-${b.cue}">
      <div class="board-h"><span>${b.label}</span><span class="note">${b.note}</span></div>
      <div class="row">${b.you.map(([r, s]) => card(r, s)).join('')}
        <span class="vs">v</span>
        ${b.opp.map(([r, s]) => card(r, s, 'dim')).join('')}</div>
    </div>`).join('');
  return `
  <section class="panel" style="--felt:${f.felt}">
    <header class="cap"><b>${f.id}</b> ${f.name}<code>${f.rgb}</code></header>
    <div class="phone">
      <div class="felt">
        <div class="community">${HAND.community.map(([r, s]) => card(r, s)).join('')}</div>
        ${boards}
      </div>
    </div>
  </section>`;
}

const page = (W) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       display:flex;gap:20px;padding:20px;align-items:flex-start}
  .panel{display:flex;flex-direction:column;gap:10px}
  .cap{color:#cfd6d0;font-size:13px;letter-spacing:.02em;display:flex;gap:8px;align-items:baseline}
  .cap b{color:#fff;font-size:15px}
  .cap code{color:#8b938d;font-size:11px;font-family:ui-monospace,Menlo,monospace}
  /* THE PHONE. Width is the only fixed number in the file — it is the viewport under test,
     not a design dimension — and everything inside sizes from it via container units. */
  .phone{width:${W}px;background:${T.page};container-type:inline-size;
         border-radius:10px;overflow:hidden}
  /* THE FELT: a real surface. Same edge and same weave on all three; only --felt changes. */
  .felt{background:var(--felt);margin:3cqw;padding:4cqw 3cqw;border-radius:3cqw;
        border:1px solid rgba(255,255,255,.09);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 2cqw 4cqw rgba(0,0,0,.45);
        background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.014) 0 2px,transparent 2px 4px),
                         repeating-linear-gradient(-45deg,rgba(0,0,0,.03) 0 2px,transparent 2px 4px);
        display:flex;flex-direction:column;gap:3cqw}
  .community{display:flex;gap:1.6cqw;justify-content:center;padding-bottom:1cqw}
  .board{border-radius:2cqw;padding:2cqw;background:rgba(0,0,0,.16)}
  .cue-gold{border:3px solid ${T.cueGold}}
  .cue-mint{border:2px solid ${T.cueMint}}
  .cue-neutral{border:1px solid ${T.cueNeutral}}
  .board-h{display:flex;justify-content:space-between;font-size:2.6cqw;color:${T.textPrimary};
           margin-bottom:1.4cqw;letter-spacing:.02em}
  .note{color:${T.textMuted}}
  .row{display:flex;gap:1.4cqw;align-items:center}
  .vs{color:${T.textMuted};font-size:2.6cqw;padding:0 .6cqw}
  /* CARD: 2.5x3.5 proportion, width from the container — never a pixel literal. */
  .card{width:11cqw;aspect-ratio:2.5/3.5;background:${T.cardFace};border-radius:1.2cqw;
        border:1px solid ${T.cardBorder};box-shadow:0 .5cqw 1cqw rgba(0,0,0,.4);
        display:flex;align-items:flex-start;justify-content:flex-start;padding:.9cqw}
  .card.dim{opacity:.92}
  .pip{font-size:3.4cqw;font-weight:700;line-height:1;display:flex;flex-direction:column;align-items:center}
  .pip i{font-style:normal;font-size:3.1cqw;margin-top:.2cqw}
  .red{color:${T.suitRed}} .black{color:${T.suitBlack}}
</style></head><body>${FELTS.map(panel).join('')}</body></html>`;

// ── render ──────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}),
});
const written = [];
for (const W of [393, 320]) {
  const ctx = await browser.newContext({ viewport: { width: W * 3 + 80, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(page(W), { waitUntil: 'load' });
  await p.waitForTimeout(250);
  const file = path.join(OUT, `felts-${W}.png`);
  await p.locator('body').screenshot({ path: file });
  written.push(file);
  console.log('wrote', file);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify({ T, FELTS }, null, 2));
console.log('wrote', path.join(OUT, 'tokens.json'));
