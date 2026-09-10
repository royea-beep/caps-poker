/**
 * SOUND ASSETS — every file must be DISTINCT and must carry SIGNAL.
 *
 * WHY BOTH, AND WHY THIS TEST EXISTS
 * ----------------------------------
 * On 2026-03-25 (commit d996c9d) three sound files were dropped into assets/sounds by hand:
 * boardWin.wav, boardLose.wav and revealStart.wav. All three were byte-identical, sha256
 * 3c395893…, 44,178 bytes — and all three were 0.5 SECONDS OF DIGITAL SILENCE: 22,050 frames,
 * every sample exactly 0, written by ffmpeg's null source (the header still carries
 * `ISFT: Lavf62.3.100`). For five and a half months a won board, a lost board and the start of
 * every reveal played nothing at all, while utils/sounds.ts carried a volume for each and
 * components/BoardReveal.tsx called playSound() for each. Sound is ON by default.
 *
 * It survived because the web QA rigs run muted and native has never been verified on a device.
 *
 * ⚠️ THE PART THAT MATTERS FOR THIS TEST: sha256 equality proved the three files were THE SAME.
 * It did NOT prove what they were. A uniqueness check alone would have passed happily on three
 * DIFFERENT silent files — and the first audit to look at this reported "a lost board plays the
 * win chime", which was wrong, because it compared hashes and never read a sample.
 *
 * So this asserts BOTH, and neither assertion is sufficient alone:
 *   1. no two sound files share a sha256   (catches copy-paste placeholders)
 *   2. every sound file carries real signal (catches silence, however it arrived)
 *
 * A third assertion keeps the two honest: every name declared in SoundName must resolve to a
 * file that exists, so a declaration can never quietly point at nothing.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/** Minimal RIFF/WAVE reader — finds the `data` chunk and returns 16-bit PCM samples. */
function readWavSamples(file: string): { samples: Int16Array; sampleRate: number; channels: number } {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let data: Buffer | null = null;

  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4).toString('ascii');
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      channels = body.readUInt16LE(2);
      sampleRate = body.readUInt32LE(4);
      bitsPerSample = body.readUInt16LE(14);
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }

  if (!data) throw new Error(`${path.basename(file)}: no data chunk`);
  if (bitsPerSample !== 16) throw new Error(`${path.basename(file)}: expected 16-bit, got ${bitsPerSample}`);
  return {
    samples: new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2)),
    sampleRate,
    channels,
  };
}

function peakAmplitude(samples: Int16Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

function rms(samples: Int16Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length) / 32768;
}

const wavFiles = fs
  .readdirSync(SOUNDS_DIR)
  .filter((f) => f.toLowerCase().endsWith('.wav'))
  .sort();

describe('sound assets', () => {
  it('there are sound files to check (guards against an empty-set pass)', () => {
    // A test whose pass condition is a zero passes just as loudly when the instrument is broken.
    expect(wavFiles.length).toBeGreaterThanOrEqual(11);
  });

  it('no two sound files are byte-identical', () => {
    const byHash = new Map<string, string[]>();
    for (const f of wavFiles) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(SOUNDS_DIR, f))).digest('hex');
      byHash.set(hash, [...(byHash.get(hash) ?? []), f]);
    }
    const duplicates = [...byHash.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([hash, files]) => `${files.join(' == ')} (sha256 ${hash.slice(0, 16)})`);
    expect(duplicates).toEqual([]);
  });

  it.each(wavFiles)('%s carries signal — it is not silence', (file) => {
    const { samples, sampleRate } = readWavSamples(path.join(SOUNDS_DIR, file));
    expect(samples.length).toBeGreaterThan(0);
    expect(sampleRate).toBe(44100);

    // The defect this catches: peak === 0 across every sample.
    const peak = peakAmplitude(samples);
    expect(peak).toBeGreaterThan(0);

    // And a file that is technically non-zero but inaudible is the same bug wearing a hat.
    // The quietest real sound in the set (buzzer) measures ~0.045 RMS; 0.01 is a floor no
    // deliberate sound falls below, and silence-with-a-click cannot clear it.
    expect(rms(samples)).toBeGreaterThan(0.01);

    // No clipping: a sample pinned at the rail means the file was normalised past full scale.
    expect(peak).toBeLessThan(32767);
  });

  it('every SoundName declared in utils/sounds.ts resolves to a file that exists', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'sounds.ts'), 'utf8');

    const typeBlock = src.slice(src.indexOf('export type SoundName'), src.indexOf(';', src.indexOf('export type SoundName')));
    const declared = [...typeBlock.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThanOrEqual(11);

    // Each name must have a require() line, and the file it names must be on disk. The three
    // names that reuse another sound at a different volume (turnReveal / riverReveal /
    // boardTransition) are legitimate and covered by this: they must still point at a REAL file.
    const missing: string[] = [];
    for (const name of declared) {
      const m = src.match(new RegExp(`soundFiles\\.${name}\\s*=\\s*require\\('\\.\\./assets/sounds/([^']+)'\\)`));
      if (!m) {
        missing.push(`${name}: no require() line`);
        continue;
      }
      if (!fs.existsSync(path.join(SOUNDS_DIR, m[1]))) missing.push(`${name}: requires ${m[1]}, which does not exist`);
    }
    expect(missing).toEqual([]);
  });
});
