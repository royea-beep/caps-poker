/**
 * THE UPLOAD LIST — what goes where, and the checksum that proves it arrived intact.
 *
 * This does not upload anything and holds no credential. It writes the manifest a human uses to
 * put the ten files on the host, and that tools/verify-hosting.mjs then checks against the live
 * URLs. Upload is a manual step by design: it needs cPanel credentials, which this session must
 * not handle.
 *
 * ── WHY ftable.co.il AND NOT caps.ftable.co.il ──────────────────────────────────────────────
 * The game's own domain is the wrong host for these files, for three measured reasons:
 *
 *   1. vercel.json rewrites `/(.*)` to `/index.html`. A MISSING OR MISTYPED FILE THEREFORE
 *      RETURNS 200 WITH THE APP'S HTML, not a 404 — measured: 200, text/html, 1902 bytes. A
 *      published post pointing at a wrong name would silently serve a web page to a video
 *      ingester. (That same 1902-byte page once read as "the fix is deployed" in an earlier
 *      sprint. It is the house speciality.)
 *   2. The deploy runs a fresh `expo export`, so only files IN THE REPO reach the deployment —
 *      and 32 MB of video must not enter the repo.
 *   3. It would put video bandwidth through the app's own project and its cache.
 *
 * The cPanel host at ftable.co.il has none of those problems and was measured to satisfy every
 * platform requirement: real 404s, no redirects on deep paths, correct Content-Type with nosniff,
 * and Accept-Ranges with a working 206.
 *
 * ── STABILITY ───────────────────────────────────────────────────────────────────────────────
 * A published post points at a URL forever. Two things protect that here:
 *   - the files are not part of any build, so no deploy can move or rename them;
 *   - the path carries a VERSION segment. A re-cut publishes to v2 and cannot overwrite what a
 *     live post already points at.
 *
 *   node tools/publish-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
const OUT = path.join(CONTENT, 'out');
const BASE = process.env.PUBLIC_BASE || 'https://ftable.co.il/caps-media/v1';
const queue = JSON.parse(fs.readFileSync(path.join(OUT, 'queue.json'), 'utf8'));

const rows = queue.videos.map((v) => {
  const file = path.join(OUT, `${v.id}.mp4`);
  const buf = fs.readFileSync(file);
  return {
    id: v.id,
    kind: v.kind,
    localFile: path.relative(process.cwd(), file),
    url: `${BASE}/${v.id}.mp4`,
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    seconds: v.seconds,
    hook: v.hook,
    caption: v.caption,
  };
});

const manifest = {
  base: BASE,
  note: 'Upload only. Nothing here publishes to any platform and no credential is read or stored.',
  uploadTarget: 'the cPanel host serving ftable.co.il — public_html/caps-media/v1/',
  requirements: {
    https: 'required by both platforms',
    noRedirects: 'TikTok PULL_FROM_URL forbids redirects on the media URL — measured 0 on this host',
    rangeRequests: 'Accept-Ranges: bytes, 206 verified on this host',
    contentType: 'video/mp4 — verify after upload; cPanel/nginx sets it from the extension',
    availability: 'TikTok allows up to 1 hour to pull; the URL must stay up throughout',
  },
  totalBytes: rows.reduce((n, r) => n + r.bytes, 0),
  videos: rows,
};

fs.writeFileSync(path.join(OUT, 'publish-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n  base ${BASE}`);
console.log(`  ${rows.length} files, ${(manifest.totalBytes / 1e6).toFixed(1)} MB total\n`);
for (const r of rows) {
  console.log(`  ${r.id.padEnd(18)} ${String(r.bytes).padStart(8)} B  ${r.sha256.slice(0, 16)}…  ${r.url}`);
}
console.log(`\n  wrote ${path.join(OUT, 'publish-manifest.json')}`);
console.log(`  after upload:  PUBLIC_BASE=${BASE} node tools/verify-hosting.mjs\n`);
