import { resolveActingIdentity, DELETE_TABLES } from '../../supabase/functions/account_delete/identity';

// AC2.3 — adversarial tests for the JWT-derived replacements.
// The old guard was `IF p_user_id IS NOT NULL AND auth.uid() IS NOT NULL AND auth.uid() <> p_user_id`
// — three ANDed conditions, so it passed whenever EITHER value was NULL. RED below models that
// shape; GREEN is the replacement.

/** The OLD guard, faithfully: returns true when the call is ALLOWED to proceed. */
function oldGuardAllows(pUserId: string | null, authUid: string | null): boolean {
  const raises = pUserId !== null && authUid !== null && authUid !== pUserId;
  return !raises; // no exception => proceeds to DELETE ... WHERE device_id = p_device_id
}

describe('AC2 identity derivation (account_delete / account_merge)', () => {
  it('RED: old guard lets an UNAUTHENTICATED caller delete a named victim', () => {
    expect(oldGuardAllows('victim-uid', null)).toBe(true);
  });

  it('RED: old guard lets an AUTHENTICATED caller delete a victim by passing p_user_id => NULL', () => {
    expect(oldGuardAllows(null, 'attacker-uid')).toBe(true);
  });

  it('GREEN: an unauthenticated call is rejected, and it is the FIRST check', () => {
    for (const bad of [null, undefined, '']) {
      const d = resolveActingIdentity(bad as string | null);
      expect(d.ok).toBe(false);
      expect(d.error).toBe('unauthenticated');
      expect(d.uid).toBeUndefined();
    }
  });

  it('GREEN: an authenticated caller acts ONLY as itself — no parameter can name a target', () => {
    const d = resolveActingIdentity('caller-uid');
    expect(d.ok).toBe(true);
    expect(d.uid).toBe('caller-uid');
  });

  it('GREEN: sending a target parameter is refused LOUDLY, never silently ignored', () => {
    for (const field of ['p_device_id', 'device_id', 'p_user_id', 'user_id', 'target_user_id']) {
      const d = resolveActingIdentity('attacker-uid', { [field]: 'victim' });
      expect(d.ok).toBe(false);
      expect(d.error).toBe('target_parameter_present');
    }
  });

  it('GREEN: a NULL uid is rejected even when a target is also supplied (no AND-chain to defeat)', () => {
    const d = resolveActingIdentity(null, { p_device_id: 'victim-device' });
    expect(d.ok).toBe(false);
    expect(d.error).toBe('unauthenticated');
  });

  it('covers the same 22 tables the old function deleted from', () => {
    expect(DELETE_TABLES).toHaveLength(22);
    for (const t of ['chip_transactions', 'leaderboard', 'hand_history', 'daily_rewards', 'user_missions']) {
      expect(DELETE_TABLES).toContain(t);
    }
    // user_profiles is handled separately because it keys on `id`, not `user_id`.
    expect(DELETE_TABLES).not.toContain('user_profiles');
  });
});
