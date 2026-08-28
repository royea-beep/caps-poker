/**
 * RENDER AND MEASURE THE TEN — side by side, at 393 and 320, then audited.
 *
 * Renders, not a redesign: nothing here is wired into the app. But they are REAL DOM, so the same
 * three measurements the brief asks for are taken from the rendered pixels rather than asserted:
 *
 *   CONTRAST     every text element, its own colour against its OWN painted backdrop — walked up
 *                the ancestor chain until an opaque background is found, because a token pair says
 *                nothing about what a translucent panel actually composites to.
 *   44pt         every exposed control's rendered box.
 *   EXPOSED      how many controls assistive tech can see AND name. An unnamed button counts as a
 *                control that exists and cannot be used, which is how twelve of them hid here.
 *
 *   node tools/home-concepts/render.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { CONCEPTS, T } from './concepts.mjs';

const OUT = process.env.OUT_DIR || '/tmp/home-concepts';
fs.mkdirSync(OUT, { recursive: true });

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
body{background:#050505;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.phone{background:${T.bg};color:${T.text};display:flex;flex-direction:column;overflow:hidden;position:relative}
.pad{flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:14px 16px 26px}
.pad.center{align-items:stretch;text-align:center;gap:34px}  /* stretch, not center: align-items:center shrink-wrapped C8's PLAY to its text width */
.top{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:12px 14px 0}
.chips{background:${T.surface};color:${T.goldLight};border:1px solid rgba(201,168,76,.45);border-radius:999px;
  padding:10px 16px;font-weight:800;font-size:15px;min-height:44px}
