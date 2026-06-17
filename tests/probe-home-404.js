/**
 * Probe caps.ftable.co.il/ for 404 responses (the 5 home-only failures the
 * QA council flagged). Lists each 404 URL + a heuristic likely-cause.
 */
const { chromium } = require('playwright');
const path = require('path');

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const STATE_PATH = path.join(__dirname, 'caps-onboarded.json');

function cause(u) {
  const s = u.toLowerCase();
  if (s.includes('favicon')) return 'favicon';
  if (s.includes('apple-touch') || s.includes('icon')) return 'app/touch icon';
  if (s.includes('manifest')) return 'web manifest';
  if (/\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/.test(s)) return 'missing image asset';
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(s)) return 'missing sound asset';
  if (/\.(woff2?|ttf|otf)(\?|$)/.test(s)) return 'missing font';
  if (/\.(js|hbs|hbc|map)(\?|$)/.test(s)) return 'missing JS chunk/sourcemap';
  if (/\.(css)(\?|$)/.test(s)) return 'missing stylesheet';
  return 'unknown';
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();
  const notFound = [];
  page.on('response', (res) => { if (res.status() === 404) notFound.push(res.url()); });

  await page.goto(SITE + '/', { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForTimeout(3000);
  await browser.close();

  const uniq = [...new Set(notFound)];
  console.log(`[404] ${uniq.length} unique 404 response(s) on home:\n`);
  for (const u of uniq) console.log(`  [${cause(u)}]  ${u}`);
  if (!uniq.length) console.log('  (none captured — may have been transient/cached)');
})().catch((e) => { console.error('[404] FATAL', e); process.exit(2); });
