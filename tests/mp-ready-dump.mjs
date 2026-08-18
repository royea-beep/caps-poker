/**
 * IS `READY` PRESENT OR ABSENT? — dump, do not locate.
 *
 * Three locator theories have now almost-worked. This answers the question from the DOM instead:
 * every leaf text node with its box, every data-testid with its count, and the hand-card count.
 * "selector matched" != "matched the right element" != "visible", so all three are reported.
 *
 *   BASE=https://caps.ftable.co.il node tests/mp-ready-dump.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[dump]', ...a);

async function boot(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  await p.goto(BASE + '/lobby/private', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  return p;
}

const DUMP = () => {
  const out = { leaves: [], testids: {}, ready: null };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.textContent || '').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out.leaves.push({ t: t.slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  }
  for (const el of document.querySelectorAll('[data-testid]')) {
    const id = el.getAttribute('data-testid');
    out.testids[id] = (out.testids[id] || 0) + 1;
  }
  // Is READY anywhere at all, at any visibility?
  const all = Array.from(document.querySelectorAll('*'));
  const hits = all.filter((e) => (e.textContent || '').trim() === 'READY');
  out.ready = hits.map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return { tag: e.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
  });
  return out;
};

const browser = await chromium.launch();
const A = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }));
const B = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }));
try {
  await A.getByLabel(/Create a 2-player private table/i).first().click();
  await sleep(3000);
  const code = (await A.getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => '') || '').trim();
  log('code =', code);
  const inp = B.getByLabel(/Enter a table code/i).first();
  await inp.fill(code);
  await B.getByLabel(/Join by code/i).first().click();
  log('joined; waiting for the game...');
  for (const p of [A, B]) {
    await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 60000 }).catch(() => {});
  }
  await sleep(6000);
  log('A url', A.url());

  const d = await A.evaluate(DUMP);
  console.log('--- TESTIDS ---');
  console.log(JSON.stringify(d.testids));
  console.log('--- READY ELEMENTS (exact text) ---');
  console.log(JSON.stringify(d.ready));
  console.log('--- LEAF TEXT NODES ---');
  for (const l of d.leaves) console.log(`  "${l.t}"  @${l.x},${l.y} ${l.w}x${l.h}`);
} finally {
  await browser.close();
}
