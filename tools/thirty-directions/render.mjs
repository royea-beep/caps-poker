/**
 * RENDER + FLOOR AUDIT — thirty directions, two widths, measured in the browser that draws them.
 *
 * The floor is MEASURED, never asserted (Iron Rule #14):
 *   contrast   WCAG relative luminance on every text node, against the pixel actually behind it.
 *              A gradient or an image behind text is sampled from the RENDERED CANVAS, not from
 *              a CSS background-color that may be `transparent` — which is how a "pass" gets
 *              recorded for text sitting on art.
 *   44pt       every control's real bounding box, both dimensions.
 *   naming     every control has an accessible name (aria-label / text / aria-labelledby).
 *
 * ⚠️ THE PRECONDITION. Fonts are embedded as data URIs, but `document.fonts.ready` still has to
 * settle or a screenshot catches the fallback. Every page waits on it and REPORTS which families
 * actually loaded. A typography direction judged on Liberation Serif would be a verdict about
 * Liberation Serif.
 *
 * Usage: xvfb-run -a node tools/thirty-directions/render.mjs [--only=A1,B2] [--boards=3]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { page } from './lib.mjs';
import { DIRECTIONS } from './directions.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const ONLY = args.only ? new Set(args.only.split(',')) : null;
/** The home screen's own default is 3 players. Board count is DYNAMIC — never a literal 4. */
const PLAYERS = Number(args.players || 3);
const BOARDS = PLAYERS === 2 ? 4 : PLAYERS === 3 ? 3 : 2;
const WIDTHS = [393, 320];
const OUT = path.resolve(process.argv[1], '../../../docs/thirty-directions');
/**
 * `--shots=<dir>` sends the screenshots somewhere else while the audit still lands in OUT.
 *
 * WHY IT EXISTS. `--only=J2` rewrites `floor-audit.json` with a ONE-DIRECTION report, because the
 * report is assembled from whatever this run touched. That is what happened after J2's red spade
 * was fixed: the audit was truncated to a single entry, `sheet.mjs` was then rebuilt from it, and
 * twenty-nine of thirty tiles lost their floor verdict to a `?`. The pictures were fine and the
 * labels were quietly wrong — and the report claimed the sheets carried the verdicts.
 *
 * So an audit-repair pass can now regenerate the full measurement WITHOUT rewriting a single
 * committed render: the art stays exactly as it was published, only the JSON is refreshed.
 */
const SHOTS = args.shots ? path.resolve(args.shots) : OUT;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const AUDIT = () => {
  const px = (s) => parseFloat(s) || 0;
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const out = { text: [], controls: [], fonts: [] };

  document.fonts.forEach((f) => out.fonts.push(`${f.family} ${f.weight} ${f.status}`));

  // TEXT: every leaf node with visible characters.
  for (const el of document.querySelectorAll('*')) {
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!direct) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const fg = parse(s.color);
    if (!fg || fg.a === 0) continue;
    // `-webkit-text-fill-color: transparent` = gradient text. Contrast for it is not a colour
    // pair at all, so it is FLAGGED rather than scored — scoring it would invent a number.
    const gradientText = s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || s.color === 'rgba(0, 0, 0, 0)';
    // A COLOUR EMOJI IS PAINTED BY THE FONT, NOT BY `color`. Scoring 👤 against the inherited
    // text colour produced a 1.02:1 "failure" on all thirty directions in the first pass — a
    // number about a colour the glyph does not use. Flagged, never scored.
    const emojiOnly = !/[a-z0-9]/i.test(direct) && /\p{Extended_Pictographic}/u.test(direct);
    out.text.push({
      text: direct.slice(0, 40), fg: s.color, gradientText, emojiOnly,
      size: px(s.fontSize), weight: s.fontWeight, family: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    });
  }

  // CONTROLS: real box, real accessible name.
  for (const el of document.querySelectorAll('button,[role="button"],a[href]')) {
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
    out.controls.push({ name: name.slice(0, 44), w: Math.round(r.width), h: Math.round(r.height),
      box: [Math.round(r.x), Math.round(r.y)] });
  }
  return out;
};

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });
const report = { ts: new Date().toISOString(), players: PLAYERS, boards: BOARDS, widths: WIDTHS, directions: [] };

