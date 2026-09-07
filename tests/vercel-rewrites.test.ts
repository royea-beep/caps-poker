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

  it('landing.html keeps an explicit rewrite of its own', () => {
    expect(cfg.rewrites.some((r: any) => r.source === '/landing.html')).toBe(true);
  });
});
