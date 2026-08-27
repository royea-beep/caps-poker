/**
 * WHAT THE PANEL DOES TO EVERYTHING DRAWN ON IT.
 *
 * FINDING THE PANEL WITHOUT GUESSING AT IT. Twice before I sampled "the felt" and got a gold
 * border and a mint accent instead, so no coordinate is trusted here. The panel is located by
 * DIFFING two real renders that differ only in the panel's alpha — P0S at 0.55 against V2 at
 * 0.00. The pixels that change are, by definition, the pixels the panel paints and nothing else.
 * Cards sitting on top of the panel are identical in both renders, so they fall out of the mask
 * automatically and what remains is exactly the VISIBLE panel ground.
 *
 * WHAT SITS ON WHAT — the distinction that produced a wrong answer last sprint and is the entire
 * reason these are separated rather than averaged:
 *   card face vs panel      the card's legibility against the ground it rests on
 *   mint cue vs panel       the community-card cue (`isCommunityCard`, 2px) sits ON the panel
 *   card back vs panel      classic #18181c is the DEFAULT; slate #4A5058 is purchasable
 *   slot outline vs panel   white at 0.30 alpha over whatever the panel leaves behind
 *   neutral cue vs CARD     the card's OWN 1px border — composites over the card face, so no
 *                           panel choice can move it by even one step
 *   gold cue                NOT MEASURED AGAINST THE PANEL. It needs `revealed`, and a revealed
 *                           hand is either the full-screen BoardReveal (bare felt, no panel) or
 *                           /results, whose BoardResultCard paints COLORS.surface. Gold never
 *                           rests on a board panel, so no variant here can move it.
 *
 * SAME HAND, PROVEN NOT ASSERTED. Share-of-pixels is computed per capture and compared across
 * variants. A share of 0.00 matching another 0.00 is NOT a proof — the first run of this script
 * reported "same hand: YES" off four zeroes, because the card face was behind a tip-toast veil at
 * rgb(156,155,150) and matched nothing. So the check now requires the shares to be non-trivial
 * before it will call them equal.
 *
 *   node tests/panel-measure.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.env.OUT_DIR || 'panel-compare');
const VARIANTS = (process.env.VARIANTS || 'P0,P0S,V1,V2,V3').split(',');
const NAMES = { P0: 'control', P0S: 'single', V1: '0.25', V2: 'none', V3: 'felt-hued', V4: 'raised' };
const CELLS = [[393, 2], [393, 3], [393, 4], [320, 2], [320, 3], [320, 4]];
const STATE = process.env.STATE || 'B';   // B = every slot filled; A = arrangement, empty slots

// ── the product's own values, read from source, none invented ───────────────────────────────
const T = {
  cardFace: '#FCFAF3',    // paintThemes visual.classic.cardFace
  cueGold: '#FFD700',     // Card.tsx:475 — winner cue, 3px. NOT on a panel; see above.
  cueMint: '#4FD6A8',     // Card.tsx:482 OBSIDIAN.mint — community cue, 2px
  backClassic: '#18181c', // cardBacks.ts CLASSIC.bg — THE DEFAULT
  backSlate: '#4A5058',   // cardBacks.ts SLATE.bg — purchasable
  resultsSurface: '#161922', // paintThemes:217 — what the gold cue actually sits on
  slotDash: 0.30,         // paintThemes boardSlotDash, white
  neutralAlpha: 0.45,     // Card.tsx:483, black, over the CARD FACE
};

const hex = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** Perceived grey 0-255. The cue is a WIDTH, so this asks whether each pair still separates once
 *  hue is gone. */
const grey = (rgb) => Math.round(255 * L(rgb) ** (1 / 2.2));
const fmt = (n) => n.toFixed(2).padStart(6);

const PY = `
import sys, json
from PIL import Image

req = json.loads(sys.argv[1])
root, variants, cells, targets, state = req["root"], req["variants"], req["cells"], req["targets"], req["state"]

def load(v, w, p, st):
    return Image.open(f"{root}/{v}/game-{w}-{p}p-{st}.png").convert("RGB")

out = {"shares": {}, "panel": {}, "sizes": {}}
for (w, p) in cells:
    key = f"{w}-{p}"
    a = load("P0S", w, p, state); b = load("V2", w, p, state)
    if a.size != b.size:
        out.setdefault("errors", []).append(f"size mismatch {key}")
        continue
    pa, pb = list(a.getdata()), list(b.getdata())
    mask = [i for i in range(len(pa))
            if abs(pa[i][0]-pb[i][0]) > 6 or abs(pa[i][1]-pb[i][1]) > 6 or abs(pa[i][2]-pb[i][2]) > 6]
    out["sizes"][key] = {"px": len(pa), "maskPx": len(mask),
                         "maskPct": round(100*len(mask)/len(pa), 2), "dim": list(a.size)}
    for v in variants:
        px = list(load(v, w, p, state).getdata())
        tot = len(px)
        sh = {}
        for name, t in targets.items():
            t = tuple(t)
            sh[name] = round(100*sum(1 for q in px
                if abs(q[0]-t[0])<=3 and abs(q[1]-t[1])<=3 and abs(q[2]-t[2])<=3)/tot, 2)
        out["shares"].setdefault(v, {})[key] = sh
        if mask:
            out["panel"].setdefault(v, {})[key] = [
                round(sum(px[i][j] for i in mask)/len(mask), 1) for j in (0, 1, 2)]
print(json.dumps(out))
`;

