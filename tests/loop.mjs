/**
 * THE LOOP — the render-and-measure gate this series runs after every visual change.
 *
 * It exists because a claim is not evidence (Iron Rule 14). Everything below is measured in a real
 * browser against a real `expo export`, at four phone widths, in TWO independent engines.
 *
 * ── CANARY FIRST, ALWAYS ─────────────────────────────────────────────────────────────────────
 * Before a single number from the app is trusted, the instrument measures a page of PLANTED
 * DEFECTS and asserts that every one of its own detectors fires:
 *   · a low-contrast label that MUST be flagged, beside a high-contrast one that MUST NOT
 *   · a 3000px element that MUST trip the horizontal-overflow detector
 *   · an overflow:hidden box cutting a long child, which MUST trip the clip detector
 *   · a 24px control that MUST trip the 44pt touch-target floor
 *   · a button painted #FFD700 that MUST trip the gold-on-controls detector, beside a mint one
 *     that MUST NOT
 * If any detector fails to fire, the run ABORTS and reports nothing about the app. A canary that
 * cannot fail has caught four tools in this series, including one canary.
 *
 * ── WHAT "GOLD ON CONTROLS" MEANS ────────────────────────────────────────────────────────────
 * #FFD700 is the WINNER cue (components/Card.tsx). A control wearing it competes with the one
 * signal the player must read instantly. The detector reads COMPUTED styles, so it sees the
 * shipped pixels rather than the source, and it matches the rgb triple at ANY alpha — an
 * rgba(255,215,0,0.12) fill is the same cue at lower volume.
 *
 *   node tests/loop.mjs /tmp/webloop docs/last-three/loop
 */
import { chromium, webkit } from 'playwright';
import { serve } from '../tools/content-lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.argv[2] || '/tmp/webloop';
const OUT = process.argv[3] || 'docs/last-three/loop';
const PORT = Number(process.env.PORT || 8991);
const WIDTHS = [320, 375, 393, 430];
const SCREENS = [
  { id: 'home', path: '/' },
  { id: 'play', path: '/play' },
  { id: 'settings', path: '/settings' },
  { id: 'theme-pick', path: '/theme-pick' },
];

fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// The detectors. One copy, injected into both the canary page and the app, so the canary proves
// the SAME code that measures the app.
// ---------------------------------------------------------------------------------------------
const DETECTORS = () => {
  const GOLD_TRIPLE = [255, 215, 0];
  const rgb = (s) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s || '');
    return m ? [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])] : null;
  };
  const alpha = (s) => {
    const m = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(s || '');
    return m ? +m[1] : 1;
  };
  const isGold = (s) => {
    const c = rgb(s);
    if (!c || alpha(s) === 0) return false;
    return Math.abs(c[0] - GOLD_TRIPLE[0]) <= 6 && Math.abs(c[1] - GOLD_TRIPLE[1]) <= 10 && Math.abs(c[2] - GOLD_TRIPLE[2]) <= 12;
  };
  const lum = (c) => {
    const f = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => { const [l, d] = [lum(a), lum(b)].sort((x, y) => y - x); return (l + 0.05) / (d + 0.05); };
  const effectiveBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (rgb(c) && alpha(c) > 0.6) return rgb(c);
      n = n.parentElement;
    }
    return [10, 10, 10];
  };
  const controls = () => Array.from(document.querySelectorAll(
    'button, a[href], [role="button"], [role="radio"], [role="switch"], [role="link"], [role="tab"], [tabindex]:not([tabindex="-1"])'
  ));
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-testid') || (el.innerText || '').trim().slice(0, 40) || '(unnamed)');

  return {
    // 1. horizontal overflow of the page itself
    overflow() {
      const sw = document.documentElement.scrollWidth;
      const iw = window.innerWidth;
      return { scrollWidth: sw, innerWidth: iw, overflows: sw > iw + 1 };
    },
    // 2. content clipped inside an overflow:hidden box
    clips() {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'hidden' && cs.overflow !== 'hidden') continue;
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40), scrollW: el.scrollWidth, clientW: el.clientWidth, text: (el.innerText || '').trim().slice(0, 40) });
        }
      }
      return out.slice(0, 25);
    },
    // 3. touch targets under the 44pt floor
    under44() {
      return controls().map((el) => { const r = el.getBoundingClientRect(); return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((c) => c.h > 0 && c.h < 44).slice(0, 25);
    },
    // 4. text contrast below WCAG AA
    contrast() {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        if (!el.childNodes.length) continue;
        const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
        if (txt.length < 2) continue;
        const cs = getComputedStyle(el);
        const fg = rgb(cs.color);
        if (!fg || alpha(cs.color) < 0.5) continue;
        const r = ratio(fg, effectiveBg(el));
        const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
        const need = big ? 3 : 4.5;
        if (r < need) out.push({ text: txt.slice(0, 34), fg: cs.color, ratio: +r.toFixed(2), need });
      }
      return out.slice(0, 25);
    },
    // 5. THE WINNER CUE ON A CONTROL
    goldControls() {
      return controls().map((el) => {
        const cs = getComputedStyle(el);
        const where = [];
        if (isGold(cs.backgroundColor)) where.push('background');
        if (isGold(cs.borderTopColor) || isGold(cs.borderLeftColor)) where.push('border');
        if (isGold(cs.color)) where.push('text');
        // a control's own text lives in child nodes under RN-Web
        for (const t of el.querySelectorAll('*')) if (isGold(getComputedStyle(t).color)) { where.push('childText'); break; }
        return where.length ? { label: label(el), where: Array.from(new Set(where)) } : null;
      }).filter(Boolean);
    },
    controlCount() { return controls().length; },
  };
};

