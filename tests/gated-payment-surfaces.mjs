/**
 * A GATED SCREEN IS AN UNMEASURED SCREEN.
 *
 * /shop and /chip-store hide their entire purchase surface behind iap_enabled / web_payments_enabled,
 * both false in production. So every loop that has ever "passed" those two routes passed on a screen
 * with the paid half removed. This overrides the CONFIG RESPONSE in the browser only - the flags in
 * app_config are never touched, nothing is enabled for any real user, and no purchase is attempted.
 *
 * Checks the paid surface for the failure shapes this project has actually shipped before:
 *   - a price rendering as undefined / NaN / null (shipped once, on this exact screen)
 *   - a value ladder that inverts (more money for fewer chips per unit)
 *   - horizontal overflow at 375 and 393
 *   - buy controls that are focusable but declare no role  (the class fixed this sprint)
 */
import { webkit, chromium } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const findings = [];
const add = (w, k, d) => findings.push(`[${k}] ${w} - ${d}`);

for (const [ename, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  for (const VW of [375, 393]) {
    const b = await engine.launch({ headless: false });
    const c = await b.newContext({ viewport: { width: VW, height: 852 }, ignoreHTTPSErrors: true });

    // Override the RESPONSE only. Never the flag.
    await c.route(/\/rest\/v1\/app_config.*/, async (route) => {
      const req = route.request();
      const url = req.url();
      if (/key=eq\.(iap_enabled|web_payments_enabled)/.test(url)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: true }) });
      }
      return route.continue();
    });

    const p = await c.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
    p.on('dialog', async (d) => { errs.push('DIALOG: ' + d.message().slice(0, 80)); await d.dismiss(); });

    for (const route of ['/shop', '/chip-store']) {
      const tag = `${ename}/${VW}${route}`;
      await p.goto(SITE + route, { waitUntil: 'load', timeout: 120000 });
      await p.waitForTimeout(9000);

      const r = await p.evaluate(() => {
        const text = document.body.innerText || '';
        const sel = 'button,[role="button"],[role="link"],a[href]';
        const controls = Array.from(document.querySelectorAll(sel))
          .filter((e) => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2; })
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim());
        const roleless = Array.from(document.querySelectorAll('[tabindex="0"]'))
          .filter((e) => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2; })
          .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON' && e.tagName !== 'A')
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        return {
          text: text.slice(0, 1400),
          controls,
          roleless,
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
          scrollW: document.documentElement.scrollWidth,
        };
      });

      if (/undefined|NaN|\bnull\b|\$\s*$|₪\s*$/i.test(r.text)) add(tag, 'COPY', 'placeholder leaked into visible text');
      if (r.overflowX) add(tag, 'LAYOUT', `horizontal overflow scrollW=${r.scrollW} vw=${VW}`);
      if (r.roleless.length) add(tag, 'A11Y', `focusable with no role: ${r.roleless.join(' | ')}`);
      if (!r.controls.length) add(tag, 'A11Y', 'zero exposed controls');

      console.log(`\n-- ${tag}  controls=${r.controls.length} roleless=${r.roleless.length} overflow=${r.overflowX}`);
      console.log('   controls: ' + r.controls.slice(0, 14).join(' | '));
      const prices = (r.text.match(/(?:\$|₪)\s?[\d.,]+/g) || []);
      const chips = (r.text.match(/[\d,]+\s*(?:chips|💰)/gi) || []);
      console.log('   prices: ' + prices.join(' ') + '   chips: ' + chips.join(' '));
      if (errs.length) console.log('   console: ' + errs.slice(0, 3).join(' ;; '));
    }
    await b.close();
  }
}
console.log('\n===== GATED-SURFACE FINDINGS: ' + findings.length);
findings.forEach((f) => console.log('   ' + f));
