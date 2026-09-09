/**
 * CONTACT SHEETS — thirty directions where they can be compared, which is the only way a
 * ranking means anything. One sheet per width, ten columns (one family per column) by three
 * rows (its three treatments), so a family's internal spread reads down and the families read
 * across.
 *
 * Every tile is labelled with its ID and its floor verdict, because a direction that fails the
 * floor must be reported WITH its picture and its number rather than quietly dropped.
 *
 * Usage: xvfb-run -a node tools/thirty-directions/sheet.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { DIRECTIONS } from './directions.mjs';

const OUT = path.resolve(process.argv[1], '../../../docs/thirty-directions');
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'floor-audit.json'), 'utf8'));
const byId = Object.fromEntries(audit.directions.map((d) => [d.id, d]));

const families = [...new Set(DIRECTIONS.map((d) => d.family))];

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });

for (const W of [393, 320]) {
  const TILE = 168, TH = Math.round(TILE * 852 / 393);
  const cols = families.map((fam) => {
    const inFam = DIRECTIONS.filter((d) => d.family === fam);
    const tiles = inFam.map((d) => {
      const f = byId[d.id]?.widths[W]?.floor;
      const png = fs.readFileSync(path.join(OUT, `${d.id}-${W}.png`)).toString('base64');
      const verdict = !f ? '?' : f.pass ? 'floor ok'
        : [f.contrastFailures.length && `${f.contrastFailures.length} contrast`,
           f.under44.length && `${f.under44.length} under 44`,
           f.unnamed && `${f.unnamed} unnamed`].filter(Boolean).join(' · ');
      const bad = f && !f.pass;
      return `<figure>
        <img src="data:image/png;base64,${png}" width="${TILE}" height="${TH}" alt="${d.id}">
        <figcaption><b>${d.id}</b> ${d.name}
          <span class="${bad ? 'bad' : 'ok'}">${verdict}</span>
          ${d.needs !== 'none' ? `<span class="needs">needs ${d.needs}</span>` : ''}
        </figcaption></figure>`;
    }).join('');
    return `<section><h2>${fam}</h2>${tiles}</section>`;
  }).join('');

  const html = `<!doctype html><meta charset="utf-8"><title>Thirty directions @ ${W}</title>
  <style>
    body{margin:0;background:#111318;color:#e8e6e0;font:13px/1.4 system-ui,sans-serif;padding:22px}
    h1{font:700 22px system-ui;margin:0 0 4px}
    .sub{color:#8b93a1;margin-bottom:20px}
    .grid{display:flex;gap:16px;align-items:flex-start}
    section{flex:0 0 ${TILE}px}
    h2{font:700 11px system-ui;letter-spacing:.06em;text-transform:uppercase;color:#7ee0bb;
       margin:0 0 8px;min-height:26px}
    figure{margin:0 0 14px}
    img{display:block;border-radius:6px;border:1px solid #2a2f3a}
    figcaption{font-size:10.5px;color:#aeb6c2;margin-top:5px;line-height:1.35}
    .ok{display:block;color:#5ec49a}.bad{display:block;color:#e0885e}
    .needs{display:block;color:#c9a84c}
  </style>
  <h1>CAPS · thirty art directions · ${W}px</h1>
  <div class="sub">Ten distinct ideas, three treatments each. The C2 control set is identical in every tile —
    the art is the only variable. Board count rendered at the home screen's own 3-player default
    (dynamic: 2P=4, 3P=3, 4P=2).</div>
  <div class="grid">${cols}</div>`;

  const file = path.join(OUT, `_sheet-${W}.html`);
  fs.writeFileSync(file, html);
  const ctx = await browser.newContext({ viewport: { width: 220 + families.length * (TILE + 16), height: 1200 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, `_contact-sheet-${W}.png`), fullPage: true });
  await ctx.close();
  fs.unlinkSync(file);
  console.log(`sheet ${W} -> _contact-sheet-${W}.png`);
}
await browser.close();