for (const d of DIRECTIONS) {
  if (ONLY && !ONLY.has(d.id)) continue;
  const entry = { id: d.id, family: d.family, name: d.name, needs: d.needs, note: d.note || null, widths: {} };

  for (const W of WIDTHS) {
    const html = page({
      id: d.id, title: `${d.family} — ${d.name}`, W,
      art: d.boardsAware ? d.art(W, BOARDS) : d.art(W),
    });
    const H = Math.round(W * 852 / 393);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);   // THE PRECONDITION
    await p.waitForTimeout(350);                     // let feTurbulence rasterise

    const shotPath = path.join(SHOTS, `${d.id}-${W}.png`);
    await p.screenshot({ path: shotPath });
    const raw = await p.evaluate(AUDIT);

    /**
     * THE GROUND SHOT — the background measured with the text taken out of it.
     *
     * The first pass sampled the background from the FINISHED render, inside each text box, and
     * took the median of twelve points. At 17px the glyphs cover most of that box, so the median
     * landed on the letterforms and the balance pill scored 3.06:1 against itself. Every one of
     * the thirty "failed" on it. A measurement that fails all thirty is a broken instrument, not
     * a finding.
     *
     * So the ground gets its own screenshot with every glyph made transparent. Layout, art,
     * gradients and the pill's own translucent plate are all still there; only the ink is gone.
     * RESIDUAL LIMIT, stated: colour-emoji fonts ignore `color`, so an emoji still paints in the
     * ground shot. It only pollutes its own box, and emoji are excluded from scoring anyway.
     */
    const groundPath = path.join(SHOTS, `.ground-${d.id}-${W}.png`);
    await p.addStyleTag({ content: `*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}` });
    await p.screenshot({ path: groundPath });
    const { PNG } = await import('pngjs');
    const img = PNG.sync.read(fs.readFileSync(groundPath));
    fs.unlinkSync(groundPath);
    const sampleBehind = (box) => {
      const [x, y, w, h] = box.map((v) => v * 2);          // deviceScaleFactor
      const pts = [];
      for (let i = 1; i <= 4; i++) for (let j = 1; j <= 3; j++) {
        const px2 = Math.min(img.width - 1, Math.max(0, Math.round(x + w * i / 5)));
        const py2 = Math.min(img.height - 1, Math.max(0, Math.round(y + h * j / 4)));
        const o = (img.width * py2 + px2) << 2;
        pts.push(lum(img.data[o], img.data[o + 1], img.data[o + 2]));
      }
      pts.sort((a, b) => a - b);
      // WORST CASE, not median: on a gradient or an image the hardest point is what decides
      // whether the text is readable, and a median would average that difficulty away.
      return pts;
    };

    const parseC = (c) => { const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
    const contrast = raw.text.map((t) => {
      if (t.emojiOnly) return { ...t, verdict: 'EMOJI — painted by the font, not by `color`. Not scorable.' };
      if (t.gradientText) return { ...t, verdict: 'GRADIENT_TEXT — not a colour pair; judge by eye' };
      const fg = parseC(t.fg); if (!fg) return { ...t, verdict: 'UNPARSED' };
      // Large text = >=18.66px bold or >=24px (WCAG). Everything else takes the 4.5:1 bar.
      const large = t.size >= 24 || (t.size >= 18.66 && +t.weight >= 700);
      const need = large ? 3 : 4.5;
      const fgL = lum(...fg);
      const grounds = sampleBehind(t.box);
      const worst = Math.min(...grounds.map((g) => ratio(fgL, g)));
      const median = ratio(fgL, grounds[Math.floor(grounds.length / 2)]);
      /**
       * EDGE vs FAIL. `getBoundingClientRect()` on a ROTATED element returns the axis-aligned box,
       * which for a fanned card extends well past the card onto the felt behind it. Sampling that
       * box reported the rank glyphs of half-cropped cards as contrast failures — a fact about the
       * bounding box, not about legibility. So: worst AND median below the bar is a real failure;
       * worst below but median above means the text straddles a boundary. That is still worth
       * seeing — it is where a designer would move the text — but it is not the same claim.
       */
      const cls = worst >= need ? 'PASS' : (median >= need ? 'EDGE' : 'FAIL');
      return { ...t, ratio: +worst.toFixed(2), median: +median.toFixed(2), need, cls, pass: cls !== 'FAIL' };
    });

    const fails = contrast.filter((c) => c.cls === 'FAIL');
    const small = raw.controls.filter((c) => c.w < 44 || c.h < 44);
    const unnamed = raw.controls.filter((c) => !c.name);
    const loadedFams = [...new Set(raw.fonts.filter((f) => f.endsWith('loaded')).map((f) => f.split(' ')[0]))];

    entry.widths[W] = {
      shot: path.basename(shotPath),
      fontsLoaded: loadedFams,
      pageErrors: errs,
      floor: {
        contrastFailures: fails.map((f) => ({ text: f.text, worst: f.ratio, median: f.median, need: f.need, size: f.size })),
        contrastEdges: contrast.filter((c) => c.cls === 'EDGE').map((c) => ({ text: c.text, worst: c.ratio, median: c.median, need: c.need })),
        gradientText: contrast.filter((c) => c.gradientText).map((c) => c.text),
        emojiSkipped: contrast.filter((c) => c.emojiOnly).length,
        under44: small.map((c) => ({ name: c.name, w: c.w, h: c.h })),
        unnamed: unnamed.length,
        controls: raw.controls.length,
        pass: fails.length === 0 && small.length === 0 && unnamed.length === 0,
      },
    };
    await ctx.close();
  }
  report.directions.push(entry);
  const f = entry.widths[393].floor;
  console.log(`${d.id.padEnd(3)} ${d.family.padEnd(26)} ${d.name.padEnd(34)} ` +
    `needs=${d.needs.padEnd(8)} floor=${f.pass ? 'PASS' : 'FAIL'} ` +
    `${f.contrastFailures.length ? `contrast:${f.contrastFailures.length} ` : ''}` +
    `${f.contrastEdges.length ? `edge:${f.contrastEdges.length} ` : ''}` +
    `${f.under44.length ? `small:${f.under44.length} ` : ''}${f.unnamed ? `unnamed:${f.unnamed}` : ''}`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'floor-audit.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.directions.length} directions x ${WIDTHS.length} widths -> ${OUT}`);
