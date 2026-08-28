/**
 * VERIFY THE HOSTING — every file, not a sample, and never trusting a 200.
 *
 * A 200 is not a video. `caps.ftable.co.il` returns 200 with 1902 bytes of the app's HTML for any
 * path that does not exist, because vercel.json rewrites everything to index.html — so "it
 * responded" is exactly the evidence that would mislead here, and it has misled before. Each file
 * is therefore checked five ways:
 *
 *   1. STATUS          200, and no redirect chain (TikTok's PULL_FROM_URL forbids redirects)
 *   2. CONTENT-TYPE    video/mp4 — an HTML content-type is the trap firing
 *   3. BYTE-EXACT SIZE against the local file, then a sha256 of what was actually downloaded, so
 *                      a truncated or re-encoded upload cannot pass
 *   4. MAGIC BYTES     an MP4 begins with an `ftyp` box at offset 4; HTML does not
 *   5. PLAYABLE        ffprobe reads the DOWNLOADED bytes and must report a decodable H.264
 *                      stream of the right dimensions and duration, and ZERO audio streams
 *
 *   PUBLIC_BASE=https://ftable.co.il/caps-media/v1 node tools/verify-hosting.mjs
 *
 * Run with no PUBLIC_BASE and it serves the files locally and verifies against that instead —
 * which is how the checker itself was proven before the real host existed.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
const OUT = path.join(CONTENT, 'out');
const manifestPath = path.join(OUT, 'publish-manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error('run tools/publish-manifest.mjs first');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let base = process.env.PUBLIC_BASE || null;
let server = null;
if (!base) {
  // SELF-TEST MODE. Serves the real files so the checker can be proven end to end before the
  // host exists. Deliberately sets video/mp4 the way a correctly configured static host would.
  const port = Number(process.env.PORT || 8997);
  server = http.createServer((req, res) => {
    const f = path.join(OUT, path.basename(decodeURIComponent((req.url || '').split('?')[0])));
    if (!fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<html>404</html>'); return; }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': fs.statSync(f).size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(port, r));
  base = `http://localhost:${port}`;
  console.log(`\n  SELF-TEST: no PUBLIC_BASE given, serving the real files from ${base}`);
}

const tmp = '/tmp/verify-hosting';
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

/**
 * ASYNC ON PURPOSE. execFileSync BLOCKS THE EVENT LOOP, and in self-test mode the server being
 * fetched lives in THIS process — so a synchronous curl deadlocks against the server that is
 * supposed to answer it. It timed out at 000/0 bytes and looked exactly like a dead host.
 * --noproxy exempts loopback from this container's HTTPS_PROXY; it does not affect a real host.
 */
const execFileAsync = promisify(execFile);
const curl = async (args) => (await execFileAsync('curl',
  ['--noproxy', 'localhost,127.0.0.1', '--max-time', '120', ...args],
  { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 })).stdout;
const rows = [];
let failures = 0;

console.log(`\n  base ${base}\n`);
console.log('  id                 status  redirects  content-type       bytes      sha  ftyp  probe');
for (const v of manifest.videos) {
  const url = `${base}/${v.id}.mp4`;
  const dest = path.join(tmp, `${v.id}.mp4`);
  // A NETWORK ERROR IS A FAILED FILE, NOT A CRASHED RUN. The first version let curl's non-zero
  // exit throw, and one transient "connection reset by peer" on the second file aborted the whole
  // verification — which against a real host would read as "fine up to here, then nothing".
  // Retried once, then recorded as a failure carrying its reason.
  let meta = null, netErr = null;
  for (let attempt = 0; attempt < 2 && !meta; attempt++) {
    try {
      // PIPE-DELIMITED, not whitespace: `content_type` is "text/html; charset=utf-8", whose space
      // shifted every field after it and made num_redirects parse as NaN — so the no-redirect
      // check silently passed on nothing.
      meta = (await curl(['-sS', '-o', dest, '-w', '%{http_code}|%{content_type}|%{num_redirects}|%{size_download}',
        url])).toString().trim().split('|');
    } catch (e) {
      netErr = (e.stderr?.toString() || String(e)).trim().split('\n')[0].slice(0, 70);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const [status, ctype, redirects, size] = meta
    ? [meta[0], meta[1], Number(meta[2]), Number(meta[3])]
    : ['000', netErr ?? 'network error', 0, 0];

  const buf = fs.existsSync(dest) ? fs.readFileSync(dest) : Buffer.alloc(0);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const ftyp = buf.length > 12 && buf.slice(4, 8).toString('latin1') === 'ftyp';

  let probe = null, probeErr = null;
  try {
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json',
      '-show_streams', '-show_format', dest], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const vs = j.streams.find((s) => s.codec_type === 'video');
    probe = { codec: vs?.codec_name, w: vs?.width, h: vs?.height,
              dur: Number(j.format?.duration ?? 0),
              audio: j.streams.filter((s) => s.codec_type === 'audio').length };
  } catch (e) { probeErr = String(e).split('\n')[0].slice(0, 60); }

  const checks = {
    status: status === '200',
    noRedirect: redirects === 0,
    contentType: /^video\/mp4/.test(ctype || ''),
    bytes: size === v.bytes && buf.length === v.bytes,
    sha: sha === v.sha256,
    ftyp,
    playable: !!probe && probe.codec === 'h264' && probe.w === 1080 && probe.h === 1920
              && probe.audio === 0 && Math.abs(probe.dur - v.seconds) < 0.5,
  };
  const ok = Object.values(checks).every(Boolean);
  if (!ok) failures++;
  rows.push({ id: v.id, url, status, ctype, redirects, size, checks, probe, probeErr, netErr, ok });

  console.log(`  ${v.id.padEnd(18)} ${String(status).padStart(4)}  ${String(redirects).padStart(7)}  ` +
    `${String(ctype).slice(0, 17).padEnd(17)} ${String(size).padStart(8)}  ` +
    `${checks.sha ? ' ok' : 'BAD'}  ${ftyp ? ' ok' : 'BAD'}  ` +
    `${checks.playable ? `${probe.codec} ${probe.w}x${probe.h} ${probe.dur.toFixed(1)}s a=${probe.audio}` : `FAIL ${probeErr ?? JSON.stringify(probe)}`}` +
    `${ok ? '' : '   <-- FAILED'}`);
}

if (server) server.close();
fs.writeFileSync(path.join(OUT, 'hosting-verification.json'),
  JSON.stringify({ base, checkedAt: new Date().toISOString(), failures, rows }, null, 2));
console.log(`\n  ${rows.length - failures}/${rows.length} verified` +
  (failures ? `  — ${failures} FAILED` : '  — every file: 200, no redirect, video/mp4, byte-exact, sha match, real MP4, playable, zero audio'));
console.log(`  wrote ${path.join(OUT, 'hosting-verification.json')}\n`);
process.exit(failures ? 1 : 0);
