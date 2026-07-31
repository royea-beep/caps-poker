# PHASE 0 — Channel Authorisation & Private Transport (DESIGN ONLY, nothing shipped)

> 2026-07-31. Design + verification. **No channel change shipped, no `private: true` in shipped code,
> no `realtime.messages` policy on the shared project.** Written after N2 proved a listener with no
> session, no seat and no membership receives every seat's hole cards off `caps-room-{code}`.

## P1 — Is `private: true` a real control, or theatre?

**It is a real control.** The concern was that `private` is a client-declared flag an attacker simply
omits, joining the same topic as a public channel — which would make the whole plan decorative, exactly
like the "RLS under service_role" trap we already hit. The Supabase docs resolve the mechanism, verbatim:

> "The `realtime.send()` function in the database includes a flag that determines whether the broadcast
> is private or public, and client channels also have the same configuration. **For broadcasts to work
> correctly, these settings must match. A public broadcast only reaches public channels and a private
> broadcast only reaches private channels.**"

> "By default, all database broadcasts are private, meaning clients must authenticate to receive them.
> If the database sends a public message but the client subscribes to a private channel, the message is
> not delivered because private channels only accept signed, authenticated messages."

Public and private are **separate delivery domains**, not a permission check layered on one shared
topic. An attacker who omits `private: true` lands in the *public* domain and receives nothing that was
broadcast privately. So no project-level "force private topics" setting is required — and none was
found in the docs (`private_only` / "disable public channels" / "Enable private": zero occurrences).

**SUPERSEDED — the branch test WAS subsequently run; see the Q1 section below, which confirms `private` is server-enforced AND that the policy keys on membership. The paragraph below is retained only to show what was known before that test.** Residual as of that moment: this was a docs-level (mechanism) answer, not an executed branch test. The
empirical test — create a `realtime.messages` policy, broadcast privately, attempt a non-private join to
the same topic — was NOT run: it requires either a shared-project policy (forbidden this sprint) or a
paid Supabase branch. Given the mechanism is unambiguous **and** P2 below shows the durable fix does not
depend on this answer, the test is no longer load-bearing. Run it at implementation time as the gate
before flipping any client to `private: true`.

## P2 — The durable fix: secrets must not traverse a shared channel

**Channel authz alone is insufficient, and this is the key point.** Even with perfect authorisation, a
seated *opponent* is legitimately authorised on `caps-room-{code}` — and today they receive
`CARDS_DEALT` for every seat and `BOARD_REVEAL` with all `closedCards`. `targetId` filtering is
client-side only (`realtimeMultiplayer.ts:932`). So channel authz stops **strangers**, not **the players
at the table**. Both must be closed.

### What moves OFF the channel

| Message | Carries today | Where it goes |
|---|---|---|
| `CARDS_DEALT` | a seat's `yourCards` — broadcast to all, filtered client-side | **HTTPS fetch**: each client calls `deal_hand` and receives ONLY its own slice (own hole cards + open board cards + a closed *count*). Already built in Phase A. |
| `BOARD_REVEAL` | `closedCards` + `playerHands` for EVERY seat, sent at reveal | **Server-released, staged**: a reveal endpoint releases board *n*'s closed cards only when the hand legitimately reaches board *n*, to every client equally. Requires the reveal cursor that `dealt_hands` lacks. |
| chip settlement | derived from host-side evaluation | **Server-computed** and returned/settled server-side (same authority the rake needs). |

### What STAYS on the channel

Turn order and phase transitions · timers/countdowns · presence and seat occupancy · ready/ack signals ·
chat/emotes · **post-settlement** chip deltas (public by then) · reveal *notifications* (not card data).
Reduced to coordination only: **nothing secret rides the channel.**

### This reframes Phase A

Phase A's value was recorded as "server-authoritative shuffle". That was the wrong headline. Its real
value is the **private per-caller transport** — `sliceForPlayer` + the JWT/roster authz already deliver
each client only its own cards over authenticated HTTPS. That is precisely the `CARDS_DEALT` fix.

- **Promoted from Phase A into PHASE 0:** the `deal_hand` EF + `sliceForPlayer` no-leak boundary + the
  JWT-verified/roster authz (`authz.ts`) + `dealt_hands` server-side storage + `private: true` on both
  channels + a `realtime.messages` policy keyed on room membership.
- **Remains PHASE B:** staged board reveal (the reveal cursor `dealt_hands` does not have), server-side
  showdown evaluation (`evaluateAllBoards`), chip settlement (`calculateChipDeltas`) + the working rake,
  and HMAC commit–reveal provable fairness.

**Dependency worth stating:** a `realtime.messages` policy keys off room membership → it reads
`room_players` → that is only trustworthy if seats carry a verified identity. So the identity work
(`user_id` population, `join_requires_session`, the club guard) is a **prerequisite** for Phase 0, not a
competing track.

## P3 — Interim posture

- **MP is known-exploitable until Phase 0 ships.** Not shut down: no MP session since ~2026-07-12
  (`mp_game_started` 24/19 devices in 30d, all older than three weeks). That is a judgement about
  *exposure*, not *severity*, and must be revisited the moment traffic resumes.
- **Tripwire live:** `phase0_mp_traffic_tripwire()` + hourly cron `caps_phase0_tripwire` alerts through
  `whatsapp_outbound` if `mp_game_started` fires while Phase 0 is unshipped. Self-disarms when
  `app_config.phase0_channel_authz_shipped` is set true.
