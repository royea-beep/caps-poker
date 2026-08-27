/**
 * THE CUT — constraints enforced by the tool, not remembered from a brief.
 *
 * Three rules from the research are not comments here, they are assertions that fail the build:
 *
 *   UNDER 60 SECONDS      a cut longer than MAX_SECONDS throws. Platform limits are longer than
 *                         this; the constraint is about attention, not about the uploader.
 *   HOOK IN 0.5 SECONDS   the first caption cue MUST start at t=0.000 and the tool refuses a spec
 *                         whose first cue starts later. A hook that arrives at 1.2s is a hook
 *                         nobody saw.
 *   NO AUDIO DEPENDENCY   the output is muxed with NO AUDIO STREAM AT ALL. "Works muted" is then
 *                         not a claim about taste, it is a property of the file: there is no
 *                         sound to miss. ffprobe on the result shows zero audio streams.
 *
 * CAPTIONS ARE BURNED IN, not sidecar. Most of this viewing is silent and platform auto-captions
 * are not guaranteed, so the words are pixels.
 *
 * GEOMETRY. The raw take is 486x864 (exactly 9:16 — see content-lib.mjs for why that width).
 * Scaling to 1080x1920 is a clean 2.222x with no crop and no padding: nothing is lost from the
 * frame. It is an UPSCALE, so the result is soft compared with a native 1080-wide capture — that
 * is a real cost and it is stated rather than hidden. Playwright records CSS pixels at 1:1 and
 * ignores deviceScaleFactor for video, and the app's own phone layout stops at width 500, so 486
 * is the widest true-9:16 capture available without pushing the app into its tablet layout.
 *
 * ffmpeg: system ffmpeg 6.1.1 (libx264, libfreetype/drawtext, libass). The ffmpeg BUNDLED WITH
 * PLAYWRIGHT cannot do this job — it is built --disable-everything with only VP8, scale/pad/crop
 * and the webm muxer, so it has no drawtext and no H.264 at all.
 *
 *   node tools/cut.mjs                 # cut every video in tools/videos.json
 *   ONLY=dev-invite node tools/cut.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { VIEWPORT, TARGET, FPS } from './content-lib.mjs';

const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
const RAW = path.join(CONTENT, 'raw');
const OUT = path.join(CONTENT, 'out');
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const MAX_SECONDS = 60;
const HOOK_DEADLINE = 0.5;
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(FONT)) throw new Error(`no caption font at ${FONT}`);

const ff = (args) => execFileSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const probe = (f, entries) => execFileSync('ffprobe',
  ['-v', 'error', '-select_streams', 'v:0', '-show_entries', entries, '-of', 'default=nw=1', f],
  { encoding: 'utf8' }).trim();

/** drawtext is a filtergraph value: colons, quotes, backslashes and commas all bite. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019")
  .replace(/%/g, '\\%').replace(/,/g, '\\,');

/**
 * One caption cue -> one drawtext filter. Text sits in the lower third with a solid box, which is
 * what survives being watched on a bright phone screen over moving cards.
 */
function cue({ t, d, text, size = 46, y = 'h-h/3.1', box = 'black@0.72' }) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const yy = `${y}+${i * Math.round(size * 1.25)}`;
    return `drawtext=fontfile=${FONT}:text='${esc(line)}':fontcolor=white:fontsize=${size}` +
      `:box=1:boxcolor=${box}:boxborderw=18:x=(w-text_w)/2:y=${yy}` +
      `:enable='between(t,${t},${t + d})'`;
  }).join(',');
}

/**
 * WHERE THE ACTION STARTS. Playwright records from context creation, so every take opens with a
 * page load and the CAPS POKER splash — measured at 1.6s in all five. The first cut put the hook
 * caption over that splash: correct duration, correct dimensions, correct caption timing, and the
 * most important half-second of the video was a loading screen. Only visible by looking.
 * So a spec's `start` is RELATIVE TO THE ACTION, and the measured offset is added here.
 */
const ACTION = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(RAW, 'manifest.json'), 'utf8'))
    .capturedScenes.map((r) => [r.scene, r.actionStartSeconds]));

