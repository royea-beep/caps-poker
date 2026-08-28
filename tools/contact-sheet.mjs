/**
 * WATCH ALL TEN — one sheet per video, a frame under every caption.
 *
 * Two of the ten shipped wrong and every automated check passed on both: correct length, correct
 * dimensions, captions on time. One was a loading spinner and one said "Nobody wins" over a screen
 * reading YOU WIN. The base rate for this failure is therefore 2 in 10, and the only thing that
 * has ever caught it is opening the file.
 *
 * So this samples the MIDDLE OF EVERY CAPTION CUE and lays the frames out in order with the words
 * printed above them. The question each sheet has to answer is not "is it pretty" but: DOES THE
 * FOOTAGE UNDER THIS SENTENCE SUPPORT THE SENTENCE?
 *
 *   node tools/contact-sheet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
const OUT = path.join(CONTENT, 'sheets');
fs.mkdirSync(OUT, { recursive: true });
const specs = JSON.parse(fs.readFileSync('tools/videos.json', 'utf8')).videos;

const PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
req = json.loads(sys.argv[1])
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f = ImageFont.truetype(FONT, 15)
fs_ = ImageFont.truetype(FONT, 13)
tiles = []
for shot, label, t in req["frames"]:
    im = Image.open(shot).convert("RGB")
    im.thumbnail((300, 540))
    tiles.append((im, label, t))
pad, head = 10, 62
W = sum(t[0].width for t in tiles) + pad*(len(tiles)+1)
H = max(t[0].height for t in tiles) + head + pad
out = Image.new("RGB", (W, H), (14,14,16))
d = ImageDraw.Draw(out)
d.text((pad, 8), req["title"], font=f, fill=(255,215,0))
x = pad
for im, label, t in tiles:
    out.paste(im, (x, head))
    lines = label.split("\\n")
    for i, ln in enumerate(lines):
        d.text((x, head - 34 + i*15), ln[:38], font=fs_, fill=(235,235,235))
    d.text((x, head - 4 + im.height + 2), f"t={t}s", font=fs_, fill=(150,150,150))
    x += im.width + pad
out.save(req["dest"])
print(req["dest"])
`;

for (const spec of specs) {
  const src = path.join(CONTENT, 'out', `${spec.id}.mp4`);
  const frames = [];
  for (const c of spec.cues) {
    const t = +(c.t + c.d / 2).toFixed(2);
    const shot = `/tmp/cs-${spec.id}-${t}.png`;
    execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', src, '-frames:v', '1', shot, '-y']);
    frames.push([shot, c.text, t]);
  }
  const dest = path.join(OUT, `${spec.id}.png`);
  execFileSync('python3', ['-c', PY, JSON.stringify({
    frames, dest, title: `${spec.id}  (${spec.kind}, ${spec.duration}s, source: ${spec.source})`,
  })], { encoding: 'utf8' });
  console.log(`  ${dest}`);
}
console.log(`\n  ${specs.length} sheets in ${OUT}\n`);
