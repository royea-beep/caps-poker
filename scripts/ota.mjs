// scripts/ota.mjs — the ONE sanctioned OTA publish path. Cross-platform (Windows + CI).
//
// Replaces the old inline npm script `NODE_OPTIONS='…' npx expo export … && … eas update …`,
// which used POSIX env-prefix syntax that FAILS on Windows cmd.exe — so `npm run ota` never ran
// on the Windows dev machine, which is why a raw `eas update --auto` was hand-rolled once and
// mis-targeted branch `main` (reaching no channel). This launcher sets NODE_OPTIONS via the child
// env (portable) and HARD-CODES `--branch production`. NEVER hand-roll `eas update` — use this.
//
// Usage: npm run ota -- "commit-style message describing the OTA"
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const OUT = join(tmpdir(), 'caps_ota');
const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
  if (r.status !== 0) {
    console.error(`\n[ota] FAILED (exit ${r.status}): ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

// Sanitize shell-breakers ( ; ( ) { } " ) then JSON-quote so shell:true passes it as ONE arg
// on both cmd.exe and POSIX shells (unquoted multi-word args otherwise split/break the command).
const rawMsg = process.argv.slice(2).join(' ').trim() || 'OTA to production';
const message = rawMsg.replace(/[;(){}"]/g, ' ').replace(/\s+/g, ' ').trim();

try { rmSync(OUT, { recursive: true, force: true }); } catch {}

console.log('[ota] exporting ios+android bundle…');
run('npx', ['expo', 'export', '--platform', 'ios', '--platform', 'android',
  '--output-dir', OUT, '--dump-assetmap', '--source-maps']);

console.log('[ota] publishing to branch production (hard-coded guard)…');
run('npx', ['eas-cli', 'update', '--branch', 'production', '--environment', 'production',
  '--input-dir', OUT, '--skip-bundler', '--non-interactive', '--message', JSON.stringify(message)]);

console.log('[ota] done — published to branch production.');
