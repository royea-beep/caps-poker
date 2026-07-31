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

**~~Residual~~ — CLOSED by R2 below.** At the time of Q1 I did not obtain a paired POSITIVE control
(member1 → member2 delivery): self-broadcast is off by default so the single member never saw its own
message, and the two-member rerun hung on client teardown and was killed. **That control was
subsequently obtained — see R2: member A → member B `RECEIVED`, in the same run as both blocked
injections.** The Q1 negatives are therefore interpretable in hindsight; they were not, on their own,
at the time.

**IMPLEMENTATION TRAP FOUND (would have broken Phase 0 silently):** the `realtime.messages` policy's
`EXISTS` subquery is evaluated **as the connecting user**. With RLS enabled on the membership table and
no SELECT policy, legitimate members are rejected `Unauthorized` — the check silently returns false. I
hit exactly this and had to add `read own membership`. In CAPS this happens to hold today because
`room_players` carries `"Anyone can read room_players" SELECT TO public` — but if that policy is ever
tightened, channel access dies with it.

> ⚠️ **This paragraph's original conclusion — "couple the two deliberately" — is SUPERSEDED and was
> WRONG.** Coupling channel access to a permissive `room_players` SELECT preserves the very policy the
> impersonation chain exploited. The correct resolution is to **DECOUPLE** via a `SECURITY DEFINER`
> predicate. See **R1** below, verified on a branch with `room_players` and `game_rooms` at RLS-on and
> zero SELECT policies.

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


## R1 — DECOUPLING: the channel policy must not depend on any table's SELECT policy

The Q1 "implementation trap" is not merely a trap — it is a **direct conflict between two correct
security fixes**, and it had to be designed out before either ships.

- The `realtime.messages` policy's `EXISTS` is evaluated **as the connecting user**. A policy that
  reads `room_players` directly therefore depends on `room_players` being readable by that user.
- CAPS satisfies that today only by accident: `room_players` carries
  `"Anyone can read room_players" SELECT TO public USING (true)` (verified live 2026-07-31).
- But **that permissive policy is exactly what made the impersonation chain possible** — it is where
  the attacker harvested the `user_id` (N) and then the `device_id` (N1). Narrowing it is work this
  project should do anyway.
- Ship both naively and they destroy each other: tightening `room_players` SELECT would silently
  reject **every legitimate player** from their own game channel, failing closed with no diagnosable
  client error (just `Unauthorized`).

### The fix: a SECURITY DEFINER predicate

```sql
create or replace function public.is_room_member(p_topic text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_ok boolean;
begin
  if v_uid is null then return false; end if;                              -- no verified identity, ever
  if p_topic is null or p_topic !~ '^caps-room-[A-Za-z0-9]{4}$' then return false; end if;
  v_code := upper(right(p_topic, 4));
  select exists (
    select 1
    from public.room_players rp
    join public.game_rooms gr on gr.id = rp.room_id
    where gr.room_code = v_code
      and rp.user_id = v_uid          -- ALWAYS the caller; cannot probe anyone else
  ) into v_ok;
  return coalesce(v_ok, false);
end $$;

revoke all on function public.is_room_member(text) from public, anon;
grant execute on function public.is_room_member(text) to authenticated;

create policy "phase0 room members read"  on realtime.messages
  for select to authenticated using ( public.is_room_member((select realtime.topic())) );
create policy "phase0 room members write" on realtime.messages
  for insert to authenticated with check ( public.is_room_member((select realtime.topic())) );
```

**Non-negotiable properties of this function** — a definer function that leaks is worse than the
policy it replaces:

1. **Returns ONLY a boolean.** Never rows, never seat lists, never identities. There is no output
   channel through which it can leak what the tables hold.
2. **Compares `auth.uid()` itself.** The caller cannot pass a user id, so it can only ever ask *"am I
   in this room"* — a question the caller already knows the answer to. It is not an identity oracle.
3. **Device ids are not accepted.** A verified session or nothing.
4. **Topic is validated** against the CAPS room-topic shape before use.
5. `stable` + `set search_path` — standard definer hygiene.

### R1.4 — `game_rooms` has the SAME dependency, and it is easy to miss

