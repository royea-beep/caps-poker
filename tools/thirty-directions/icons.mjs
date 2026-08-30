/**
 * THE ICON TEST — because "would it survive as an app icon" is a question with an answer, and
 * the answer is a picture.
 *
 * An app icon is a SQUARE at a size where most of a design disappears. The store shows it at
 * roughly 120px; the home screen shows it around 60px. So each candidate's art is re-rendered
 * with no controls, at 1:1, and stamped out at 1024 / 240 / 120 / 60 in one strip. A direction
 * that only works at 1024 has failed the test that matters.
 *
 * NOTE ON WHAT THIS IS NOT. Rendering a direction's hero into a square is not the same as
 * designing an icon — a real icon is composed for the square, not cropped into it. This says
 * which directions SURVIVE the square, which is the question asked. It does not produce a
 * shippable icon and nothing here should be treated as one.
 *
 * Usage: xvfb-run -a node tools/thirty-directions/icons.mjs A2,I2,J2,I1,H2,F1,C1
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fontFaces, P } from './lib.mjs';
import { DIRECTIONS } from './directions.mjs';
import { CUP_DIRECTIONS } from './cups.mjs';
const ALL = [...DIRECTIONS, ...CUP_DIRECTIONS];

const IDS = (process.argv[2] || 'A2,I2,J2,I1,H2,F1,C1').split(',');
const OUT = path.resolve(process.argv[1], '../../../docs/thirty-directions');
const SIZES = [1024, 240, 120, 60];
const BOARDS = 3;   // the home screen's own default. Dynamic: 2P=4, 3P=3, 4P=2.

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });
const tiles = [];

for (const id of IDS) {
  const d = ALL.find((x) => x.id === id);
  if (!d) { console.log(`skip ${id} — no such direction`); continue; }
  const row = { id, name: d.name, shots: {} };

  for (const S of SIZES) {
    // The art is authored against a 393-wide screen, so it is drawn at 393 and scaled into the
    // square. Scaling a finished render is what a store listing does to an icon anyway.
    const ART_W = 393;
    const html = `<!doctype html><meta charset="utf-8"><style>
      ${fontFaces()}
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{width:${S}px;height:${S}px;overflow:hidden;background:${P.bg}}
      .frame{position:relative;width:${S}px;height:${S}px;overflow:hidden}
      .inner{position:absolute;left:50%;top:50%;width:${ART_W}px;height:${ART_W}px;
        margin:-${ART_W / 2}px 0 0 -${ART_W / 2}px;transform:scale(${S / ART_W});transform-origin:center;overflow:hidden}
      .grain{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:overlay}
    </style><div class="frame"><div class="inner">${d.boardsAware ? d.art(ART_W, BOARDS) : d.art(ART_W)}</div></div>`;

    const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const f = path.join(OUT, `_icon-${id}-${S}.png`);
    await p.screenshot({ path: f });
    row.shots[S] = path.basename(f);
    await ctx.close();
  }
  tiles.push(row);
  console.log(`icon ${id} -> ${SIZES.join('/')}`);
}

// One strip so the sizes can be compared, which is the only way the small ones mean anything.
const strip = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#111318;color:#e8e6e0;font:13px system-ui;padding:22px}
  h1{font:700 20px system-ui;margin:0 0 4px}.sub{color:#8b93a1;margin-bottom:18px;max-width:820px;line-height:1.5}
  table{border-collapse:collapse}td,th{padding:10px 14px;vertical-align:middle;text-align:center}
  th{font:600 11px system-ui;letter-spacing:.06em;text-transform:uppercase;color:#7ee0bb}
  td.n{text-align:left;font:600 13px system-ui;color:#cfd6e0;white-space:nowrap}
  img{display:block;border-radius:22%;border:1px solid #2a2f3a}
</style>
<h1>Does it survive the square?</h1>
<div class="sub">Each direction's art with the controls removed, rendered 1:1 and stamped at store size (120)
  and home-screen size (60). Cropping a hero into a square is NOT designing an icon — this only shows which
  directions survive the square, which is the question. None of these is a shippable icon.</div>
<table><tr><th></th>${SIZES.map((s) => `<th>${s}px</th>`).join('')}</tr>
${tiles.map((t) => `<tr><td class="n">${t.id}<br><span style="font-weight:400;color:#8b93a1">${t.name}</span></td>
  ${SIZES.map((s) => `<td><img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, t.shots[s])).toString('base64')}"
    width="${Math.min(s, 190)}" height="${Math.min(s, 190)}" alt="${t.id} at ${s}"></td>`).join('')}</tr>`).join('')}
</table>`;

const f = path.join(OUT, '_icon-strip.html');
fs.writeFileSync(f, strip);
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.setContent(strip, { waitUntil: 'load' });
await p.waitForTimeout(500);
await p.screenshot({ path: path.join(OUT, '_icon-test.png'), fullPage: true });
await ctx.close();
fs.unlinkSync(f);
// the 1024s and 240s were only inputs to the strip; the strip is the deliverable
for (const t of tiles) for (const S of [1024, 240]) fs.unlinkSync(path.join(OUT, t.shots[S]));
await browser.close();
console.log('-> _icon-test.png');
