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

const CLIPS = [
  { id: '01-home', src: A, start: 1.5, duration: 11.0, cues: [
    { t: 0,   d: 3.4, text: 'HOME — where every session starts' },
    { t: 3.5, d: 3.7, text: 'Play Online, or practise against bots' },
    { t: 7.3, d: 3.7, text: 'A daily bonus tops up your chips' },
  ] },
  { id: '02-placement', src: A, start: 17.0, duration: 11.5, cues: [
    { t: 0,   d: 3.4, text: 'PLACING — the decision that is the game' },
    { t: 3.5, d: 3.9, text: 'Four cards per board. You choose where' },
    { t: 7.5, d: 4.0, text: 'Auto-Place fills a board fast. Then READY' },
  ] },
  { id: '03-reveal', src: A, start: 29.0, duration: 8.5, cues: [
    { t: 0,   d: 3.2, text: 'REVEAL — the boards play out one at a time' },
    { t: 3.3, d: 2.6, text: 'Live odds while cards are still to come' },
    { t: 6.0, d: 2.5, text: 'Each board is named and settled on its own' },
  ] },
  // WINDOW SHORTENED after watching: at 12.5s this clip ran past the navigation away from results
  // and spent its last two seconds on the CAPS splash, under a caption about "Deal me in".
  { id: '04-results', src: A, start: 40.5, duration: 10.0, cues: [
    { t: 0,   d: 3.2, text: 'RESULTS — boards decide the hand' },
    { t: 3.3, d: 3.2, text: 'The score is boards won, not chips' },
    { t: 6.6, d: 3.4, text: 'Hand details opens the breakdown' },
  ] },
  { id: '05-hand-history', src: A, start: 53.5, duration: 10.5, cues: [
    { t: 0,   d: 3.4, text: 'HAND HISTORY — your past hands' },
    { t: 3.5, d: 3.7, text: 'Practice hands are not recorded' },
    { t: 7.4, d: 3.0, text: 'Play for chips and every hand lands here' },
  ] },
  { id: '06-profile', src: A, start: 64.5, duration: 13.5, cues: [
    { t: 0,   d: 3.4, text: 'PROFILE — hands, win rate, streak and chips' },
    { t: 3.5, d: 4.4, text: 'Achievements, hand history and detailed stats' },
    { t: 8.0, d: 5.4, text: 'Cups and settings live here too' },
  ] },
  // WINDOW SHORTENED after watching: at 14.0s this clip was already showing the SHOP under a
  // caption about board counts, and 8.0s still caught the splash on the way out — 6.8s is the
  // last frame that is unambiguously the lobby. The tables read "Opening a table..." because the capture runs
  // with the network blocked — the clip shows the lobby's SHAPE, which is what the caption says.
  { id: '07-lobby', src: B, start: 8.5, duration: 6.8, cues: [
    { t: 0,   d: 2.2, text: 'LOBBY — tables against real people' },
    { t: 2.3, d: 2.2, text: 'Heads-up, 3-player or 4-player' },
    { t: 4.6, d: 2.2, text: 'Fewer players, more boards: 2 play 4' },
  ] },
  { id: '08-shop', src: B, start: 23.5, duration: 6.5, cues: [
    { t: 0,   d: 3.2, text: 'CHIP SHOP — reached from your chip count' },
    { t: 3.3, d: 3.1, text: 'Empty today. Nothing is for sale' },
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
fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(built, null, 1));
console.log(JSON.stringify(built, null, 1));
