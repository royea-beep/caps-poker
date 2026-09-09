/**
 * EXPLAINER CUT — trim the two raw takes into one clip per screen and burn the captions in.
 *
 * WINDOWS ARE MEASURED, NOT GUESSED. The first pass used the rig's own elapsed marks and the
 * "home" clip came out showing the placement screen: the marks record when a step was ISSUED, and
 * a goto plus a settle drifts from that. So a filmstrip was extracted from the raw take every 4
 * seconds, looked at, and the windows below were read off it. Iron Rule #10.
 *
 * CAPTIONS ARE BURNED IN (most of this is watched muted) and each one is checked against the text
 * actually on screen in that window — the facts block in docs/explainers/explainers-report.json is
 * the record. Nothing here describes code; every line describes what a player can see or do.
 *
 * CONSTRAINTS ENFORCED, not remembered: every clip is under 30s, the first caption starts at
 * t=0.0 (a hook nobody saw is not a hook), and the output carries NO audio stream at all.
 *
 *   node tools/explainer-cut.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const RAW = '/tmp/explainers-raw';
const OUT = process.env.OUT || 'docs/explainers';
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const MAX_SECONDS = 30;
/**
 * CAPTION WIDTH IS ASSERTED, NOT EYEBALLED. Three captions in the first pass ran off the 1080px
 * frame and rendered as "ty today. Nothing is for sale and nothing is requ" — legible nonsense,
 * and every automated check passed on it. DejaVuSans-Bold at 34px averages ~19px per glyph, so
 * 1080 minus the 18px box border either side leaves room for about 54 characters. The limit is
 * enforced below and throws.
 */
const FONT_SIZE = 34;
const MAX_CAPTION_CHARS = 54;
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(FONT)) throw new Error(`no caption font at ${FONT}`);

const marks = JSON.parse(fs.readFileSync(`${RAW}/marks.json`, 'utf8'));
const A = marks.marks.file, B = marks.marksB.file;

/** drawtext is a filtergraph value: colons, quotes, backslashes, commas and % all bite. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019')
  .replace(/%/g, '\\%').replace(/,/g, '\\,');
const cue = ({ t, d, text, size = FONT_SIZE }) =>
  `drawtext=fontfile=${FONT}:text='${esc(text)}':fontcolor=white:fontsize=${size}:` +
  `box=1:boxcolor=black@0.78:boxborderw=18:x=(w-text_w)/2:y=h-h/4.2:` +
  `enable='between(t,${t},${t + d})'`;

/**
 * WINDOWS RE-DERIVED 2026-09-07 for the THREE-BEFORE-TESTERS re-capture (build 515 code).
 *
 * The offsets below belong to ONE take. Re-running the rig produces a new take with different
 * timings, so reusing the previous windows would have cut the wrong screens under the right
 * captions — the exact failure this file's original header warns about, and three of the eight
 * previous windows really would have missed this time. A filmstrip was pulled from the new raw
 * take (A every 3s, B every 2s) and LOOKED AT; these are read off it:
 *   take A  splash 0-2 · home 3-10 · WHITE FRAME at 12 · placement 15-27 · reveal 30-37 ·
 *           results 39-48 · history 51-63 · profile 66-75 · black tail from ~78
 *   take B  splash 0-1 · lobby 2-14 · splash again 16 · shop 18-28
 *
 * ⚠️ THE THREE THAT MOVED, and why each would have been wrong:
 *   home     3.0+8.0 ended at 11.0, one second before a WHITE navigation frame. Now 7.0s.
 *   reveal   29.5 started on the "ALL CARDS PLACED / READY" screen, not the reveal. Now 30.0.
 *   profile  68.0+9.5 ran to 77.5 and this take goes black at ~78. Now 66.0+9.5.
 */
