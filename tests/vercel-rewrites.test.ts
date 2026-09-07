/**
 * THE CATCH-ALL 404, checked rather than assumed.
 *
 * vercel.json used to end with `{ source: "/(.*)" } -> /index.html`, so ANY unmatched path came
 * back 200 with the app's HTML. A typo'd or deleted file looked like a working page, and that trap
 * twice made a stale or absent file read as "deployed".
 *
 * The rule now excludes any path containing a dot. This test pins both halves of that change:
 *   1. every route the app actually navigates to STILL matches (the SPA must not break), and
 *   2. a request for a file that does not exist NO LONGER matches, so Vercel 404s honestly.
 *
 * ⚠️ BOUNDARY, stated not hidden: this exercises the same regex in the same engine Vercel's
 * matcher compiles to, but not Vercel's path-to-regexp wrapper itself. The deployed behaviour is
 * confirmed by one command after the next web deploy:
 *     curl -s -o /dev/null -w '%{http_code}\n' https://caps.ftable.co.il/definitely-missing.html
 *   expect 404 (it returned 200 with 1,902 bytes of app HTML before this change).
 */
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const catchAll = cfg.rewrites[cfg.rewrites.length - 1];
// path-to-regexp compiles `/(<pattern>)` to `^/(<pattern>)$`; this is that expansion.
const inner = catchAll.source.replace(/^\/\(/, '').replace(/\)$/, '');
const re = new RegExp('^/(' + inner + ')$');

/** Every route grepped out of the app's own router calls. */
const SPA_ROUTES = [
  '/', '/achievements', '/cups', '/debug', '/game', '/gameover', '/hand-history',
  '/leaderboard', '/lobby', '/lobby/private', '/orientation-pick', '/rank', '/referral',
  '/results', '/settings', '/shop', '/simulate', '/stats', '/theme-pick',
  '/play', '/profile', '/friends', '/missions', '/coaching', '/battle-pass', '/replay',
  '/spectate', '/chip-store', '/multiplayer-game', '/heatmap', '/lobby/table',
];

const FILE_PATHS = [
  '/definitely-missing-abc123.html', '/landing.htm', '/Landing.html', '/index.js',
  '/robots.txt', '/favicon.ico', '/sitemap.xml', '/shots/game-boards-en.webp',
  '/_expo/static/js/web/index-deadbeef.js',
  // EMBED-THE-VIDEO 2026-09-07 — the brief names .html, .png and .mp4 by extension, and .png and
  // .mp4 were the two it named that this list did not actually cover. A missing poster or a missing
  // clip must 404 rather than hand back the app's HTML with a 200: that 200 is exactly what made an
  // absent file read as "deployed" twice before.
  // ⚠️ ONLY GENUINELY-MISSING NAMES BELONG HERE. The assertion is "the catch-all does not match",
  // which for a file that EXISTS means "the real file is served" — a true statement under a test
  // title that says 404. explainer-poster.webp is real, so it is asserted separately, below.
  '/shots/explainer-poster-missing.png', '/caps-explainer-FINAL.mp4',
  '/docs/explainers/01-home.mp4',
];

describe('vercel.json catch-all rewrite', () => {
  it('is the last rewrite and points at the SPA shell', () => {
    expect(catchAll.destination).toBe('/index.html');
  });

  it('no longer swallows every path (the "/(.*)"" trap is gone)', () => {
    expect(catchAll.source).not.toBe('/(.*)');
  });

  it.each(SPA_ROUTES)('SPA route %s still resolves to the app', (route) => {
    expect(re.test(route)).toBe(true);
  });

  it.each(FILE_PATHS)('file path %s falls through to a real 404', (p) => {
    expect(re.test(p)).toBe(false);
  });

  it('the app navigates to no route containing a dot, so nothing regresses', () => {
    expect(SPA_ROUTES.filter((r) => r.includes('.'))).toEqual([]);
  });

  // EMBED-THE-VIDEO 2026-09-07 — the landing page's poster is the one dotted path on this page that
  // MUST resolve. The rewrite exclusion means Vercel serves the static file, so the file has to be
  // there: a name is a claim about content, and this asserts the claim.
  it('the landing page poster it references is a real file on disk', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'landing.html'), 'utf-8');
    const m = html.match(/poster="([^"]+)"/);
    expect(m).not.toBeNull();
    const rel = m![1];
    expect(rel).not.toMatch(/^https?:/);       // the poster is ours, not a third party's
    expect(fs.existsSync(path.join(__dirname, '..', 'public', rel))).toBe(true);
    expect(catchAll.source).toBeDefined();
    expect(new RegExp(`^${catchAll.source.replace(/^\//, '/')}$`).test('/' + rel)).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // ⚠️ THE FILE THAT ACTUALLY SHIPS. Added 2026-09-07, after the live site was measured.
  //
  // Everything above this line reads the ROOT vercel.json. Production never does: the deploy step
  // runs `npx vercel --prod` from dist/, and scripts/fix-web-html.js writes dist/vercel.json. So
  // the 2026-09-03 catch-all fix — and this whole test file with it — was pinning a config that is
  // not served, while /nope.png went on returning 200 with the app's HTML for four days.
  //
  // These two tests are the ones that would have caught it: read the GENERATOR's source, and
  // require the shipped catch-all to be character-identical to the root one.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fix-web-html.js'), 'utf8');

  it('the vercel.json that SHIPS excludes dotted paths too', () => {
    const m = generator.match(/const CATCH_ALL_NO_DOTS = "(.*)";/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-eval
    const shipped: string = eval('"' + m![1] + '"');   // the JS string literal, as node builds it
    expect(shipped).toBe(catchAll.source);             // identical to the root config, character for character
    expect(generator).not.toMatch(/source: "\/\(\.\*\)", destination: "\/index\.html"/);
  });

  it('the shipped catch-all keeps every SPA route and drops every dotted path', () => {
    const m = generator.match(/const CATCH_ALL_NO_DOTS = "(.*)";/)!;
    // eslint-disable-next-line no-eval
    const shipped: string = eval('"' + m[1] + '"');
    const shippedRe = new RegExp('^' + shipped + '$');
    for (const r of SPA_ROUTES) expect([r, shippedRe.test(r)]).toEqual([r, true]);
    for (const f of FILE_PATHS) expect([f, shippedRe.test(f)]).toEqual([f, false]);
    // and the landing page's own poster, which must be served as a file rather than rewritten
    expect(shippedRe.test('/shots/explainer-poster.webp')).toBe(false);
  });

  it('landing.html keeps an explicit rewrite of its own', () => {
    expect(cfg.rewrites.some((r: any) => r.source === '/landing.html')).toBe(true);
  });
});
