/**
 * CHIP-STORE FORCED FAILURE — proves what deleting DEFAULT_PACKAGES actually did.
 *
 * The store is gated behind (iap_enabled || web_payments_enabled) and both are FALSE in
 * production, so the packages never render and the fallback path cannot be observed. Rather
 * than flip a payment flag — forbidden, and it would change production — this rewrites the
 * ONE config response in THIS BROWSER. Production is not touched: the override lives entirely
 * in the page, and every other request goes to the real backend unmodified.
 *
 * Two scenarios, same build:
 *   A  ladder fetch normal  -> five cards must render with the config's chips and prices
 *   B  ladder fetch FAILING -> the honest message must appear and there must be ZERO buy
 *      controls. Before this sprint a stale hardcoded ladder rendered here instead, whose
 *      package ids do not exist in app_config, so a player could be shown a price and then
 *      not be creditable.
 *
 *   ENGINE=webkit VIEWPORT=393 node tests/chip-store-forced.mjs
 */
import { webkit, chromium } from 'playwright';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const engineName = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 393);
const engine = engineName === 'chromium' ? chromium : webkit;

const READ = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const body = document.body.innerText;
  return {
    lines: body.split('\n').map((s) => s.trim()).filter(Boolean),
    labels: ['Starter', 'Popular', 'Pro', 'High Roller', 'Whale'].filter((l) => body.includes(l)),
    prices: body.match(/\$\d+\.\d{2}/g) ?? [],
    chipFigures: body.match(/\b\d{1,3}(,\d{3})+\b/g) ?? [],
    badges: ['BEST VALUE'].filter((b) => body.includes(b)),
    buyControls: [...document.querySelectorAll('button,[role="button"]')].filter(vis)
      .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim())
      .filter((t) => /buy|purchase|get |\$/i.test(t)),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
};

for (const scenario of ['A-ladder-ok', 'B-ladder-FORCED-FAIL']) {
  const b = await engine.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: VW, height: 900 } })).newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));

  await p.route('**/rest/v1/app_config*', async (route) => {
    const url = route.request().url();
    // Open the render gate for THIS PAGE ONLY. Production config is untouched.
    if (url.includes('web_payments_enabled')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: true }) });
    }
    // Scenario B: make the ladder unreadable, exactly as a real outage would.
    if (scenario.startsWith('B') && url.includes('chip_store_packages')) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'forced failure' }) });
    }
    return route.continue();
  });

  await p.goto(SITE + '/chip-store', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(9000);
  const s = await p.evaluate(READ);

  console.log(`\n══ ${engineName}/${VW} · ${scenario}`);
  console.log(`   text        : ${JSON.stringify(s.lines)}`);
  console.log(`   labels      : ${JSON.stringify(s.labels)}`);
  console.log(`   prices      : ${JSON.stringify(s.prices)}`);
  console.log(`   chip figures: ${JSON.stringify(s.chipFigures)}`);
  console.log(`   badges      : ${JSON.stringify(s.badges)}`);
  console.log(`   buy controls: ${JSON.stringify(s.buyControls)}`);
  console.log(`   overflowX   : ${s.overflowX}   pageerrors: ${errs.length}`);

  // Can a player reach checkout from here?
  if (s.buyControls.length) {
    await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
      .find(x=>/\$/.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) b.click();})()`);
    await p.waitForTimeout(3000);
    const after = await p.evaluate(() => ({ path: location.pathname, text: document.body.innerText.slice(0, 400) }));
    console.log(`   after tapping a pack -> ${after.path} :: ${JSON.stringify(after.text.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,6))}`);
  }
  console.log(`   device      : ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
  await b.close();
}
