/**
 * CAPTURE THE MOMENTS THAT READ IN SILENCE.
 *
 * Five scenes, each a real play-through of the real app in PRACTICE MODE against a LOCAL export.
 * Every one is scripted through the app's own controls — Auto-Place ALL, the READY button, the
 * reveal's own tap target — rather than by writing into its state, so what is filmed is what a
 * player would do.
 *
 * THE SEEDS ARE NOT LUCK. tools/find-seeds.mjs played out a range and recorded what the app said
 * the result was; `win` and `tie` name seeds that produce those outcomes every time. Filming a
 * tie by re-rolling until one appeared would make the clip unreproducible and the claim unbacked.
 *
 * OUTPUT: raw 486x864 VP8/WebM at 25fps, one per scene, into a directory OUTSIDE the repo
 * (default ../caps-content, see tools/README.md). tools/cut.mjs turns them into 1080x1920 MP4.
 *
 *   node tools/capture.mjs
 *   SCENES=tie,win node tools/capture.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, openGame, autoPlaceAll, pressReady, tapThroughReveal, readOutcome, VIEWPORT, FPS } from './content-lib.mjs';

const DIST = process.env.DIST || 'web-slot-dist';
const PORT = Number(process.env.PORT || 8993);
const OUT = path.resolve(process.env.CONTENT_DIR || '../caps-content', 'raw');
fs.mkdirSync(OUT, { recursive: true });

/**
 * The five moments the brief names. `hold` values are generous: the cut stage trims to length, and
 * an over-long take can be shortened while a short one cannot be lengthened.
 */
const SCENES = {
  // The four-day-old green felt, and the slot outlines raised yesterday. No action: this is the
  // table, held still, so the surface is the subject.
  felt: { players: 2, seed: 3, skipReveal: false, async run(page) {
    // 9s, not 6s: cut.mjs needs actionStart(2s) + 9s = 11.0s of usable take, and a 6s hold
    // produced a 10.84s take — 0.16s short — which failed the cut's own length assertion.
    await page.waitForTimeout(9000);
    return { note: 'static table — felt, board panels, empty slot outlines' };
  } },

  // Sixteen cards placed in one tap. The single most "screen recording" moment in the app.
  autoplace: { players: 2, seed: 3, skipReveal: false, async run(page) {
    await page.waitForTimeout(1500);
    await autoPlaceAll(page, { after: 5000 });
    return { note: 'Auto-Place ALL fills 16 cards across 4 boards' };
  } },

  // Board after board turning over. skipBoardReveal stays OFF — this scene IS the reveal.
  reveal: { players: 2, seed: 3, skipReveal: false, async run(page) {
    await autoPlaceAll(page, { after: 1800 });
    await pressReady(page, { after: 2500 });
    const taps = await tapThroughReveal(page, { maxTaps: 10, gap: 2200 });
    await page.waitForTimeout(3000);
    return { note: `per-board reveal, ${taps} taps` };
  } },

  // A win landing. Seed 8 sweeps all four boards, which is the app's top celebration tier.
  win: { players: 2, seed: 8, skipReveal: false, async run(page) {
    await autoPlaceAll(page, { after: 1500 });
    await pressReady(page, { after: 2500 });
    await tapThroughReveal(page, { maxTaps: 10, gap: 2000 });
    await page.waitForTimeout(6000);
    return { note: 'sweep — gold winner cue and the complete-overlay celebration' };
  } },

  // A REAL tie: seed 5 is 2-2 and the app's own headline is "TIE". Seed 4 was used first and is
  // NOT a tie — it is 2-1 with one board tied, which the app calls YOU WIN. The difference was
  // invisible in "boards 2/4" and obvious the moment the results screen was looked at.
  tie: { players: 2, seed: 5, skipReveal: false, async run(page) {
    await autoPlaceAll(page, { after: 1500 });
    await pressReady(page, { after: 2500 });
    await tapThroughReveal(page, { maxTaps: 10, gap: 2000 });
    await page.waitForTimeout(6000);
    return { note: 'tie — 2 boards each, reported as a tie rather than a loss' };
  } },
};

const want = (process.env.SCENES || Object.keys(SCENES).join(',')).split(',');
const server = await serve(DIST, PORT);
const browser = await launch();

// MERGE, DO NOT REPLACE. Writing only the scenes captured in THIS run wiped the other four from
// the manifest the first time SCENES= was used for a single re-take, and cut.mjs needs all of
// them — it reads each source's measured action offset from here.
const MAN = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(MAN)
  ? (JSON.parse(fs.readFileSync(MAN, 'utf8')).capturedScenes ?? []).filter((r) => !want.includes(r.scene))
  : [];

for (const name of want) {
  const scene = SCENES[name];
  if (!scene) { console.log(`  ${name}: no such scene`); continue; }
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const { ctx, page, errs } = await openGame(browser, {
    port: PORT, players: scene.players, seed: scene.seed,
    skipReveal: scene.skipReveal, record: dir, settle: 4500,
  });
  const info = await scene.run(page);
  const outcome = /results/.test(page.url()) ? await readOutcome(page) : null;
  await ctx.close();   // the video is only flushed on context close

  const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  const full = file ? path.join(dir, file) : null;
  const bytes = full ? fs.statSync(full).size : 0;
  const row = { scene: name, seed: scene.seed, players: scene.players, file: full, bytes,
                note: info.note, endedOn: page.url().replace(/^http:\/\/localhost:\d+/, ''),
                boardsWon: outcome?.boardsWon ?? null, boardsTotal: outcome?.boardsTotal ?? null,
                pageErrors: errs.length };
  manifest.push(row);
  console.log(`  ${name.padEnd(10)} ${String(Math.round(bytes / 1024)).padStart(5)} KB  ` +
    `ended ${row.endedOn}  boards ${row.boardsWon ?? '-'}/${row.boardsTotal ?? '-'}  errs ${errs.length}`);
}

await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'),
  JSON.stringify({ viewport: VIEWPORT, fps: FPS, dist: DIST, capturedScenes: manifest }, null, 2));
console.log(`\nwrote ${OUT} (raw takes + manifest.json)\n`);
