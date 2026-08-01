// AC2 — identity resolution for the account_delete / account_merge Edge Functions, extracted PURE
// so it is unit-testable (same idiom as authz.ts / handAcks.ts / handOrdinal.ts / storeDeal.ts).
//
// WHAT THIS REPLACES. The old `delete_user_account(p_device_id text, p_user_id uuid)` guard was:
//
//   IF p_user_id IS NOT NULL AND auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE ...
//
// THREE conditions ANDed => TWO independent bypasses: pass p_user_id => NULL (works even when
// authenticated), or call with no session. Deletion then keyed on the CLIENT-SUPPLIED p_device_id,
// and all 319 device ids are harvestable in one anon SELECT from `leaderboard`.
//
// THE RULE, and it is deliberately not a guard at all — it is a derivation:
//   * identity comes ONLY from the verified JWT;
//   * a NULL uid is rejected as the FIRST statement, never as one term of an AND-chain;
//   * THERE IS NO TARGET PARAMETER. No device_id, no user_id. A caller cannot name a victim,
//     so there is nothing to spoof. That is the whole design.

export type IdentityError = 'unauthenticated' | 'target_parameter_present';

export interface IdentityDecision {
  ok: boolean;
  uid?: string;
  error?: IdentityError;
}

/**
 * Resolve the acting identity for a destructive account operation.
 *
 * @param callerUserId  auth.uid() from the VERIFIED JWT. Never from a request body.
 * @param requestBody   the raw parsed body — inspected ONLY to refuse target parameters outright.
 */
export function resolveActingIdentity(
  callerUserId: string | null | undefined,
  requestBody: Record<string, unknown> = {},
): IdentityDecision {
  // FIRST statement, standalone. Not one term of an AND-chain — that shape is what created the
  // NULL-passes-through bypass in the function this replaces.
  if (!callerUserId) return { ok: false, error: 'unauthenticated' };

  // Defence in depth: if a future caller starts sending a target, refuse LOUDLY rather than
  // silently ignoring it. A silently-ignored parameter is how a spoof gets re-introduced by
  // someone who assumes it works.
  for (const forbidden of ['p_device_id', 'device_id', 'p_user_id', 'user_id', 'target_user_id']) {
    if (forbidden in requestBody) return { ok: false, error: 'target_parameter_present' };
  }

  return { ok: true, uid: callerUserId };
}

/**
 * Tables the old delete_user_account touched, with the column each is keyed on for a UID-ONLY
 * delete. All 22 data tables carry BOTH user_id and device_id, so a uid-keyed delete is
 * structurally possible for every one of them.
 *
 * ⚠️ STRUCTURALLY POSSIBLE IS NOT THE SAME AS EFFECTIVE — see the coverage note in
 * docs/ACCOUNT_DELETE_GAP.md. The user_id columns are largely UNPOPULATED, and where populated they
 * mostly do not hold a real auth.users id.
 */
export const DELETE_TABLES: readonly string[] = [
  'achievements', 'analytics_events', 'chip_transactions', 'daily_rewards', 'device_cups',
  'economy_log', 'hand_history', 'heatmap_events', 'leaderboard', 'player_cups', 'player_levels',
  'player_poker_stats', 'player_streaks', 'purchases', 'push_log', 'push_tokens', 'referral_links',
  'room_players', 'shared_hands', 'sit_and_go_players', 'starter_pack_redemptions', 'user_missions',
];