The channel topic is `caps-room-{room_code}`, but `room_players` keys on `room_id`. **Any membership
check must therefore read `game_rooms` too**, to map code → id. Written as a naive inline policy that
is a *second* silent dependency on a *second* table's SELECT policy. Resolving `room_code` **inside**
the definer function decouples both tables at once. That is why the function takes the topic rather
than a room id.

### R2 — VERIFIED ON A BRANCH, WITH THE TABLES LOCKED DOWN

Branch `phase0-membership-decouple` (deleted; $0.01344/hr, ~25 min ≈ **$0.01**). The fixture
deliberately set the **future hardened state**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on **both**
`room_players` and `game_rooms` with **zero** SELECT policies (verified: `relrowsecurity=true`,
`policies=0` on each). Under the Q1-style inline policy this configuration rejects every member; the
decoupled design must survive it.

| Client | Subscribe | Did member B receive its message? |
|---|---|---|
| **Member A** (seated, `private: true`) | **SUBSCRIBED** | — (the broadcaster) |
| **Member B** (seated, `private: true`) — the listener | **SUBSCRIBED** | — |
| **POSITIVE CONTROL**: A → B | — | **RECEIVED** ✅ |
| anon-only, no session, no `private` flag | SUBSCRIBED *(public topic)* | **blocked** |
| authenticated **non-member**, `private: true` | **CHANNEL_ERROR — "Unauthorized: You do not have permissions to read from this Channel topic: caps-room-RB01"** | **blocked** |

**The positive control is now matched:** the same listener B, in the same run, received the legitimate
member's broadcast and neither injection. "Injection blocked" no longer rests on negatives that could
equally mean "the fixture delivers nothing to anyone". Reproduced twice; teardown bounded by an
explicit timeout (the Q1 hang did not recur; `teardown: clean`, exit 0).

**And it worked with both tables at RLS-on / zero-SELECT-policies** — which is the proof that channel
access is decoupled. `room_players` SELECT can now be narrowed without killing the game channel.

**One honest note on flakiness:** the first run recorded B's subscribe as a transient
`MissingPartition: Realtime was unable to find the expected messages partition` — the same
branch-provisioning race seen in Q1 — yet B still received the control message. The second run was
clean (`SUBSCRIBED`). This is a *branch* artifact, not a design finding.

**`senderId` is still unbound**, re-confirmed here: member A's payload claiming
`senderId: "CLAIMED-TO-BE-HOST"` arrived at B verbatim. Channel authz decides *who may speak*, never
*who they are*. That is Q2's problem, and it is not solved by this policy.

### FUTURE ITEM (NOT this sprint) — narrow `room_players` / `club_members` SELECT

Verified live 2026-07-31, both expose every seat identity to anyone holding the anon key:

| Table | Policy | Exposes |
|---|---|---|
| `room_players` | `"Anyone can read room_players"` — `SELECT TO public USING (true)` | `user_id`, `device_id` |
| `club_members` | `"club_members_read"` — `SELECT TO public USING (true)` | `user_id`, `device_id` |

**This is precisely what both spoofs used** — N harvested `user_id`, N1 harvested `device_id`.
Once the channel policy is decoupled (above), narrowing these becomes possible. **Do not narrow them
yet:** `list_public_tables` and the lobby may read them, and that needs its own audit with a
legitimate-player regression test. Recorded as a separate follow-on, sequenced *after* Phase 0.

## S2 — PHASE 0 ROLLOUT PLAN (planning only; nothing in this section is shipped)

**The dangerous part of Phase 0 is the CUTOVER, not the policy.** Public and private are separate
delivery domains, so a mixed fleet is a fleet where players in the same room cannot hear each other.
And a private channel with no policy denies everyone. The plan is built around those two facts.

### The failure mode we are designing against, stated first

**A half-flipped fleet is a SILENT HANG, not an error.** Player A on a new client (private) and player B
on an old client (public) both join room `ABCD`. Both subscribe *successfully* — to different delivery
domains. Neither sees the other in presence. Each sees an empty seat that never fills, a "waiting for
players" that never resolves, a ready-ack that never arrives, and eventually a timer that expires for
no visible reason. **No error is raised anywhere.** That is worse than a crash: it is unreportable by
the player and invisible in error logs. Every step below exists to make this state impossible or brief.