function build(spec) {
  const src = path.join(RAW, spec.source, fs.readdirSync(path.join(RAW, spec.source)).find((f) => f.endsWith('.webm')));
  const action = ACTION[spec.source];
  if (typeof action !== 'number') {
    throw new Error(`${spec.id}: no measured action start for "${spec.source}" — run tools/find-action.mjs`);
  }
  const srcDur = Number(probe(src, 'format=duration').split('=')[1] ?? execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', src], { encoding: 'utf8' }).trim());

  // ── the three constraints, as failures rather than intentions ────────────────────────────
  if (!spec.cues.length) throw new Error(`${spec.id}: no caption cues`);
  const first = spec.cues.slice().sort((a, b) => a.t - b.t)[0];
  if (first.t > HOOK_DEADLINE - 1e-9) {
    throw new Error(`${spec.id}: HOOK TOO LATE — first cue at ${first.t}s, must be at 0 (deadline ${HOOK_DEADLINE}s)`);
  }
  if (spec.duration > MAX_SECONDS) throw new Error(`${spec.id}: ${spec.duration}s exceeds the ${MAX_SECONDS}s limit`);
  const lastEnd = Math.max(...spec.cues.map((c) => c.t + c.d));
  if (lastEnd > spec.duration + 0.01) throw new Error(`${spec.id}: a caption runs to ${lastEnd}s past the ${spec.duration}s cut`);

  const start = action + (spec.start ?? 0);
  if (start + spec.duration > srcDur + 0.05) {
    throw new Error(`${spec.id}: needs ${(start + spec.duration).toFixed(2)}s of "${spec.source}" ` +
      `(action starts ${action}s) but the take is ${srcDur.toFixed(2)}s`);
  }

  const vf = [
    `scale=${TARGET.width}:${TARGET.height}:flags=lanczos`,
    ...spec.cues.map(cue),
    `format=yuv420p`,
  ].join(',');

  const dest = path.join(OUT, `${spec.id}.mp4`);
  ff(['-y', '-loglevel', 'error',
    '-ss', String(start), '-t', String(spec.duration), '-i', src,
    '-an',                              // NO AUDIO STREAM — the muted-safety proof
    '-vf', vf,
    '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    dest]);
  return { dest, srcDur };
}

const specs = JSON.parse(fs.readFileSync('tools/videos.json', 'utf8')).videos;
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const report = [];

console.log(`\n  id                 len   source      size    audio  dims        hook`);
for (const spec of specs) {
  if (only && !only.includes(spec.id)) continue;
  const { dest } = build(spec);
  // Verify the FILE, not the command line: dimensions, duration, and the absence of audio.
  const dims = probe(dest, 'stream=width,height').split('\n').map((l) => l.split('=')[1]).join('x');
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', dest], { encoding: 'utf8' }).trim());
  const audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a',
    '-show_entries', 'stream=index', '-of', 'csv=p=0', dest], { encoding: 'utf8' }).trim();
  const kb = Math.round(fs.statSync(dest).size / 1024);
  if (audio) throw new Error(`${spec.id}: an audio stream got in — the muted guarantee is broken`);
  if (dur > MAX_SECONDS) throw new Error(`${spec.id}: rendered ${dur}s, over the limit`);
  if (dims !== `${TARGET.width}x${TARGET.height}`) throw new Error(`${spec.id}: ${dims}, expected vertical`);
  report.push({ id: spec.id, kind: spec.kind, seconds: +dur.toFixed(2), dims, kb, source: spec.source,
                hook: spec.cues[0].text.replace(/\n/g, ' '), payoff: spec.payoff, caption: spec.caption });
  console.log(`  ${spec.id.padEnd(18)} ${String(dur.toFixed(1)).padStart(4)}s  ${spec.source.padEnd(10)} ` +
    `${String(kb).padStart(5)}KB  ${(audio ? 'YES' : 'none').padEnd(5)}  ${dims}  "${report.at(-1).hook.slice(0, 34)}"`);
}

fs.writeFileSync(path.join(OUT, 'queue.json'), JSON.stringify({
  generated: 'tools/cut.mjs',
  note: 'A QUEUE, NOT A SCHEDULE. Nothing here is published, and nothing in this repo can publish it.',
  constraints: { maxSeconds: MAX_SECONDS, hookDeadlineSeconds: HOOK_DEADLINE, audioStreams: 0,
                 resolution: `${TARGET.width}x${TARGET.height}`, fps: FPS, capture: `${VIEWPORT.width}x${VIEWPORT.height}` },
  videos: report,
}, null, 2));
console.log(`\n  wrote ${path.join(OUT, 'queue.json')}  (${report.length} videos)\n`);
