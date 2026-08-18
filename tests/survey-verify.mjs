/**
 * Verify three survey claims by reading RENDERED strings, not source.
 *   1. /play "Practice vs bots · N boards" at 2P / 3P / 4P — is N the rule's board count?
 *   2. /cups — what a player can actually read, and whether anything is tappable.
 *   3. home — what renders the bare `10` between POKER and the tagline.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[sv]', ...a);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
try {
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(7000);

  // --- 3. the bare 10 on home: every short numeric leaf, with its ancestry ---
  const tens = await p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = (n.textContent || '').trim();
      if (/^\d{1,3}$/.test(t)) {
        const el = n.parentElement; const r = el.getBoundingClientRect();
        const chain = []; let c = el;
        for (let i = 0; i < 4 && c; i++, c = c.parentElement) chain.push(c.className || c.tagName);
        out.push({ t, y: Math.round(r.y), x: Math.round(r.x), fs: getComputedStyle(el).fontSize, chain: chain.join(' < ').slice(0, 120) });
      }
    }
    return out;
  });
  log('home numeric leaves:', JSON.stringify(tens));

  // --- 1. /play subtitle at each player count ---
  for (const n of [2, 3, 4]) {
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(3500);
    const btn = p.getByText(new RegExp(`^${n}P$`)).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(900); }
    await p.goto(BASE + '/play', { waitUntil: 'domcontentloaded' }); await sleep(3500);
    const line = await p.evaluate(() => {
      const L = document.body.innerText.split(String.fromCharCode(10)).find((x) => x.indexOf('Practice vs bots') >= 0);
      return L || null;
    }).catch(() => null);
    log(`/play at ${n}P ->`, line);
  }

  // --- 2. /cups ---
  await p.goto(BASE + '/cups', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  const cups = await p.evaluate(() => ({
    text: document.body.innerText.split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean),
    buttons: document.querySelectorAll('[role="button"],button').length,
    pressables: document.querySelectorAll('[tabindex]').length,
  }));
  log('/cups buttons:', cups.buttons, 'tabindex nodes:', cups.pressables);
  log('/cups text:', JSON.stringify(cups.text));
} finally { await b.close(); }
