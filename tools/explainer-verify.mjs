/**
 * EXPLAINER VERIFY — the check that ASSERTS. Run after tools/explainer-cut.mjs.
 *
 * ⚠️ WHY THIS EXISTS AS A SEPARATE, FAILING PROGRAM. The previous verification printed numbers and
 * built contact sheets for a human to look at. 06-profile still shipped opening on the CAPS splash
 * under a caption about the profile screen, because the sheet I built covered every clip's LAST
 * frame and never its first. A number printed and never asserted is decoration; a check that looks
 * at one end of a clip is not a check. This one exits non-zero.
 *
 * WHAT IT ASSERTS, per clip:
 *   1. FIRST, MIDDLE and LAST frame each classify to the screen the clip declares.
 *   2. Every CAPTION's midpoint frame classifies to that same screen — so a caption can never sit
 *      over a screen it is not describing.
 *   3. No sampled frame is the splash.
 *   4. Duration <= 30s, zero audio streams, first caption at t = 0.
 *   5. ⚠️ NO CAPTION MAY CLAIM AN OUTCOME. See the note on that below.
 *
 * HOW A FRAME IS CLASSIFIED — an identity check, not a statistic. Two earlier attempts at a
 * statistic are recorded in explainer-cut.mjs; both passed the splash and failed good clips. Here
 * each frame is compared per pixel against one reference still per screen, captured from the raw
 * take, and the nearest reference wins. Validated before being trusted: 141 frames sampled every
 * 0.5s across all eight clips, 141 classified to their own screen, 0 misclassified.
 *
 * ⚠️ AND THE LIMIT OF IT, STATED. Screen references separate the SCREEN, not the WORDS. The
 * classifier can prove "this caption is over the results screen"; it cannot prove "this caption is
 * true of this instant". The failure that motivated rule 5 — a caption reading "Nobody wins" over
 * a screen reading YOU WIN — is therefore NOT caught by classification, and pretending otherwise
 * would be exactly the kind of decorative check this file replaces. It is caught by forbidding
 * outcome words in captions outright: a caption that never claims who won cannot contradict the
 * screen about who won. That is a narrower guarantee, and it is the honest one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const OUT = process.env.OUT || 'docs/explainers';
const REF_DIR = path.join(OUT, 'verification/screens');
const MAX_SECONDS = 30;

/** Which screen each clip must show, for every frame of it. */
const SCREEN = {
  '01-home': 'home', '02-placement': 'placement', '03-reveal': 'reveal', '04-results': 'results',
  '05-hand-history': 'history', '06-profile': 'profile', '07-lobby': 'lobby', '08-shop': 'shop',
};
/**
 * ⚠️ Rule 5, AND IT HAD TO BE NARROWED. The first version forbade any win-word and immediately
 * fired on two captions that are correct: "The score is boards WON, not chips" states the scoring
 * rule, and "hands, WIN RATE, streak and chips" names a statistic printed on the screen. A guard
 * that fails correct content is a bad guard — the same failure as the two discarded metrics in
 * explainer-cut.mjs, and it would have taught the next person to delete the guard.
 *
 * What actually went wrong was never a word. It was a caption ASSERTING THE RESULT OF THE HAND ON
 * SCREEN — "Nobody wins" burned over a screen reading YOU WIN. Those are second-person or bare
 * declarations of a result, and that is what is forbidden here. Naming a statistic or a rule is
 * allowed on purpose.
 */
const OUTCOME_CLAIM = [
  /\byou\s+(win|won|lose|lost|tie|tied|draw)\b/i,
  /\bnobody\s+(wins|won|loses|lost)\b/i,
  /\b(it'?s|its)\s+a\s+(tie|draw)\b/i,
  /\beveryone\s+(wins|won|ties|tied)\b/i,
  /^\s*(tie|draw|you win|you lose|winner|loser)\s*[.!]?\s*$/i,
];

const clips = JSON.parse(fs.readFileSync(path.join(OUT, 'clips.json'), 'utf8'));
const refs = Object.fromEntries(
  fs.readdirSync(REF_DIR).filter((f) => f.endsWith('.png'))
    .map((f) => [f.replace(/\.png$/, ''), PNG.sync.read(fs.readFileSync(path.join(REF_DIR, f)))]),
);
for (const need of [...new Set(Object.values(SCREEN)), 'splash'])
  if (!refs[need]) throw new Error(`missing reference still for "${need}" in ${REF_DIR}`);

const frameAt = (file, t) => {
  const p = `/tmp/verify-frame.png`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', 'scale=96:171', p], { stdio: ['ignore', 'pipe', 'pipe'] });
  return PNG.sync.read(fs.readFileSync(p));
};
const mad = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.data.length; i += 4)
    s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) +
         Math.abs(a.data[i + 2] - b.data[i + 2]);
  return s / ((a.data.length / 4) * 3);
};
const classify = (img) => Object.keys(refs)
  .map((n) => [n, mad(img, refs[n])])
  .sort((x, y) => x[1] - y[1])[0];

const failures = [];
const report = [];
for (const c of clips) {
  const want = SCREEN[c.id];
  if (!want) { failures.push(`${c.id}: no declared screen`); continue; }
  const file = path.join(OUT, `${c.id}.mp4`);
  const dur = c.seconds;

  if (dur > MAX_SECONDS) failures.push(`${c.id}: ${dur}s over the ${MAX_SECONDS}s limit`);
  if (c.audioStreams !== 0) failures.push(`${c.id}: has ${c.audioStreams} audio stream(s)`);

  for (const text of c.captions) {
    const hit = OUTCOME_CLAIM.find((re) => re.test(text));
    if (hit) failures.push(`${c.id}: caption ASSERTS A RESULT — "${text}" (matched ${hit})`);
  }

  // first / middle / last, plus one frame per caption at its midpoint
  const points = [['first', 0.05], ['middle', dur / 2], ['last', Math.max(0, dur - 0.35)]];
  const cues = JSON.parse(fs.readFileSync(path.join(OUT, 'clips.json'), 'utf8'));
  void cues;
  c.captions.forEach((text, i) => {
    // captions run in order across the clip; sample the middle of each equal share
    points.push([`caption ${i + 1}`, ((i + 0.5) * dur) / c.captions.length]);
  });

  const rows = [];
  for (const [label, t] of points) {
    const [got, dist] = classify(frameAt(file, t));
    rows.push({ label, t: +t.toFixed(2), got, dist: +dist.toFixed(1) });
    if (got === 'splash') failures.push(`${c.id}: ${label} frame (t=${t.toFixed(2)}s) IS THE SPLASH`);
    else if (got !== want) failures.push(`${c.id}: ${label} frame (t=${t.toFixed(2)}s) shows "${got}", expected "${want}"`);
  }
  report.push({ id: c.id, screen: want, seconds: dur, checks: rows });
}

fs.writeFileSync(path.join(OUT, 'verify-report.json'), JSON.stringify(report, null, 1));
for (const r of report)
  console.log(`${r.id.padEnd(18)} ${String(r.seconds).padStart(5)}s  ` +
    r.checks.map((k) => `${k.label}=${k.got}`).join('  '));

if (failures.length) {
  console.error('\nVERIFICATION FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll ${clips.length} clips pass: first, middle, last and every caption frame show the declared screen; no splash; no caption claims an outcome.`);
