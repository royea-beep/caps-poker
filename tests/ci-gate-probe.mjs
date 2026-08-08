/**
 * CN-GATE — execute the deploy-blocking probe-harness assertion WITHOUT deploying.
 *
 * The gate added to .github/workflows/web-deploy.yml is blocking and sits on the release path,
 * and it had never executed: the first run would have been during a real deploy, which is the
 * worst moment to find a typo. GitHub will not dispatch a workflow_dispatch job from a
 * non-default branch, and `act` is not installed here, so this does the next best thing and
 * removes the two failure modes that matter:
 *
 *   1. YAML VALIDITY — the file is parsed, and the step is located by name. A syntax error or a
 *      mis-indented block fails here rather than on main.
 *   2. SCRIPT BEHAVIOUR — the step's `run:` body is pulled OUT OF THE YAML and executed
 *      verbatim under each env condition. It is not a re-typed copy, so it cannot drift from
 *      what CI will actually run.
 *
 * What this does NOT cover: the GitHub runner's shell defaults and `::error::` rendering. Those
 * are not where deploy-breaking mistakes live.
 *
 *   node tests/ci-gate-probe.mjs
 */
import fs from 'fs';
import { execFileSync } from 'child_process';
import yaml from 'js-yaml';

const WF = '.github/workflows/web-deploy.yml';
const STEP = 'Assert probe harness is disabled';

const doc = yaml.load(fs.readFileSync(WF, 'utf-8')); // throws on invalid YAML
const steps = doc.jobs?.['deploy-web']?.steps ?? [];
const step = steps.find((s) => s.name === STEP);
if (!step) { console.error(`FAIL: step "${STEP}" not found in ${WF}`); process.exit(1); }
if (typeof step.run !== 'string') { console.error('FAIL: step has no run: body'); process.exit(1); }

// Order matters: the export step must not run before the gate.
const names = steps.map((s) => s.name);
const gateIdx = names.indexOf(STEP);
const exportIdx = names.findIndex((n) => /Export Expo web bundle/.test(n || ''));
const orderOk = gateIdx >= 0 && exportIdx >= 0 && gateIdx < exportIdx;

console.log(`YAML parsed OK. Step found at index ${gateIdx}; export at ${exportIdx}; gate-before-export=${orderOk}`);
console.log(`blocking (no continue-on-error)=${!step['continue-on-error']}\n`);

// Each case: how the variable is presented to the step, and what SHOULD happen.
// The runtime guard is `process.env.EXPO_PUBLIC_CAPS_FIXTURE === '1'` — ONLY the exact string
// '1' arms the harness. Anything else leaves it compiled out, so anything else blocking the
// deploy would be a false positive.
const CASES = [
  { label: 'unset',        env: null,   expectExit: 0 },
  { label: "set to '1'",   env: '1',    expectExit: 1 },
  { label: 'empty string', env: '',     expectExit: 0 },
  { label: "set to '0'",   env: '0',    expectExit: 0 },
  { label: "set to 'true'", env: 'true', expectExit: 0 },
];

// `bash` is not on PATH for a Windows shell even when Git Bash is installed. Resolve it, and
// treat a missing interpreter as a HARNESS failure — the first run of this probe reported
// "FAIL" on all five cases when bash simply could not be spawned, which is the same class of
// mistake as reading zero dots off a page that never mounted.
const BASH = ['bash', 'C:/Program Files/Git/bin/bash.exe', 'C:/Program Files (x86)/Git/bin/bash.exe',
  `${process.env.LOCALAPPDATA || ''}/Programs/Git/bin/bash.exe`]
  .find((p) => { try { execFileSync(p, ['-c', 'exit 0']); return true; } catch (e) { return e.code !== 'ENOENT'; } });
if (!BASH) { console.error('HARNESS FAILURE: no bash interpreter found — cannot execute the step.'); process.exit(2); }
console.log(`interpreter: ${BASH}\n`);

let fails = 0;
for (const c of CASES) {
  const env = { ...process.env, GITHUB_STEP_SUMMARY: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  delete env.EXPO_PUBLIC_CAPS_FIXTURE;
  if (c.env !== null) env.EXPO_PUBLIC_CAPS_FIXTURE = c.env;

  let code = 0, out = '';
  try {
    out = execFileSync(BASH, ['-c', step.run], { env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (e.status === null || e.status === undefined) {
      console.error(`HARNESS FAILURE on case "${c.label}": ${e.code || e.message}`); process.exit(2);
    }
    code = e.status;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const ok = code === c.expectExit;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.label.padEnd(14)} exit=${code} (expected ${c.expectExit})  ${out.trim().split('\n')[0] || ''}`);
}

console.log(`\n=== ${CASES.length - fails}/${CASES.length} PASS ===`);
process.exit(fails ? 1 : 0);
