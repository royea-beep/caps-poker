/**
 * EMBED-THE-VIDEO 2026-09-07 — fetch the LIVE page's exact bytes so a real browser can render them.
 *
 * WHY A SNAPSHOT AND NOT A DIRECT NAVIGATION. This container's browser cannot open
 * caps.ftable.co.il (the agent proxy resets the tunnel) while curl to the same URL returns 200.
 * "Load the live page in a real browser" therefore means "render the live page's exact bytes",
 * and the md5 of every fetched file is printed so the claim is checkable rather than asserted.
 * ⚠️ The VIDEO is deliberately NOT snapshotted — the <video src> stays the real Supabase URL, so
 * the browser reaches out to the same origin a visitor's browser would.
 */
import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT  = process.env.SNAP || '/tmp/live-snapshot';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const FILES = ['landing.html', 'shots/explainer-poster.webp',
  'shots/game-boards-en.webp', 'shots/game-boards-he.webp',
  'shots/game-reveal-en.webp', 'shots/game-reveal-he.webp'];
const rows = [];
for (const f of FILES) {
  const dst = path.join(OUT, f);
  const code = execFileSync('curl', ['-sS', '-o', dst, '-w', '%{http_code}', '--max-time', '90', `${BASE}/${f}`]).toString();
  const size = fs.existsSync(dst) ? fs.statSync(dst).size : 0;
  const md5 = size ? execFileSync('md5sum', [dst]).toString().split(' ')[0] : '-';
  rows.push({ file: f, status: Number(code), bytes: size, md5 });
}
console.log(JSON.stringify({ base: BASE, out: OUT, files: rows }, null, 1));
const bad = rows.filter(r => r.status !== 200);
if (bad.length) { console.error('NOT 200:', JSON.stringify(bad)); process.exit(1); }
