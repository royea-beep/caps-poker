#!/usr/bin/env node
/**
 * Generate the Edge Function's copy of the evaluator FROM SOURCE.
 *
 * WHY THIS EXISTS. Server-side adjudication must run the SAME evaluator the client runs, or there
 * are two implementations and the reveal can disagree with what gets recorded. But an Edge Function
 * is Deno, and Deno will not resolve the extensionless relative imports this repo is written with:
 *
 *   Module not found ".../constants/cards". Maybe add a '.ts' extension
 *
 * The alternatives were a project-wide `allowImportingTsExtensions` (a compiler setting changed to
 * suit one consumer, which then changes how every future import gets written) or an import map,
 * which was measured to bundle successfully and then BOOT_ERROR at runtime — a build that passes and
 * a function that cannot start. So: copy at deploy time, rewriting only the import specifier.
 *
 * THE ONE RULE. The output is GENERATED, NEVER COMMITTED, and never hand-edited. A committed copy
 * is the second source of truth arriving by the back door — the exact thing this whole route exists
 * to avoid. `--check` re-derives it and fails if what is on disk differs from source, so a stale
 * copy cannot quietly serve old logic.
 *
 *   node scripts/gen-edge-shared.mjs          write supabase/functions/_shared/
 *   node scripts/gen-edge-shared.mjs --check  verify on-disk == source, exit 2 on drift
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'supabase', 'functions', '_shared');

const BANNER =
  '// GENERATED — DO NOT EDIT, DO NOT COMMIT.\n' +
  '// Produced by scripts/gen-edge-shared.mjs from the app source of record.\n' +
  '// Edit the source file, not this copy. `--check` fails the deploy if these drift apart.\n';

/** name in _shared -> [source path, rewrite fn] */
const FILES = {
  'cards.ts': ['constants/cards.ts', (s) => s],
  'handEvaluator.ts': [
    'utils/handEvaluator.ts',
    // The ONLY transformation: give the relative import an extension Deno accepts. Nothing else
    // about the file is touched — the algorithm is byte-identical to the source.
    (s) => s.replace(/from '\.\.\/constants\/cards'/g, "from './cards.ts'"),
  ],
};

function derive() {
  const out = {};
  for (const [name, [src, rewrite]] of Object.entries(FILES)) {
    const raw = readFileSync(join(ROOT, src), 'utf8');
    const body = rewrite(raw);
    if (name === 'handEvaluator.ts' && body === raw) {
      // The rewrite is load-bearing: if the source import ever changes shape and this silently
      // no-ops, the function stops bundling. Fail loudly at generation instead.
      throw new Error(`gen-edge-shared: the import rewrite matched nothing in ${src} — has the import changed?`);
    }
    out[name] = BANNER + body;
  }
  return out;
}

const derived = derive();
const check = process.argv.includes('--check');

if (check) {
  const drift = [];
  for (const [name, content] of Object.entries(derived)) {
    const p = join(OUT, name);
    if (!existsSync(p)) drift.push(`${name}: MISSING`);
    else if (readFileSync(p, 'utf8') !== content) drift.push(`${name}: DIFFERS FROM SOURCE`);
  }
  if (drift.length) {
    console.error('gen-edge-shared --check FAILED:\n  ' + drift.join('\n  '));
    process.exit(2);
  }
  console.log('gen-edge-shared --check ok: ' + Object.keys(derived).join(', '));
} else {
  mkdirSync(OUT, { recursive: true });
  for (const [name, content] of Object.entries(derived)) writeFileSync(join(OUT, name), content, 'utf8');
  console.log('gen-edge-shared wrote: ' + Object.keys(derived).map((n) => `_shared/${n}`).join(', '));
}
