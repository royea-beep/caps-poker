/**
 * THE STORE SET, CHECKED BY PIXELS — not by filename, not by the DOM. STORE-SHOTS 2026-09-08.
 *
 * ⚠️ WHY OCR AND NOT innerText. The landing page shipped HEBREW screenshots on its ENGLISH page,
 * and every text-based check passed, because a word baked into a PNG is not a text node. The
 * capture tool had ignored the language parameter and saved one image under two names. So the
 * only honest way to say "these are English" is to read the PIXELS of the file that will be
 * uploaded.
 *
 * ⚠️ AND THE DETECTOR IS NOT A UNICODE-RANGE COUNT. A Hebrew-trained OCR model transliterates
 * Latin glyphs into Hebrew-looking ones — an earlier run of this idea reported 61 "Hebrew
 * characters" in a fully English screenshot. So the text is matched against the PRODUCT'S OWN
 * Hebrew strings, every Hebrew token of 3+ characters in the `he` table of utils/i18n.ts. A hit
 * means the image contains a word the app actually renders in Hebrew, not OCR noise.
 *
 * CANARY BOTH WAYS, as this project's probes are required to be:
 *   · a known-Hebrew image must be FLAGGED
 *   · a known-English image must come back CLEAN
 * If either misbehaves the run aborts and reports nothing about the set.
 *
 * ALSO ASSERTED, because a store asset can be English and still be wrong:
 *   · NO DEMO BALANCE. A rejected explainer frame carried 499,900 while the richest real player
 *     holds 3,250. Every number that looks like a balance must be plausible.
 *   · NO EMPTY STATE. "Shop is empty", "No achievements", "No hands yet", "No stats yet".
 *   · EVERY FILE the real pixel size its name claims.
 *
 *   npm i --no-save tesseract.js && node tests/store-shots-verify.mjs
 */
import { createWorker } from 'tesseract.js';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = process.env.DIR || 'docs/product-map/store-515';
const TMP = '/tmp/store-shots-ocr';
fs.mkdirSync(TMP, { recursive: true });

// ── the product's own Hebrew vocabulary ───────────────────────────────────────────────────────
const i18n = fs.readFileSync('utils/i18n.ts', 'utf-8');
/**
 * ⚠️ FOUR CHARACTERS, NOT THREE, AND THE REASON IS A FALSE POSITIVE I HIT ON THIS EXACT SET.
 * At a 3-character floor the run flagged "חבר" (friend) on the profile shot and "הוא" on hand
 * history. Neither screen contains a word of Hebrew — I had looked at both. A Hebrew-trained OCR
 * model hallucinates short Hebrew-looking tokens out of Latin glyphs, and the shorter the token
 * the likelier the collision. The canary image did not catch it because it is a game screen and
 * these are list screens with different type.
 *
 * A detector that fails clean assets teaches the next person to delete the detector. Raising the
 * floor to 4 removes the noise, and the canary below re-proves that a genuinely Hebrew image is
 * STILL flagged at the new floor — otherwise the run aborts and reports nothing.
 */
