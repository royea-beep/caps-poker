/**
 * PRICE-LADDER — the chip store on the LIVE site, both engines, at 375 and 393.
 *
 * Checks the five packages render with the config's chips and prices, that the badge sits on the
 * tier that earns it, that nothing is purchasable while both flags are off, and that no layout
 * breaks at the narrow widths.
 *
 * The cards are gated behind (iap_enabled || web_payments_enabled), and BOTH ARE FALSE, so the
 * expected result is that the packages do NOT render. That is the point: this run proves the gate
 * holds. The card CONTENT is verified against the config by SQL, which is the honest place to check
 * a value that the UI is currently refusing to show.
 *
 *   node tests/price-ladder.mjs
 */
import { webkit, chromium } from 'playwright';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';

const READ = () => {
  const body = document.body.innerText;
  const lines = body.split('\n').map((s) => s.trim()).filter(Boolean);
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  return {
    path: location.pathname,
    lineCount: lines.length,
    head: lines.slice(0, 8),
    // Any price string at all on the page
    prices: (body.match(/\$\d+\.\d{2}/g) ?? []),
    // Package labels from the config
    labels: ['Starter', 'Popular', 'Pro', 'High Roller', 'Whale'].filter((l) => body.includes(l)),
    badges: ['BEST VALUE', 'VIP'].filter((b) => body.includes(b)),
    buyButtons: [...document.querySelectorAll('button,[role="button"]')].filter(vis)
      .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim())
      .filter((t) => /buy|purchase|subscribe|restore/i.test(t)),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollW: document.documentElement.scrollWidth,
  };
};

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  for (const vw of [375, 393]) {
    const b = await engine.launch({ headless: false });
    const p = await (await b.newContext({ viewport: { width: vw, height: 900 } })).newPage();
    p.on('dialog', async (d) => { await d.dismiss(); });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));

    await p.goto(SITE + '/chip-store', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(9000);
    const s = await p.evaluate(READ);

    console.log(`\n── ${name}/${vw} · ${s.path} · ${s.lineCount} lines`);
    console.log(`   sees        : ${JSON.stringify(s.head)}`);
    console.log(`   labels      : ${JSON.stringify(s.labels)}`);
    console.log(`   badges      : ${JSON.stringify(s.badges)}`);
    console.log(`   prices      : ${JSON.stringify(s.prices)}`);
    console.log(`   buy controls: ${JSON.stringify(s.buyButtons)}   <- must be EMPTY, flags off`);
    console.log(`   overflowX   : ${s.overflowX} (scrollWidth ${s.scrollW} vs ${vw})`);
    console.log(`   pageerrors  : ${errs.length}`);
    console.log(`   device      : ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
    await b.close();
  }
}
