/**
 * WHERE THE ACTION ACTUALLY STARTS IN EACH TAKE.
 *
 * Playwright begins recording when the CONTEXT is created, not when the app is ready — so every
 * raw take opens with a page load and the CAPS POKER splash. The first cut of these videos put
 * the hook caption over that splash: the most important half-second of a social video was a
 * loading screen, and it was invisible in the numbers because the caption timing, the duration
 * and the dimensions were all correct. It was only visible by looking at the frame.
 *
 * So the offset is measured rather than eyeballed. For each take this samples frames and finds the
 * first one that is really the GAME: the felt covers a large share of the screen AND card faces
 * are present. The splash is a near-flat dark navy with a little gold, and fails both tests.
 *
 * The result is written back into raw/manifest.json as `actionStartSeconds`, and tools/cut.mjs
 * adds it to every spec's `start` — so a spec's `start` means "seconds into the action", which is
 * what whoever writes one actually means.
 *
 *   node tools/find-action.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
const RAW = path.join(CONTENT, 'raw');
const MAN = path.join(RAW, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MAN, 'utf8'));

const PY = `
import sys, json
from PIL import Image
f = sys.argv[1]
im = Image.open(f).convert("RGB"); px = im.load(); w,h = im.size
step = 8
green = card = 0; tot = 0
for x in range(0, w, step):
    for y in range(0, h, step):
        r,g,b = px[x,y]; tot += 1
        # the felt: green channel clearly ahead of red and blue, and not near-black
        if g > r + 10 and g > b + 6 and g > 24: green += 1
        # a card face: bright and neutral-warm
        if r > 200 and g > 200 and b > 190: card += 1
print(json.dumps({"green": round(100*green/tot,2), "card": round(100*card/tot,2)}))
`;

for (const row of manifest.capturedScenes) {
  const src = row.file;
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', src], { encoding: 'utf8' }).trim());
  let found = null;
  const trace = [];
  for (let t = 0; t < Math.min(dur, 12); t += 0.4) {
    const tmp = `/tmp/action-probe.png`;
    execFileSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(2), '-i', src, '-frames:v', '1', tmp, '-y']);
    const m = JSON.parse(execFileSync('python3', ['-c', PY, tmp], { encoding: 'utf8' }));
    trace.push({ t: +t.toFixed(2), ...m });
    // The game screen is mostly felt AND is showing cards. The splash has neither.
    if (m.green > 18 && m.card > 1.5) { found = +t.toFixed(2); break; }
  }
  row.actionStartSeconds = found;
  row.durationSeconds = +dur.toFixed(2);
  row.usableSeconds = found === null ? 0 : +(dur - found).toFixed(2);
  console.log(`  ${row.scene.padEnd(10)} take ${String(dur.toFixed(1)).padStart(5)}s   ` +
    `action starts ${found === null ? 'NOT FOUND' : found + 's'}   usable ${row.usableSeconds}s` +
    (found === null ? '   <-- no game frame detected' : ''));
  if (found === null) row.trace = trace;
}

fs.writeFileSync(MAN, JSON.stringify(manifest, null, 2));
console.log(`\nwrote actionStartSeconds into ${MAN}\n`);
