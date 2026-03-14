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

// 2. Add error handler before main script if not already present
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

console.log('\nReady to deploy: cd web-dist && vercel --prod --yes');
