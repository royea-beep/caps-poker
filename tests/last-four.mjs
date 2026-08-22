/**
 * Measure four things that were changed or asserted without being seen.
 *  1. /profile on a fresh device — what the stat cards actually read
 *  2. /shop at 390 and 320 — is the new earn-hint on screen, clipped, legible
 *  3. /shop touch targets — CONTAINERS, deduped, with hitSlop noted
 *  4. the three profile sub-screens
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[l4]', ...a);
const b = await chromium.launch();
try {
  // 1 + 4 — fresh context so nothing is persisted
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c1.newPage();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(7000);
  await p.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  const prof = await p.evaluate(() => document.body.innerText.split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).slice(0, 22));
  log('PROFILE:', JSON.stringify(prof));

  for (const route of ['/achievements', '/hand-history', '/stats']) {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(3000);
    const t = await p.evaluate(() => document.body.innerText.split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).slice(0, 10));
    log(`SUB ${route} -> ${p.url().split('/').pop()} :: ${JSON.stringify(t)}`);
  }
  await c1.close();

  // 2 + 3 — shop
  for (const w of [390, 320]) {
    const c = await b.newContext({ viewport: { width: w, height: 844 } });
    const q = await c.newPage();
    await q.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(6000);
    await q.goto(BASE + '/shop', { waitUntil: 'domcontentloaded' }); await sleep(4000);
    const hint = await q.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div,span')).find(e => e.children.length===0 && /Chips come from playing/.test(e.textContent||''));
      if (!el) return null;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { text: el.textContent.trim(), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               clipped: el.scrollWidth > el.clientWidth + 1, fs: cs.fontSize, visible: r.height > 0 && r.width > 0 };
    });
    log(`SHOP ${w} hint:`, JSON.stringify(hint));
    if (w === 390) {
      const small = await q.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('[role="button"],button,[tabindex]'));
        const seen = [], out = [];
        for (const e of nodes) {
          if (seen.some(s => s.contains(e) || e.contains(s))) continue;   // dedupe nested
          seen.push(e);
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 44 || r.width < 44) out.push({ label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0,34), w: Math.round(r.width), h: Math.round(r.height) });
        }
        return { total: nodes.length, small: out };
      });
      log('SHOP targets:', JSON.stringify(small));
    }
    await c.close();
  }
} finally { await b.close(); }
