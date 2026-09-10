#!/usr/bin/env node
/**
 * FALSE-POSITIVE SWEEP for the secret guard.
 *
 * A guard that blocks real work gets disabled by the next person who hits it, and then it is not a
 * guard at all — it is a deleted line in a config file. So the rate at which it refuses ORDINARY
 * commits is a property worth measuring, not assuming.
 *
 * This replays the guard over the real commit history: for each commit, scan the files that commit
 * added or modified, reading their bytes AT that commit. A commit the guard would have refused is
 * either a true positive (it really did carry a credential) or a false positive. Both are printed;
 * the caller judges which is which, because only a human knows whether a string was live.
 *
 *   node tests/secret-scan-falsepos.mjs [count]     default 60 commits
 */
import { execFileSync } from 'node:child_process';

const COUNT = Number(process.argv[2] ?? 60);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const shas = git(['log', '--format=%H', '-n', String(COUNT)]).split('\n').filter(Boolean);
const blocked = [];
let scannedCommits = 0;
let scannedFiles = 0;

for (const sha of shas) {
  const files = git(['show', '--pretty=format:', '--name-only', '--diff-filter=ACM', sha])
    .split('\n').filter(Boolean);
  if (!files.length) continue;           // merge commits and empty diffs have nothing to judge
  scannedCommits++;
  scannedFiles += files.length;
  let out = '';
  try {
    execFileSync('node', ['scripts/scan-secrets.mjs', '--rev', sha], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = String(e.stderr ?? '');
    const hits = out.split('\n').filter((l) => l.includes('BLOCKED')).map((l) => l.trim());
    blocked.push({ sha, subject: git(['show', '-s', '--format=%s', sha]).trim(), hits });
  }
}

const rate = scannedCommits ? (blocked.length / scannedCommits) * 100 : 0;
console.log(`commits scanned : ${scannedCommits}  (of the last ${shas.length}; merges/empty skipped)`);
console.log(`files scanned   : ${scannedFiles}`);
console.log(`commits blocked : ${blocked.length}`);
console.log(`block rate      : ${rate.toFixed(1)}%`);
if (blocked.length) {
  console.log('\nEvery blocked commit, for a human to classify true/false positive:');
  for (const b of blocked) {
    console.log(`\n  ${b.sha.slice(0, 9)}  ${b.subject.slice(0, 78)}`);
    for (const h of b.hits) console.log(`    ${h}`);
  }
}