const MIN_TOKEN = 4;
const VOCAB = [...new Set(
  [...i18n.matchAll(/'([^']*[֐-׿][^']*)'/g)]
    .flatMap((m) => m[1].match(/[֐-׿']{4,}/g) ?? [])
    .map((w) => w.replace(/'/g, ''))
    .filter((w) => w.length >= MIN_TOKEN),
)];

let worker = null;      // Hebrew model — for the language check
let engWorker = null;   // English model — for the numbers and the empty-state strings
async function ocr(file) {
  worker ??= await createWorker('heb', undefined, { cachePath: TMP });
  const { data } = await worker.recognize(file);
  return data.text.replace(/\s+/g, ' ');
}
/**
 * ⚠️ A SECOND MODEL, BECAUSE THE FIRST RUN'S NUMBER CHECK WAS VACUOUS. The Hebrew model read the
 * balances as nothing at all — every file came back `numbers=[]`, so "no demo balance" passed
 * without ever having seen a balance. A check that cannot fail is not a check. Balances and the
 * empty-state phrases are read with the ENGLISH model, which is the one that can actually see them.
 */
async function ocrEng(file) {
  engWorker ??= await createWorker('eng', undefined, { cachePath: TMP });
  const { data } = await engWorker.recognize(file);
  return data.text.replace(/\s+/g, ' ');
}
const hebrewIn = (text) => VOCAB.filter((w) => text.includes(w));

// ── CANARY ────────────────────────────────────────────────────────────────────────────────────
const canary = { vocabSize: VOCAB.length };
{
  const heb = 'tests/fixtures/live-2026-09-05-game-boards.webp';
  const eng = 'public/shots/game-boards-en.webp';
  const toPng = (src, name) => {
    const dst = `${TMP}/${name}.png`;
    execFileSync('ffmpeg', ['-y', '-i', src, dst], { stdio: 'ignore' });
    return dst;
  };
  canary.knownHebrewHits = hebrewIn(await ocr(toPng(heb, 'canary-he'))).length;
  canary.knownEnglishHits = hebrewIn(await ocr(toPng(eng, 'canary-en'))).length;
  canary.flagsHebrew = canary.knownHebrewHits > 0;
  canary.clearsEnglish = canary.knownEnglishHits === 0;
  if (!canary.flagsHebrew || !canary.clearsEnglish) {
    console.log(JSON.stringify({ CANARY_FAILED: canary }, null, 1));
    process.exit(2);
  }
  console.log(`CANARY ok — flags a Hebrew image (${canary.knownHebrewHits} hits), clears an English one (0). Vocabulary ${VOCAB.length} words.`);
}

// ── what must never appear in a store asset ───────────────────────────────────────────────────
const EMPTY = /shop is empty|no achievements|no hands yet|no stats yet|no rank yet|no players yet|no coaching yet|nothing here|coming soon/i;
/** A balance a real player could not hold. The richest row in the database is 3,250. */
const IMPLAUSIBLE = 20000;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
const rows = [];
const fail = [];

for (const f of files) {
  const file = path.join(DIR, f);
  const dim = execFileSync('python3', ['-c',
    'from PIL import Image;import sys;im=Image.open(sys.argv[1]);print(f"{im.size[0]}x{im.size[1]}")', file]).toString().trim();
  const claimed = (f.match(/(\d+x\d+)\.png$/) || [])[1] || null;

  const text = await ocr(file);
  const eng = await ocrEng(file);
  const hebrew = hebrewIn(text);
  const empty = (eng.match(EMPTY) || text.match(EMPTY) || [null])[0];
  // Numbers with thousands separators are what a balance looks like on these screens.
  const bigNumbers = [...new Set((eng.match(/\d{1,3}(?:[.,]\d{3})+/g) || []))]
    .map((n) => Number(n.replace(/[.,]/g, '')))
    .filter((n) => Number.isFinite(n));
  const implausible = bigNumbers.filter((n) => n >= IMPLAUSIBLE);

  const row = { file: f, measured: dim, claimed, sizeOk: dim === claimed,
    hebrewWords: hebrew, emptyState: empty, numbers: bigNumbers, implausible };
  rows.push(row);

  if (!row.sizeOk) fail.push({ ...row, why: `pixel size ${dim} does not match the name's ${claimed}` });
  if (hebrew.length) fail.push({ ...row, why: `HEBREW words baked into an English store asset: ${hebrew.slice(0, 6).join(', ')}` });
  if (empty) fail.push({ ...row, why: `advertises an empty state: "${empty}"` });
  if (implausible.length) fail.push({ ...row, why: `a balance no real player holds: ${implausible.join(', ')}` });

  console.log(`${row.sizeOk && !hebrew.length && !empty && !implausible.length ? 'PASS' : 'FAIL'}  ${f.padEnd(34)} ${dim}  hebrew=${hebrew.length}  numbers=[${bigNumbers.join(' ')}]`);
}

if (worker) await worker.terminate();
if (engWorker) await engWorker.terminate();

// ⚠️ THE NUMBER CHECK MUST HAVE SEEN SOMETHING. If OCR read no balance on ANY file, "no demo
// balance" is a statement about the reader, not the images, and this run must say so rather than
// report a clean pass.
const sawAnyNumber = rows.some((r) => r.numbers.length > 0);
if (!sawAnyNumber) {
  fail.push({ file: '(all)', why: 'VACUOUS: OCR read no balance on any file, so the demo-balance check proved nothing' });
  console.log('FAIL  the balance check saw no numbers at all — it proved nothing');
}
const report = { dir: DIR, canary, files: rows.length, failures: fail, failureCount: fail.length };
fs.writeFileSync(path.join(DIR, 'verify.json'), JSON.stringify(report, null, 1));
console.log(`\n${rows.length - fail.length}/${rows.length} clean`);
if (fail.length) { console.log(JSON.stringify(fail, null, 1)); process.exit(1); }
