/**
 * PROBE KIT — measurement helpers that cannot silently succeed.
 *
 * WHY THIS EXISTS. Four iterations of this project were lost or nearly corrupted by
 * infrastructure failure wearing a result's clothes:
 *   1. a dead page scored 0 dots as a PASS — four false passes on the celebration matrix
 *   2. `bash` missing from PATH scored the CI gate as FAILED on all five cases
 *   3. substring matching found "ידיים" inside "מיידיים" — a false pass on an unrendered screen
 *   4. page.evaluate returned undefined — no geometry, no evidence, iteration lost
 * Cases 1 and 3 were false PASSES, which is the dangerous direction.
 *
 * ROOT CAUSE OF #4, measured not guessed (see probe-kit-selftest.mjs case A):
 * `page.evaluate("(...)=>{...}")` with a bare arrow-function STRING evaluates the expression
 * to a Function OBJECT. A Function is not serialisable across the CDP boundary, so Playwright
 * hands back `undefined` — no throw, no warning. JSON.stringify then DROPS the key entirely,
 * which is why iteration 15's output had no `reveal` field at all rather than a null one.
 * The probes that worked always evaluated a CALL (`window.__c(...)`), never a bare function.
 *
 * The fix is not "remember to call it". It is that `measure()` refuses to accept a payload
 * that evaluates to a function, and refuses to return undefined as data.
 */

import { execFileSync } from 'child_process';

/** Returned instead of data whenever a measurement could not be taken. Never falsy-equal to a real empty. */
export const MEASUREMENT_FAILED = Symbol.for('MEASUREMENT_FAILED');

export class HarnessError extends Error {
  constructor(msg) { super(msg); this.name = 'HarnessError'; }
}

/** A missing external binary is a HARNESS fault, not a test result. Hard-exits with the cause. */
export function requireBinary(candidates, label) {
  for (const p of candidates) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; }
    catch (e) { if (e.code !== 'ENOENT') return p; }
  }
  throw new HarnessError(`missing dependency: ${label}. Tried: ${candidates.join(', ')}. This is a harness fault — no result was produced.`);
}

/** True only when the app has actually rendered something. Gate for every measurement. */
export async function isMounted(page) {
  const r = await page.evaluate(`(() => ({
    kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
    len: (document.body.innerText || '').trim().length
  }))()`);
  if (!r || typeof r !== 'object') return false;
  return r.kids > 0 && r.len > 0;
}

/**
 * The only sanctioned way to read from the page.
 *
 * - `expr` MUST be a self-invoking expression that yields data. A bare function expression is
 *   rejected up front, because that is exactly the fault that cost iteration 15.
 * - The page must be mounted, unless allowUnmounted (used only to TEST the gate).
 * - undefined/null comes back as MEASUREMENT_FAILED, never as data.
 */
export async function measure(page, expr, { label = 'measure', allowUnmounted = false } = {}) {
  if (typeof expr !== 'string') throw new HarnessError(`${label}: expr must be a string expression`);
  if (/^\s*(\(?\s*[\w\s,{}]*\)?\s*=>|function\b)/.test(expr.trim()) && !/\)\s*\(/.test(expr)) {
    throw new HarnessError(
      `${label}: payload is a BARE FUNCTION expression. page.evaluate would return a Function, ` +
      `which is not serialisable, so Playwright yields undefined and JSON.stringify drops the key. ` +
      `Wrap it as a self-invoking call: (() => { ... })()`);
  }
  if (!allowUnmounted && !(await isMounted(page))) {
    throw new HarnessError(`${label}: page is NOT MOUNTED (#root empty or no text). A measurement here is INVALID, not zero.`);
  }
  let v;
  try { v = await page.evaluate(expr); }
  catch (e) { throw new HarnessError(`${label}: evaluate threw — ${String(e).slice(0, 200)}`); }
  if (v === undefined || v === null) return MEASUREMENT_FAILED;
  return v;
}

/** Renders a measurement for reporting so an empty result can never be confused with a failed one. */
export function show(v) {
  if (v === MEASUREMENT_FAILED) return 'MEASUREMENT_FAILED';
  if (Array.isArray(v)) return v.length === 0 ? 'EMPTY (measured, mounted)' : JSON.stringify(v);
  return JSON.stringify(v);
}

/**
 * EXACT text match, structurally — never substring.
 * "ידיים" must not match inside "מיידיים"; that false pass already happened once.
 */
export async function findExact(page, wanted, { label = 'findExact' } = {}) {
  const expr = `(() => {
    const want = ${JSON.stringify(wanted)};
    const out = {};
    for (const w of want) out[w] = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (!Object.prototype.hasOwnProperty.call(out, t)) continue;
      if (out[t]) continue;
      const r = el.getBoundingClientRect();
      out[t] = { text: t, x: Math.round(r.left), y: Math.round(r.top),
                 w: Math.round(r.width), h: Math.round(r.height),
                 scrollW: el.scrollWidth, clipped: el.scrollWidth > Math.ceil(r.width) + 1 };
    }
    return out;
  })()`;
  return measure(page, expr, { label });
}