### Step order (each step is independently revertible)

| # | Step | Rollback |
|---|---|---|
| 0 | **DB first.** Create `is_room_member` + both `realtime.messages` policies on the shared project. No client is private yet, so the policy is inert — `realtime.messages` RLS is only consulted for private channels. | `drop policy` ×2, `drop function`. Inert either way. |
| 1 | **Ship dual-mode client, flag FALSE.** Client reads `app_config.phase0_channel_authz_shipped` and chooses `{ config: { private: <flag> } }` at channel construction. With the flag false, behaviour is byte-identical to today. Ship via `npm run ota` (branch `production`). | OTA rollback; behaviour was already unchanged. |
| 2 | **Wait for fleet reach** (threshold below). Nothing to roll back — this step is only waiting. | — |
| 3 | **Flip `phase0_channel_authz_shipped` = true.** One row. All clients that have the new bundle go private together on their next channel construction. | `UPDATE app_config SET value='false'` — one row, no deploy. Same shape as the S1 rollback. |
| 4 | **Verify**, then let the MP tripwire self-disarm (it keys on this same flag). | — |

**Step 0 before step 3 is non-negotiable and is the single easiest way to break this:** a private
channel with no matching policy denies *everyone*, including legitimate players. Policy first, always.

**Note the flag does double duty and that is deliberate:** `phase0_channel_authz_shipped` already
self-disarms the MP tripwire. Using the same key to gate the client means the tripwire cannot disarm
while clients are still public — the alarm stays armed exactly as long as the exposure exists.

### S2.3 — How we know the OTA reached the fleet, and the clients that never relaunch

**Clients take an OTA on relaunch.** So "shipped" and "arrived" are different events and only the
second one matters here.

*Evidence threshold (all three, not any one):*
1. A version-stamped client event (e.g. `app_open`) shows **≥99% of devices active in the trailing 7
   days are on the new bundle**, sustained for 7 consecutive days.
2. **Zero** MP-entry events (`table_joined` / `mp_game_started`) from a pre-cutover bundle in the
   trailing 7 days — this is the population that actually matters, since only MP clients touch the
   channel. A stale solo-only client is harmless.
3. The counting query is run against `analytics_events` directly (DB ground truth), not an OTA
   dashboard — `eas update:list` proves *publication*, never *adoption*.

*The clients that never relaunch:* **they never get it, and no flag can rescue them** — a bundle
without the dual-mode code has no private branch to switch on. Being honest about that:

- Once step 3 flips, a never-updated MP client is **permanently unable to play with updated players**,
  and its symptom is the silent hang above.
- **Mitigation (should ship with step 1): a server-side minimum-bundle gate on the MP entry path.**
  Refuse MP entry for pre-cutover bundles with an explicit "update to keep playing online" result,
  converting an unreportable silent hang into one clear instruction. Solo play stays untouched.
- **And the decisive practical point: that population is currently EMPTY.** No MP session since
  2026-07-12. The same zero-traffic argument that justified flipping `join_requires_session` applies
  with more force here, because the cutover cost scales with the number of players mid-session — which
  is, right now, zero. **Cut over while the fleet is idle.**

### S2.5 — Sequencing P2 against the channel flip

Two possible intermediate states. **They are not equally safe.**

| Intermediate state | What an attacker gets | Verdict |
|---|---|---|
| **(a) Secrets OFF the channel, channel still PUBLIC** | Coordination traffic only — turn order, timers, presence, ready-acks. **No hole cards.** The actual N2 finding is closed. Remaining: injection/forgery and metadata. | **SAFER** |
| **(b) Channel PRIVATE, secrets still ON it** | Strangers excluded — but every *seated opponent* still receives every seat's hole cards, because `targetId` filtering is client-side only. The table is still cheatable by the people at it. | Weaker |

**(a) is safer, and for a second reason that matters more than the first: it is the only one that is
safe to ROLL BACK.** If the channel flip has to be reverted from state (a), nothing secret returns to
the wire — the secrets already left. Reverting from state (b) instantly re-exposes every hole card to
any anon listener. A rollback should never re-open the original vulnerability.

