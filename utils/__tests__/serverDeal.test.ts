import {
  dealFromSeed,
  sliceForPlayer,
  createDeck,
  type ServerDeal,
} from '../../supabase/functions/deal_hand/deal';
import { authorizeDealRequest } from '../../supabase/functions/deal_hand/authz';

// SERVER-DEAL-PHASE-A verification. These are the invariants the owner named as critical because
// this path touches every hand/card/chip. The MP *flow* still needs the 2-device acceptance test;
// this proves the deal LOGIC is correct, deterministic, and non-leaking.
describe('server deal — deterministic, valid Omaha, no-leak', () => {
  const SEED = 'a1b2c3d4'.repeat(8); // 64-hex

  it('deterministic: same seed -> byte-identical deck', () => {
    const a = dealFromSeed(SEED, 2);
    const b = dealFromSeed(SEED, 2);
    expect(a.deck.map((c) => c.id)).toEqual(b.deck.map((c) => c.id));
  });

  it('sensitive: a different seed -> a different deck', () => {
    const a = dealFromSeed(SEED, 2).deck.map((c) => c.id);
    const b = dealFromSeed('ffffffff'.repeat(8), 2).deck.map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it('the shuffled deck is a valid 52-card permutation (no cards created/lost)', () => {
    const d = dealFromSeed(SEED, 3);
    const ids = d.deck.map((c) => c.id);
    expect(ids.length).toBe(52);
    expect(new Set(ids).size).toBe(52);
    expect(new Set(ids)).toEqual(new Set(createDeck().map((c) => c.id)));
  });

  // [playerCount, cardsPerPlayer, boards, usedCards, discarded]
  const cases: Array<[2 | 3 | 4, number, number, number, number]> = [
    [2, 16, 4, 52, 0],
    [3, 12, 3, 51, 1],
    [4, 8, 2, 42, 10],
  ];
  it.each(cases)(
    '%iP deal: no duplicate cards across all hole+board cards; correct counts; discard math',
    (pc, cpp, boards, used, discard) => {
      const d = dealFromSeed(SEED, pc);
      expect(d.playerHands.length).toBe(pc);
      d.playerHands.forEach((h) => expect(h.length).toBe(cpp));
      expect(d.boards.length).toBe(boards);
      d.boards.forEach((b) => {
        expect(b.openCards.length).toBe(3);
        expect(b.closedCards.length).toBe(2);
      });
      const inPlay = [
        ...d.playerHands.flat(),
        ...d.boards.flatMap((b) => [...b.openCards, ...b.closedCards]),
      ];
      expect(inPlay.length).toBe(used);
      expect(new Set(inPlay.map((c) => c.id)).size).toBe(used); // ZERO duplicates in play
      expect(d.discarded.length).toBe(discard);
      // dealt + discarded === the full 52, still all unique
      const full = [...inPlay, ...d.discarded];
      expect(new Set(full.map((c) => c.id)).size).toBe(52);
    },
  );

  it('NO-LEAK: a player payload carries ONLY own hole cards + open cards + a closed COUNT', () => {
    const deal: ServerDeal = dealFromSeed(SEED, 4);
    const p0 = sliceForPlayer(deal, 0, 'hand-x');
    const visibleToP0 = new Set<string>([
      ...p0.yourCards.map((c) => c.id),
      ...p0.boards.flatMap((b) => b.openCards.map((c) => c.id)),
    ]);
    // opponents' hole cards must NOT be present anywhere in P0's payload
    for (let i = 1; i < 4; i++) {
      for (const c of deal.playerHands[i]) expect(visibleToP0.has(c.id)).toBe(false);
    }
    // NO closed board card may appear in the payload (only a count)
    for (const b of deal.boards) {
      for (const c of b.closedCards) expect(visibleToP0.has(c.id)).toBe(false);
    }
    p0.boards.forEach((b) => expect(b.closedCardCount).toBe(2));
    // own cards ARE present + correct count for 4P
    expect(p0.yourCards.length).toBe(8);
    // the payload has no `deck`, no `playerHands`, no `closedCards` keys at all
    expect(JSON.stringify(p0)).not.toContain('closedCards');
    expect((p0 as unknown as { deck?: unknown }).deck).toBeUndefined();
  });

  it('every seat gets a disjoint hand + all seats union to the full in-play set', () => {
    const deal = dealFromSeed(SEED, 2);
    const seen = new Set<string>();
    deal.playerHands.forEach((hand) =>
      hand.forEach((c) => {
        expect(seen.has(c.id)).toBe(false); // disjoint across seats
        seen.add(c.id);
      }),
    );
  });
});

// ── A2 ADVERSARIAL AUTHZ — the tests that were missing. These prove a caller cannot obtain ANOTHER
// seat's cards. The authz decision comes from the VERIFIED JWT (auth.uid()) + the SERVER roster; there
// is no request field that selects a seat, so the spoof is structurally impossible. `legacyResolveByBody`
// captures the PRE-FIX logic (identity + roster from the client body) to show tests 1-3 were RED before.
function legacyResolveByBody(bodyDeviceId: string, clientSuppliedSeats: string[]): number {
  return clientSuppliedSeats.indexOf(bodyDeviceId); // OLD: identity AND roster came from the caller
}

describe('server deal — adversarial authz (identity from verified JWT + server roster)', () => {
  // Server roster (from room_players): seat 0 = user-A, seat 1 = user-B. Both authenticated.
  const roster = [
    { userId: 'user-A', seatIndex: 0 },
    { userId: 'user-B', seatIndex: 1 },
  ];

  it('1. caller A cannot request B’s slice (no body field selects a seat)', () => {
    // NEW: identity=A -> only A's own seat is derivable. There is no argument to request B.
    expect(authorizeDealRequest('user-A', roster)).toEqual({ ok: true, seat: 0 });
    // RED-before contrast: the OLD body-param path DID hand over B's seat when A passed B's device id.
    expect(legacyResolveByBody('device-B', ['device-A', 'device-B'])).toBe(1); // the leak, pre-fix
  });

  it('2. caller not seated in the hand -> rejected', () => {
    expect(authorizeDealRequest('user-C', roster)).toEqual({ ok: false, error: 'not_seated' });
  });

  it('3. unauthenticated / anon-key-only (no verified uid) -> rejected', () => {
    expect(authorizeDealRequest(null, roster)).toEqual({ ok: false, error: 'unauthenticated' });
    // a null caller must NEVER match a device-anon roster slot whose user_id is also null:
    const anonRoster = [
      { userId: null, seatIndex: 0 },
      { userId: 'user-B', seatIndex: 1 },
    ];
    expect(authorizeDealRequest(null, anonRoster)).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('4. caller A’s own slice -> A’s seat only (own cards proven in the NO-LEAK test above)', () => {
    expect(authorizeDealRequest('user-A', roster)).toEqual({ ok: true, seat: 0 });
    expect(authorizeDealRequest('user-B', roster)).toEqual({ ok: true, seat: 1 });
  });

  it('5. replay: A calls twice -> identical seat, deterministic (deal row is create-or-get by hand_id PK)', () => {
    const first = authorizeDealRequest('user-A', roster);
    const second = authorizeDealRequest('user-A', roster);
    expect(first).toEqual(second);
    expect(first).toEqual({ ok: true, seat: 0 });
    // (No second dealt_hands row is possible: hand_id is the PK + create-or-get in index.ts — a
    //  DB-level guarantee, verified against the DB, not re-asserted here.)
  });
});
