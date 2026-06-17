/**
 * QA Council run — caps.ftable.co.il (web), 14 canonical routes.
 * Per route: navigate → screenshot → axe-core (WCAG) → console/pageerror capture
 * → crash-text scan → council verdict (PASS / DEGRADED / FAIL).
 * Uploads each screenshot to Supabase Storage bucket `screenshots` under
 * caps-2026-05-21-qa/, writes tests/qa-council-2026-05-21.json, prints a table.
 *
 * Reuses tests/routes.js + tests/caps-onboarded.json (onboarded storageState),
 * mirroring scripts/reality-check-screenshots.js + tests/wcag-audit.js.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const routes = require('./routes');

// --- load .env (only EXPO_PUBLIC_SUPABASE_* are consumed) ---
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch (_) {}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const DATE_TAG = '2026-05-21';
const FOLDER = `caps-${DATE_TAG}-qa`;
const STATE_PATH = path.join(__dirname, 'caps-onboarded.json');
const REPORT_PATH = path.join(__dirname, 'qa-council-2026-05-21.json');

if (!SUPABASE_KEY) { console.error('ERROR: no Supabase key in env'); process.exit(1); }
if (!fs.existsSync(STATE_PATH)) { console.error('ERROR: missing storageState ' + STATE_PATH); process.exit(2); }

const CRASH_PATTERNS = [
  'something went wrong', 'unexpected error', 'application error', 'unhandled',
  'cannot read propert', 'undefined is not', "can't find variable", 'is not a function',
  'render error', 'maximum update depth', 'this screen does not exist', 'unmatched route',
  'failed to compile', 'invariant violation',
];
// console errors that are benign web noise, not app failures
const BENIGN_CONSOLE = ['react devtools', 'favicon', 'manifest.json', 'apple-touch-icon', 'sourcemap', 'source map', '[expo]'];

function verdict(r) {
  const reasons = [];
  if (r.navError) reasons.push(`FAIL: navigation error — ${r.navError}`);
  if (r.pageErrors.length) reasons.push(`FAIL: ${r.pageErrors.length} uncaught JS error(s) — ${r.pageErrors[0].slice(0, 120)}`);
  if (r.crashHits.length) reasons.push(`FAIL: crash text — ${r.crashHits.join(', ')}`);
  if (r.bodyLen < 20 && !r.navError) reasons.push('FAIL: blank/empty render (<20 chars)');
  if (r.counts.critical > 0) reasons.push(`FAIL: ${r.counts.critical} axe critical`);
  if (reasons.length) return { verdict: 'FAIL', reasons };

  if (r.counts.serious > 0) reasons.push(`DEGRADED: ${r.counts.serious} axe serious`);
  if (r.appConsoleErrors.length) reasons.push(`DEGRADED: ${r.appConsoleErrors.length} app console error(s) — ${r.appConsoleErrors[0].slice(0, 120)}`);
  if (r.counts.moderate >= 8) reasons.push(`DEGRADED: high moderate count (${r.counts.moderate})`);
  if (reasons.length) return { verdict: 'DEGRADED', reasons };

  return { verdict: 'PASS', reasons: [`PASS: axe crit/ser=0, no uncaught/app-console errors, no crash text, rendered (${r.bodyLen} chars)`] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: STATE_PATH,
    locale: 'en-US',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });

  const summary = {
    runAt: new Date().toISOString(), site: SITE, folder: FOLDER,
    tally: { PASS: 0, DEGRADED: 0, FAIL: 0 },
    totals: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    routes: [],
  };

  for (const route of routes) {
    const target = `${SITE}${route.path}`;
    const consoleErrors = [];
    const pageErrors = [];
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)));

    const r = {
      name: route.name, path: route.path, url: null,
      navError: null, pageErrors, consoleErrors, appConsoleErrors: [],
      crashHits: [], bodyLen: 0,
      counts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, violations: [],
    };

    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2800);

      // screenshot + upload
      const localPath = path.join(outDir, `${route.name}.png`);
      await page.screenshot({ path: localPath, fullPage: false });
      const buf = fs.readFileSync(localPath);
      const storagePath = `${FOLDER}/${route.name}.png`;
      const { error: upErr } = await sb.storage.from('screenshots').upload(storagePath, buf, { contentType: 'image/png', upsert: true });
      r.url = upErr ? null : `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
      if (upErr) r.uploadError = upErr.message;

      // crash text scan
      const body = (await page.evaluate(() => document.body?.innerText || '')).toLowerCase();
      r.bodyLen = body.length;
      r.crashHits = CRASH_PATTERNS.filter((p) => body.includes(p));

      // axe
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of res.violations) {
        const impact = v.impact ?? 'minor';
        r.counts[impact] = (r.counts[impact] ?? 0) + 1;
        summary.totals[impact] = (summary.totals[impact] ?? 0) + 1;
        r.violations.push({ id: v.id, impact, help: v.help, nodes: v.nodes.length });
      }
    } catch (e) {
      r.navError = String(e?.message ?? e);
    } finally {
      await page.close();
    }

    r.appConsoleErrors = consoleErrors.filter((t) => !BENIGN_CONSOLE.some((b) => t.toLowerCase().includes(b)));
    const v = verdict(r);
    r.verdict = v.verdict; r.reasons = v.reasons;
    summary.tally[v.verdict]++;
    summary.routes.push(r);

    const c = r.counts;
    console.log(`[qa] ${route.name.padEnd(13)} ${v.verdict.padEnd(9)} crit=${c.critical} ser=${c.serious} mod=${c.moderate} pageErr=${pageErrors.length} appCon=${r.appConsoleErrors.length} crash=${r.crashHits.length} -> ${r.url ? 'uploaded' : 'UPLOAD-FAIL'}`);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
  await browser.close();

  const t = summary.tally;
  const aggregate = t.FAIL > 0 ? 'FAIL' : (t.DEGRADED > 0 ? 'DEGRADED' : 'PASS');
  console.log(`\n[qa] TALLY  PASS=${t.PASS} DEGRADED=${t.DEGRADED} FAIL=${t.FAIL}  (of ${summary.routes.length})`);
  console.log(`[qa] AXE TOTALS critical=${summary.totals.critical} serious=${summary.totals.serious} moderate=${summary.totals.moderate} minor=${summary.totals.minor}`);
  console.log(`[qa] AGGREGATE VERDICT = ${aggregate}`);
  console.log(`[qa] report → ${REPORT_PATH}`);
})().catch((e) => { console.error('[qa] FATAL', e); process.exit(2); });
