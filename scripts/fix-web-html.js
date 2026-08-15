#!/usr/bin/env node
/**
 * Post-export script: patches web-dist/index.html after `npx expo export --platform web`
 * - Adds type="module" to the main script tag (bundle uses import.meta)
 * - Adds window.onerror debug handler
 * - Copies vercel.json for SPA rewrites
 */
const fs = require('fs');
const path = require('path');

// Check both possible output dirs (expo exports to 'dist' by default)
const distDefault = path.join(__dirname, '..', 'dist');
const distLegacy = path.join(__dirname, '..', 'web-dist');
const distDir = fs.existsSync(path.join(distDefault, 'index.html')) ? distDefault : distLegacy;
const htmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('ERROR: web-dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf-8');

// 1. Add type="module" and remove defer (type="module" is deferred by default)
html = html.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
  '<script type="module" src="$1"></script>'
);

// 2. Fix viewport for iOS Safari (replace existing, don't duplicate)
html = html.replace(
  /<meta name="viewport" content="[^"]*" \/>/,
  // PR-J — dropped maximum-scale=1 so users can pinch-zoom (WCAG 1.4.4).
  // viewport-fit=cover keeps content under iOS notch.
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
);

// 2b. WEB-MOBILE-LAYOUT 2026-07-08 — the html/body/#root { height:100% } reset (Expo
// Router's own ScrollViewStyleReset, baked into every export) matches mobile Safari's
// classic `100vh` footgun: on iOS Safari, a bare height:100%/100vh is measured against
// the LARGEST possible viewport (URL bar collapsed), not the one that's actually visible.
// While the URL bar is showing (page load, after scrolling up) the real visible area is
// shorter than what 100% resolved to, so content sized against that box — the boards
// ScrollView's available height, anything anchored near the bottom — renders as if there's
// more room than is actually on screen. This is invisible in a desktop-resized browser or
// an iframe (neither has a collapsing toolbar), which is exactly why earlier passes at
// this bug (tested via iframe/panel) concluded web was clean. `dvh` is the CSS unit the
// spec added specifically for this: it tracks the CURRENT toolbar state live, supported in
// Safari since 15.4 (Mar 2022). Note: web.output is "single" (SPA) in app.json, so
// Expo Router's app/+html.tsx static-rendering hook does NOT apply here (confirmed: adding
// one had zero effect on the exported HTML) — this post-export string patch is the correct
// mechanism for this project, same reasoning as every other patch in this script.
html = html.replace(
  /<style id="expo-reset">([\s\S]*?)<\/style>/,
  (match, css) => `<style id="expo-reset">${css}    /* WEB-MOBILE-LAYOUT 2026-07-08 — dvh overrides height:100% above where supported (mobile Safari toolbar-aware); silently ignored as an invalid value on browsers that don't understand dvh, leaving the 100% fallback in effect there. */\n    html, body, #root { height: 100dvh; }\n  </style>`
);

// 3. Add iOS Safari meta tags
if (!html.includes('apple-mobile-web-app-capable')) {
  html = html.replace(
    '</head>',
    '  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n  </head>'
  );
}

