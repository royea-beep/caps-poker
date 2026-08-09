/**
 * PROBE KIT SELF-TEST — a harness that claims to fail loudly must demonstrate it.
 *
 * Each case injects a DELIBERATE fault and asserts the kit refuses to produce a datum.
 * Case A reproduces the exact iteration-15 fault to confirm the root cause rather than assume it.
 *
 *   node tests/probe-kit-selftest.mjs
 */
import { chromium } from 'playwright';
import { measure, findExact, isMounted, requireBinary, show, MEASUREMENT_FAILED, HarnessError } from './probe-kit.mjs';

const results = [];
const rec = (name, expect, got, pass) => { results.push({ name, expect, got, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      expected: ${expect}\n      got:      ${got}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

// A mounted page with known content.
await page.setContent(`<div id="root"><div><span>מיידיים</span><span>Hello</span></div></div>`);

// ── CASE A — the iteration-15 fault, reproduced raw, then caught by the kit ────────────────
const bare = `(() => 1)`; // a bare function expression, the shape that broke iteration 15
const rawResult = await page.evaluate(`(${bare})`); // evaluates to a Function -> not serialisable
rec('A1 raw page.evaluate of a bare function returns undefined (ROOT CAUSE)',
  'undefined', String(rawResult), rawResult === undefined);

let caught = null;
try { await measure(page, `() => ({a:1})`, { label: 'caseA' }); }
catch (e) { caught = e; }
rec('A2 measure() REJECTS a bare function payload',
  'HarnessError naming the non-serialisable Function', caught ? `${caught.name}: ${caught.message.slice(0, 80)}…` : 'no error',
  caught instanceof HarnessError);

// ── CASE B — an evaluate that genuinely yields undefined ──────────────────────────────────
const undef = await measure(page, `(() => undefined)()`, { label: 'caseB' });
rec('B undefined result becomes MEASUREMENT_FAILED, never a datum',
  'MEASUREMENT_FAILED', show(undef), undef === MEASUREMENT_FAILED);

// ── CASE C — measurement against an UNMOUNTED page ────────────────────────────────────────
const blank = await browser.newPage({ viewport: { width: 375, height: 812 } });
await blank.setContent(`<div id="root"></div>`);
rec('C0 isMounted() reports false on a blank page', 'false', String(await isMounted(blank)), (await isMounted(blank)) === false);
let unmountErr = null;
try { await measure(blank, `(() => [])()`, { label: 'caseC' }); }
catch (e) { unmountErr = e; }
rec('C1 measuring an unmounted page is INVALID, not an empty pass',
  'HarnessError saying NOT MOUNTED', unmountErr ? unmountErr.message.slice(0, 70) + '…' : 'returned a value',
  unmountErr instanceof HarnessError);

// ── CASE D — a genuine empty on a MOUNTED page must be clean and distinguishable ──────────
const empty = await measure(page, `(() => [])()`, { label: 'caseD' });
rec('D genuine empty is distinguishable from failure',
  'EMPTY (measured, mounted)', show(empty), Array.isArray(empty) && empty.length === 0 && show(empty) !== 'MEASUREMENT_FAILED');

// ── CASE E — exact match, never substring ─────────────────────────────────────────────────
const ex = await findExact(page, ['ידיים', 'מיידיים', 'Hello']);
const noSubstring = ex['ידיים'] === null && ex['מיידיים'] !== null && ex['Hello'] !== null;
rec('E "ידיים" does NOT match inside "מיידיים"',
  'ידיים=null, מיידיים=found, Hello=found',
  `ידיים=${ex['ידיים'] ? 'FOUND' : 'null'}, מיידיים=${ex['מיידיים'] ? 'found' : 'null'}, Hello=${ex['Hello'] ? 'found' : 'null'}`,
  noSubstring);

// ── CASE F — a missing binary is a harness fault, not a score ─────────────────────────────
let binErr = null;
try { requireBinary(['definitely-not-a-real-binary-xyz'], 'fake-tool'); }
catch (e) { binErr = e; }
rec('F missing binary hard-errors naming the tool',
  'HarnessError naming fake-tool', binErr ? binErr.message.slice(0, 60) + '…' : 'no error',
  binErr instanceof HarnessError && /fake-tool/.test(binErr.message));

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== ${results.length - failed}/${results.length} harness properties demonstrated ===`);
process.exit(failed ? 1 : 0);
