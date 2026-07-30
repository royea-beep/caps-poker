import { resolveJoinIdentity, JOIN_AUTH_TIMEOUT_MS } from '../joinIdentity';

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
