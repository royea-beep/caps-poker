import { ensureSessionBounded, __resetAuthGate, APP_OPEN_AUTH_TIMEOUT_MS } from '../authGate';

// AE2 — the app-open race, and the gate that closes it.
// AD1 proved against live: `void signInAnonymously()` then an RPC -> server logged no_session;
// `await signInAnonymously()` then the same RPC -> no row. These lock in that shape client-side.
describe('app-open auth gate (AE2)', () => {
  beforeEach(() => __resetAuthGate());

  it('RED: fire-and-forget lets the call proceed before a uid exists (the no_session shape)', async () => {
    let uid: string | null = null;
    const signIn = async () => { await new Promise((r) => setTimeout(r, 30)); uid = 'u1'; return uid; };
    void signIn();                       // exactly app/_layout.tsx:267
    expect(uid).toBeNull();              // the RPC would fire here, unauthenticated
  });

  it('GREEN: the bounded gate yields a uid before the caller proceeds', async () => {
    const signIn = async () => { await new Promise((r) => setTimeout(r, 30)); return 'u1'; };
    expect(await ensureSessionBounded(1000, signIn)).toBe('u1');
  });

  it('GREEN: N concurrent callers cost ONE sign-in, not N', async () => {
    let calls = 0;
    const signIn = async () => { calls += 1; await new Promise((r) => setTimeout(r, 20)); return 'u1'; };
    const all = await Promise.all([1,2,3,4,5].map(() => ensureSessionBounded(1000, signIn)));
    expect(calls).toBe(1);
    expect(all).toEqual(['u1','u1','u1','u1','u1']);
  });

  it('GREEN: times out and falls back rather than hanging the app open', async () => {
    const started = Date.now();
    const never = () => new Promise<string | null>(() => {});
    expect(await ensureSessionBounded(60, never)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);   // bounded, not indefinite
  });

  it('GREEN: an auth error resolves null instead of throwing into the app-open path', async () => {
    const boom = async () => { throw new Error('auth down'); };
    await expect(ensureSessionBounded(500, boom)).resolves.toBeNull();
  });

  it('after the first resolve, later awaits are free (no second sign-in)', async () => {
    let calls = 0;
    const signIn = async () => { calls += 1; return 'u1'; };
    await ensureSessionBounded(500, signIn);
    await ensureSessionBounded(500, signIn);
    expect(calls).toBe(1);
  });

  it('the launch bound is longer than J2 join bound and still sane', () => {
    expect(APP_OPEN_AUTH_TIMEOUT_MS).toBe(3000);
    expect(APP_OPEN_AUTH_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});
