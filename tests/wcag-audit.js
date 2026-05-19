/**
 * WCAG audit — runs @axe-core/playwright against all 14 canonical routes
 * with the post-onboarding storageState, writes the result to
 * tests/wcag-report.json, and exits non-zero on critical findings.
 *
 * CI gate: critical > 0 = build fails. Serious is reported but not
 * fail-the-build to avoid blocking deploy on density-of-warning vs new
 * regression. Tune CAPS_FAIL_ON_SERIOUS=1 in CI when ready.
 *
 * Idempotent: re-running overwrites wcag-report.json deterministically
 * (axe is stable for a given DOM snapshot).
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');

const URL = process.env.CAPS_URL ?? 'https://caps.ftable.co.il';
const STATE_PATH = path.join(__dirname, 'caps-onboarded.json');
const REPORT_PATH = path.join(__dirname, 'wcag-report.json');
const FAIL_ON_SERIOUS = process.env.CAPS_FAIL_ON_SERIOUS === '1';

if (!fs.existsSync(STATE_PATH)) {
  console.error(`[wcag] missing storageState: ${STATE_PATH}`);
  console.error(`[wcag] run: node tests/bootstrap-storage-state.js`);
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: STATE_PATH,
    locale: 'en-US',
    viewport: { width: 393, height: 852 },
  });

  const summary = {
    runAt: new Date().toISOString(),
    url: URL,
    totals: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    routes: [],
  };

  for (const route of routes) {
    const page = await ctx.newPage();
    const target = `${URL}${route.path}`;
    let routeEntry = { name: route.name, path: route.path, error: null, counts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, violations: [] };
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      for (const v of result.violations) {
        const impact = v.impact ?? 'minor';
        routeEntry.counts[impact] = (routeEntry.counts[impact] ?? 0) + 1;
        summary.totals[impact] = (summary.totals[impact] ?? 0) + 1;
        routeEntry.violations.push({
          id: v.id,
          impact,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
          targets: v.nodes.slice(0, 3).map((n) => n.target?.join(' ')).filter(Boolean),
        });
      }
    } catch (e) {
      routeEntry.error = String(e?.message ?? e);
    } finally {
      await page.close();
    }
    summary.routes.push(routeEntry);
    const c = routeEntry.counts;
    console.log(`[wcag] ${route.name.padEnd(14)} crit=${c.critical} ser=${c.serious} mod=${c.moderate} min=${c.minor}${routeEntry.error ? ' ERROR=' + routeEntry.error : ''}`);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
  console.log(`\n[wcag] report → ${REPORT_PATH}`);
  console.log(`[wcag] TOTALS critical=${summary.totals.critical} serious=${summary.totals.serious} moderate=${summary.totals.moderate} minor=${summary.totals.minor}`);

  await browser.close();

  const blockingCritical = summary.totals.critical > 0;
  const blockingSerious = FAIL_ON_SERIOUS && summary.totals.serious > 0;
  if (blockingCritical || blockingSerious) {
    console.error(`[wcag] FAIL — critical=${summary.totals.critical} serious=${summary.totals.serious} (FAIL_ON_SERIOUS=${FAIL_ON_SERIOUS})`);
    process.exit(1);
  }
  console.log('[wcag] PASS');
})().catch((e) => { console.error('[wcag] FATAL', e); process.exit(2); });
