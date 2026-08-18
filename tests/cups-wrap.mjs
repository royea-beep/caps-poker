/**
 * Does the cup condition line clip at 390 and 320? Wrapping to two rows is acceptable;
 * TRUNCATING mid-number is not — "Win 200 han…" tells a player nothing.
 * Checks scrollWidth > clientWidth (real overflow), not just visual overflow.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
try {
  for (const w of [390, 320]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 } });
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(6000);
    await p.goto(BASE + '/cups', { waitUntil: 'domcontentloaded' }); await sleep(4500);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('div,span')) {
        const t = (el.textContent || '').trim();
        if (/^Win \d+ hands/.test(t) && el.children.length === 0) {
          const cs = getComputedStyle(el);
          out.push({
            text: t,
            clipped: el.scrollWidth > el.clientWidth + 1,
            scrollW: el.scrollWidth, clientW: el.clientWidth,
            h: Math.round(el.getBoundingClientRect().height),
            lh: cs.lineHeight, overflow: cs.textOverflow,
          });
        }
      }
      return out;
    });
    console.log(`[wrap ${w}] rows=${rows.length}`);
    for (const r of rows) console.log(`  "${r.text}"  clipped=${r.clipped}  ${r.scrollW}/${r.clientW}px  h=${r.h}`);
    await p.close();
  }
} finally { await b.close(); }