**Therefore P2 lands FIRST**, and P2 has its own three-step because it faces the same mixed-fleet
problem:

1. Ship clients that **prefer** the per-caller `deal_hand` HTTPS slice but still accept a `CARDS_DEALT`
   broadcast as fallback. Old and new clients coexist — this step is fleet-mixing-safe, unlike the
   channel flip, which is a hard partition with no coexistence at all.
2. Wait for fleet reach (same threshold).
3. **Stop broadcasting `CARDS_DEALT`.** Only now are the secrets actually off the channel — step 1
   alone does not achieve it, because the host is still broadcasting.

Staged `BOARD_REVEAL` follows the same shape but needs the reveal cursor `dealt_hands` lacks, so it is
the last piece before the channel flip.

**Full order: P2 steps 1→3 · then channel step 0 (policy) → 1 (dual-mode OTA) → 2 (wait) → 3 (flip).**

**What Phase 0 still will NOT buy, restated so it is not forgotten:** authenticity against a *seated*
opponent. `senderId` remains an unbound payload field. That needs the Phase B turn-logic move (Q2).

### Known branch artifact — `MissingPartition` (seen on TWO consecutive fresh branches)

`CHANNEL_ERROR: "MissingPartition: Realtime was unable to find the expected messages partition"` on a
newly created Supabase branch is a **provisioning race, not a design failure**. Realtime's
`realtime.messages_YYYY_MM_DD` partitions are created asynchronously after the branch reports healthy.

- **Workaround:** wait ~2-5 minutes after branch creation and re-run. It cleared on the retry both times.
- **Do NOT try to create the partitions by hand** — `permission denied for schema realtime`, the owner
  is `supabase_admin`. That is a dead end; an hour was nearly lost to it once already.
- **Do NOT read it as a policy failure.** In the R2 run, listener B reported `MissingPartition` at
  subscribe and *still received* the control broadcast — the error is transient and can coexist with a
  working channel. Judge the run by delivery, not by the first subscribe status.
## T2 — MONITORING CONVENTION ⚠️ SUPERSEDED BY U1 — the prefix rule below was EVASIBLE

> **Do not implement the prefix rule in this section.** `device_id` is client-supplied, so excluding
> rows by a `test-` prefix let an attacker switch the alarm off by renaming themselves. Replaced by a
> server-side allowlist — see **U1 CORRECTION** below. The "do not delete instrumentation rows"
> principle and the alert-budget table in this section still stand; only the exclusion MECHANISM changed.

~~**Rule: any probe or synthetic event MUST carry a `device_id` beginning `test-`.**~~
`phase0_mp_traffic_tripwire()` excluded those rows (`device_id NOT LIKE 'test-%'`) so probes were
inert by construction and nothing needed deleting afterwards. **The goal was right; the mechanism was
not.** The allowlist achieves the same thing without trusting the caller.

*Why this replaced the previous habit:* the S1 sprint deleted its own `join_rejected` probe rows to
stop them paging the owner. That worked, but it establishes "delete instrumentation rows" as the
routine — and the day a real row goes with them, the only signal the strict-mode flip depends on is
gone. Probes should be invisible to the alarm, not cleaned up after it.

**The alarm's trigger is attacker-controlled** — anyone can replay the sessionless join that is
correctly rejected, so an uncapped alarm is a WhatsApp/Twilio flood vector paid for by us. Bounds:

| Control | Value |
|---|---|
| Hourly suppression | 1 lockout alert per 60 min |
| **Daily cap** | **4 lockout alerts per 24h** |
| Test rows | excluded entirely (`test-` prefix) |

**Signal vs noise — escalate on either condition, and the message says which fired:**
1. **A returning device is rejected** — a `device_id` with an earlier successful `join_identity` row
   that now gets `no_session`. Highest signal: this is a real player who used to be able to play.
2. **≥5 distinct never-before-seen devices** rejected in the hour — looks like a broad auth outage
   rather than one prober. This second clause exists so a genuine outage hitting **brand-new** players
   is not silently swallowed: a new player has no prior `join_identity` by definition, so rule 1 alone
   would treat a real outage as probe noise.

A single never-seen device is counted and returned but **never pages** — that is the flood case.

