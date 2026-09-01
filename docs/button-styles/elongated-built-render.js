/* BUILD-ELONGATED-CHIP — faithful render + measure of the BUILT ChipButton.
 *
 * This mirrors the EXACT computed styles of components/ChipButton.tsx and the home layout
 * around it (content paddingH rs(20), chip marginH rs(16), the masthead above, the Challenge
 * link + cup pills below). All pixel values are computed with the SAME rf/rs/rv math as
 * utils/responsive.ts (BASE 393, FONT_SCALE 1.0 for iOS/web), so the mirror renders the built
 * component's real geometry — not a hand-eyeballed mockup.
 *
 * It is a RENDERED MIRROR of the built component (real Chromium pixels), NOT the app bundle and
 * NOT a device. Output: two sheets (393, 320) each with EN + HE tiles, plus a machine report.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/home/user/caps-poker/docs/button-styles';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ── responsive math, verbatim from utils/responsive.ts (FONT_SCALE 1.0) ────────
const BASE = 393;
const rv = (v, w) => Math.round(v * (w / BASE));
const rs = rv;
const rf = (v, min, max, w) => {
  const scaled = Math.round(v * (w / BASE) * 1.0);
  const lo = min !== undefined ? min : Math.round(v * 0.75);
  const hi = max !== undefined ? max : Math.round(v * 1.25);
  return Math.max(lo, Math.min(hi, scaled));
};

// ── WCAG contrast (label vs effective fill) ───────────────────────────────────
function lum(hex) {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map(i => parseInt(n.substr(i, 2), 16) / 255).map(v =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const MINT = '#4FD6A8', BRASS = '#C9A84C', INK = '#08130F', SUBINK = '#0A1A14', DARK = '#12211B';
const GOLD = '#FFD700'; // winner cue — must NOT appear on the button

// strings
const EN = { title: 'Play Online', sub: 'Real players · instant bot tables', prac: 'Practice vs bots' };
// HE: the i18n title 'שחק אונליין' + the longest realistic HE subtitle tested in ROUND-CHIP,
// and the practice label in Hebrew. This is the fit STRESS case (app currently ships EN).
const HE = { title: 'שחק אונליין', sub: 'מול שחקנים אמיתיים · שולחנות בוט', prac: 'אימון מול בוטים' };

// ── build one tile's HTML (the full home stack around the two chips) ──────────
function tile(w, lang, mode) {
  const S = lang === 'he' ? HE : EN;
  const rtl = lang === 'he';
  const titleFontSize = Math.min(126, Math.round(w * 0.30));
  const padH = rs(20, w);              // content paddingHorizontal
  const marginH = rs(16, w);           // primary chip marginHorizontal
  const radius = rv(60, w);
  const edgeInset = rs(6, w);
  const edgeWidth = rv(3, w);
  const bevelTop = rs(3, w), bevelBottom = rs(8, w);
  const chipW = w - 2 * padH - 2 * marginH;
  const pracW = Math.round(w * 0.64);

  // per-variant chip skin
  function chip(variant, inner) {
    const isP = variant === 'primary';
    const fill = isP ? MINT : DARK;
    const edge = isP ? BRASS : MINT;
    const minH = isP ? rv(72, w) : rv(52, w);
    const padV = isP ? rs(14, w) : rs(10, w);
    const cpadH = (isP ? rs(24, w) : rs(20, w)) + edgeInset;
    const gap = isP ? rs(12, w) : rs(8, w);
    const width = isP ? chipW : pracW;
    const mt = isP ? rs(12, w) : 0;
    return `<div class="chipwrap ${variant}" data-fill="${fill}" data-edge="${edge}"
        style="width:${width}px;margin-top:${mt}px;background:${fill};border-radius:${radius}px;
        box-shadow:0px ${rs(10, w)}px ${rs(22, w)}px rgba(0,0,0,.5);${isP ? '' : 'align-self:center;'}">
      <div class="chip" style="min-height:${minH}px;padding:${padV}px ${cpadH}px;gap:${gap}px;border-radius:${radius}px;">
        <div class="bevel" style="top:0;height:${bevelTop}px;border-top-left-radius:${radius}px;border-top-right-radius:${radius}px;background:rgba(255,255,255,.45)"></div>
        <div class="bevel" style="bottom:0;height:${bevelBottom}px;border-bottom-left-radius:${radius}px;border-bottom-right-radius:${radius}px;background:rgba(0,0,0,.2)"></div>
        <div class="rim" data-edge="${edge}" style="inset:${edgeInset}px;border-radius:${radius}px;border:${edgeWidth}px dashed ${edge};opacity:.85"></div>
        ${inner}
      </div>
    </div>`;
  }

  // primary inner: emoji · label column · chevron
  const emojiFS = rf(24, undefined, undefined, w);
  const titleFS = rf(19, undefined, undefined, w);
  const subFS = rf(12, undefined, undefined, w);
  const pracFS = rf(15, 12, 18, w);
  // canary planted defects
  const plantOverflow = mode === 'canary-overflow';
  const plantClip = mode === 'canary-clip';
  const titleText = plantOverflow ? (S.title + ' — VS REAL PLAYERS INSTANTLY NOW EXTRALONG') : S.title;

  const primaryInner = `
    <span class="emoji" style="font-size:${emojiFS}px">🎮</span>
    <div class="labelcol" style="flex:1 1 auto;min-width:0;${rtl ? 'text-align:right' : ''}">
      <div class="mtitle" style="color:${INK};font-size:${titleFS}px;font-weight:900;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titleText}</div>
      <div class="msub" style="color:${SUBINK};font-size:${subFS}px;font-weight:700;margin-top:${rs(1, w)}px;
        display:-webkit-box;-webkit-line-clamp:${plantClip ? 1 : 2};-webkit-box-orient:vertical;overflow:hidden;${plantClip ? `max-height:${subFS + 2}px;` : ''}">${S.sub}</div>
    </div>
    <span class="chev" style="color:${INK};font-size:${emojiFS}px;font-weight:900">${rtl ? '‹' : '›'}</span>`;

  const pracInner = `<div class="practext" style="color:${MINT};font-size:${pracFS}px;font-weight:800;letter-spacing:.8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%">${S.prac}</div>`;

  // pre-change control: the OLD rounded-rect button (rv16, minHeight 64, mint fill)
  const oldBtn = `<div class="oldbtn" style="width:${chipW}px;margin:${rs(12, w)}px 0 0 0;background:${MINT};border-radius:${rv(16, w)}px;min-height:64px;display:flex;flex-direction:row;align-items:center;gap:${rs(12, w)}px;padding:${rs(16, w)}px">
      <span style="font-size:${emojiFS}px">🎮</span>
      <div style="flex:1 1 auto;min-width:0;${rtl ? 'text-align:right' : ''}">
        <div class="mtitle" style="color:${INK};font-size:${titleFS}px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${S.title}</div>
        <div class="msub" style="color:${SUBINK};font-size:${subFS}px;font-weight:700;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${S.sub}</div>
      </div>
      <span style="color:${INK};font-size:${emojiFS}px;font-weight:900">${rtl ? '‹' : '›'}</span>
    </div>`;

  const body = mode === 'control-old'
    ? oldBtn
    : chip('primary', primaryInner) + chip('secondary', pracInner);

  const label = ({ built: 'ELONGATED CHIP (BUILT)', 'control-old': 'PRE-CHANGE CONTROL (old button)', 'canary-overflow': 'CANARY · planted overflow', 'canary-clip': 'CANARY · planted clip' })[mode] || mode;

  return `<div class="tile" data-w="${w}" data-lang="${lang}" data-mode="${mode}" style="width:${w}px" dir="${rtl ? 'rtl' : 'ltr'}">
    <div class="tilelabel">${label} · ${w}px · ${lang.toUpperCase()}</div>
    <div class="screen" style="width:${w}px">
      <div class="content" style="padding:${rs(8, w)}px ${padH}px ${rs(24, w)}px;gap:${rs(16, w)}px">
        <div class="masthead">
          <div class="suits" style="font-size:${rf(16, undefined, undefined, w)}px;letter-spacing:10px;opacity:.6">♠ ♥ ♦ ♣</div>
          <div class="caps" style="font-size:${titleFontSize}px;font-weight:900;letter-spacing:${rs(-3, w)}px;color:#C9A84C;line-height:1.02;text-shadow:0 0 24px rgba(0,0,0,.85)">CAPS</div>
          <div class="poker" style="font-size:${rf(13, undefined, undefined, w)}px;font-weight:600;letter-spacing:${rs(10, w)}px;color:#c9a84c;text-transform:uppercase">POKER</div>
          <div class="sub" style="font-size:${rf(13, undefined, undefined, w)}px;font-weight:600;letter-spacing:.2px;line-height:${rf(19, undefined, undefined, w)}px;color:#cfd8d2;padding:0 ${rs(18, w)}px;margin-top:${rs(8, w)}px;text-align:center">Four cards on every board. Every board plays at once. Win the most boards, win the hand.</div>
        </div>
        ${body}
        <div class="challenge" style="margin-top:${rs(10, w)}px;color:rgba(255,255,255,.6);font-size:${rf(13, undefined, undefined, w)}px;font-weight:600;text-align:center">⚔️ Challenge a Friend</div>
        <div class="cups" style="display:flex;flex-direction:row;justify-content:center;gap:${rs(8, w)}px;margin-top:${rs(8, w)}px">
          ${[0, 1, 2].map(i => `<div class="cuppill" style="width:${rs(36, w)}px;height:${rs(36, w)}px;border-radius:${rv(8, w)}px;background:rgba(255,255,255,.1)"></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function page(tiles) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    body{background:#111;padding:20px;display:flex;width:max-content;gap:24px;align-items:flex-start}
    .tile{background:#0a0a0a;border-radius:8px;overflow:hidden;border:1px solid #222}
    .tilelabel{background:#1a1a1a;color:#9fe;font-size:11px;font-weight:700;padding:6px 10px;letter-spacing:.5px}
    .screen{background:#0a0a0a}
    .content{display:flex;flex-direction:column;align-items:center}
    .masthead{display:flex;flex-direction:column;align-items:center;gap:2px}
    .chipwrap{position:relative}
    .chip{position:relative;display:flex;flex-direction:row;align-items:center;justify-content:center;overflow:hidden}
    .bevel{position:absolute;left:0;right:0}
    .rim{position:absolute;pointer-events:none}
    .emoji,.chev{flex:0 0 auto}
  </style></head><body>${tiles.join('')}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const report = { contrast: {}, canary: {}, tiles: [] };

  // ── contrast instrument + canary (re-verify BEFORE trusting a number) ──────
  report.contrast.ink_on_mint = +ratio(INK, MINT).toFixed(2);
  report.contrast.subink_on_mint = +ratio(SUBINK, MINT).toFixed(2);
  report.contrast.mint_on_dark = +ratio(MINT, DARK).toFixed(2);
  report.canary.mint_on_mint = +ratio(MINT, MINT).toFixed(2); // must be 1.00 → flagged
  report.canary.badFlagged = report.canary.mint_on_mint < 4.5;
  report.canary.goodPass = report.contrast.ink_on_mint >= 4.5;

  async function measure(mode) {
    const combos = [[393, 'en'], [393, 'he'], [320, 'en'], [320, 'he']];
    const tiles = combos.map(([w, l]) => tile(w, l, mode));
    const p = await browser.newPage({ deviceScaleFactor: 2 });
    await p.setContent(page(tiles), { waitUntil: 'networkidle' });
    const res = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('.tile').forEach(t => {
        const w = +t.dataset.w, lang = t.dataset.lang, mode = t.dataset.mode;
        const rec = { w, lang, mode };
        // horizontal overflow of the whole screen
        const scr = t.querySelector('.screen');
        rec.hOverflow = scr.scrollWidth > scr.clientWidth + 1;
        // title clip
        const title = t.querySelector('.mtitle');
        rec.titleClipped = title ? title.scrollWidth > title.clientWidth + 1 : false;
        // sub clip (rendered taller than box = truncated)
        const sub = t.querySelector('.msub');
        rec.subClipped = sub ? sub.scrollHeight > sub.clientHeight + 1 : false;
        // practice label clip
        const prac = t.querySelector('.practext');
        rec.pracClipped = prac ? prac.scrollWidth > prac.clientWidth + 1 : false;
        // goldHit: scan chip fills + rim borders for rgb(255,215,0)
        let goldHit = false;
        t.querySelectorAll('.chipwrap,.rim,.chip,.oldbtn').forEach(el => {
          const cs = getComputedStyle(el);
          [cs.backgroundColor, cs.borderColor, cs.borderTopColor].forEach(c => {
            if (c && c.replace(/\s/g, '') === 'rgb(255,215,0)') goldHit = true;
          });
        });
        rec.goldHit = goldHit;
        // collision: every stacked child's top >= previous child's bottom (no overlap)
        const content = t.querySelector('.content');
        const kids = [...content.children].filter(k => k.offsetHeight > 0);
        let minGap = 9999, overlap = false;
        for (let i = 1; i < kids.length; i++) {
          const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
          const gap = b.top - a.bottom;
          if (gap < -1) overlap = true;
          if (gap < minGap) minGap = gap;
        }
        rec.overlap = overlap;
        rec.minGapPx = Math.round(minGap);
        out.push(rec);
      });
      return out;
    });
    await p.close();
    // clean per-width sheets: a dedicated page with only that width's EN+HE tiles
    if (mode === 'built') {
      for (const wgt of [393, 320]) {
        const sp = await browser.newPage({ deviceScaleFactor: 2 });
        await sp.setContent(page([tile(wgt, 'en', 'built'), tile(wgt, 'he', 'built')]), { waitUntil: 'networkidle' });
        await sp.locator('body').screenshot({ path: `${OUT}/elongated-built-${wgt}.png` });
        await sp.close();
      }
    }
    return res;
  }

  for (const mode of ['built', 'control-old', 'canary-overflow', 'canary-clip']) {
    const r = await measure(mode);
    report.tiles.push(...r);
  }

  await browser.close();

  // ── verdicts ───────────────────────────────────────────────────────────────
  const built = report.tiles.filter(t => t.mode === 'built');
  const control = report.tiles.filter(t => t.mode === 'control-old');
  const canOv = report.tiles.filter(t => t.mode === 'canary-overflow');
  const canCl = report.tiles.filter(t => t.mode === 'canary-clip');

  report.verdict = {
    built_all_fit: built.every(t => !t.hOverflow && !t.titleClipped && !t.subClipped && !t.pracClipped),
    built_no_overlap: built.every(t => !t.overlap && t.minGapPx >= 0),
    built_no_gold: built.every(t => !t.goldHit),
    control_all_fit: control.every(t => !t.hOverflow && !t.titleClipped && !t.subClipped),
    // self-test: the planted defects MUST be caught
    canary_overflow_caught: canOv.some(t => t.titleClipped || t.hOverflow),
    canary_clip_caught: canCl.some(t => t.subClipped),
  };
  console.log(JSON.stringify(report, null, 2));
})();