// ---------------------------------------------------------------------------------------------
// The canary page — every planted defect the detectors must catch.
// ---------------------------------------------------------------------------------------------
const CANARY_HTML = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0a0a0a;color:#f0ead6;font:14px system-ui">
<p id=good style="color:#f0ead6;background:#0a0a0a">high contrast label</p>
<p id=bad  style="color:#2a2a2a;background:#0a0a0a">low contrast label</p>
<div style="width:3000px;height:8px;background:#333"></div>
<div style="width:40px;overflow:hidden;white-space:nowrap">a very long child that is definitely wider than forty pixels</div>
<button id=small style="height:24px">tiny</button>
<button id=goldbtn style="background:#FFD700;color:#000;height:48px">GOLD CONTROL</button>
<button id=mintbtn style="background:rgba(79,214,168,0.12);border:1px solid #4FD6A8;color:#4FD6A8;height:48px">MINT CONTROL</button>
</body>`;

async function runCanary(ctx) {
  const page = await ctx.newPage();
  await page.setContent(CANARY_HTML);
  const d = await page.evaluate(`(${DETECTORS.toString()})()`);
  const r = await page.evaluate(`(() => { const D = (${DETECTORS.toString()})(); return {
      overflow: D.overflow(), clips: D.clips(), under44: D.under44(), contrast: D.contrast(), gold: D.goldControls() }; })()`);
  await page.close();

  const checks = {
    overflow_caught: r.overflow.overflows === true,
    clip_caught: r.clips.length >= 1,
    under44_caught: r.under44.some((c) => c.label.includes('tiny')),
    contrast_flagged_bad: r.contrast.some((c) => c.text.startsWith('low contrast')),
    contrast_passed_good: !r.contrast.some((c) => c.text.startsWith('high contrast')),
    gold_caught: r.gold.some((g) => g.label.includes('GOLD')),
    mint_not_caught: !r.gold.some((g) => g.label.includes('MINT')),
  };
  return { checks, ok: Object.values(checks).every(Boolean), raw: r };
}

// ---------------------------------------------------------------------------------------------
const server = await serve(DIST, PORT);
const report = { dist: DIST, ts: new Date().toISOString(), engines: {} };
let aborted = null;

// The container's installed browser revisions do not match this playwright build's expected ones
// (it looks for chromium-1217 / chrome-headless-shell; only 1194 and webkit-2272 are present), so
// each engine is launched from the binary that actually exists. Overridable via env.
const EXE = {
  chromium: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  webkit: process.env.CAPS_WEBKIT || null,   // webkit resolves its own pw_run.sh correctly
};

for (const [name, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch(EXE[name] ? { executablePath: EXE[name] } : {});
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US' });
  await ctx.route('**/*supabase.co/**', (r) => r.abort());
  await ctx.route('**/*ftable.co.il/**', (r) => r.abort());

  const canary = await runCanary(ctx);
  report.engines[name] = { canary, widths: {} };
  console.log(`\n=== ${name} — CANARY ===`);
  for (const [k, v] of Object.entries(canary.checks)) console.log(`   ${v ? 'PASS' : 'FAIL'}  ${k}`);
  if (!canary.ok) { aborted = `${name} canary failed`; await browser.close(); break; }

  for (const w of WIDTHS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 852 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.addInitScript(() => {
      try { localStorage.setItem('caps-device-id', 'LOOP-PROBE'); localStorage.setItem('has_seen_interactive_tutorial', 'true'); } catch (_) {}
    });
    report.engines[name].widths[w] = {};
    for (const s of SCREENS) {
      await page.goto(`http://localhost:${PORT}${s.path}`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const r = await page.evaluate(`(() => { const D = (${DETECTORS.toString()})(); return {
          controls: D.controlCount(), overflow: D.overflow(), clips: D.clips(),
          under44: D.under44(), contrast: D.contrast(), gold: D.goldControls() }; })()`);
      const shot = `${s.id}-${w}-${name}.png`;
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      report.engines[name].widths[w][s.id] = { ...r, shot, pageErrors: errs.splice(0) };
      const bad = r.gold.length + (r.overflow.overflows ? 1 : 0);
      console.log(`   ${name} ${w} ${s.id.padEnd(11)} controls=${String(r.controls).padStart(2)} gold=${r.gold.length} overflow=${r.overflow.overflows} clips=${r.clips.length} under44=${r.under44.length} contrast=${r.contrast.length}${bad ? '   <-- LOOK' : ''}`);
    }
    await page.close();
  }
  await browser.close();
}

server.close();
fs.writeFileSync(path.join(OUT, 'loop.json'), JSON.stringify(report, null, 1));

// ---- verdict --------------------------------------------------------------------------------
console.log('\n=== VERDICT ===');
if (aborted) { console.log('ABORTED:', aborted); process.exit(1); }
let goldTotal = 0, overflowTotal = 0;
for (const [eng, e] of Object.entries(report.engines))
  for (const [w, ws] of Object.entries(e.widths))
    for (const [sid, s] of Object.entries(ws)) {
      goldTotal += s.gold.length;
      if (s.overflow.overflows) { overflowTotal++; console.log(`  overflow: ${eng} ${w} ${sid}`); }
      for (const g of s.gold) console.log(`  GOLD ON CONTROL: ${eng} ${w} ${sid} -> ${g.label} (${g.where.join('+')})`);
    }
console.log(`gold-on-controls across ${Object.keys(report.engines).length} engines x ${WIDTHS.length} widths x ${SCREENS.length} screens: ${goldTotal}`);
console.log(`horizontal overflow: ${overflowTotal}`);
console.log(`written: ${path.join(OUT, 'loop.json')}`);