### U1 CORRECTION — the `test-` prefix was CLIENT-CONTROLLED (evasion path, now closed)

The T2 convention above is **superseded**. `device_id` comes from the client, so excluding rows by a
`test-` prefix let any attacker turn the lockout alarm off by naming themselves `test-anything` and
probe freely, forever, with no page. Same defect class as client-side `targetId` filtering and
client-supplied `p_player_id`: **a security decision keyed on a field the caller controls.**

**Replacement: server-side allowlist `public.test_devices`.** The tripwire excludes a device ONLY if
it is present there (`NOT EXISTS (SELECT 1 FROM test_devices t WHERE t.device_id = e.device_id)`). The
`LIKE 'test-%'` filter is **removed entirely** — leaving both in place would keep the evasion open.

- RLS enabled, **zero policies**, and `REVOKE ALL ... FROM anon, authenticated`. Verified from a real
  client: anon and authenticated, insert and select, all four return
  `permission denied for table test_devices`. Only `service_role` (the bot) can register a device.
- Naming a probe `test-…` is now only a human convention; it grants nothing.
- **Grep note:** searching the function body for `test-` still matches the COMMENT that documents the
  removal. Check the executable predicate (`test_devices`), not the string — a substring grep here
  false-positives, and did for me once.

**Residual, stated plainly:** the flood ceiling is now the **4/day cap**. An attacker can still mint 5
distinct never-seen `device_id`s to trip the outage clause and burn up to 4 alerts a day. I would err
**toward keeping the alarm noisy**: 4 attacker-triggered messages a day is a nuisance with a known
cause and a documented rollback in every message, whereas raising the outage threshold to suppress it
would blind us to the real case it exists for — a genuine auth outage locking out brand-new players,
who are indistinguishable from probes by construction. A missed lockout costs a real player; a false
page costs the owner ten seconds. Revisit only if it actually fires in anger.
## U3 — P2 STEP 1 IMPLEMENTATION PLAN (planning only; no P2 code shipped)

Step 1 of the three P2 steps established earlier: **ship clients that PREFER the per-caller HTTPS
slice but still accept the `CARDS_DEALT` broadcast**. Fleet-mixing-safe by construction — old and new
clients coexist, because the host keeps broadcasting until step 3.

### U3.1 — Exactly what ships

| Artifact | Source | Note |
|---|---|---|
| **EF `deal_hand`** | `supabase/functions/deal_hand/{index,deal,authz,handAcks}.ts` (dormant branch) | Deploy only. Identity from the **verified JWT**, seat from the **server-side** `room_players` — no request field selects a seat, so the spoof is structurally impossible. |
| **Migration `20260801090000_dealt_hands_server_deal.sql`** | dormant branch | `dealt_hands` table + `cleanup_dealt_hands()`. **The only migration step 1 needs.** |
| **Client fetch** | `utils/serverDeal.client.ts` (dormant branch) | `POST { hand_id, room_id }`, returns this caller's slice only. |
| **Flag** | new `app_config.server_deal_enabled` (currently ABSENT = false) | Selects HTTPS slice vs broadcast. Ship FALSE. |

**Prerequisite already met, and worth naming:** the EF resolves the caller's seat from
`room_players.user_id`. That column is only trustworthy because `join_requires_session = true`
shipped today — with the device fallback still open, a seat's `user_id` could be a client-supplied
value and the EF's authz would inherit the impersonation. **S1 was a hard prerequisite for P2 step 1**,
not a parallel track.

### U3.4 — Is the autostart machinery required? **NO.** And this is the decisive finding.

The EF is **create-or-get keyed on `hand_id`** (`index.ts:78-105`): the first authorised caller for a
given `hand_id` triggers the deal and stores it; every later caller reads the same row and receives
only its own slice. **There is no "a hand has begun" event for the server to learn about.** So step 1
does NOT need autostart, the `starting` reaper, `promote_starting_to_playing`, or the `join_table`
deal-gate. Hands can keep being dealt/ordered by the in-memory engine; only CARD DELIVERY moves.

