import { decideStore, type StoreRosterEntry } from '../../supabase/functions/deal_hand/storeDeal';

// W1 — DECK INJECTION. In store-and-serve the host uploads the deck and clients fetch their slice.
// With create-or-get and no writer check, FIRST WRITER WINS: a seated NON-HOST who uploads a deck of
// its own choosing for the expected hand_id, before the host does, makes every client fetch ITS deck.
// Shopping (V1) let the host pick among honest decks; injection lets any seat CHOOSE the cards.
//
// RED/GREEN is expressed as OLD RULE vs NEW RULE: `oldFirstWriterWins` is store-and-serve without a
// writer check — the shape this design would have had if W1 had not been raised.

/** The naive store-and-serve rule: anyone may write if nothing is stored yet. */
function oldFirstWriterWins(alreadyStored: boolean): 'store' | 'reject' {
  return alreadyStored ? 'reject' : 'store';
}

const HOST: StoreRosterEntry = { userId: 'uid-host', seatIndex: 0, isHost: true };
const GUEST: StoreRosterEntry = { userId: 'uid-guest', seatIndex: 1, isHost: false };
const ROSTER = [HOST, GUEST];

describe('W1 store-and-serve upload authorisation', () => {
  it('RED: first-writer-wins lets a seated NON-HOST inject a deck', () => {
    expect(oldFirstWriterWins(/* alreadyStored */ false)).toBe('store');
  });

  it('GREEN: a seated non-host upload is rejected and nothing is stored', () => {
    const d = decideStore({ callerUserId: 'uid-guest', roster: ROSTER, alreadyStored: false });
    expect(d.action).toBe('reject');
    expect(d.error).toBe('not_host');
  });

  it('the host may store when nothing exists yet', () => {
    const d = decideStore({ callerUserId: 'uid-host', roster: ROSTER, alreadyStored: false });
    expect(d.action).toBe('store');
    expect(d.error).toBeUndefined();
  });

  it('RED: without write-once the host could store a SECOND deck for the same hand', () => {
    // The old rule rejects a second write only because the row exists — but nothing stopped an
    // UPDATE/delete-then-insert, which is why write-once must also be enforced in the schema.
    expect(oldFirstWriterWins(true)).toBe('reject');
  });

  it('GREEN: a host uploading twice for the same hand_id is rejected the second time', () => {
    const first = decideStore({ callerUserId: 'uid-host', roster: ROSTER, alreadyStored: false });
    expect(first.action).toBe('store');
    const second = decideStore({ callerUserId: 'uid-host', roster: ROSTER, alreadyStored: true });
    expect(second.action).toBe('reject');
    expect(second.error).toBe('already_stored');
  });

  it('a rejected overwrite leaves the decision unable to mutate — the first deck stands', () => {
    // decideStore never returns 'store' once a deck exists, for ANY caller. The fetch path is
    // therefore unaffected by a failed overwrite: it keeps reading the original row.
    for (const caller of ['uid-host', 'uid-guest', 'uid-stranger']) {
      expect(decideStore({ callerUserId: caller, roster: ROSTER, alreadyStored: true }).action).toBe('reject');
    }
  });

  it('an unauthenticated caller is rejected before anything else is considered', () => {
    const d = decideStore({ callerUserId: null, roster: ROSTER, alreadyStored: false });
    expect(d.action).toBe('reject');
    expect(d.error).toBe('unauthenticated');
  });

  it('a verified stranger who is not seated is rejected as not_seated', () => {
    const d = decideStore({ callerUserId: 'uid-stranger', roster: ROSTER, alreadyStored: false });
    expect(d.action).toBe('reject');
    expect(d.error).toBe('not_seated');
  });

  it('does NOT reveal whether a deck exists to an unauthorised caller', () => {
    // Same answer whether or not the hand has been dealt — already_stored is evaluated last.
    const notDealt = decideStore({ callerUserId: 'uid-stranger', roster: ROSTER, alreadyStored: false });
    const dealt = decideStore({ callerUserId: 'uid-stranger', roster: ROSTER, alreadyStored: true });
    expect(dealt.error).toBe(notDealt.error);
  });

  it('a NULL-user_id seat cannot be matched by a null caller (legacy seat, not an identity)', () => {
    const legacy: StoreRosterEntry[] = [{ userId: null, seatIndex: 0, isHost: true }];
    expect(decideStore({ callerUserId: null, roster: legacy, alreadyStored: false }).error).toBe('unauthenticated');
    expect(decideStore({ callerUserId: 'uid-host', roster: legacy, alreadyStored: false }).error).toBe('not_seated');
  });
});