- **Spectate channel is CLEAN.** `spectate:{roomCode}` carries `SpectatorSnapshot` only:
  `communityCards` = `b.openCards` (open cards only), and `revealedBoards[].playerHands` =
  `{ playerName, handRank }` — hand-rank *labels*, never card ids. No hole cards, no closed cards.
  **Intended spectator visibility:** open community cards, player names/ready state, winner name and
  hand-rank labels post-reveal, spectator count. Phase 0 should preserve exactly that and must not
  "upgrade" spectators to card-level data when the reveal moves server-side.


## Q1 — BRANCH TEST RESULT: `private` is SERVER-ENFORCED, and the policy keys on MEMBERSHIP

Run on a throwaway Supabase branch (`phase0-injection-test`, deleted; $0.01344/hr, ~35 min ≈ **$0.01**)
with a membership-keyed `realtime.messages` policy in place.

| Case | Subscribe | Injection landed on a private member? |
|---|---|---|
| Member (granted membership) + `private: true` | **SUBSCRIBED** | — |
| **T1** anon-only, no session, **no** `private` flag | SUBSCRIBED *(to the public topic)* | **NO** |
| **T2** valid session, **no** membership, `private: true` | **CHANNEL_ERROR — "Unauthorized: You do not have permissions to read from this Channel topic: caps-room-BR01"** | **NO** |

**The policy keys on MEMBERSHIP, not merely on being logged in** — T2 is the decisive case: a fully
authenticated user was rejected at subscribe because it was not in the membership table.

**On SEND:** `send()` returned `"ok"` for the anon and outsider clients, but that is the client-side
result of a REST fallback — the message **never reached the private member**. Report it as
"send call returns ok locally, delivery blocked", never as "SEND: YES".

**Residual, stated honestly:** I did not obtain a paired POSITIVE control (member1 → member2 delivery) —
self-broadcast is off by default so the single member never saw its own message, and the two-member
rerun hung on client teardown and was killed. So "injection blocked" rests on the negative observation
plus the documented public/private domain separation, not on a matched positive control. Re-run the
two-member control at implementation time.

**IMPLEMENTATION TRAP FOUND (would have broken Phase 0 silently):** the `realtime.messages` policy's
`EXISTS` subquery is evaluated **as the connecting user**. With RLS enabled on the membership table and
no SELECT policy, legitimate members are rejected `Unauthorized` — the check silently returns false. I
hit exactly this and had to add `read own membership`. In CAPS this happens to hold today because
`room_players` carries `"Anyone can read room_players" SELECT TO public` — but if that policy is ever
tightened, channel access dies with it. **Couple the two deliberately, and test a legitimate member
after any change to `room_players` visibility.**

## Q2 — MESSAGE AUTHENTICITY (Phase 0 requirement)

**P2 made the game confidential. It does not make it authentic.** An attacker who cannot read a single
card can still PUBLISH. `senderId` is just a payload field — `const { type, data, senderId } = payload`
(`realtimeMultiplayer.ts:230`) — and **nothing binds it to the authenticated sender**. Proven on live in
N2: a forged payload carrying `senderId: "host"` was received verbatim by a listener that was not the
host. So after Phase 0's confidentiality work, a *seated* player (legitimately on the channel) can still
impersonate the host or another seat.

### INSTRUCTIONS (mutate state — must be bound to a verified sender)

| Message | Effect if forged |
|---|---|
| `GAME_START` / phase transitions | starts/advances a hand out of band |
| `PLAYER_READY` / ready-acks | triggers the next hand without consent (the unanimity rule becomes forgeable) |
| `BOARD_ASSIGNMENT` / placement submissions | commits another player's cards |
| next-hand / rematch requests | resets a hand in progress (the griefing vector G1 closed server-side — do not re-open it client-side) |
| turn advance / timer expiry | steals or skips a turn |
| chip-delta / settlement messages | fabricates an economic outcome |

### INFORMATION (display only — forging is a nuisance, not a state change)

chat / emotes · presence and spectator counts · countdown ticks used purely for rendering ·
post-settlement result *echoes* (once the server is the record of truth) · reveal *notifications*.

### Binding mechanism, per class

- **Every INSTRUCTION moves to an RPC / Edge Function**, where the server validates `auth.uid()` against
  the seated player it claims to be *and* against whether that action is legal right now. This is the
  same shape as the `join_table` / `promote_starting_to_playing` / `begin_next_hand` work already done.
- **INFORMATION may stay on the channel**, but the client must treat it as advisory and never mutate
  authoritative state from it.
- **Signing individual messages is explicitly NOT chosen** — it needs key distribution and still leaves
  the server ignorant of game state, so it buys authenticity without authority.

### The principle, stated plainly

> **After Phase 0, no client message may be TRUSTED to mutate game state merely because it arrived on
> the channel. The server is the arbiter of state; the channel is a coordination bus.**

### PHASE B DEPENDENCY — recorded now, not designed here

The current architecture **cannot** satisfy that principle, because turn/phase logic lives in the host's
in-memory `RealtimeServer`. There is no server-side notion of whose turn it is, so no RPC can validate
"is this caller allowed to do this now". **Moving turn/phase state server-side is therefore a Phase B
dependency of Phase 0's authenticity goal.** Not designed this sprint — named and stopped, deliberately.
Consequence to accept honestly: Phase 0 alone delivers *confidentiality* + *stranger exclusion*; full
*authenticity against a seated opponent* is not achievable until that Phase B move lands.
