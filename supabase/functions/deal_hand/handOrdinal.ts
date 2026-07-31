// SERVER-DEAL-PHASE-A / V1 — hand-ordinal monotonicity, extracted PURE so it is unit-testable
// (same pattern as handAcks.ts).
//
// THE ATTACK THIS CLOSES. The EF is create-or-get keyed on hand_id: the first authorised caller
// mints the deal. If the ordinal is chosen by the client (and step 1's original plan had the HOST
// broadcasting it), a malicious host can call deal_hand for N+1, N+2, N+3…, read its OWN slice each
// time — every request is a genuinely seated player asking for its own cards, so authz passes on all
// of them — and then announce whichever ordinal dealt it the best hand. The no-leak property holds
// perfectly and the fairness property dies anyway: card DELIVERY moves off the wire while a NEW host
// advantage replaces the old one.
//
// ⚠️ MONOTONICITY ALONE DOES NOT CLOSE IT. Minting only `cursor + 1` stops a caller re-minting the
// SAME ordinal, but burning is free: the host peeks N+1, dislikes it, peeks N+2, and simply plays
// N+2. A skipped hand costs the attacker nothing. Two further conditions are required and are stated
// in docs/PHASE_0_CHANNEL_AUTHZ.md (V1):
//   (A) clients must DERIVE the ordinal themselves, never accept it from the host; and
//   (B) minting ordinal K must require that K-1 is complete (handAcks unanimity).
// This module is (1) of (3). It is necessary, not sufficient.

export type OrdinalAction = 'return_stored' | 'mint' | 'reject';

export type OrdinalError =
  | 'bad_ordinal'          // not a positive integer
  | 'ordinal_out_of_order' // ahead of the expected next -> would let a caller skip/burn forward
  | 'hand_expired';        // already consumed, and its deck has been dropped by the TTL

export interface OrdinalDecision {
  action: OrdinalAction;
  error?: OrdinalError;
}

export interface OrdinalRequest {
  /** Ordinal the caller is asking for (1-based). */
  requested: number;
  /**
   * Room high-water mark: the highest ordinal EVER minted for this room, or null for a fresh room.
   * MUST come from a cursor that outlives the 24h dealt_hands TTL — see decideOrdinal's note on the
   * retention door.
   */
  cursor: number | null;
  /** Whether a dealt_hands row for this exact (room, ordinal) still exists. */
  storedExists: boolean;
}

/**
 * Decide what the EF may do with an ordinal request.
 *
 * RETENTION DOOR (the subtle one): the 24h TTL deletes decks. If the expected-next ordinal were
 * derived from `max(stored ordinal)`, deleting rows would LOWER the maximum and a consumed ordinal
 * could be minted a second time — the re-roll walks back in through the retention door with a fresh
 * deck. So the cursor is a separate high-water mark that the TTL does not touch, and a request at or
 * below it whose row is gone returns `hand_expired` and mints NOTHING.
 */
export function decideOrdinal({ requested, cursor, storedExists }: OrdinalRequest): OrdinalDecision {
  if (!Number.isInteger(requested) || requested < 1) {
    return { action: 'reject', error: 'bad_ordinal' };
  }

  // create-or-get preserved: an existing deal is returned as-is, never re-dealt. Idempotent by
  // design — every seat at the table asks for the same ordinal and must get the same deck.
  if (storedExists) return { action: 'return_stored' };

  const expectedNext = cursor === null ? 1 : cursor + 1;

  if (requested === expectedNext) return { action: 'mint' };

  // Consumed already, row gone (TTL). Never re-mint: that is the retention-door re-roll.
  if (cursor !== null && requested <= cursor) {
    return { action: 'reject', error: 'hand_expired' };
  }

  // Ahead of the expected next: this is the deck-shopping / burn-forward request.
  return { action: 'reject', error: 'ordinal_out_of_order' };
}
