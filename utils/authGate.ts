/**
 * AE2 — APP-OPEN AUTH GATE.
 *
 * THE BUG (AD1, proven against live). `app/_layout.tsx:267` bootstraps auth fire-and-forget through
 * a dynamic import (`void ensureAnonymousAuth()`), while the home-screen effects fire their own
 * `void (async () => {})()` blocks on mount. Those RPCs therefore race the sign-in and arrive with
 * `auth.uid() = NULL`. Controlled A/B against live: `void signInAnonymously()` then call -> the
 * server logged `econ_authz no_session`; `await signInAnonymously()` then call -> no row.
 *
 * It is harmless TODAY only because the device variants have no guard. It stops being harmless the
 * moment `econ_requires_session` flips — at which point EVERY player's app-open path breaks.
 *
 * THE SHAPE, and why it is not simply `await ensureAnonymousAuth()` at each call site:
 *  - ONE shared in-flight promise, so N concurrent app-open effects cost ONE sign-in, not N. After
 *    it resolves every later await is free.
 *  - BOUNDED. An unbounded await turns an auth outage into a blank home screen; bounded turns it
 *    into a degraded one that still works via the existing device path. Same trade J2 made in
 *    `resolveJoinIdentity`, for the same reason.
 */
import { getSupabase } from './supabase';

/**
 * 3000ms, slightly longer than J2's 2500ms, and deliberately so.
 *
 * J2 bounded a JOIN: the user had tapped a button and was watching a spinner, so latency was felt
 * directly and 2500ms was already generous. This gate runs ONCE at launch, behind a splash/loading
 * screen the user expects, and it is shared by every economy call — so the cost is paid at most once
 * per process rather than per action. The downside of timing out too early is worse here too: a
 * premature fallback writes an unattributable row that the forward-only migration cannot later
 * reconcile. Longer bound, paid once, is the better trade at launch.
 */
export const APP_OPEN_AUTH_TIMEOUT_MS = 3000;

let inFlight: Promise<string | null> | null = null;

/** Reset between tests. Not used in app code. */
export function __resetAuthGate(): void {
  inFlight = null;
}

/**
 * Resolve the anonymous session once, bounded. Returns the uid, or null if auth did not resolve in
 * time — callers MUST keep working in that case (the device path still functions).
 */
export function ensureSessionBounded(
  timeoutMs: number = APP_OPEN_AUTH_TIMEOUT_MS,
  signIn?: () => Promise<string | null>,
): Promise<string | null> {
  if (inFlight) return inFlight;

  const run = signIn ?? (async () => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) return session.user.id;
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) return null;
    return data.user?.id ?? null;
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  inFlight = Promise.race([
    run().catch(() => null),
    new Promise<string | null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });

  return inFlight;
}
