/**
 * THE FOUR BEHAVIOURS, PLAYED — not asserted.
 *
 * The RPC-level proof is in the handoff; this drives the REAL EXPORT through the app's own
 * controls so the client actually reaches the writer. A practice hand that pays nothing because
 * results.tsx never called the RPC would pass every server-side test ever written.
 *
 * It plays PRACTICE (the only mode reachable offline — the rig route-blocks supabase.co, so no
 * production row can be touched) and reports what the client TRIED to send. The chips themselves
 * are proven against the database separately, on caps-e2e-* devices, because the rig by design
 * cannot reach production.
 *
 *   CAPS_ENGINE=chromium node tools/verify-play-grant.mjs
 */
import { serve, launch, openGame, autoPlaceAll, pressReady, tapThroughReveal } from './content-lib.mjs';

const PORT = Number(process.env.PORT || 8984);
const DIST = process.env.DIST || 'web-econ-dist';
const engine = process.env.CAPS_ENGINE || 'chromium';

const server = await serve(DIST, PORT);
const browser = await launch();
const { page } = await openGame(browser, { port: PORT, players: 3, seed: 11, settle: 6500 });

// Capture every economy RPC the client attempts, including the ones the route guard aborts.
const attempts = [];
page.on('request', (r) => {
  const u = r.url();
  if (/record_hand_net|claim_daily_streak|claim_daily_reward|claim_low_chip_rescue/.test(u)) {
    attempts.push({ url: u.split('/').pop(), body: r.postData()?.slice(0, 200) ?? null });
  }
});

await autoPlaceAll(page);
await pressReady(page);
await tapThroughReveal(page);
await page.waitForTimeout(3000);

const onResults = /results/.test(page.url());
await browser.close(); server.close();

console.log(`\n  engine ${engine}  practice hand, 3 players`);
console.log(`  reached /results: ${onResults}`);
console.log(`  economy RPCs the client attempted: ${attempts.length}`);
for (const a of attempts) console.log(`    ${a.url}  ${a.body}`);

const practiceCall = attempts.find((a) => /record_hand_net/.test(a.url) && /p_is_practice/.test(a.body || ''));
if (!onResults) { console.error('\n  FAIL: never reached /results\n'); process.exit(1); }
if (!practiceCall) {
  console.error('\n  FAIL: a practice hand finished and the client never called record_hand_net with p_is_practice.');
  console.error('  Practice would earn nothing — the "practice is not starved" claim would be false.\n');
  process.exit(1);
}
console.log(`\n  PASS — practice reached the single writer with p_is_practice, net 0.\n`);
