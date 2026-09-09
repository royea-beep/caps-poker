/**
 * ONE SHEET — the ten survivors and the cup directions together.
 *
 * The brief is explicit that this must not be two comparisons: Roye chooses once, so every
 * candidate has to be on the same page at the same size. The two groups are labelled, and the
 * cup group carries the fact that decides it — every cup direction is `needs designer`, because
 * the app's real cup is the 🏆 emoji and a drawn cup obliges the Cups tab to adopt the same mark.
 *
 * Tiles are labelled with their code, their name and their measured floor verdict — the same
 * three things the thirty-sheet carries, from the same audit implementation. Two audit files
 * feed this (the thirty and the cups); a tile whose verdict cannot be found says so rather than
 * printing a blank, because a missing verdict is exactly how twenty-nine tiles quietly lost
 * theirs last sprint.
 *
 * Usage: xvfb-run -a node tools/thirty-directions/finalists.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { DIRECTIONS } from './directions.mjs';
import { CUP_DIRECTIONS } from './cups.mjs';

const OUT = path.resolve(process.argv[1], '../../../docs/thirty-directions');

/** The ten the panel kept, in the panel's order. */
const SURVIVORS = ['J2', 'A2', 'I1', 'C1', 'F1', 'F2', 'E1', 'D1', 'J1', 'J3'];
/** The cup family, minus the instrument canary (ZZ) and minus K0, which is a control not a hero. */
const CUPS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'];

const byId = {};
for (const f of ['floor-audit.json', 'cup-floor-audit.json']) {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) throw new Error(`missing ${f} — render both sets first`);
  for (const d of JSON.parse(fs.readFileSync(p, 'utf8')).directions) byId[d.id] = d;
}
const meta = Object.fromEntries([...DIRECTIONS, ...CUP_DIRECTIONS].map((d) => [d.id, d]));

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });

for (const W of [393, 320]) {
  const TILE = 176, TH = Math.round(TILE * 852 / 393);
  const tile = (id) => {
    const d = meta[id], a = byId[id];
    const f = a?.widths?.[W]?.floor;
    const file = path.join(OUT, `${id}-${W}.png`);
    if (!fs.existsSync(file)) throw new Error(`missing render ${id}-${W}.png`);
    const verdict = !f ? 'NO VERDICT FOUND — do not trust this tile'
      : f.pass ? 'floor ok'
      : [f.contrastFailures.length && `${f.contrastFailures.length} contrast`,
         f.under44.length && `${f.under44.length} under 44`,
         f.unnamed && `${f.unnamed} unnamed`].filter(Boolean).join(' · ');
    return `<figure>
      <img src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}" width="${TILE}" height="${TH}" alt="${id}">
      <figcaption><b>${id}</b> ${d.name}
        <span class="${!f ? 'miss' : f.pass ? 'ok' : 'bad'}">${verdict}</span>
        ${d.needs !== 'none' ? `<span class="needs">needs ${d.needs}</span>` : ''}
      </figcaption></figure>`;
  };

  const html = `<!doctype html><meta charset="utf-8"><title>Finalists @ ${W}</title><style>
    body{margin:0;background:#111318;color:#e8e6e0;font:13px/1.4 system-ui,sans-serif;padding:24px}
    h1{font:700 23px system-ui;margin:0 0 4px}
    .sub{color:#8b93a1;margin-bottom:22px;max-width:1000px;line-height:1.55}
    h2{font:700 12px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#7ee0bb;margin:26px 0 12px}
    h2 span{color:#8b93a1;text-transform:none;letter-spacing:0;font-weight:400}
    .row{display:flex;gap:16px;flex-wrap:wrap}
    figure{margin:0;width:${TILE}px}
    img{display:block;border-radius:7px;border:1px solid #2a2f3a}
    figcaption{font-size:10.5px;color:#aeb6c2;margin-top:6px;line-height:1.4}
    .ok{display:block;color:#5ec49a}.bad{display:block;color:#e0885e}.miss{display:block;color:#ff6b6b;font-weight:700}
    .needs{display:block;color:#c9a84c}
  </style>
  <h1>CAPS · finalists · ${W}px</h1>
  <div class="sub">The ten the panel kept, and the cup family, on one page at one size — because the
    choice is made once. Controls are identical in every tile; the art is the only variable.</div>
  <h2>The ten survivors <span>— cards, felt and type. Nothing here says CAPS rather than "a poker game".</span></h2>
  <div class="row">${SURVIVORS.map(tile).join('')}</div>
  <h2>The cup family <span>— the only asset in the product a competitor does not have. Every one is
    "needs designer": the app's real cup is the 🏆 emoji, so a drawn cup obliges the Cups tab to adopt it too.</span></h2>
  <div class="row">${CUPS.map(tile).join('')}</div>`;

  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1200 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, `_finalists-${W}.png`), fullPage: true });
  await ctx.close();
  console.log(`finalists ${W} -> _finalists-${W}.png  (${SURVIVORS.length} survivors + ${CUPS.length} cups)`);
}
await browser.close();