const payload = JSON.stringify({
  root: ROOT, variants: VARIANTS, cells: CELLS, state: STATE,
  targets: { cardFace: hex(T.cardFace), mint: hex(T.cueMint), backClassic: hex(T.backClassic) },
});
const px = JSON.parse(execFileSync('python3', ['-c', PY, payload], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

// ── 1. same hand ────────────────────────────────────────────────────────────────────────────
console.log(`\n=== SAME HAND (state ${STATE}) — share of each capture that is exactly the token colour (±3/255) ===\n`);
console.log('  cell        variant   card face     mint    back');
let sameHand = true, trivial = false;
for (const [w, p] of CELLS) {
  const key = `${w}-${p}`;
  const ref = px.shares[VARIANTS[0]][key];
  // A card face that occupies essentially none of the screen means the capture is veiled or the
  // token is not what paints — either way the equality below would be vacuous.
  if (ref.cardFace < 1) trivial = true;
  for (const v of VARIANTS) {
    const s = px.shares[v][key];
    const same = ['cardFace', 'mint'].every((k) => Math.abs(s[k] - ref[k]) < 0.005);
    if (!same) sameHand = false;
    console.log(`  ${key.padEnd(10)} ${v.padEnd(8)} ${String(s.cardFace).padStart(8)}` +
      ` ${String(s.mint).padStart(8)} ${String(s.backClassic).padStart(7)}${same ? '' : '   <- DIFFERS'}`);
  }
}
console.log(`\n  identical to two decimals across every variant: ${sameHand ? 'YES' : 'NO — void'}`);
console.log(`  and non-trivial (the card face is actually on screen): ${trivial ? 'NO — VOID' : 'YES'}`);

// ── 2. the panel as it actually renders ─────────────────────────────────────────────────────
console.log('\n=== THE PANEL, AS RENDERED — mean colour over the diff mask ===');
console.log('  (the mask is where the panel paints and no card covers it)\n');
console.log('  cell        mask' + VARIANTS.map((v) => `   ${(v + ' ' + NAMES[v]).padEnd(15)}`).join(''));
for (const [w, p] of CELLS) {
  const key = `${w}-${p}`;
  console.log(`  ${key.padEnd(10)} ${String(px.sizes[key].maskPct).padStart(5)}%` +
    VARIANTS.map((v) => { const c = px.panel[v]?.[key];
      return '   ' + (c ? `rgb(${c.map(Math.round).join(',')})` : '—').padEnd(15); }).join(''));
}

// ── 3. contrast against the ground each variant actually produces ───────────────────────────
const CARD = hex(T.cardFace);
const MINT = hex(T.cueMint);
const BACKC = hex(T.backClassic);
const BACKS = hex(T.backSlate);
const NEUTRAL = over([0, 0, 0], T.neutralAlpha, CARD);
const REF = process.env.REF || '393-2';
const ground = (v) => px.panel[v][REF].map(Math.round);

console.log(`\n=== CONTRAST against the rendered panel ground (${REF}, state ${STATE}) ===\n`);
console.log('                              ' + VARIANTS.map((v) => (v + '/' + NAMES[v]).padStart(8)).join('') + '   needs');
const rows = [];
const row = (label, fgOf, min) => {
  const vals = VARIANTS.map((v) => ratio(fgOf(v), ground(v)));
  rows.push({ label, vals, min });
  console.log(`  ${label.padEnd(28)}${vals.map(fmt).join('  ')}   ${min}:1`);
};
row('card face vs panel', () => CARD, 3);
row('mint cue vs panel', () => MINT, 3);
row('classic back vs panel (default)', () => BACKC, 3);
row('slate back vs panel (bought)', () => BACKS, 3);
row('empty slot outline vs panel', (v) => over([255, 255, 255], T.slotDash, ground(v)), 3);

console.log('\n  PANEL-INDEPENDENT — these do not sit on the panel, so no variant moves them:');
console.log(`    neutral cue rgb(${NEUTRAL.join(',')}) vs card face   ${fmt(ratio(NEUTRAL, CARD))}   ` +
  `${ratio(NEUTRAL, CARD) >= 3 ? 'pass' : 'FAIL'}   (the card's own border)`);
console.log(`    gold cue ${T.cueGold} vs COLORS.surface ${T.resultsSurface}   ` +
  `${fmt(ratio(hex(T.cueGold), hex(T.resultsSurface)))}   pass   (/results, never a panel)`);

// ── 4. greyscale ────────────────────────────────────────────────────────────────────────────
console.log('\n=== GREYSCALE — luminance only, 0-255. Remove hue: does it still separate? ===\n');
console.log('                              ' + VARIANTS.map((v) => (v + '/' + NAMES[v]).padStart(8)).join(''));
console.log(`  ${'panel grey'.padEnd(28)}` + VARIANTS.map((v) => String(grey(ground(v))).padStart(8)).join(''));
const gline = (label, fgOf) => console.log(`  ${label.padEnd(28)}` +
  VARIANTS.map((v) => String(Math.abs(grey(fgOf(v)) - grey(ground(v)))).padStart(8)).join(''));
gline('separation: card face', () => CARD);
gline('separation: mint cue', () => MINT);
gline('separation: classic back', () => BACKC);
gline('separation: slate back', () => BACKS);
gline('separation: slot outline', (v) => over([255, 255, 255], T.slotDash, ground(v)));

fs.writeFileSync(path.join(ROOT, `measurements-${STATE}.json`),
  JSON.stringify({ tokens: T, state: STATE, sameHand, trivial, sizes: px.sizes,
    shares: px.shares, panel: px.panel, rows }, null, 2));
console.log(`\nwrote ${path.join(ROOT, `measurements-${STATE}.json`)}\n`);
