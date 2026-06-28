#!/usr/bin/env node
/**
 * tests/db-sim/run.mjs — Layer 1 entry point.
 *
 * Discovers every sibling .mjs (except this file + helpers), runs them in
 * series against the live caps-poker Supabase project with a unique runId,
 * tracks every row each sim touches, asserts ZERO residue at the end, and
 * exits non-zero on any assertion failure or residue.
 *
 * Required env:
 *   SUPABASE_URL=https://gxrpunvhjcrzqnitbqah.supabase.co
 *   SUPABASE_ANON_KEY=<the anon key — same one the web client uses>
 *
 * Optional env:
 *   SIM_VERBOSE=1     log every assertion + cleanup row
 *   SIM_KEEP=1        skip cleanup (debug — leaves residue on purpose)
 *
 * Run locally:
 *   node tests/db-sim/run.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const verbose = !!process.env.SIM_VERBOSE;
const keep = !!process.env.SIM_KEEP;

const url = process.env.SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const key = process.env.SUPABASE_ANON_KEY;
if (!key) {
  console.error('[db-sim] SUPABASE_ANON_KEY is required (see .env or CI secrets).');
  process.exit(2);
}

const runId = `${(process.env.GIT_SHA || 'local').slice(0, 8)}_${randomBytes(3).toString('hex')}`;
const sb = createClient(url, key, { auth: { persistSession: false } });

// --------------------------------------------------------------------------
// Per-run state (assertions + cleanup registry).
// --------------------------------------------------------------------------
let pass = 0;
let fail = 0;
const failures = [];
const cleanupRegistry = new Map(); // table -> Set<id>

function register(table, id) {
  if (!id) return;
  if (!cleanupRegistry.has(table)) cleanupRegistry.set(table, new Set());
  cleanupRegistry.get(table).add(id);
}

const asserts = {
  eq(actual, expected, label) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
      pass++;
      if (verbose) console.log(`  ✓ ${label}`);
    } else {
      fail++;
      failures.push({ label, actual, expected });
      console.error(`  ✗ ${label}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`);
    }
  },
  truthy(value, label) {
    if (value) {
      pass++;
      if (verbose) console.log(`  ✓ ${label}`);
    } else {
      fail++;
      failures.push({ label, actual: value, expected: 'truthy' });
      console.error(`  ✗ ${label}\n      actual:   ${JSON.stringify(value)}\n      expected: truthy`);
    }
  },
};

// --------------------------------------------------------------------------
// Sim discovery + execution.
// --------------------------------------------------------------------------
const skip = new Set(['run.mjs', 'README.md']);
const sims = readdirSync(HERE)
  .filter((f) => f.endsWith('.mjs') && !skip.has(f))
  .sort();

console.log(`[db-sim] runId=${runId} sims=${sims.length}`);
let exitCode = 0;
for (const file of sims) {
  console.log(`\n--- ${file} ---`);
  try {
    const mod = await import(join(HERE, file));
    if (typeof mod.default !== 'function') {
      console.error(`  ! ${file} has no default-exported async function — skipping`);
      continue;
    }
    await mod.default({ sb, runId, asserts, register });
  } catch (e) {
    fail++;
    failures.push({ label: `${file} threw`, actual: String(e?.message || e), expected: 'no throw' });
    console.error(`  ! ${file} threw:`, e?.message || e);
  }
}

// --------------------------------------------------------------------------
// Cleanup — every row registered by every sim.
// --------------------------------------------------------------------------
let cleaned = 0;
let cleanupFail = 0;
if (keep) {
  console.log('\n[db-sim] SIM_KEEP=1 — skipping cleanup (debug).');
} else {
  console.log('\n[db-sim] cleanup');
  for (const [table, ids] of cleanupRegistry) {
    if (ids.size === 0) continue;
    const { error } = await sb.from(table).delete().in('id', [...ids]);
    if (error) {
      cleanupFail++;
      console.error(`  ! cleanup ${table} (${ids.size} rows): ${error.message}`);
    } else {
      cleaned += ids.size;
      if (verbose) console.log(`  ✓ ${table}: ${ids.size} rows`);
    }
  }
  console.log(`[db-sim] cleaned ${cleaned} rows across ${cleanupRegistry.size} tables (failed: ${cleanupFail})`);
}

// --------------------------------------------------------------------------
// Final residue check — fetch every registered table by the runId-marker
// prefix and assert NONE remain. Tables can opt into this by exposing a
// device_id / display_name / name column we can filter on.
// --------------------------------------------------------------------------
const residueChecks = [
  { table: 'room_players', column: 'device_id', prefix: `simdev_${runId}` },
  { table: 'clubs',        column: 'name',      prefix: `SIM_${runId}` },
];
let residueRows = 0;
for (const { table, column, prefix } of residueChecks) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).like(column, `${prefix}%`);
  if (error) { console.error(`  ! residue probe ${table}.${column}: ${error.message}`); continue; }
  if (count && count > 0) {
    residueRows += count;
    console.error(`  ! residue: ${table}.${column} matching '${prefix}%' = ${count} rows`);
  } else if (verbose) {
    console.log(`  ✓ residue ${table}.${column}: 0`);
  }
}

// --------------------------------------------------------------------------
// Report.
// --------------------------------------------------------------------------
console.log('\n========== db-sim summary ==========');
console.log(`pass:    ${pass}`);
console.log(`fail:    ${fail}`);
console.log(`cleaned: ${cleaned}`);
console.log(`residue: ${residueRows}`);
if (fail > 0) {
  exitCode = 1;
  console.log('\nfailures:');
  for (const f of failures) console.log(`  - ${f.label}`);
}
if (residueRows > 0 || cleanupFail > 0) exitCode = exitCode || 1;
process.exit(exitCode);
