import { resolveJoinIdentity, JOIN_AUTH_TIMEOUT_MS, joinErrorMessage, JOIN_NO_SESSION_MESSAGE, JOIN_NETWORK_ERROR, JOIN_NETWORK_MESSAGE } from '../joinIdentity';

// J2 — joinTable must NEVER hang on auth. Today's client does not wait on auth before joining;
// awaiting ensureAnonymousAuth() unconditionally would turn an auth outage / slow network / offline
// first-launch into a stuck join button. resolveJoinIdentity bounds the wait and always falls back to
// the EXISTING device-identity path, which join_requires_session=FALSE (the shipped default) accepts.
describe('joinTable identity resolution never blocks the join (J2)', () => {
  const DEVICE_FALLBACK = 'device-player-uuid';

  // RED baseline: the naive version this replaces — a bare await. A rejecting/never-settling auth call
  // propagates or hangs, which is exactly the regression the bound exists to prevent.
  const naiveAwait = async (ensureAuth: () => Promise<string | null>, fallback: string | null) => {
    const uid = await ensureAuth(); // no timeout, no catch
    return uid ?? fallback;
  };

  it('RED (naive await): a rejecting auth call propagates and would fail the join', async () => {
    await expect(
      naiveAwait(() => Promise.reject(new Error('auth outage')), DEVICE_FALLBACK),
    ).rejects.toThrow('auth outage');
  });

  it('GREEN: auth REJECTS -> still completes, via the device identity', async () => {
    const out = await resolveJoinIdentity(() => Promise.reject(new Error('auth outage')), DEVICE_FALLBACK);
    expect(out).toBe(DEVICE_FALLBACK);
  });

  it('GREEN: auth NEVER settles -> times out and completes via the device identity', async () => {
    const started = Date.now();
    const out = await resolveJoinIdentity(() => new Promise<string | null>(() => {}), DEVICE_FALLBACK, 30);
    expect(out).toBe(DEVICE_FALLBACK);
    expect(Date.now() - started).toBeLessThan(1000); // bounded, not hung
  });

  it('happy path: a verified uid wins over the client-supplied fallback', async () => {
    const out = await resolveJoinIdentity(() => Promise.resolve('verified-uid'), DEVICE_FALLBACK);
    expect(out).toBe('verified-uid');
  });

  it('auth returns null AND no fallback -> null (legacy accepts it while the flag is FALSE)', async () => {
    expect(await resolveJoinIdentity(() => Promise.resolve(null), null)).toBeNull();
  });

  it('the timeout is bounded to a sane default', () => {
    expect(JOIN_AUTH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(JOIN_AUTH_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});

// T1 — JOIN_NO_SESSION_MESSAGE shipped as dead code: defined, never referenced. joinTable returned
// the RPC payload unmapped and every call site branched only on `ok` / `not_a_member`, so a
// no_session rejection surfaced as a generic "table unavailable". These lock the mapping in place.
describe('join error copy mapping (T1)', () => {
  it('maps no_session to the written copy', () => {
    expect(joinErrorMessage('no_session')).toBe(JOIN_NO_SESSION_MESSAGE);
  });

  it('returns undefined for errors whose call-site copy is better', () => {
    // not_a_member has three context-specific strings (public lobby / private code / club screen).
    // Centralising it would REPLACE good copy with worse copy.
    expect(joinErrorMessage('not_a_member')).toBeUndefined();
    expect(joinErrorMessage('table_full_or_gone')).toBeUndefined();
  });

  it('returns undefined for absent/unknown errors rather than throwing', () => {
    expect(joinErrorMessage(undefined)).toBeUndefined();
    expect(joinErrorMessage(null)).toBeUndefined();
    expect(joinErrorMessage('')).toBeUndefined();
    expect(joinErrorMessage('something_new_from_the_server')).toBeUndefined();
  });

  it('copy names the cause and the remedy (it is the only hard-fail a player can hit)', () => {
    expect(JOIN_NO_SESSION_MESSAGE).toMatch(/sign you in/i);
    expect(JOIN_NO_SESSION_MESSAGE).toMatch(/try again/i);
  });
});

// U2 — a TRANSPORT failure is not the server saying no. joinTable used to return null for it, and
// every call site fell through to its `table_full_or_gone` wording, so an OFFLINE player was told
// their code was "wrong, full, or no longer open" — confidently wrong, and unreadable as a support
// report. These lock in the distinction and the copy's focus on connectivity.
describe('transport failure copy (U2)', () => {
  it('maps the synthetic network_error code to network copy', () => {
    expect(joinErrorMessage(JOIN_NETWORK_ERROR)).toBe(JOIN_NETWORK_MESSAGE);
  });

  it('network copy points at the connection, never at the code or the table', () => {
    expect(JOIN_NETWORK_MESSAGE).toMatch(/connection/i);
    expect(JOIN_NETWORK_MESSAGE).not.toMatch(/code|table|full|wrong/i);
  });

  it('is distinct from the no-session copy — they are different failures', () => {
    expect(JOIN_NETWORK_MESSAGE).not.toBe(JOIN_NO_SESSION_MESSAGE);
  });
});
