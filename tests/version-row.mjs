/**
 * Does the Settings Version row show a meaningful build on WEB?
 *
 * settings.tsx:1211 records that this row is the ONLY place a tester reads a build number. On
 * web it printed the abandoned `extra.buildNumber` (330) because `nativeBuildVersion` is null,
 * so the screen and the bug_report payload disagreed and every report needed a follow-up.
 *
 * Asserts the row matches the identifier getBuildIdentity() puts in telemetry, not just "not
 * 330" — a wrong-but-different value would pass that weaker check.
 *
 *   node tests/version-row.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20}, 900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${URL}/settings`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

let r;
try {
  r = await measure(page, `(() => {
    const t = document.body.innerText || '';
    const m = /\\(build ([^)]+)\\)/.exec(t);
    const s = document.querySelector('script[src*="/_expo/static/js/web/"]');
    const src = s ? s.getAttribute('src') : null;
    const bundle = src ? (/index-([a-f0-9]+)\\.js/.exec(src) || [])[1] : null;
    return { row: m ? m[1] : null, stale330: /\\(build 330\\)/.test(t), bundle, len: t.length };
  })()`, { label: 'ver' });
} catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

if (r.row === null) { console.error('VERSION ROW NOT FOUND — failed measurement, not a pass.'); process.exit(2); }
console.log(`viewport=${VW}  body text ${r.len} chars`);
console.log(`  Version row build value : ${JSON.stringify(r.row)}`);
console.log(`  still the stale 330?    : ${r.stale330}`);
console.log(`  live bundle hash        : ${r.bundle}`);
console.log(r.stale330 ? '  FAIL — still showing the abandoned extra.buildNumber.'
  : /^[0-9a-f]{7,8}$/.test(r.row) ? '  PASS — a real build identifier (sha or bundle hash).'
  : `  INCONCLUSIVE — "${r.row}" is neither 330 nor a hex identifier; check what it is.`);
