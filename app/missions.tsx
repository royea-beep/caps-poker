/**
 * DAILY MISSIONS — RETIRED 2026-08-22 (PRE-TESTER-CLOSE), Roye's ruling.
 *
 * His words on being shown it: "לא יודע מה זה בכלל" — he did not know the feature existed.
 *
 * Retired the same way the twelve unearnable achievements were: the definitions are
 * DEACTIVATED, NOT DELETED. All 20 rows of `daily_missions` keep their titles, targets and
 * rewards (is_active = false), so whenever this is built properly nothing has to be rewritten.
 *
 * WHY IT WENT, measured rather than assumed:
 *   - 5,622 user_missions rows exist and ZERO have ever had any progress. 0 completed, 0 claimed.
 *   - the reason is a vocabulary mismatch nobody had spotted: the client advances progress with
 *     'games_played' / 'games_won' / 'boards_won' (results.tsx), and NOT ONE of the 20 missions
 *     uses any of those mission_types — they use play/win/quick/streak/allIn/bluff/sng/social.
 *     So no mission of any type could ever advance, not just bluff_1.
 *   - the screen also showed "0 chips" on every mission and offered Claim on an already-claimed
 *     one (the RPC sends chips/xp/completed/claimed, the component read
 *     chips_reward/xp_reward/is_complete), and claim_mission_d marks a mission claimed and
 *     RETURNS a chip figure without ever crediting it.
 *
 * WHY A REDIRECT RATHER THAN DELETING THIS FILE: there is no app/+not-found.tsx, so removing the
 * route would send /missions to expo-router's unmatched-route fallback — and a tester who typed
 * the URL could land somewhere with no way back. That would be a new defect in place of an old
 * one. Bouncing to Home guarantees a way forward and a way back.
 *
 * NOT TOUCHED, deliberately: `claim_mission_d` (an unreachable screen cannot pay nothing, and its
 * crediting behaviour is an economy question), the 20 `daily_missions` rows, the 5,622
 * `user_missions` rows, and `update_mission_progress` — which is one of the four guarded economy
 * functions, touches only `user_missions`, credits nothing, and is now a no-op because no mission
 * is ever assigned.
 *
 * The retired implementation is in git history at 2739762 if it is ever wanted back.
 */
import { Redirect } from 'expo-router';

export default function MissionsRetired() {
  return <Redirect href="/" />;
}
