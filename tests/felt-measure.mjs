/**
 * THE NUMBERS BESIDE THE PICTURES.
 *
 * Two independent passes, because a contrast figure computed from a token is only a claim about
 * what the renderer did:
 *
 *   ANALYTIC   WCAG 2.x relative-luminance contrast from the exact token values.
 *   SAMPLED    the same quantities read back out of the rendered PNG, by locating each token's
 *              own colour in the pixels rather than by trusting coordinates. If the two disagree,
 *              the render is not showing what the tokens say and every number here is void.
 *
 * WHERE A COLOUR ACTUALLY SITS MATTERS, and the report says so rather than blurring it:
 *   - the suit pip's legibility is against the CARD FACE, which no felt changes;
 *   - the pip against the FELT is an adjacency/hue-collision question, which is the real
 *     burgundy risk and is measured separately;
 *   - the winner cue sits directly on the felt, so cue-vs-felt is the load-bearing one.
 *
 * GREYSCALE is not a filter over the picture — the cue is a WIDTH, so the question is whether
 * card, felt and cue still separate by luminance alone once hue is gone.
 *
 *   node tests/felt-measure.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = path.resolve(process.env.OUT_DIR || 'felt-compare');
const { T, FELTS } = JSON.parse(fs.readFileSync(path.join(DIR, 'tokens.json'), 'utf8'));

// ── colour maths ────────────────────────────────────────────────────────────────────────────
const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
/** Composite a straight-alpha colour over a backdrop — the neutral cue is rgba(0,0,0,.22). */
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** Perceived grey, 0-255, from relative luminance — what survives when hue is removed. */
const grey = (rgb) => Math.round(255 * L(rgb) ** (1 / 2.2));

const CARD = hex(T.cardFace);
const RED = hex(T.suitRed);
const RED_LEGACY = hex(T.suitRedLegacy);
const GOLD = hex(T.cueGold);
const MINT = hex(T.cueMint);

const fmt = (n) => n.toFixed(2).padStart(5);
const pass = (r, min) => (r >= min ? 'pass' : 'FAIL');

const rows = [];
console.log('\n=== ANALYTIC — WCAG contrast, from the exact tokens ===\n');
console.log('                                    A green   B burgundy   C near-black');
const line = (label, fn) => {
  const v = FELTS.map((f) => fn(hex(f.felt)));
  console.log(`  ${label.padEnd(32)} ${v.map((x) => fmt(x)).join('      ')}`);
  rows.push({ label, a: v[0], b: v[1], c: v[2] });
  return v;
};

const cardVsFelt = line('card face vs felt', (f) => ratio(CARD, f));
const goldVsFelt = line('gold cue vs felt', (f) => ratio(GOLD, f));
const mintVsFelt = line('mint cue vs felt', (f) => ratio(MINT, f));
// THE NEUTRAL CUE IS THE CARD'S OWN BORDER (components/Card.tsx:483), so it composites over the
// CARD FACE, not over the felt. Measured both ways because both matter and they differ wildly:
// against the card it is the cue's own legibility; against the felt it is whether the card has a
// defined edge at all. My first pass composited it over the felt and was simply wrong about where
// the pixel sits.
const NEUTRAL = over([0, 0, 0], 0.22, CARD);
const neutVsCard = ratio(NEUTRAL, CARD);
const neutVsFelt = line('neutral cue (on card) vs felt', (f) => ratio(NEUTRAL, f));
const redVsFelt  = line('suit red vs felt (adjacency)', (f) => ratio(RED, f));
const redLegVsFelt = line('  legacy red #CC0000 vs felt', (f) => ratio(RED_LEGACY, f));

console.log('\n  Constant across all three — the pip sits on the card, not the felt:');
console.log(`    suit red  #c41e3a  vs card face   ${fmt(ratio(RED, CARD))}   ${pass(ratio(RED, CARD), 4.5)}`);
console.log(`    legacy    #CC0000  vs card face   ${fmt(ratio(RED_LEGACY, CARD))}   ${pass(ratio(RED_LEGACY, CARD), 4.5)}`);
console.log(`    suit black#18181b  vs card face   ${fmt(ratio(hex(T.suitBlack), CARD))}   ${pass(ratio(hex(T.suitBlack), CARD), 4.5)}`);
console.log(`    neutral cue rgb(${NEUTRAL.join(',')}) vs card face   ${fmt(neutVsCard)}   ${pass(neutVsCard, 3)}  <- the cue against its OWN substrate`);

