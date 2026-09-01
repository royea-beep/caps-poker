/* Annotated GAME-SCREEN audit sheet. Composes the REAL mirrored-bytes renders (live built screen,
 * not a mockup) with numbered callout pins + a legend of element scores and ranked upgrades. */
const fs = require('fs');
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad';
const OUT = '/home/user/caps-poker/docs/game-audit';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const main = b64(`${S}/game-393-3P.png`);
const t320 = b64(`${S}/game-320-4P.png`);
const t430 = b64(`${S}/game-430-2P.png`);
const t375 = b64(`${S}/game-375-3P.png`);

// numbered pins on the 393-3P frame (percentages of the image)
const pins = [
  { n: 1, x: 90, y: 42, t: 'FELT' },
  { n: 2, x: 22, y: 21, t: 'BOARD PANEL' },
  { n: 3, x: 42, y: 52, t: 'EMPTY SLOTS' },
  { n: 4, x: 74, y: 96, t: 'CHROME (Confirm)' },
  { n: 5, x: 86, y: 26, t: 'Auto-Place' },
  { n: 6, x: 33, y: 4, t: 'HEADER' },
  { n: 7, x: 24, y: 80, t: 'CARDS' },
];

const legend = `
<div class="legend">
  <h1>GAME SCREEN — audit (live built screen, mirrored bytes · not a mockup)</h1>
  <p class="sub">Placing phase · rendered at 320/375/393/430 × 2P/3P/4P from the deployed bundle. Reveal/results: code-read (winner cue #FFD700, spotlight dim, BoardSurface 'muted').</p>
  <h2>Element scores — game or form?</h2>
  <table>
    <tr><td>① Felt / play surface</td><td class="form">FORM</td><td>flat dark green; the inset table reads ~1.03:1 vs the page (its own doc says so) — nothing like the home vignette</td></tr>
    <tr><td>② Board panels</td><td class="mix">MIXED</td><td>coloured border says "game", but the fill is ~25%-alpha translucent — faint boxes, little depth</td></tr>
    <tr><td>③ Empty slots</td><td class="mix">MIXED</td><td>dashed 3:1 outlines are legible but quiet — read as faint boxes more than targets</td></tr>
    <tr><td>④ Chrome (Confirm/Cancel/Auto-Place)</td><td class="form">FORM</td><td>flat translucent mint pills — exactly the old-home-button look Roye rejected</td></tr>
    <tr><td>⑤ Header pills</td><td class="mix">MIXED</td><td>functional translucent pills; crowd at 320 ("Practice·no chips" overlaps "PLACE 8 CARDS")</td></tr>
    <tr><td>⑦ Cards</td><td class="game">GAME</td><td>the finished element — real Card.tsx faces, cyan ownership rim. Meets the bar. Do not touch.</td></tr>
  </table>
  <h2>Proposed upgrades — ranked by impact ÷ risk</h2>
  <ol>
    <li><b>Chrome → chips.</b> Make Confirm / Cancel / Auto-Place ALL the home's <b>ChipButton</b> (smooth brass edge, bevel, sink). <span class="reuse">reuses ChipButton</span> · <span class="risk">low risk — chrome, not layout/cue/card-size; footer buttons sit in a fixed row</span></li>
    <li><b>Felt → LuxuryBackdrop.</b> Put the radial-green vignette + faint beam behind the boards so the surface reads as a table. <span class="reuse">reuses LuxuryBackdrop tokens</span> · <span class="risk">med risk — must not fight the reveal spotlight; re-measure card/slot contrast (use 'muted' at reveal, as BoardSurface already does)</span></li>
    <li><b>Board panels → depth (PAINT ONLY).</b> Deepen the panel fill + add an inner-shadow bevel so boards read as recessed wells. <span class="reuse">reuses ChipButton bevel idiom</span> · <span class="warn">⚠ geometry (borderWidth/size) is the 83px→0 arc — PAINT ONLY, no dimension change</span></li>
    <li><b>Slots → stronger target read (fill/glow, not the outline).</b> A subtle inner glow / slightly richer resting fill so slots invite placement. <span class="warn">⚠ the 3:1 OUTLINE is load-bearing — change fill/glow, never the outline contrast</span> · med impact</li>
    <li><b>Header → luxury pills.</b> Align the balance/status pills with the luxury look and fix the 320 crowd. <span class="reuse">reuses backdrop/edge tokens</span> · low risk, low impact</li>
  </ol>
  <h2>⚠ Load-bearing — report, never touch casually</h2>
  <ul class="flags">
    <li><b>Winner cue</b> — gold #FFD700 3px on the winning board/card. No upgrade may recolour or restyle it.</li>
    <li><b>Card sizes</b> — 68/58@390, 54/44@320, 10px symbol floor. Frozen. No upgrade resizes cards (⑦ stays as-is).</li>
    <li><b>83px→0 layout arc</b> — board geometry, slot sizes, borderWidths. Frozen. Panel/slot upgrades are PAINT ONLY.</li>
  </ul>
  <p class="foot">Nothing built on the game screen this sprint — Roye picks, a follow-up builds one at a time with the full loop.</p>
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  body{background:#0b0f0d;color:#e8efe9;padding:24px;width:1500px}
  .row{display:flex;gap:28px;align-items:flex-start}
  .frame{position:relative;flex:0 0 393px}
  .frame img{width:393px;display:block;border-radius:10px;border:1px solid #223}
  .cap{font-size:12px;color:#9fe;font-weight:700;margin-bottom:6px;letter-spacing:.5px}
  .pin{position:absolute;width:26px;height:26px;border-radius:50%;background:#FFD24A;color:#111;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);box-shadow:0 0 0 3px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.6)}
  .legend{flex:1 1 auto;max-width:1020px}
  h1{font-size:20px;margin-bottom:4px}
  .sub{font-size:12px;color:#9bb;margin-bottom:14px}
  h2{font-size:14px;margin:16px 0 8px;color:#FFD24A;letter-spacing:.4px}
  table{border-collapse:collapse;width:100%;font-size:13px}
  td{border-top:1px solid #1e2a24;padding:6px 8px;vertical-align:top}
  td:first-child{font-weight:700;white-space:nowrap}
  td:nth-child(2){font-weight:900;text-align:center;white-space:nowrap}
  .form{color:#ff8a8a}.game{color:#7BE8B0}.mix{color:#FFD24A}
  ol{padding-left:20px;font-size:13px}ol li{margin:7px 0}
  .reuse{color:#7BE8B0;font-weight:700}.risk{color:#9bb}.warn{color:#FFB86B;font-weight:700}
  ul.flags{padding-left:18px;font-size:13px}ul.flags li{margin:5px 0}
  .foot{margin-top:12px;font-size:12px;color:#9bb;font-style:italic}
  .thumbs{display:flex;gap:16px;margin-top:22px}
  .thumbs figure{margin:0}.thumbs img{height:360px;border-radius:8px;border:1px solid #223;display:block}
  .thumbs figcaption{font-size:11px;color:#9fe;font-weight:700;margin-top:5px;text-align:center}
</style></head><body>
  <div class="row">
    <div>
      <div class="cap">LIVE GAME · 393 · 3P · placing</div>
      <div class="frame">
        <img src="${main}">
        ${pins.map(p => `<div class="pin" style="left:${p.x}%;top:${p.y}%">${p.n}</div>`).join('')}
      </div>
    </div>
    ${legend}
  </div>
  <div class="thumbs">
    <figure><img src="${t320}"><figcaption>320 · 4P (tight — header crowd)</figcaption></figure>
    <figure><img src="${t375}"><figcaption>375 · 3P</figcaption></figure>
    <figure><img src="${t430}"><figcaption>430 · 2P (4 boards)</figcaption></figure>
  </div>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await browser.newPage({ deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.locator('body').screenshot({ path: `${OUT}/game-audit-annotated.png` });
  await browser.close();
  console.log('written', `${OUT}/game-audit-annotated.png`);
})();
