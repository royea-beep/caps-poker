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

fs.writeFileSync(htmlPath, html);
console.log('✓ index.html patched (type="module", error handler)');

// 3. Write vercel.json for SPA routing
const vercelJson = JSON.stringify({ rewrites: [{ source: "/privacy.html", destination: "/privacy.html" }, { source: "/(.*)", destination: "/index.html" }] });
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
