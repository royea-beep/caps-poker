// SERVER-DEAL-PHASE-A / W1 — store-and-serve upload authorisation, extracted PURE so it is
// unit-testable (same idiom as handAcks.ts and handOrdinal.ts).
//
// THE ATTACK THIS CLOSES — DECK INJECTION, and it is strictly worse than the shopping vector.
// In store-and-serve the HOST deals in memory and uploads the deck; clients fetch their own slice.
// If the store is create-or-get and the writer is not checked, FIRST WRITER WINS — and nothing says
// the first writer is the host. A seated NON-HOST who uploads a deck of its own choosing for the
// expected hand_id, before the host does, gets every client to fetch ITS deck.
//   - deck SHOPPING (V1) let the host pick among honest decks.
//   - deck INJECTION lets any seat CHOOSE the cards outright.
// So the upload path needs two independent controls: the writer must be the host (checked against the
// SERVER-SIDE roster, never a request field), and the store must be WRITE-ONCE (or the host can swap
// the deck after clients have already fetched it).

export type StoreAction = 'store' | 'reject';

export type StoreError =
  | 'unauthenticated'  // no verified JWT identity
  | 'not_seated'       // verified, but not at this table
  | 'not_host'         // seated, but not the host -> deck injection attempt
  | 'already_stored';  // write-once: a deck for this hand_id already exists

export interface StoreDecision {
  action: StoreAction;
  error?: StoreError;
}

/** One seat, as read from the SERVER-SIDE room_players roster. */
export interface StoreRosterEntry {
  userId: string | null;   // room_players.user_id (NULLABLE — a legacy seat may have none)
  seatIndex: number;
  isHost: boolean;         // room_players.is_host — server-computed, never client-writable
}

export interface StoreRequest {
  /** From the verified JWT (auth.uid()). NEVER from the request body. */
  callerUserId: string | null;
  /** Server-side roster for the room. */
  roster: StoreRosterEntry[];
  /** Whether a deck is already stored for this hand_id. */
  alreadyStored: boolean;
}

/**
 * Decide whether this caller may STORE the deck for a hand.
 *
 * Check order is deliberate: identity -> seated -> host -> already-stored. `already_stored` is
 * evaluated LAST so the response never tells an unauthorised caller whether a deck exists for a
 * given hand_id — an outsider gets the same answer whether or not the hand has been dealt.
 */
export function decideStore({ callerUserId, roster, alreadyStored }: StoreRequest): StoreDecision {
  if (!callerUserId) return { action: 'reject', error: 'unauthenticated' };

  const seat = roster.find((r) => r.userId !== null && r.userId === callerUserId);
  if (!seat) return { action: 'reject', error: 'not_seated' };

  // THE INJECTION GATE. is_host comes from the roster, which only SECURITY DEFINER RPCs can set
  // (join_table / create_table / leave_table / evict_ghost_seats); room_players has RLS enabled with
  // no UPDATE policy, so a client cannot make itself host.
  if (!seat.isHost) return { action: 'reject', error: 'not_host' };

  // WRITE-ONCE. Without this the host could swap the deck AFTER clients had fetched it — the same
  // re-roll, moved from "before the hand" to "during the hand", which is worse.
  if (alreadyStored) return { action: 'reject', error: 'already_stored' };

  return { action: 'store' };
}