const CLIPS = [
  { id: '01-home', src: A, start: 3.0, duration: 7.0, cues: [
    { t: 0,   d: 2.3, text: 'HOME — where every session starts' },
    { t: 2.4, d: 2.3, text: 'Play Online, or practise against bots' },
    { t: 4.8, d: 2.2, text: 'A daily bonus tops up your chips' },
  ] },
  { id: '02-placement', src: A, start: 15.0, duration: 11.0, cues: [
    { t: 0,   d: 3.5, text: 'PLACING — the decision that is the game' },
    { t: 3.6, d: 3.6, text: 'Four cards per board. You choose where' },
    { t: 7.3, d: 3.6, text: 'Auto-Place fills a board fast. Then READY' },
  ] },
  { id: '03-reveal', src: A, start: 30.0, duration: 7.5, cues: [
    { t: 0,   d: 2.9, text: 'REVEAL — the boards play out one at a time' },
    { t: 3.0, d: 2.3, text: 'Live odds while cards are still to come' },
    { t: 5.4, d: 2.1, text: 'Each board is named and settled on its own' },
  ] },
  // WINDOW SHORTENED after watching: at 12.5s this clip ran past the navigation away from results
  // and spent its last two seconds on the CAPS splash, under a caption about "Deal me in".
  { id: '04-results', src: A, start: 39.5, duration: 9.0, cues: [
    { t: 0,   d: 3.0, text: 'RESULTS — boards decide the hand' },
    { t: 3.1, d: 2.9, text: 'The score is boards won, not chips' },
    { t: 6.1, d: 2.9, text: 'Hand details opens the breakdown' },
  ] },
  { id: '05-hand-history', src: A, start: 53.5, duration: 7.0, cues: [
    { t: 0,   d: 2.3, text: 'HAND HISTORY — your past hands' },
    { t: 2.4, d: 2.3, text: 'Practice hands are not recorded' },
    { t: 4.8, d: 2.2, text: 'Play for chips and every hand lands here' },
  ] },
  // ⚠️ 66.0 WAS THE SPLASH. Fine-sampled at 0.5s: 63.0-64.5 hand history, 65.0 a WHITE frame,
  // 65.5-66.0 the CAPS splash, 66.5 profile still painting, 67.0 profile complete. The previous
  // cut opened on the wordmark under the caption "PROFILE — hands, win rate…". Starts at 67.5.
  { id: '06-profile', src: A, start: 67.5, duration: 9.0, cues: [
    { t: 0,   d: 2.9, text: 'PROFILE — hands, win rate, streak and chips' },
    { t: 3.0, d: 2.9, text: 'Achievements, hand history and detailed stats' },
    { t: 6.0, d: 3.0, text: 'Cups and settings live here too' },
  ] },
  // WINDOW SHORTENED after watching: at 14.0s this clip was already showing the SHOP under a
  // caption about board counts, and 8.0s still caught the splash on the way out — 6.8s is the
  // last frame that is unambiguously the lobby. The tables read "Opening a table..." because the capture runs
  // with the network blocked — the clip shows the lobby's SHAPE, which is what the caption says.
  { id: '07-lobby', src: B, start: 2.5, duration: 10.5, cues: [
    { t: 0,   d: 3.4, text: 'LOBBY — tables against real people' },
    { t: 3.5, d: 3.4, text: 'Heads-up, 3-player or 4-player' },
    { t: 7.0, d: 3.5, text: 'Fewer players, more boards: 2 play 4' },
  ] },
  { id: '08-shop', src: B, start: 18.5, duration: 9.5, cues: [
    { t: 0,   d: 4.6, text: 'CHIP SHOP — reached from your chip count' },
    { t: 4.7, d: 4.7, text: 'Empty today. Nothing is for sale' },
  ] },
];

