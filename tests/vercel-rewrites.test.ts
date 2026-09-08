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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // ⚠️ vercel.json IS JSON. IT HAS NO COMMENTS, AND VERCEL REJECTS THE WHOLE FILE FOR ONE.
  //
  // STOP-THE-VERCEL-BLEED 2026-09-08. The 2026-09-03 catch-all commit added a `_comment_rewrites`
  // array to this file to explain the change. JSON has no comment syntax, so that was a real
  // property — and Vercel validates vercel.json against a CLOSED schema BEFORE it runs the
  // project's Ignored Build Step. Every Git-integration deploy from that commit onward died at:
  //
  //     The `vercel.json` schema validation failed with the following message:
  //     should NOT have additional property `_comment_rewrites`
  //
  // 29 of 40 deploys in one 21.7-hour window. The skip that this project's Ignored Build Step had
  // been performing correctly for weeks (state CANCELED, errorLink -> the ignored-build-step docs)
  // could not run, because validation comes first. A red dashboard for five days, from prose.
  //
  // The prose was not even needed: scripts/fix-web-html.js — the file that ACTUALLY ships, and
  // which is JavaScript — already carries the same explanation in a real comment. Put commentary
  // there. This file gets data only.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it('the root vercel.json carries no key Vercel would reject', () => {
    // Vercel's documented top-level properties. A key outside this set fails the deploy.
    const ALLOWED = new Set([
      'alias', 'build', 'buildCommand', 'cleanUrls', 'crons', 'devCommand', 'env', 'framework',
      'functionFailoverRegions', 'functions', 'git', 'headers', 'ignoreCommand', 'images',
      'installCommand', 'name', 'outputDirectory', 'public', 'redirects', 'regions',
      'relatedProjects', 'rewrites', 'routes', 'scope', 'trailingSlash', 'version',
    ]);
    const keys = Object.keys(cfg);
    // Named explicitly so the failure message says WHICH key, not just "some key".
    expect(keys.filter((k) => k.startsWith('_'))).toEqual([]);
    expect(keys.filter((k) => !ALLOWED.has(k))).toEqual([]);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // CLOSE-THE-THREE 2026-09-08 — THE WARNING LIVES IN THE FILE A PERSON OPENS.
  //
  // The generator has carried "the root vercel.json is never read in prod" in a real comment since
  // 2026-08-15. It did not stop the 404 fix going into the root file on 2026-09-03, and it did not
  // stop me repeating the mistake. A note BESIDE a trap is not a label ON it.
  //
  // But this file is JSON: it has no comment syntax, and Vercel rejects the whole file for an
  // unknown top-level key — which is the outage that started all of this. So the warning goes in
  // the only place that is both schema-legal and impossible to miss: the VALUE of installCommand,
  // the file's first key. It is a legal string in a legal field, not a new property, so the closed
  // schema is untouched — and it prints into the build log of any deploy that ever does use this
  // config, which is the exact moment somebody needs to read it.
  //
  // ⚠️ THE FILE IS KEPT, NOT DELETED, and the reason is checkable rather than sentimental: its
  // buildCommand is a WORKING build of this app (scripts/fix-web-html.js accepts both dist/ and
  // web-dist/, so the export and the patch agree), which is what a Git-integration deploy would
  // fall back on if the project Ignored Build Step were ever switched off. Deleting it would swap
  // a five-day-old trap for a silent zero-config deploy of the repository root onto the production
  // domain. Labelled beats absent.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  describe('the root vercel.json labels itself', () => {
    const install: string = cfg.installCommand;

    it('still installs — the warning must not have replaced the actual work', () => {
      expect(install.endsWith('npm install')).toBe(true);
    });

    it('carries the warning, naming the generator and the file production really serves', () => {
      expect(install).toMatch(/PRODUCTION NEVER READS IT/);
      expect(install).toMatch(/scripts\/fix-web-html\.js/);
      expect(install).toMatch(/NEVER ADD A COMMENT KEY HERE/);
    });

    it('is the FIRST key, so the warning is the first thing the file says', () => {
      expect(Object.keys(cfg)[0]).toBe('installCommand');
    });

    it('is a shell string that cannot break on a stray quote', () => {
      // The value is built from echo "..." segments. A single quote or a backtick inside would
      // change how /bin/sh parses it and could turn the install step into a syntax error — a
      // config-file comment taking down deploys a second time, by a different mechanism.
      expect(install).not.toMatch(/['`$\\]/);
    });
  });

  it('the shipped vercel.json is built from an object literal, so it cannot carry one either', () => {
    // dist/vercel.json is JSON.stringify'd from a literal in the generator: a JS comment beside it
    // never reaches the file. This asserts the generator has not grown a "_comment" PROPERTY.
    expect(generator).not.toMatch(/^\s*_[A-Za-z0-9_]*\s*:/m);
  });
});
