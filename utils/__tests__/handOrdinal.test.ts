import { decideOrdinal } from '../../supabase/functions/deal_hand/handOrdinal';

// V1 — a malicious HOST shopping for decks. The EF is create-or-get keyed on hand_id, so whoever
// asks first mints the deal. With a client-chosen ordinal, a seated host can mint N+1, read its own
// slice, dislike it, mint N+2, and announce N+2. Every one of those requests is a legitimately
// seated player asking for its OWN cards, so authz passes on all of them — the no-leak property is
// untouched and the fairness property dies anyway.
//
// RED/GREEN is expressed as OLD RULE vs NEW RULE below: `oldCreateOrGet` is the behaviour that
// shipped on this branch (mint whenever no row exists, no ordinal check). Each adversarial case
// asserts the old rule ALLOWS the abuse and the new rule BLOCKS it.

/** The pre-V1 behaviour: create-or-get with no ordinal check at all. */
function oldCreateOrGet(storedExists: boolean): 'return_stored' | 'mint' {
  return storedExists ? 'return_stored' : 'mint';
}

describe('V1 hand-ordinal monotonicity', () => {
  it('RED: the old create-or-get rule lets a host burn forward to N+2 (deck shopping)', () => {
    // Expected next is 2 (ordinal 1 already played). Host asks for 3 to get a different deck.
    expect(oldCreateOrGet(/* storedExists */ false)).toBe('mint'); // old rule: mints ANY ordinal
  });

  it('GREEN: a seated player requesting N+2 while N+1 is expected is rejected, nothing minted', () => {
    const d = decideOrdinal({ requested: 3, cursor: 1, storedExists: false });
    expect(d.action).toBe('reject');
    expect(d.error).toBe('ordinal_out_of_order');
    expect(d.action).not.toBe('mint'); // explicitly: NOTHING is stored
  });

  it('requesting N+1 twice returns the SAME deck — create-or-get is preserved, no re-deal', () => {
    const first = decideOrdinal({ requested: 2, cursor: 1, storedExists: false });
    expect(first.action).toBe('mint');
    // after the mint the row exists; every other seat asking for the same ordinal must read it
    const second = decideOrdinal({ requested: 2, cursor: 2, storedExists: true });
    expect(second.action).toBe('return_stored');
    expect(second.error).toBeUndefined();
  });

  it('an already-consumed ordinal whose row still exists returns the stored deck and mints nothing', () => {
    const d = decideOrdinal({ requested: 1, cursor: 3, storedExists: true });
    expect(d.action).toBe('return_stored');
  });

  // THE RETENTION DOOR. If the expected-next ordinal were derived from max(stored ordinal), the 24h
  // TTL deleting rows would LOWER the max and a consumed ordinal could be minted again with a fresh
  // deck — the re-roll returns through the retention door. The cursor must outlive the decks.
  it('RED: deriving the counter from stored rows lets a TTL-deleted ordinal be re-minted', () => {
    // rows for ordinals 1..3 have been dropped by the TTL, so a row-derived counter sees nothing
    const rowDerivedCursor = null; // max(stored) over an empty set
    const d = decideOrdinal({ requested: 1, cursor: rowDerivedCursor, storedExists: false });
    expect(d.action).toBe('mint'); // <-- the re-roll, if the cursor is derived from rows
  });

  it('GREEN: with a TTL-surviving cursor, a burned ordinal returns hand_expired and is never re-minted', () => {
    const d = decideOrdinal({ requested: 1, cursor: 3, storedExists: false });
    expect(d.action).toBe('reject');
    expect(d.error).toBe('hand_expired');
  });

  it('a fresh room may only mint ordinal 1', () => {
    expect(decideOrdinal({ requested: 1, cursor: null, storedExists: false }).action).toBe('mint');
    const skip = decideOrdinal({ requested: 7, cursor: null, storedExists: false });
    expect(skip.action).toBe('reject');
    expect(skip.error).toBe('ordinal_out_of_order');
  });

  it('rejects non-positive and non-integer ordinals rather than coercing them', () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      const d = decideOrdinal({ requested: bad, cursor: null, storedExists: false });
      expect(d.action).toBe('reject');
      expect(d.error).toBe('bad_ordinal');
    }
  });

  it('a host cannot mint an unbounded run of decks to sample from', () => {
    // Simulate the shopping loop: cursor stays put because every out-of-order request mints nothing.
    let cursor: number | null = 1;
    let minted = 0;
    for (const wanted of [3, 4, 5, 6, 7]) {
      const d = decideOrdinal({ requested: wanted, cursor, storedExists: false });
      if (d.action === 'mint') { minted += 1; cursor = wanted; }
    }
    expect(minted).toBe(0);
    expect(cursor).toBe(1);
  });
});