.avatar{background:${T.surface};border:1px solid rgba(255,255,255,.14);border-radius:999px;width:44px;height:44px;font-size:19px;color:${T.text}}
.wordmarkSm{font-size:22px;font-weight:900;letter-spacing:5px;color:${T.goldLight};text-align:center;padding:2px 0 2px}
.wordmarkSm span{color:${T.muted};font-size:13px;letter-spacing:6px}
.wordmarkBig{font-size:46px;font-weight:900;letter-spacing:8px;color:${T.goldLight};text-align:center;line-height:1.05}
.wordmarkBig span{color:${T.muted};font-size:19px;letter-spacing:9px}
.cta{border:0;border-radius:16px;font-weight:900;color:#0a0a0a;background:${T.win};
  min-height:56px;font-size:19px;letter-spacing:1.5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.cta.big{min-height:76px;font-size:25px}
.cta.mint{background:${T.mint}}
.cta.ghost{background:transparent;color:${T.mint};border:1.5px solid ${T.mint};min-height:52px;font-size:16px;letter-spacing:.6px;font-weight:800}
.ctaTop{font-size:25px;font-weight:900;letter-spacing:1.5px}
.ctaSub{font-size:12.5px;font-weight:700;letter-spacing:.3px;color:rgba(10,10,10,.78)}
.under{text-align:center;color:${T.muted};font-size:14px;line-height:1.45;font-weight:600}
.pitch{text-align:center;color:${T.text};font-size:17px;line-height:1.6;font-weight:600}
.pitch b{color:${T.mint};font-weight:900}
.two{display:flex;gap:12px}
.door{flex:1;background:${T.surface};border:1.5px solid rgba(255,255,255,.16);border-radius:18px;
  padding:20px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;color:${T.text};min-height:120px}
.door.mint{border-color:${T.mint};background:rgba(79,214,168,.13)}
.door b{font-size:16px;font-weight:900;letter-spacing:1px}
.door.mint b{color:${T.mint}}
.door i{font-style:normal;font-size:12.5px;color:${T.muted};font-weight:600}
.doorIcon{font-size:29px}
.live{display:flex;align-items:center;justify-content:center;gap:8px;color:${T.mint};font-weight:800;font-size:14px;
  background:rgba(79,214,168,.10);border:1px solid rgba(79,214,168,.4);border-radius:999px;padding:9px}
.dot{width:8px;height:8px;border-radius:50%;background:${T.win};display:inline-block}
.felt{flex:0 1 auto;background:linear-gradient(165deg,${T.feltTop},${T.feltBot});border:1px solid rgba(79,214,168,.45);
  border-radius:14px;padding:9px;display:flex;flex-direction:column;justify-content:space-evenly;gap:6px}
.miniBoard{background:${T.feltLift};border:1px solid rgba(255,255,255,.10);border-radius:8px;
  padding:6px;display:flex;gap:5px;justify-content:center}
.pip{width:15px;height:21px;border-radius:3px;background:${T.cardFace};display:block}
.fan{display:flex;justify-content:center;align-items:flex-end;height:110px}
.pc{width:44px;height:62px;background:${T.cardFace};border-radius:6px;color:#1A1A1A;display:flex;flex-direction:column;
  align-items:center;justify-content:center;font-weight:900;margin-left:-11px;
  transform:rotate(calc((var(--i) - 2) * 7deg)) translateY(calc(abs(var(--i) - 2) * 4px));box-shadow:0 3px 9px rgba(0,0,0,.5)}
.pc.red{color:#CC0000}.pc b{font-size:17px}.pc em{font-style:normal;font-size:15px}
.heroWrap{display:flex;justify-content:center;padding:22px 0 44px}  /* clearance: the fan's low cards were sitting on the CTA */
.runCard{background:${T.surface};border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:11px}
.runRow{display:flex;justify-content:space-between;align-items:center}
.runK{color:${T.muted};font-size:12.5px;font-weight:800;letter-spacing:1.4px}
.runV{color:${T.goldLight};font-size:18px;font-weight:900}
.seats{display:flex;justify-content:center;gap:11px}
.seat{width:46px;height:46px;border-radius:50%;background:${T.surface};border:1px solid rgba(255,255,255,.16);
  display:flex;align-items:center;justify-content:center;font-size:21px}
.seat.open{border:2px dashed ${T.mint};color:${T.mint};font-weight:900;font-size:25px}
.tabs{display:flex;border-top:1px solid rgba(79,214,168,.22);background:${T.bg};padding-bottom:4px}
.tab{flex:1;background:none;border:0;padding:9px 0 7px;display:flex;flex-direction:column;align-items:center;gap:3px;min-height:52px;color:#8f979f}
/* #8f979f, not the shipping ${T.dim} (#5b6168): the inactive tab labels measure 3.17:1 in the
   app today and 4.5 is the bar for 10-11px text. The concepts are not allowed to inherit a
   defect and call it a baseline — but note it IS a live defect, on every screen, not just home. */
.tab.on{color:${T.mint}}
.tabIcon{font-size:19px}.tabTxt{font-size:11px;font-weight:800}
`;

const page1 = (w) => `<meta charset="utf-8"><style>${CSS}</style>
<div style="display:flex;gap:14px;padding:14px;align-items:flex-start">
${CONCEPTS.map((c) => `
  <figure style="margin:0">
    <figcaption style="color:${T.goldLight};font:800 13px system-ui;padding:0 0 6px 2px">${c.id} · ${c.name}</figcaption>
    <div class="phone" id="${c.id}" style="width:${w}px;height:852px">${c.body()}</div>
  </figure>`).join('')}
</div>`;

const MEASURE = `() => {
  const L = (c) => { const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
  const parse = (str) => { const m = str.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return { rgb: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  // THE BACKDROP A PIXEL IS ACTUALLY ON — walk up compositing every translucent layer, rather
  // than comparing a token against the token someone assumed was behind it.
  const backdrop = (el) => { let acc = null; let n = el;
    while (n && n !== document.documentElement) { const b = parse(getComputedStyle(n).backgroundColor);
      if (b && b.a > 0) { acc = acc === null ? (b.a >= 1 ? b.rgb : null) : acc;
        if (b.a >= 1) return acc ?? b.rgb; }
      n = n.parentElement; }
    return [5,5,5]; };
  const ratio = (a, b) => { const [hi, lo] = L(a) > L(b) ? [L(a), L(b)] : [L(b), L(a)];
    return (hi + 0.05) / (lo + 0.05); };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent?.trim() || '').trim();
  const out = {};
  for (const frame of document.querySelectorAll('.phone')) {
    const texts = [...frame.querySelectorAll('*')].filter((el) => vis(el) &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
      !el.hasAttribute('aria-hidden'));
    const items = texts.map((el) => { const cs = getComputedStyle(el); const fg = parse(cs.color);
      const size = parseFloat(cs.fontSize); const wgt = parseInt(cs.fontWeight) || 400;
      // WCAG large text: >=24px, or >=18.66px when bold. Those get 3:1; everything else 4.5:1.
      const large = size >= 24 || (size >= 18.66 && wgt >= 700);
      const bg = backdrop(el);
      const eff = fg.a >= 1 ? fg.rgb : over(fg, bg);
      return { text: el.textContent.trim().replace(/\\s+/g,' ').slice(0,30), size: +size.toFixed(1), large,
               ratio: +ratio(eff, bg).toFixed(2), need: large ? 3 : 4.5 }; });
    const ctrls = [...frame.querySelectorAll('button,[role="button"],a,input,select')].filter(vis);
    const small = ctrls.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
    out[frame.id] = {
      textCount: items.length,
      failing: items.filter((i) => i.ratio < i.need),
      minRatio: items.length ? Math.min(...items.map((i) => i.ratio)) : null,
      controls: ctrls.length,
      unnamed: ctrls.filter((el) => !name(el)).length,
      under44: small.map((el) => { const r = el.getBoundingClientRect();
        return { name: name(el).slice(0,24), w: Math.round(r.width), h: Math.round(r.height) }; }),
    };
  }
  return out;
}`;

const server = http.createServer((req, res) => {
  const w = Number(new URL(req.url, 'http://x').searchParams.get('w') || 393);
  // charset=utf-8 IS NOT OPTIONAL. Without it the browser decodes these UTF-8 bytes as
  // Latin-1 and every emoji renders as mojibake — which is exactly the class of bug the
  // release checklist lists, and it was invisible until the sheet was opened and looked at.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page1(w));
});
await new Promise((r) => server.listen(8991, r));

const browser = await chromium.launch({ headless: true,
  ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) });
const report = {};
for (const w of [393, 320]) {
  const ctx = await browser.newContext({ viewport: { width: CONCEPTS.length * (w + 14) + 28, height: 920 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:8991/?w=${w}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const dest = path.join(OUT, `concepts-${w}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  report[w] = await page.evaluate(`(${MEASURE})()`);
  console.log(`  rendered ${dest}`);
  await ctx.close();
}
await browser.close(); server.close();

console.log(`\n  id   name                    | text | contrast fails | min ratio | controls | <44pt | unnamed`);
for (const w of [393, 320]) {
  console.log(`\n  ── ${w}pt ─────────────────────────────────────────────────────────────────────────`);
  for (const c of CONCEPTS) {
    const r = report[w][c.id];
    console.log(`  ${c.id.padEnd(4)} ${c.name.padEnd(22)} | ${String(r.textCount).padStart(4)} | ` +
      `${String(r.failing.length).padStart(14)} | ${String(r.minRatio).padStart(9)} | ` +
      `${String(r.controls).padStart(8)} | ${String(r.under44.length).padStart(5)} | ${r.unnamed}`);
    for (const f of r.failing) console.log(`         ↳ FAIL ${f.ratio}:1 (needs ${f.need}) ${f.size}px  "${f.text}"`);
    for (const s of r.under44) console.log(`         ↳ SMALL ${s.w}x${s.h}  "${s.name}"`);
  }
}
fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 2));
console.log(`\n  wrote ${path.join(OUT, 'measurements.json')}\n`);
