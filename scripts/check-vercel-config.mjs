#!/usr/bin/env node
/**
 * VALIDATE vercel.json AGAINST THE CONSTRAINTS VERCEL ACTUALLY ENFORCES — both files.
 *
 * WHY THIS EXISTS, AND WHY tests/vercel-rewrites.test.ts WAS NOT ENOUGH
 * ---------------------------------------------------------------------
 * On 2026-09-03 a `_comment_rewrites` ARRAY was added to the root vercel.json to explain a
 * change. JSON has no comments, so it was a real property, and Vercel validates this file
 * against a CLOSED schema BEFORE the project's Ignored Build Step runs. Every Git-integration
 * deploy died at:
 *     should NOT have additional property `_comment_rewrites`
 *
 * On 2026-09-08 that was fixed — and the SAME commit (9577aa5) moved the prose into the VALUE
 * of `installCommand`, as a chain of echo segments, 1,158 characters long. Vercel caps
 * `installCommand` at 256. So the deploys went on failing, with a different message:
 *     `installCommand` should NOT be longer than 256 characters
 *
 * The guard added by that commit checked key NAMES against an allowlist and never looked at a
 * value's length. Measured 2026-09-10: it reported 56 of 56 PASSING on a file Vercel refused to
 * deploy — and four of those 56 assertions REQUIRE the over-long prose to be present, so the
 * guard did not merely miss the violation, it pinned it in place.
 *
 * THE LESSON THIS ENCODES: an allowlist of KEYS is not a schema. A schema constrains VALUES too,
 * and the value limits are where the second outage lived. Check both, and check the file that
 * actually ships as well as the one a person opens.
 *
 *     node scripts/check-vercel-config.mjs          # validate root + generated
 *     node scripts/check-vercel-config.mjs --self-test   # prove it REFUSES both known-bad shapes
 *
 * Exit 0 = both files would pass Vercel's validator. Exit 1 = a deploy would be rejected.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Vercel's documented top-level properties. Anything outside this set fails validation. */
const ALLOWED_KEYS = new Set([
  'alias', 'build', 'buildCommand', 'cleanUrls', 'crons', 'devCommand', 'env', 'framework',
  'functionFailoverRegions', 'functions', 'git', 'headers', 'ignoreCommand', 'images',
  'installCommand', 'name', 'outputDirectory', 'public', 'redirects', 'regions',
  'relatedProjects', 'rewrites', 'routes', 'scope', 'trailingSlash', 'version',
]);

/**
 * The string caps Vercel enforces. `installCommand` at 256 is the one that took this project
 * down; the others are listed so the next person does not have to rediscover the class one
 * field at a time. A cap we have not confirmed is simply absent here rather than guessed.
 */
const MAX_LEN = {
  installCommand: 256,
  buildCommand: 256,
  devCommand: 256,
  ignoreCommand: 256,
  outputDirectory: 256,
  name: 52,
};

export function validate(cfg, label) {
  const errors = [];
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return [`${label}: top level must be a JSON object`];
  }
  for (const key of Object.keys(cfg)) {
    if (!ALLOWED_KEYS.has(key)) {
      // This is the exact wording Vercel returns, so a CI log line matches the dashboard.
      errors.push(`${label}: should NOT have additional property \`${key}\``);
    }
  }
  for (const [key, cap] of Object.entries(MAX_LEN)) {
    const v = cfg[key];
    if (typeof v === 'string' && v.length > cap) {
      errors.push(`${label}: \`${key}\` should NOT be longer than ${cap} characters (it is ${v.length})`);
    }
  }
  return errors;
}

/** The file production actually serves is written by the generator, so build it the same way. */
function generatedConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'fix-web-html.js'), 'utf8');
  const start = src.indexOf('const vercelJson = JSON.stringify(');
  if (start === -1) throw new Error('fix-web-html.js: the vercel.json literal moved — update this checker');
  const catchAll = src.match(/const CATCH_ALL_NO_DOTS = "(.*)";/);
  if (!catchAll) throw new Error('fix-web-html.js: CATCH_ALL_NO_DOTS not found');
  // Evaluate the object literal in isolation, with the one identifier it references bound.
  const literal = src.slice(src.indexOf('(', start) + 1, src.indexOf('\n});', start) + 2);
  const CATCH_ALL_NO_DOTS = JSON.parse('"' + catchAll[1] + '"');
  // eslint-disable-next-line no-new-func
  return new Function('CATCH_ALL_NO_DOTS', `return ${literal}`)(CATCH_ALL_NO_DOTS);
}

function main() {
  const files = [];
  files.push(['vercel.json (root)', JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))]);
  try {
    files.push(['dist/vercel.json (GENERATED — this is what production serves)', generatedConfig()]);
  } catch (e) {
    console.error(`✗ could not reconstruct the generated config: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  let bad = 0;
  for (const [label, cfg] of files) {
    const errors = validate(cfg, label);
    if (errors.length) {
      bad += errors.length;
      for (const e of errors) console.error(`✗ ${e}`);
    } else {
      const lens = Object.keys(MAX_LEN)
        .filter((k) => typeof cfg[k] === 'string')
        .map((k) => `${k}=${cfg[k].length}/${MAX_LEN[k]}`)
        .join(' ');
      console.log(`✓ ${label}: ${Object.keys(cfg).length} keys, all allowed${lens ? '; ' + lens : ''}`);
    }
  }
  if (bad) {
    console.error(`\nVercel would REJECT this deploy (${bad} schema error(s)).`);
    console.error('Prose belongs in scripts/fix-web-html.js or docs/infra/VERCEL-CONFIG.md, never in this file.');
    process.exitCode = 1;
  }
}

/** A guard never seen to refuse is decoration. Both historical shapes must be caught. */
function selfTest() {
  const cases = [
    ['2026-09-03 shape: a comment KEY', { installCommand: 'npm install', _comment_rewrites: ['why'] },
      /additional property `_comment_rewrites`/],
    ['2026-09-08 shape: prose in the VALUE', { installCommand: 'echo "' + 'x'.repeat(1200) + '" && npm install' },
      /`installCommand` should NOT be longer than 256/],
  ];
  let failed = 0;
  for (const [name, cfg, expected] of cases) {
    const errors = validate(cfg, 'self-test');
    const caught = errors.some((e) => expected.test(e));
    console.log(`  ${caught ? '✓ REFUSED' : '✗ ACCEPTED'}  ${name}`);
    if (!caught) failed++;
  }
  const clean = validate(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')), 'self-test');
  console.log(`  ${clean.length === 0 ? '✓ ACCEPTS' : '✗ REFUSES'}  the current root vercel.json (negative control)`);
  if (clean.length) { failed++; clean.forEach((e) => console.error(`      ${e}`)); }
  if (failed) { console.error(`\n${failed} self-test(s) failed — this checker cannot be trusted.`); process.exitCode = 1; }
  else console.log('\nself-test: the checker refuses both shapes that actually broke production, and accepts the current file.');
}

if (process.argv.includes('--self-test')) selfTest();
else main();
