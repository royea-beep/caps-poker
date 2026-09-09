/* Steps 4 & 5 — CURRENT vs PROPOSED sheet (show before shipping). Real local-export renders:
 * CURRENT = shipped steps 1-3; PROPOSED = +step4 slot glow +step5 panel depth (paint only). */
const fs = require('fs'); const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad';
const OUT = '/home/user/caps-poker/docs/game-audit';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const cur393 = b64(`${S}/s3-placing-393-3P.png`), prop393 = b64(`${S}/s45-393-3P.png`);
const cur320 = b64(`${S}/s3-placing-320-4P.png`), prop320 = b64(`${S}/s45-320-4P.png`);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  body{background:#0b0f0d;color:#e8efe9;padding:24px;width:1180px}
  h1{font-size:20px;margin-bottom:2px}.sub{font-size:12px;color:#9bb;margin-bottom:16px}
  .grid{display:flex;gap:34px}
  .col{display:flex;flex-direction:column;gap:18px}
  .cap{font-size:13px;font-weight:800;letter-spacing:.5px;margin-bottom:6px}
  .cur{color:#9bb}.prop{color:#7BE8B0}
  figure{margin:0}figure img{width:300px;display:block;border-radius:9px;border:1px solid #223}
  figcaption{font-size:11px;color:#9fe;margin-top:5px;text-align:center}
  .notes{flex:1 1 auto;max-width:520px}
  h2{font-size:14px;color:#FFD24A;margin:14px 0 6px}
  ul{padding-left:18px;font-size:13px}li{margin:6px 0}
  .warn{color:#FFB86B;font-weight:700}.ok{color:#7BE8B0;font-weight:700}
  .foot{margin-top:14px;font-size:12px;color:#9bb;font-style:italic}
</style></head><body>
  <h1>GAME UPGRADES 4 &amp; 5 — current vs proposed (SHOW, not shipped)</h1>
  <div class="sub">Real local-export renders. CURRENT = shipped steps 1–3. PROPOSED = + step 4 (slot glow) + step 5 (panel depth). Paint only — geometry byte-identical.</div>
  <div class="grid">
    <div class="col">
      <div class="cap cur">CURRENT (steps 1–3)</div>
      <figure><img src="${cur393}"><figcaption>393 · 3P</figcaption></figure>
      <figure><img src="${cur320}"><figcaption>320 · 4P</figcaption></figure>
    </div>
    <div class="col">
      <div class="cap prop">PROPOSED (+ 4 &amp; 5)</div>
      <figure><img src="${prop393}"><figcaption>393 · 3P</figcaption></figure>
      <figure><img src="${prop320}"><figcaption>320 · 4P</figcaption></figure>
    </div>
    <div class="notes">
      <h2>Step 4 — Slots: a mint INNER GLOW (target cue)</h2>
      <ul>
        <li>The empty slots get a soft mint inner glow so a new player's eye lands on them.</li>
        <li class="warn">⚠ The 3:1 dashed OUTLINE is untouched. So is the resting FILL — its own token note says the outline's contrast is calibrated against that fill, so raising the fill would move the outline ratio. Glow only: not the outline, not the fill.</li>
      </ul>
      <h2>Step 5 — Panels: a recessed BEVEL (depth)</h2>
      <ul>
        <li>An inset shadow + a hair of top-edge light make each board read as a recessed well, not a flat box.</li>
        <li class="warn">⚠ The panel FILL alpha is untouched — it is a documented card/back legibility fix (0.55 made face-down cards 1.08:1). Depth comes from SHADOW, never fill.</li>
        <li class="ok">✓ Paint only — no width / height / border / padding / margin changed. Board geometry byte-identical (the 83px→0 arc is not reopened). No horizontal overflow at 320/375/393/430.</li>
      </ul>
      <h2>Not touched</h2>
      <ul>
        <li>Winner cue #FFD700, card sizes, and the 83px→0 layout arc — untouched.</li>
      </ul>
      <div class="foot">Neither step is committed. On the branch = steps 1–3 only. Roye confirms the look, then a follow-up ships 4 &amp; 5 with the full loop (and native overlays for the parts that are web-only here — a device tap).</div>
    </div>
  </div>
</body></html>`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const br = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await br.newPage({ deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.locator('body').screenshot({ path: `${OUT}/game-upgrades-4-5-proposed.png` });
  await br.close(); console.log('written');
})();
