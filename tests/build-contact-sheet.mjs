import { chromium } from 'playwright';
import fs from 'fs';

const DIR = 'docs/visual-proof';
const results = JSON.parse(fs.readFileSync(`${DIR}/results.json`, 'utf8'));

const cards = results.map(r => `
  <figure class="card ${r.status.toLowerCase()}">
    <figcaption><span class="badge">${r.status}</span> ${r.label} <code>${r.route}</code></figcaption>
    <div class="shot"><img src="./${r.file}" loading="eager" /></div>
  </figure>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0d0f15;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;padding:24px}
  h1{color:#4FD6A8;font-size:22px;letter-spacing:2px;margin:0 0 4px}
  .sub{color:rgba(255,255,255,.55);font-size:12px;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
  .card{margin:0;background:#161922;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden}
  figcaption{font-size:12px;font-weight:700;padding:8px 10px;display:flex;align-items:center;gap:6px}
  figcaption code{color:rgba(255,255,255,.5);font-weight:400;font-size:10px}
  .badge{font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px}
  .pass .badge{background:rgba(79,214,168,.2);color:#4FD6A8}
  .warn .badge{background:rgba(255,215,0,.2);color:#FFD700}
  .fail .badge{background:rgba(224,90,90,.25);color:#ff6b6b}
  .shot{height:300px;overflow:hidden;background:#000;display:flex;justify-content:center}
  .shot img{width:100%;object-fit:cover;object-position:top}
</style></head><body>
  <h1>CAPS POKER — VISUAL CONTACT SHEET</h1>
  <p class="sub">live caps.ftable.co.il (bundle index-32cb14f8) · mobile 390×844 · real-user state (first-run overlays dismissed) · ${results.length} screens · ${results.filter(r=>r.status==='PASS').length} PASS</p>
  <div class="grid">${cards}</div>
</body></html>`;

fs.writeFileSync(`${DIR}/contact-sheet.html`, html);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1 });
await p.goto('file:///' + process.cwd().replace(/\\/g, '/') + `/${DIR}/contact-sheet.html`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${DIR}/contact-sheet.png`, fullPage: true });
await b.close();
console.log('contact sheet written:', `${DIR}/contact-sheet.png`);
