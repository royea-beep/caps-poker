/**
 * CLOSE-THE-SIX · SECTION 1 — THE LEDGER POLICY, TESTED BEFORE IT SHIPS.
 *
 * Iron Rule #11: QA on a branch, never production. This runs the whole before/after against a
 * Supabase development branch over HTTPS with THAT branch's public anon key.
 *
 * WHY THERE IS A "BEFORE" AT ALL. A test that only checks the insert is refused AFTER the fix
 * proves nothing — it would pass identically on a database where the vulnerability never existed,
 * which is exactly what a freshly-created branch is. So the branch first REPRODUCES production's
 * two policies verbatim, the attack is run and must SUCCEED, and only then is the fix applied and
 * the same attack must FAIL. Both halves are required; either one alone is not evidence.
 *
 *   phase "before" : insert_tx present   -> anon INSERT must SUCCEED (the bug reproduces)
 *                                        -> definer writer must SUCCEED
 *   phase "after"  : insert_tx dropped   -> anon INSERT must be REFUSED (42501)
 *                                        -> definer writer must STILL SUCCEED
 *
 * The second line of each phase is the one that decides whether the fix is safe to ship. All 15
 * real writers are SECURITY DEFINER functions owned by `postgres`, which owns the table, and
 * chip_transactions does not have FORCE ROW LEVEL SECURITY — so RLS does not apply to them at
 * all. That is the reason the fix cannot break them, and this measures it rather than asserting it.
 *
 * Usage: node tests/verify-ledger-policy.mjs <phase>     phase = before | after
 */

const URL = process.env.CAPS_BRANCH_URL;
const ANON = process.env.CAPS_BRANCH_ANON;
const PHASE = process.argv[2];
if (!URL || !ANON) throw new Error('set CAPS_BRANCH_URL and CAPS_BRANCH_ANON — this must never point at production');
if (!['before', 'after'].includes(PHASE)) throw new Error('phase must be "before" or "after"');
if (URL.includes('gxrpunvhjcrzqnitbqah')) throw new Error('REFUSING TO RUN AGAINST PRODUCTION');

const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const DEVICE = 'BRANCH-LEDGER-PROBE';

const attack = () => fetch(`${URL}/rest/v1/chip_transactions`, { method: 'POST', headers: H,
  body: JSON.stringify({ device_id: DEVICE, amount: 1000000, event_type: 'FORGED', action: 'credit', description: 'anon direct insert' }) });
const definer = () => fetch(`${URL}/rest/v1/rpc/test_definer_writer`, { method: 'POST', headers: H,
  body: JSON.stringify({ p_device_id: DEVICE, p_amount: 80 }) });
const count = () => fetch(`${URL}/rest/v1/chip_transactions?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });

const a = await attack();       const aText = (await a.text()).slice(0, 200);
const d = await definer();      const dText = (await d.text()).slice(0, 200);
const c = await count();        const cRange = c.headers.get('content-range');

const expect = PHASE === 'before'
  ? { attack: 201, definer: 200, note: 'the bug must reproduce, or the "after" proves nothing' }
  : { attack: 401, definer: 200, note: 'anon refused, every definer writer untouched' };

const attackOk  = PHASE === 'before' ? a.status === 201 : a.status !== 201;
const definerOk = d.status === 200 && dText.includes('"ok": true');

console.log(`\nLEDGER POLICY — phase "${PHASE}" on the BRANCH (${URL.replace('https://', '').split('.')[0]})`);
console.log(`  ${expect.note}\n`);
console.log(`  anon direct INSERT      http ${a.status}   ${attackOk ? '✓ as required' : '✗ NOT AS REQUIRED'}`);
console.log(`     ${aText}`);
console.log(`  SECURITY DEFINER writer http ${d.status}   ${definerOk ? '✓ still works' : '✗ BROKEN BY THE CHANGE'}`);
console.log(`     ${dText}`);
console.log(`  rows now: ${cRange}\n`);
process.exit(attackOk && definerOk ? 0 : 1);
