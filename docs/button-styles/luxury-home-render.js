/* BUILD-LUXURY-HOME — faithful render + measure of the BUILT Luxury Dark home.
 *
 * Mirrors the exact computed geometry of the built home (LuxuryBackdrop + gold suits + gilded CAPS
 * wordmark + RoyalFlushFan built from Card.tsx's real face rules + smooth chip + relocated tagline),
 * using the SAME rf/rs/rv math as utils/responsive.ts and the app's real tokens.
 *
 * HONEST INSTRUMENT: contrast is text-vs-REAL-background — for every measured text it renders a
 * copy with that text hidden, screenshots, and SAMPLES the composited pixel (vignette+beam+felt+
 * overlays) under the text's centroid, then computes WCAG against the text colour. Canary first.
 *
 * RENDERED MIRROR of the built component (real Chromium pixels of the real geometry) — NOT the app
 * bundle (the feature branch is not deployed) and NOT a device.
 */
const { chromium } = require('playwright');
const OUT = '/home/user/caps-poker/docs/button-styles';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ── responsive math (verbatim from utils/responsive.ts, FONT_SCALE 1.0) ───────
const BASE = 393;
const rv = (v, w) => Math.round(v * (w / BASE));
const rs = rv;
const rf = (v, min, max, w) => {
  const s = Math.round(v * (w / BASE));
  const lo = min !== undefined ? min : Math.round(v * 0.75);
  const hi = max !== undefined ? max : Math.round(v * 1.25);
  return Math.max(lo, Math.min(hi, s));
};
// contrast
const lum = (hex) => {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map(i => parseInt(n.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const lumRGB = (r, g, b) => { const c = [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratioHexRGB = (hex, rgb) => { const L1 = lum(hex), L2 = lumRGB(rgb[0], rgb[1], rgb[2]); return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
const ratioHex = (a, b) => { const L1 = lum(a), L2 = lum(b); return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };

// ── tokens ────────────────────────────────────────────────────────────────────
const MINT = '#4FD6A8', BRASS = '#C9A84C', INK = '#08130F', SUBINK = '#0A1A14', DARK = '#12211B';
const GILD = '#c9a84c', TAGLINE = '#cfd8d2', CARDFACE = '#FCFAF3', SPADE = '#18181b';
const FELT_TOP = '#0C2C1D', FELT_MID = '#071C12', FELT_BOTTOM = '#03110B';
const EN = { title: 'Play Online', sub: 'Real players · instant bot tables', prac: 'Practice vs bots' };
const HE = { title: 'שחק אונליין', sub: 'מול שחקנים אמיתיים · שולחנות בוט', prac: 'אימון מול בוטים' };

// ── one card face, faithful to Card.tsx (upgraded v3, width<=48 → solid face, no bottom-right) ──
function cardFace(rank, w) {
  const h = Math.round(w * 1.4);
  const cornerRank = Math.max(9, Math.round(w * 0.30));
  const cornerSuit = Math.max(7, Math.round(w * 0.22));
  const centerSuit = Math.max(16, Math.round(w * 0.64));
  return `<div class="cardface" style="width:${w}px;height:${h}px;background:${CARDFACE};border:1px solid rgba(0,0,0,0.45);border-radius:8px;position:relative;box-shadow:0 1px 2px rgba(40,30,10,.25)">
    <div style="position:absolute;top:${rs(3, w)}px;left:${rs(4, w)}px;text-align:center;line-height:1">
      <div style="color:${SPADE};font-size:${cornerRank}px;font-weight:600">${rank}</div>
      <div style="color:${SPADE};font-size:${cornerSuit}px;font-weight:600">♠</div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="color:${SPADE};font-size:${centerSuit}px;font-weight:700">♠</div>
    </div>
  </div>`;
}

function fan(w) {
  const h = Math.round(w * 1.4);
  const ranks = ['10', 'J', 'Q', 'K', 'A'];
  const n = 5, mid = 2, step = 6, overlap = 0.42;
  const stepX = Math.round(w * overlap);
  const maxA = mid * step, lift = Math.round(h * Math.sin(maxA * Math.PI / 180));
  const cH = h + lift + Math.round(h * 0.06);
  const cW = w + stepX * (n - 1) + Math.round(w * 0.3);
  const spokes = ranks.map((r, i) => {
    const a = (i - mid) * step, tx = (i - mid) * stepX;
    return `<div style="position:absolute;left:0;right:0;bottom:0;height:${cH}px;display:flex;align-items:flex-end;justify-content:center;transform-origin:bottom center;transform:translateX(${tx}px) rotate(${a}deg)">${cardFace(r, w)}</div>`;
  }).join('');
  return `<div class="fanwrap" style="display:flex;flex-direction:column;align-items:center;gap:${rs(6, w)}px">
    <div class="fan" style="width:${cW}px;height:${cH}px;position:relative">${spokes}</div>
    <div data-measure="royal" data-color="${GILD}" style="color:${GILD};font-size:${rf(11, 9, 13, w)}px;font-weight:800;letter-spacing:${rs(3, w)}px;text-transform:uppercase">ROYAL FLUSH</div>
  </div>`;
}

function chip(variant, inner, w, extraW) {
  const isP = variant === 'primary';
  const fill = isP ? MINT : DARK, edge = isP ? BRASS : MINT;
  const radius = rv(60, w), minH = isP ? rv(72, w) : rv(52, w);
  const padV = isP ? rs(14, w) : rs(10, w), cpadH = (isP ? rs(24, w) : rs(20, w)) + rs(6, w);
  const gap = isP ? rs(12, w) : rs(8, w), inset = rs(6, w), ew = rv(2, w);
  const width = isP ? undefined : extraW;
  const mh = isP ? rs(16, w) : 0, mt = isP ? rs(12, w) : 0;
  return `<div class="chipwrap ${variant}" style="${width ? `width:${width}px;` : `align-self:stretch;margin:0 ${mh}px;`}margin-top:${mt}px;${!isP ? 'align-self:center;' : ''}background:${fill};border-radius:${radius}px;box-shadow:0 ${rs(10, w)}px ${rs(22, w)}px rgba(0,0,0,.5)">
    <div class="chip" style="position:relative;display:flex;flex-direction:row;align-items:center;justify-content:center;overflow:hidden;min-height:${minH}px;padding:${padV}px ${cpadH}px;gap:${gap}px;border-radius:${radius}px">
      <div style="position:absolute;top:0;left:0;right:0;height:${rs(3, w)}px;border-top-left-radius:${radius}px;border-top-right-radius:${radius}px;background:rgba(255,255,255,.45)"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:${rs(8, w)}px;border-bottom-left-radius:${radius}px;border-bottom-right-radius:${radius}px;background:rgba(0,0,0,.2)"></div>
      <div class="rim" style="position:absolute;inset:${inset}px;border-radius:${radius}px;border:${ew}px solid ${edge};opacity:.9"></div>
      ${inner}
    </div>
  </div>`;
}

function composition(w, lang, mode) {
  const S = lang === 'he' ? HE : EN;
  const rtl = lang === 'he';
  const titleFontSize = Math.min(126, Math.round(w * 0.30));
  const padH = rs(20, w), gap = rs(16, w);
  const emojiFS = rf(24, undefined, undefined, w), titleFS = rf(19, undefined, undefined, w), subFS = rf(12, undefined, undefined, w), pracFS = rf(15, 12, 18, w);
  const plantOverflow = mode === 'canary-overflow', plantClip = mode === 'canary-clip';
  const titleText = plantOverflow ? S.title + ' — VS REAL PLAYERS INSTANTLY EXTRALONG NOW' : S.title;

  const primaryInner = `
    <span style="font-size:${emojiFS}px;flex:0 0 auto">🎮</span>
    <div style="flex:1 1 auto;min-width:0;${rtl ? 'text-align:right' : ''}">
      <div data-measure="ctitle" data-color="${INK}" class="mtitle" style="color:${INK};font-size:${titleFS}px;font-weight:900;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titleText}</div>
      <div class="msub" style="color:${SUBINK};font-size:${subFS}px;font-weight:700;margin-top:${rs(1, w)}px;display:-webkit-box;-webkit-line-clamp:${plantClip ? 1 : 2};-webkit-box-orient:vertical;overflow:hidden;${plantClip ? `max-height:${subFS + 2}px;` : ''}">${S.sub}</div>
    </div>
    <span style="color:${INK};font-size:${emojiFS}px;font-weight:900;flex:0 0 auto">${rtl ? '‹' : '›'}</span>`;
  const pracInner = `<div data-measure="ptext" data-color="${MINT}" class="practext" style="color:${MINT};font-size:${pracFS}px;font-weight:800;letter-spacing:.8px;text-align:center;white-space:nowrap;width:100%">${S.prac}</div>`;

  return `<div class="frame" data-w="${w}" data-lang="${lang}" data-mode="${mode}" dir="${rtl ? 'rtl' : 'ltr'}" style="width:${w}px;position:relative;overflow:hidden;background:${FELT_BOTTOM}">
    <!-- LuxuryBackdrop -->
    <div class="backdrop" style="position:absolute;inset:0;background:linear-gradient(180deg,${FELT_TOP} 0%,${FELT_MID} 50%,${FELT_BOTTOM} 100%)"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(120% 78% at 50% 30%, rgba(26,70,44,0.55) 0%, rgba(7,28,18,0.0) 46%, rgba(0,0,0,0.55) 100%)"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(118deg, rgba(255,240,205,0.10) 0%, rgba(255,240,205,0.035) 12%, rgba(255,240,205,0) 27%)"></div>
    <div class="content" style="position:relative;display:flex;flex-direction:column;align-items:center;padding:${rs(8, w)}px ${padH}px ${rs(24, w)}px;gap:${gap}px">
      <div class="masthead" style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div data-measure="suits" data-color="${GILD}" style="font-size:${rf(16, undefined, undefined, w)}px;letter-spacing:10px;color:${GILD}">♠ ♥ ♦ ♣</div>
        <div data-measure="caps" data-color="${GILD}" class="caps" style="font-size:${titleFontSize}px;font-weight:900;letter-spacing:${rs(-3, w)}px;color:${GILD};line-height:1.02;text-shadow:0 0 24px rgba(0,0,0,.85)">CAPS</div>
        <div data-measure="poker" data-color="${GILD}" class="poker" style="font-size:${rf(13, undefined, undefined, w)}px;font-weight:600;letter-spacing:${rs(10, w)}px;color:${GILD};text-transform:uppercase">POKER</div>
      </div>
      ${fan(Math.max(rv(38, w), Math.min(rv(52, w), Math.round(w * 0.12))))}
      ${chip('primary', primaryInner, w)}
      ${chip('secondary', pracInner, w, Math.round(w * 0.64))}
      <div data-measure="tagline" data-color="${TAGLINE}" style="color:${TAGLINE};font-size:${rf(13, undefined, undefined, w)}px;font-weight:600;line-height:${rf(19, undefined, undefined, w)}px;padding:0 ${rs(18, w)}px;margin-top:${rs(8, w)}px;text-align:center">Four cards on every board. Every board plays at once. Win the most boards, win the hand.</div>
    </div>
  </div>`;
}

function page(frames) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    body{background:#000;padding:0;display:flex;width:max-content;gap:0}
  </style></head><body>${frames.join('')}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const report = { canary: {}, tiles: [], sheetsWritten: [] };

  // canary FIRST — instrument re-verified before any number is trusted
  report.canary.mint_on_mint = ratioHex(MINT, MINT);
  report.canary.badFlagged = report.canary.mint_on_mint < 4.5;
  report.canary.ink_on_mint = ratioHex(INK, MINT);
  report.canary.goodPass = report.canary.ink_on_mint >= 4.5;

  const WIDTHS = [320, 375, 393, 430];
  async function run(mode) {
    const combos = [];
    for (const w of WIDTHS) for (const l of ['en', 'he']) combos.push([w, l]);
    const p = await browser.newPage({ deviceScaleFactor: 1 });
    await p.setContent(page(combos.map(([w, l]) => composition(w, l, mode))), { waitUntil: 'networkidle' });

    // geometry + fit + overlap
    const geo = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('.frame').forEach(f => {
        const w = +f.dataset.w, lang = f.dataset.lang, mode = f.dataset.mode;
        const rec = { w, lang, mode, texts: {} };
        rec.hOverflow = f.scrollWidth > f.clientWidth + 1;
        const poker = f.querySelector('.poker').getBoundingClientRect();
        const fanEl = f.querySelector('.fan').getBoundingClientRect();
        rec.fanPokerGap = Math.round(fanEl.top - poker.bottom);
        rec.fanOverlapsPoker = fanEl.top < poker.bottom - 1;
        const title = f.querySelector('.mtitle');
        rec.titleClipped = title.scrollWidth > title.clientWidth + 1;
        const sub = f.querySelector('.msub');
        rec.subClipped = sub.scrollHeight > sub.clientHeight + 1;
        const prac = f.querySelector('.practext');
        rec.pracClipped = prac.scrollWidth > prac.clientWidth + 1;
        // stacked overlap in content
        const kids = [...f.querySelector('.content').children].filter(k => k.offsetHeight > 0);
        let overlap = false, minGap = 9999;
        for (let i = 1; i < kids.length; i++) { const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect(); const g = b.top - a.bottom; if (g < -1) overlap = true; if (g < minGap) minGap = g; }
        rec.contentOverlap = overlap; rec.contentMinGap = Math.round(minGap);
        // goldHit on chips (fill+rim) — scan for rgb(255,215,0)
        let goldHit = false;
        f.querySelectorAll('.chipwrap,.rim').forEach(el => { const cs = getComputedStyle(el); [cs.backgroundColor, cs.borderTopColor].forEach(c => { if (c && c.replace(/\s/g, '') === 'rgb(255,215,0)') goldHit = true; }); });
        rec.goldHit = goldHit;
        // centroids of measured texts (for bg sampling)
        f.querySelectorAll('[data-measure]').forEach(el => {
          const r = el.getBoundingClientRect();
          rec.texts[el.dataset.measure] = { color: el.dataset.color, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        });
        out.push(rec);
      });
      return out;
    });

    // background sample: hide measured text, screenshot, sample composited pixel under each centroid
    await p.addStyleTag({ content: '[data-measure]{visibility:hidden !important}' });
    const shot = await p.screenshot({ type: 'png', fullPage: true });
    const b64 = shot.toString('base64');
    const sampler = await browser.newPage({ deviceScaleFactor: 1 });
    await sampler.setContent(`<img id="i" src="data:image/png;base64,${b64}">`, { waitUntil: 'load' });
    const samples = await sampler.evaluate(async (pts) => {
      const img = document.getElementById('i');
      await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      return pts.map(pt => { const d = ctx.getImageData(pt.x, pt.y, 1, 1).data; return { key: pt.key, w: pt.w, lang: pt.lang, rgb: [d[0], d[1], d[2]] }; });
    }, geo.flatMap(rec => Object.entries(rec.texts).map(([key, t]) => ({ key, w: rec.w, lang: rec.lang, x: t.x, y: t.y }))));
    await sampler.close();

    // attach contrast
    geo.forEach(rec => {
      rec.contrast = {};
      for (const [key, t] of Object.entries(rec.texts)) {
        const s = samples.find(z => z.key === key && z.w === rec.w && z.lang === rec.lang);
        rec.contrast[key] = { color: t.color, bg: s ? s.rgb : null, ratio: s ? ratioHexRGB(t.color, s.rgb) : null };
      }
    });
    await p.close();
    return geo;
  }

  for (const mode of ['built', 'canary-overflow', 'canary-clip']) {
    report.tiles.push(...await run(mode));
  }

  // delivery sheets: 320 and 393, EN+HE, dsf 2
  for (const wgt of [393, 320]) {
    const sp = await browser.newPage({ deviceScaleFactor: 2 });
    await sp.setContent(page([composition(wgt, 'en', 'built'), composition(wgt, 'he', 'built')]), { waitUntil: 'networkidle' });
    await sp.locator('body').screenshot({ path: `${OUT}/luxury-home-built-${wgt}.png` });
    report.sheetsWritten.push(`luxury-home-built-${wgt}.png`);
    await sp.close();
  }

  await browser.close();

  const built = report.tiles.filter(t => t.mode === 'built');
  const minContrast = (key) => Math.min(...built.map(t => t.contrast[key] ? t.contrast[key].ratio : 99));
  report.verdict = {
    built_no_hOverflow: built.every(t => !t.hOverflow),
    built_no_contentOverlap: built.every(t => !t.contentOverlap),
    fan_never_overlaps_poker: built.every(t => !t.fanOverlapsPoker),
    min_fanPokerGap: Math.min(...built.map(t => t.fanPokerGap)),
    chip_label_fits_all: built.every(t => !t.titleClipped && !t.subClipped && !t.pracClipped),
    no_goldHit: built.every(t => !t.goldHit),
    contrast_min: { caps: minContrast('caps'), poker: minContrast('poker'), suits: minContrast('suits'), royal: minContrast('royal'), tagline: minContrast('tagline'), ctitle: minContrast('ctitle'), ptext: minContrast('ptext') },
    contrast_all_pass: ['caps', 'poker', 'suits', 'royal', 'tagline', 'ctitle', 'ptext'].every(k => minContrast(k) >= 4.5),
    canary_overflow_caught: report.tiles.filter(t => t.mode === 'canary-overflow').some(t => t.titleClipped || t.hOverflow),
    canary_clip_caught: report.tiles.filter(t => t.mode === 'canary-clip').some(t => t.subClipped),
  };
  console.log(JSON.stringify(report.verdict, null, 2));
  console.log('CANARY', JSON.stringify(report.canary));
  require('fs').writeFileSync('/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad/luxury-report.json', JSON.stringify(report, null, 2));
})();