**The one real dependency this creates:** all seats must agree on the same `hand_id` without a server
round trip, because hands 2+ never touch the DB today (`handId++` in memory,
`realtimeMultiplayer.ts:534-556`). Resolution: the host broadcasts the hand ordinal on the channel and
every client derives `hand_id = f(room_id, ordinal)`. **A `hand_id` is not a secret** — it is a
coordination value, exactly what the channel is for after P2. No new server machinery.

### U3.2 — Fallback semantics

**Flag OFF:** byte-identical to today. The client must not even call the EF — no probe, no latency, no
new failure surface. The HTTPS path is dead code until the flag flips.

**Flag ON, HTTPS fetch fails: RETRY briefly, then FALL BACK TO THE BROADCAST, and never fail the hand.**

Justification, and the distinction that matters: falling back to a client-side **DEAL** was ruled out
and stays ruled out — that would let a client invent its own cards. Falling back to the broadcast
**TRANSPORT** is a different question, because during step 1 the host is broadcasting the *same*
authoritative cards anyway; the fallback changes only *how the bytes arrive*, not *who decided them*.

- Failing the hand instead would mean one player's flaky connection kills a live table for everyone —
  trading a confidentiality improvement for an availability regression, on the exact population we are
  trying to bring back.
- The fallback is **safe precisely because it is temporary**: at step 3 the broadcast stops, so the
  fallback disappears on its own rather than needing to be removed.
- **Instrument it.** Emit an event on every fallback. That count IS the step-3 gate: while clients are
  still falling back, stopping the broadcast would break them. Step 3 ships when the fallback rate is
  ~0, not on a calendar date.

### U3.3 — Dormant Phase A migrations: what wakes, what sleeps

There are **4** migrations on `feat/server-deal-phase-a` (the "6" is the number of
`CREATE OR REPLACE` statements across them, not the file count).

| Migration | Step 1? |
|---|---|
| `20260801090000_dealt_hands_server_deal.sql` | **NEEDED** — the only one |
| `20260801091000_starting_state_reaper.sql` | stays dormant |
| `20260801092000_join_table_autostart_deal.sql` | stays dormant — **and is STALE, see below** |
| `20260801093000_promote_and_rls_lockdown.sql` | stays dormant |

### ⚠️ `20260801092000` IS STALE AGAIN — reported, NOT fixed this sprint

Its own header says to diff it against live before applying. Done, and it has drifted twice over:

1. **Missing the N1 club idempotency fix.** The file still carries the pre-N1 block
   `((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))`.
   Live matches club rooms on `rp.user_id = v_uid` **only**, with no device branch. Applying this file
   would **re-open the device-identity branch for club rooms** — a live security regression, the exact
   bypass N1 closed.
2. **Missing the S1 `join_rejected` rejection logging** (0 occurrences). Applying it would silently
   delete the observability that the live `join_requires_session = true` flip depends on — the strict
   rejection would go back to emitting nothing at all.

It is dormant and not needed for step 1, so this is not urgent — but it must be re-rebased before it
is ever applied. **This is the second consecutive time this file has gone stale**, which is itself the
finding: a dormant migration that `CREATE OR REPLACE`s a live, actively-changing function is a
standing landmine. Recommend it be split so the deal-gate is an ALTER-style addition rather than a
whole-function replacement, or regenerated from live at apply time.

### U3.5 — Rollback per sub-step

| Sub-step | Rollback |
|---|---|
| Apply `dealt_hands` migration | `drop table dealt_hands cascade; drop function cleanup_dealt_hands();` Inert while nothing calls the EF. |
| Deploy `deal_hand` EF | Delete the function. Nothing calls it while the flag is false. |
| Ship dual-mode client (flag FALSE) | OTA rollback; behaviour was already unchanged. |
| Flip `server_deal_enabled = true` | `UPDATE app_config SET value='false' WHERE key='server_deal_enabled';` One row, no deploy. Clients return to the broadcast they are still receiving. |
| (step 3, later) Stop broadcasting | Re-enable the broadcast — the reason step 3 is gated on a ~0 fallback rate. |

**Every sub-step before the flag flip is invisible to players**, and the flip itself is a one-row
revert while the broadcast is still running. That is the whole point of doing P2 before the channel
flip: at no point does a rollback re-expose hole cards that had already left the wire.
