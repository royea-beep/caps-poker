/**
 * J2 — bounded identity resolution for join_table. Kept in its OWN dependency-free module (no supabase
 * / RN / expo imports) so it is unit-testable without loading the native client.
 */

/**
 * How long joinTable may wait for an anon session before falling back to the device identity. The join
 * RPC is a network call anyway, so a short bound is invisible when auth is healthy and decisive when
 * it is not.
 */
export const JOIN_AUTH_TIMEOUT_MS = 2500;

/**
 * Resolve the identity to send with join_table WITHOUT EVER BLOCKING THE JOIN.
 *
 * Today's client does not wait on auth before joining. Awaiting `ensureAnonymousAuth()` unconditionally
 * would turn an auth outage, a slow network, or an offline first-launch into "the join button hangs".
 * So the wait is bounded and every failure path falls back to the EXISTING device-identity behaviour:
 *   - auth resolves in time -> use the verified uid (this repairs the NULL room_players.user_id seat);
 *   - auth times out        -> fall back to the caller-supplied playerId (today's behaviour);
 *   - auth throws/rejects   -> same fallback.
 *
 * With `join_requires_session = FALSE` (the shipped default) the server accepts that legacy identity,
 * so the fallback is a true no-op relative to today. When the flag is later flipped TRUE the server
 * rejects a NULL identity with 'no_session', and the CALLER must surface a real error rather than fail
 * silently — see JOIN_NO_SESSION_MESSAGE.
 */
export async function resolveJoinIdentity(
  ensureAuth: () => Promise<string | null>,
  fallbackPlayerId: string | null,
  timeoutMs: number = JOIN_AUTH_TIMEOUT_MS,
  /**
   * M2 — fired ONLY when the bound actually expires (or auth rejects). The DB cannot measure this:
   * server-side `auth.uid()` is non-null whenever a session JWT is attached, so it cannot distinguish
   * "auth resolved fast" from "auth timed out but a session already existed". This is the only way to
   * know whether the 2500 ms bound ever fires in the field. Fire-and-forget: it must never block or
   * fail the join, so it is called without await and any throw is swallowed.
   */
  onTimeout?: (info: { elapsedMs: number; reason: 'timeout' | 'error'; hadFallback: boolean }) => void,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const notify = (reason: 'timeout' | 'error') => {
    try { onTimeout?.({ elapsedMs: Date.now() - started, reason, hadFallback: fallbackPlayerId != null }); } catch { /* never block the join */ }
  };
  try {
    const uid = await Promise.race([
      ensureAuth(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (uid == null) notify('timeout'); // the bound fired (or auth returned no uid)
    return uid ?? fallbackPlayerId ?? null;
  } catch {
    notify('error');
    return fallbackPlayerId ?? null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * User-facing copy for the ONLY case that can hard-fail: `join_requires_session = TRUE` on the server
 * AND no session could be established (auth outage / offline). Must be shown, never swallowed.
 */
export const JOIN_NO_SESSION_MESSAGE =
  "Couldn't sign you in, so we can't reserve your seat. Check your connection and try again.";

/**
 * T1 — server `error` code -> user-facing copy, resolved at ONE choke point (`joinTable`) rather than
 * at each call site. This constant existed from the day the strict path was written but had NO
 * consumer: `joinTable` returned the RPC payload unmapped and every call site branched only on `ok`
 * and `not_a_member`, so a `no_session` rejection fell through to a generic "table unavailable".
 * Strict mode was live server-side with no user-facing story.
 *
 * Deliberately NOT listed here:
 *  - `not_a_member` — each surface already has better, context-specific copy (public lobby vs private
 *    code vs club screen). Centralising it would REPLACE good copy with worse copy.
 *  - `table_full_or_gone` — same reason; the existing per-surface generics are accurate for it.
 * Only errors with no adequate copy anywhere belong in this map.
 */
const JOIN_ERROR_COPY: Readonly<Record<string, string>> = {
  no_session: JOIN_NO_SESSION_MESSAGE,
};

/** Copy for a server join error, or undefined when the call site's own wording is better. */
export function joinErrorMessage(error?: string | null): string | undefined {
  return error ? JOIN_ERROR_COPY[error] : undefined;
}
