/**
 * CLOSE-SUBMIT-SCORE 2026-09-08 — the contract that keeps the faucet closed.
 *
 * submit_score used to take p_total_chips FROM THE REQUEST BODY, clamp it, and write it into
 * leaderboard.total_chips with no chip_transactions row. Reproduced from outside with the public
 * anon key plus an anonymous session: 9,000 chips against a 6,000 ledger, a 3,000 gap, without
 * playing a hand. The server now IGNORES p_total_chips entirely and writes stats only.
 *
 * Two things have to stay true, and neither is visible from the SQL alone:
 *
 *  1. THE CLIENT MUST KEEP SENDING p_total_chips. Build 515 is on TestFlight with that argument
 *     list baked in. The parameter is dead weight on the server now, so the obvious "cleanup" is
 *     to delete it from the wrapper — which would change the RPC signature PostgREST resolves and
 *     break every installed copy of the app. It stays until no shipped build sends it.
 *
 *  2. submit_score MUST STAY LAST. It is an echo of a balance the ledgered writers produced. If
 *     anyone re-orders results.tsx so it runs before record_hand_net, the echo carries a stale
 *     number — harmless today because the server ignores it, and a live defect the moment someone
 *     "restores" the chip write.
 */
import fs from 'fs';
import path from 'path';

const wrapper = fs.readFileSync(path.join(__dirname, '..', 'utils', 'leaderboard.ts'), 'utf8');
/** The whole call expression, INCLUDING the destructuring that sits on the same line as rpc(). */
const CALL = wrapper.slice(
  wrapper.lastIndexOf('const', wrapper.indexOf("rpc('submit_score'")),
  wrapper.indexOf('});', wrapper.indexOf("rpc('submit_score'")) + 3,
);
const results = fs.readFileSync(path.join(__dirname, '..', 'app', 'results.tsx'), 'utf8');

describe('submit_score contract', () => {
  it('the client still sends all six arguments build 515 expects', () => {
    for (const p of ['p_device_id', 'p_player_name', 'p_total_chips',
                     'p_hands_played', 'p_hands_won', 'p_biggest_win']) {
      expect([p, CALL.includes(p)]).toEqual([p, true]);
    }
  });

  it('submit_score runs AFTER record_hand_net in the results persistence block', () => {
    const net = results.indexOf('recordHandNet(deviceId, revealData.netChips');
    const sub = results.indexOf('submitScore(');
    expect(net).toBeGreaterThan(-1);
    expect(sub).toBeGreaterThan(-1);
    expect(net).toBeLessThan(sub);
  });

  it('nothing treats submit_score as a chip writer', () => {
    // Its return is discarded on purpose (`return !error`). A caller that started reading a
    // balance out of it would be reading a number the server no longer computes.
    expect(CALL).toMatch(/const \{ error \}/);
    expect(CALL).not.toMatch(/const \{ data/);
  });
});