console.log('\n=== GREYSCALE — luminance only, 0-255. The cue is a WIDTH; this asks whether the');
console.log('    three still separate without hue.\n');
console.log('                       A green   B burgundy   C near-black');
const g = (rgb) => String(grey(rgb)).padStart(5);
console.log(`  card face          ${FELTS.map(() => g(CARD)).join('      ')}`);
console.log(`  felt               ${FELTS.map((f) => g(hex(f.felt))).join('      ')}`);
console.log(`  gold cue           ${FELTS.map(() => g(GOLD)).join('      ')}`);
console.log(`  mint cue           ${FELTS.map(() => g(MINT)).join('      ')}`);
console.log(`  neutral cue        ${FELTS.map(() => g(NEUTRAL)).join('      ')}`);
console.log('');
for (const f of FELTS) {
  const fg = grey(hex(f.felt));
  const sep = (x) => Math.abs(grey(x) - fg);
  console.log(`  ${f.id} separation from felt:  card ${String(sep(CARD)).padStart(3)}` +
    `   gold ${String(sep(GOLD)).padStart(3)}   mint ${String(sep(MINT)).padStart(3)}` +
    `   neutral ${String(sep(NEUTRAL)).padStart(3)}`);
}

// ── SAMPLED — read the same quantities back out of the render ───────────────────────────────
console.log('\n=== SAMPLED — the same colours located in the rendered PNG ===\n');
const py = `
import sys, json
from PIL import Image
im = Image.open("${path.join(DIR, 'felts-393.png')}").convert("RGB")
w,h = im.size
third = w//3
want = json.loads(sys.argv[1])
out = {}
for i,(pid, felt) in enumerate(want["felts"]):
    box = im.crop((i*third, 0, (i+1)*third, h))
    px = list(box.getdata())
    tot = len(px)
    counts = {}
    for name, target in want["targets"].items():
        t = tuple(target)
        n = sum(1 for p in px if abs(p[0]-t[0])<=2 and abs(p[1]-t[1])<=2 and abs(p[2]-t[2])<=2)
        counts[name] = round(100*n/tot, 2)
    ft = tuple(felt)
    nf = sum(1 for p in px if abs(p[0]-ft[0])<=3 and abs(p[1]-ft[1])<=3 and abs(p[2]-ft[2])<=3)
    counts["felt"] = round(100*nf/tot, 2)
    out[pid] = counts
print(json.dumps(out))
`;
const payload = JSON.stringify({
  felts: FELTS.map((f) => [f.id, hex(f.felt)]),
  targets: { cardFace: CARD, gold: GOLD, mint: MINT },
});
const sampled = JSON.parse(execFileSync('python3', ['-c', py, payload], { encoding: 'utf8' }));
console.log('  % of each panel that is exactly the token colour (±2/255):');
console.log('                      card face    felt     gold cue   mint cue');
for (const f of FELTS) {
  const s = sampled[f.id];
  console.log(`  ${f.id} ${f.name.padEnd(16)} ${String(s.cardFace).padStart(6)}  ${String(s.felt).padStart(7)}` +
    `  ${String(s.gold).padStart(8)}  ${String(s.mint).padStart(8)}`);
}
const ok = FELTS.every((f) => sampled[f.id].cardFace > 3 && sampled[f.id].felt > 5);
console.log(`\n  render matches the tokens: ${ok ? 'YES' : 'NO — the numbers above are void'}`);

fs.writeFileSync(path.join(DIR, 'measurements.json'),
  JSON.stringify({ analytic: rows, sampled, cardVsFelt, goldVsFelt, mintVsFelt, neutVsFelt, redVsFelt }, null, 2));
console.log(`\nwrote ${path.join(DIR, 'measurements.json')}\n`);