const probe = (f, e) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', e, '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const built = [];
for (const c of CLIPS) {
  if (c.duration > MAX_SECONDS) throw new Error(`${c.id}: ${c.duration}s exceeds the ${MAX_SECONDS}s limit`);
  const first = [...c.cues].sort((a, b) => a.t - b.t)[0];
  if (!first || first.t > 0.001) throw new Error(`${c.id}: HOOK TOO LATE — first caption at ${first?.t}s, must be 0`);
  for (const q of c.cues) {
    if (q.text.length > MAX_CAPTION_CHARS)
      throw new Error(`${c.id}: caption is ${q.text.length} chars, over the ${MAX_CAPTION_CHARS} that fit the frame — "${q.text}"`);
  }
  const last = Math.max(...c.cues.map((q) => q.t + q.d));
  if (last > c.duration + 0.01) throw new Error(`${c.id}: a caption runs to ${last}s past the ${c.duration}s cut`);
  const dest = path.join(OUT, `${c.id}.mp4`);
  execFileSync('ffmpeg', ['-y', '-ss', String(c.start), '-t', String(c.duration), '-i', c.src,
    '-an', '-vf', ['scale=1080:1920:flags=lanczos', 'fps=25', ...c.cues.map(cue)].join(','),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', dest], { stdio: ['ignore', 'pipe', 'pipe'] });
  const dur = Number(probe(dest, 'format=duration'));
  const audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', dest], { encoding: 'utf8' }).trim();
  if (audio) throw new Error(`${c.id}: an audio stream got in — the muted guarantee is broken`);
  if (dur > MAX_SECONDS) throw new Error(`${c.id}: output is ${dur}s`);
  built.push({ id: c.id, seconds: +dur.toFixed(2), size: probe(dest, 'stream=width,height').split('\n')[0], bytes: fs.statSync(dest).size, audioStreams: 0, captions: c.cues.map((q) => q.text) });
}
/**
 * ⚠️ THE HOOK GUARD — because the one failure this project keeps repeating is a clip that OPENS
 * on the splash under a caption naming a screen. It happened again on 06-profile, and the
 * final-frame check missed it entirely because the final frame was correct.
 *
 * ⚠️ TWO MEASUREMENTS WERE TRIED AND DISCARDED BEFORE THIS ONE. Both looked rigorous.
 *   1. "Fraction of pixels far from the dominant colour." Separated nothing: the splash scored
 *      0.169 while the LEGITIMATE hand-history frame scored 0.046 and lobby scored 0.169. It
 *      would have passed the splash and failed a good clip.
 *   2. ffmpeg's signalstats YUV average difference. The splash-opening frame scored 3.45 and the
 *      legitimate lobby scored 3.47 — a global luma average cannot tell a dark screen from a dark
 *      splash. Worse, the floor had been calibrated on measurement 3 below and enforced with this
 *      one: two instruments, one number, which is how a guard fires on a frame that is fine.
 *
 * What works is not a statistic but an IDENTITY CHECK: the splash is a known image, so compare
 * frame 0 to it per pixel. Mean absolute RGB difference at 96x171, this take:
 *     06-profile at 66.0s (the defect) ..... 0.00   <- the splash, wearing a caption
 *     08-shop .............................. 5.58   <- nearest legitimate frame
 *     06-profile at 67.5s (fixed) .......... 7.64
 *     07-lobby ............................. 7.95
 *     05-hand-history ..................... 15.32
 *     01-home ............................. 19.31
 *     02/03/04 ...................... 46.13-49.76
 * Floor 3.0. ⚠️ The 0.00 is exact only because the reference frame was taken from this same take;
 * a splash from another recording would score a little above zero, nowhere near 5.58. The real
 * margin is the 5.58, and it is stated rather than dressed up.
 */
const SPLASH_REF = path.join(OUT, 'verification/splash-reference.png');
if (!fs.existsSync(SPLASH_REF)) throw new Error(`no splash reference at ${SPLASH_REF}`);
const SPLASH_FLOOR = 3.0;
const png = (file) => {
  const small = `/tmp/hook-${path.basename(file)}.png`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-frames:v', '1',
    '-vf', 'scale=96:171', small], { stdio: ['ignore', 'pipe', 'pipe'] });
  return PNG.sync.read(fs.readFileSync(small));
};
const ref = png(SPLASH_REF);
for (const c of built) {
  const f = png(path.join(OUT, `${c.id}.mp4`));
  let sum = 0;
  for (let i = 0; i < ref.data.length; i += 4)
    sum += Math.abs(f.data[i] - ref.data[i]) + Math.abs(f.data[i + 1] - ref.data[i + 1]) +
           Math.abs(f.data[i + 2] - ref.data[i + 2]);
  const diff = sum / ((ref.data.length / 4) * 3);
  c.hookDiffFromSplash = +diff.toFixed(2);
  if (diff < SPLASH_FLOOR)
    throw new Error(`${c.id}: HOOK IS THE SPLASH — frame 0 is ${diff.toFixed(2)} from the splash reference (floor ${SPLASH_FLOOR})`);
}
console.log('hook guard, difference from the splash (floor 3.0):',
  JSON.stringify(Object.fromEntries(built.map((c) => [c.id, c.hookDiffFromSplash]))));

fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(built, null, 1));
console.log(JSON.stringify(built, null, 1));
