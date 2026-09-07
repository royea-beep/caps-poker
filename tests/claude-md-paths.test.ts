/**
 * CLAUDE.md TELLS PEOPLE TO RUN COMMANDS. DO ITS PATHS EXIST?
 *
 * ⚠️ WHY THIS EXISTS (THE-LAST-GAPS 2026-09-08). The Visual QA section printed this recipe:
 *
 *     npm run visual-qa:update
 *     git add tests/visual/baselines/
 *
 * `tests/visual/baselines/` does not exist — not empty, ABSENT — so the second line fails outright,
 * and the snapshots the first line refreshes are not the ones CI compares (CI runs `npx backstop
 * test` against `backstop_data/bitmaps_reference/`). A recipe aimed at a file nothing reads is the
 * same shape as the catch-all 404 fix that went into the vercel.json production never opens, and
 * this project has now paid for that shape six times.
 *
 * So: every repo path CLAUDE.md hands to `git add` must exist on disk. Cheap, and it fails the
 * moment the instructions drift away from the tree again.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

/**
 * ⚠️ FENCED BLOCKS ONLY, AND THAT NARROWING IS THE POINT.
 * The first version of this file scanned the whole document, and it failed on the sentence that
 * DOCUMENTS the broken recipe — prose quoting `git add tests/visual/baselines/` while explaining
 * that the path is gone. This project has already paid for that mistake once, on the explainer
 * caption rule, and wrote down what it costs: a guard that fails correct content teaches the next
 * person to delete the guard. A ``` block is a thing someone runs; a sentence is a thing someone
 * reads. Only the first has to resolve.
 */
const fenced = [...md.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
const gitAddPaths = [...fenced.matchAll(/^\s*git add\s+([^\n]+)$/gm)]
  .flatMap((m) => m[1].trim().split(/\s+/))
  .filter((p) => !p.startsWith('-') && !p.includes('*') && p !== '.');

describe('CLAUDE.md instructions point at paths that exist', () => {
  it('finds the git add lines it is meant to check (the probe is not vacuous)', () => {
    expect(gitAddPaths.length).toBeGreaterThan(0);
  });

  it.each(gitAddPaths)('`git add %s` names a path that exists', (p) => {
    expect([p, fs.existsSync(path.join(ROOT, p))]).toEqual([p, true]);
  });

  // The specific correction this file was born from, pinned both ways.
  it('no longer tells anyone to add the baselines directory that does not exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'tests/visual/baselines'))).toBe(false);
    expect(fenced).not.toMatch(/git add\s+tests\/visual\/baselines/);
  });

  it('still names the baselines CI actually compares', () => {
    expect(md).toMatch(/backstop_data\/bitmaps_reference/);
    expect(fs.existsSync(path.join(ROOT, 'backstop_data/bitmaps_reference'))).toBe(true);
  });

  it('carries the filename rule the six repeats earned', () => {
    expect(md).toMatch(/A FILENAME IS NOT EVIDENCE/);
    expect(md).toMatch(/verify at the place that actually SHIPS/i);
  });
});
