/* PREVIEW-THE-GAME — the ladder: CURRENT (before) · 3 SHIPPED · ALL 5, in real built pixels.
 * Rows: 393 placing, 320 placing, 393 reveal. Real Card.tsx, real bundle, web-rendered (not device). */
const fs = require('fs'); const { chromium } = require('playwright');
const D = '/home/user/caps-poker/docs/game-preview';
const OUT = '/home/user/caps-poker/docs/game-preview';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const img = s => ({
  p393: b64(`${D}/game-${s}-393-placing.png`),
  p320: b64(`${D}/game-${s}-320-placing.png`),
  r393: b64(`${D}/game-${s}-393-reveal.png`),
});
const before = img('before'), shipped = img('shipped'), all5 = img('all5');
const col = (title, sub, klass) => ({ title, sub, klass });
const cols = [
  col('CURRENT', 'pre-upgrade', 'cur'),
  col('SHIPPED (steps 1–3)', 'on the branch now', 'ship'),
  col('ALL 5 (+ 4 & 5)', 'rendered, not shipped', 'all'),
];
const rowImgs = [
  ['393 · 3P · placing', [before.p393, shipped.p393, all5.p393]],
  ['320 · 3P · placing', [before.p320, shipped.p320, all5.p320]],
  ['393 · 3P · reveal', [before.r393, shipped.r393, all5.r393]],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  body{background:#0b0f0d;color:#e8efe9;padding:26px;width:1120px}
  h1{font-size:21px;margin-bottom:3px}
  .sub{font-size:12px;color:#9bb;margin-bottom:20px;max-width:1000px}
  table{border-collapse:collapse}
  th{font-size:13px;font-weight:800;letter-spacing:.4px;padding:0 8px 4px;text-align:center}
  th .s{display:block;font-size:11px;font-weight:600;color:#9bb;margin-top:1px}
  .cur{color:#9bb}.ship{color:#7BE8B0}.all{color:#FFD24A}
  td{padding:8px;vertical-align:top;text-align:center}
  td img{width:300px;display:block;border-radius:8px;border:1px solid #223}
  .rowlab{font-size:11px;color:#9fe;font-weight:700;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;padding:0 4px}
  .foot{margin-top:16px;font-size:12px;color:#9bb;font-style:italic;max-width:1000px}
</style></head><body>
  <h1>CAPS — the game screen, real built pixels</h1>
  <div class="sub">The REAL built game screen (real components/Card.tsx at 68/58, the real web bundle), not the small-card mockups. Left→right: current, the 3 shipped upgrades (on the branch), and all 5 (steps 4 &amp; 5 rendered but NOT shipped). Web-rendered — the felt gradient, the chip and the wordmark still differ slightly on iOS.</div>
  <table>
    <tr><th></th>${cols.map(c => `<th class="${c.klass}">${c.title}<span class="s">${c.sub}</span></th>`).join('')}</tr>
    ${rowImgs.map(([lab, imgs]) => `<tr><td class="rowlab">${lab}</td>${imgs.map(src => `<td><img src="${src}"></td>`).join('')}</tr>`).join('')}
  </table>
  <div class="foot">What changed 1→3: Cancel/Confirm became chips (brass edge + bevel), the header pills got a gilded hairline and the 320 crowd is gone, and the felt got a muted luxury vignette (the reveal still shows the gold winner cue dominant). 4 &amp; 5 add a mint glow on the empty slots and a recessed bevel on the board panels — paint only, geometry unchanged, awaiting Roye's OK.</div>
</body></html>`;
(async () => {
  const br = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await br.newPage({ deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.locator('body').screenshot({ path: `${OUT}/game-preview-ladder.png` });
  await br.close(); console.log('written');
})();