// 4. Add error handler before main script if not already present
if (!html.includes('window.onerror')) {
  html = html.replace(
    '<script type="module"',
    '<script>window.onerror=function(m,s,l,c,e){document.getElementById(\'root\').innerHTML=\'<pre style="color:red;padding:20px;font-size:14px;">JS ERROR:\\n\'+m+\'\\n\\nSource: \'+s+\'\\nLine: \'+l+\', Col: \'+c+\'\\n\\n\'+(e&&e.stack?e.stack:\'\')+\'</pre>\';}</script>\n  <script type="module"'
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// FAIL LOUD. This is the single point of total failure in the web deploy.
//
// The bundle uses `import.meta`. Without type="module" the browser throws
// `SyntaxError: Cannot use 'import.meta' outside a module`, #root stays empty, and the site
// is a WHITE PAGE. Every replace above is String.replace — a regex that stops matching (an
// Expo exporter change to the script tag is all it takes) is a SILENT NO-OP, and this script
// would still print "patched" and exit 0. The deploy would then ship the blank page, and the
// post-deploy axe-core audit would NOT catch it: a page with no content has no accessibility
// violations, so it passes.
//
// So: assert the outcome, not the intent. Cheapest possible guard, blocking on purpose.
if (!/<script type="module" src="\/_expo\/static\/js\/web\/[^"]+"><\/script>/.test(html)) {
  console.error('::error::fix-web-html.js: index.html has NO type="module" script tag after patching.');
  console.error('The exported script tag did not match the expected pattern, so the patch was a no-op.');
  console.error('Deploying this would serve a WHITE PAGE (import.meta outside a module).');
  console.error('Actual script tags found:');
  for (const m of html.matchAll(/<script[^>]*>/g)) console.error('  ' + m[0]);
  process.exit(1);
}

fs.writeFileSync(htmlPath, html);
console.log('✓ index.html patched (type="module", error handler, dvh viewport fix)');

// 3. Write vercel.json for SPA routing
// SECURITY 2026-08-15 (FRAMING-HEADERS) — this is the vercel.json that ACTUALLY ships: the CI
// deploy runs `vercel --prod` from dist/, so the root vercel.json is never read in prod. The
// headers MUST live here or they do not deploy. Framing protection ONLY — frame-ancestors 'none'
// is the sole CSP directive (no default-src/script-src), so it restricts embedding and nothing
// else; Supabase/Realtime/fonts are untouched. A full CSP is a separate, verified pass.
const vercelJson = JSON.stringify({
  rewrites: [{ source: "/privacy.html", destination: "/privacy.html" }, { source: "/(.*)", destination: "/index.html" }],
  headers: [{ source: "/(.*)", headers: [
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
  ] }]
});
fs.writeFileSync(path.join(distDir, 'vercel.json'), vercelJson);
console.log('✓ vercel.json written');

// 4. Write .vercel/project.json
const vercelDir = path.join(distDir, '.vercel');
if (!fs.existsSync(vercelDir)) fs.mkdirSync(vercelDir, { recursive: true });
fs.writeFileSync(
  path.join(vercelDir, 'project.json'),
  JSON.stringify({ projectId: 'prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP', orgId: 'team_ayrePMw5z8jSPhRe67RiBD0k' })
);
console.log('✓ .vercel/project.json written');

// 5. Copy privacy.html from project root if it exists
const privacySrc = path.join(__dirname, '..', 'privacy.html');
const privacyDst = path.join(distDir, 'privacy.html');
if (fs.existsSync(privacySrc)) {
  fs.copyFileSync(privacySrc, privacyDst);
  console.log('✓ privacy.html copied');
}

// 5b. Copy terms.html from project root if it exists
const termsSrc = path.join(__dirname, '..', 'terms.html');
const termsDst = path.join(distDir, 'terms.html');
if (fs.existsSync(termsSrc)) {
  fs.copyFileSync(termsSrc, termsDst);
  console.log('✓ terms.html copied');
}

// 6. Copy bug dashboard → dist/bugs/index.html
const bugsDashSrc = path.join(__dirname, '..', 'web-dashboard', 'index.html');
const bugsDashDst = path.join(distDir, 'bugs', 'index.html');
if (fs.existsSync(bugsDashSrc)) {
  if (!fs.existsSync(path.dirname(bugsDashDst))) fs.mkdirSync(path.dirname(bugsDashDst), { recursive: true });
  fs.copyFileSync(bugsDashSrc, bugsDashDst);
  console.log('✓ bugs/index.html copied');
}

// 7. Copy hand replay → dist/hand/index.html
const handReplaySrc = path.join(__dirname, '..', 'web-replay', 'index.html');
const handReplayDst = path.join(distDir, 'hand', 'index.html');
if (fs.existsSync(handReplaySrc)) {
  if (!fs.existsSync(path.dirname(handReplayDst))) fs.mkdirSync(path.dirname(handReplayDst), { recursive: true });
  fs.copyFileSync(handReplaySrc, handReplayDst);
  console.log('✓ hand/index.html copied');
}

console.log('\nReady to deploy: cd web-dist && vercel --prod --yes');
