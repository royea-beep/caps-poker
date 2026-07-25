// SERVER-DEAL-PHASE-A — authorization decision, extracted PURE so it is unit-testable (the missing
// adversarial tests). This is the sole authz boundary for the full deck: the EF runs as service_role
// and BYPASSES the dealt_hands RLS, so RLS is decorative — THIS function is the real gate.
//
// CRITICAL FIX (was: identity from a request-body device_id + a client-supplied `seats` roster, so a
// caller could ask for another seat's cards): identity now comes ONLY from the VERIFIED JWT
// (callerUserId = auth.uid()) and the seat is looked up from the SERVER-SIDE roster (room_players).
// A caller can therefore only ever receive its OWN seat, and only if it is actually seated. There is
// no request field that selects a seat — the spoof is structurally impossible.

export interface RosterEntry {
  userId: string | null; // room_players.user_id (== auth.uid() of the seated player)
  seatIndex: number; // room_players.seat_index (server-assigned by join_table)
}

export type AuthzResult =
  | { ok: true; seat: number }
  | { ok: false; error: 'unauthenticated' | 'not_seated' };

/**
 * Decide which seat's slice (if any) the caller may receive.
 * @param callerUserId auth.uid() from the VERIFIED JWT — NOT from the request body. null = no verified
 *                     identity (anonymous / no session) -> rejected.
 * @param roster       the hand's room roster from room_players (server-authoritative), one row per seat.
 */
export function authorizeDealRequest(callerUserId: string | null, roster: RosterEntry[]): AuthzResult {
  if (!callerUserId) return { ok: false, error: 'unauthenticated' };
  const entry = roster.find((r) => r.userId != null && r.userId === callerUserId);
  if (!entry) return { ok: false, error: 'not_seated' };
  return { ok: true, seat: entry.seatIndex };
}
