/**
 * Does this WebKit build actually support flex `gap` in ROW direction?
 *
 * The proposed fix touches 295 gap sites. That is far too large a change to make on an
 * unverified premise, so this tests the engine capability directly with a minimal page — no
 * app, no framework, nothing that could confound it.
 *
 * Three cases per engine: row gap, column gap, and a control with explicit margins. If gap
 * works, the gapped row is WIDER than the ungapped one by exactly the gap total.
 *
 * ALSO reports the engine's own opinion via CSS.supports, and the WebKit version — because
 * Playwright's WebKit on Windows is NOT Safari. Flex gap shipped in Safari 14.1 (2021), so
 * "row gap unsupported" would be surprising for any current build, and if this is a
 * Playwright-build artefact then the 295-site change would be fixing a phantom that no iPhone
 * user ever sees.
 *
 *   node tests/gap-capability.mjs
 */
import { chromium, webkit } from 'playwright';

const HTML = `<!doctype html><html><body style="margin:0">
  <div id="rowgap"  style="display:flex;flex-direction:row;gap:20px">
    <div style="width:50px;height:20px;background:#f00"></div>
    <div style="width:50px;height:20px;background:#0f0"></div>
    <div style="width:50px;height:20px;background:#00f"></div>
  </div>
  <div id="rownogap" style="display:flex;flex-direction:row">
    <div style="width:50px;height:20px;background:#f00"></div>
    <div style="width:50px;height:20px;background:#0f0"></div>
    <div style="width:50px;height:20px;background:#00f"></div>
  </div>
  <div id="colgap" style="display:flex;flex-direction:column;gap:20px;width:60px">
    <div style="height:20px;background:#f00"></div>
    <div style="height:20px;background:#0f0"></div>
    <div style="height:20px;background:#00f"></div>
  </div>
  <div id="colnogap" style="display:flex;flex-direction:column;width:60px">
    <div style="height:20px;background:#f00"></div>
    <div style="height:20px;background:#0f0"></div>
    <div style="height:20px;background:#00f"></div>
  </div>
</body></html>`;

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const browser = await engine.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 500, height: 400 } })).newPage();
  await page.setContent(HTML);
  await page.waitForTimeout(300);
  const r = await page.evaluate(`(() => {
    const w = (id) => Math.round(document.getElementById(id).getBoundingClientRect().width);
    const h = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
    const kidLefts = [...document.getElementById('rowgap').children].map((c) => Math.round(c.getBoundingClientRect().left));
    return { rowGapW: w('rowgap'), rowNoGapW: w('rownogap'),
             colGapH: h('colgap'), colNoGapH: h('colnogap'),
             kidLefts,
             supportsGap: (window.CSS && CSS.supports) ? CSS.supports('gap', '20px') : null,
             supportsRowGap: (window.CSS && CSS.supports) ? CSS.supports('column-gap', '20px') : null,
             ua: navigator.userAgent };
  })()`);
  const rowDelta = r.rowGapW - r.rowNoGapW;
  const colDelta = r.colGapH - r.colNoGapH;
  console.log(`\n=== ${name}  (v${browser.version()}) ===`);
  console.log(`  ROW    gapped ${r.rowGapW}px vs ungapped ${r.rowNoGapW}px  -> delta ${rowDelta}px (expect 40)  ${rowDelta === 40 ? 'GAP WORKS' : '*** GAP IGNORED ***'}`);
  console.log(`  COLUMN gapped ${r.colGapH}px vs ungapped ${r.colNoGapH}px  -> delta ${colDelta}px (expect 40)  ${colDelta === 40 ? 'GAP WORKS' : '*** GAP IGNORED ***'}`);
  console.log(`  row children lefts: ${JSON.stringify(r.kidLefts)}  (expect 0, 70, 140)`);
  console.log(`  CSS.supports('gap','20px') = ${r.supportsGap} | ('column-gap','20px') = ${r.supportsRowGap}`);
  console.log(`  UA: ${r.ua.slice(0, 120)}`);
  await browser.close();
}
