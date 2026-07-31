# CAPS POKER — Project Memory

### 2026-07-31 (V) — STANDING RULE + the deck-shopping hole in P2 step 1

**RULE (permanent, no exceptions): a dormant branch may NEVER carry a whole-function
`CREATE OR REPLACE` of a live, actively-changing function.**

Express the change as an additive delta plus a regenerate-from-live procedure, and make the file
**fail loudly** if applied blind. `20260801092000_join_table_autostart_deal.sql` went stale **twice in
one week** — first missing the M1 club guard, then missing the N1 club idempotency fix *and* the S1
rejection logging. Applying it would have re-opened a proven impersonation bypass and deleted the
observability the live `join_requires_session=true` flip depends on. Both times it was caught only by
a hand diff. **A hand diff is not a control.** That file now contains no function body at all; it is a
procedure ending in `RAISE EXCEPTION`, listing the five markers whose absence proves a stale start.

**Why this class of file rots:** the dormant copy is written once and the live function keeps moving.
The staleness is invisible — the file still applies cleanly, it just silently un-ships whatever landed
after it was written. The blast radius is exactly the security fixes we shipped most recently.

---

**V1 — P2 step 1 had a deck-shopping hole, found before shipping.** `deal_hand` is create-or-get keyed
on `hand_id`, so the first authorised caller mints the deal. The step-1 plan had the HOST broadcasting
the hand ordinal. Together those let a malicious host mint N+1, read its **own** slice, dislike it,
mint N+2, and announce whichever dealt it better — every call a legitimately seated player asking for
its own cards, so authz passes on all of them. **Step 1 as scoped would have moved card DELIVERY off
the wire while introducing a NEW host advantage in place of the old one.** Same trap as "Phase A moves
who shuffles, not who can see", in a new costume.

Shipped on the dormant branch (not live): `handOrdinal.ts` (pure, tested) + `room_hand_cursor` +
`claim_hand_ordinal()`, and authz moved **before** the mint (previously any caller knowing a `room_id`
could burn an ordinal before being rejected).

**Three conditions are required; only the first is built.** Stated so nobody mistakes partial for done:
1. ✅ **Server-side monotonicity** — mint only `cursor + 1`.
2. ❌ **Clients must DERIVE the ordinal, never accept it from the host.** Without this, monotonicity
   alone does not close it: burning is free, so the host just skips forward and plays a later ordinal.
3. ❌ **Minting K requires K-1 complete** (`handAcks` unanimity). Without this the host can mint ahead
   and preview its own future hands.

**The retention door:** the cursor must OUTLIVE the 24h `dealt_hands` TTL. If "expected next" were
`max(stored ordinal)`, deleting decks would lower the max and a burned ordinal could be re-minted with
a fresh deck — the re-roll returns through retention. Hence a separate `room_hand_cursor`, cleaned by
room lifetime, never by a clock.

### 2026-07-31 (S) — `join_requires_session` = **TRUE** (flipped). ROLLBACK IS ONE ROW.

```sql
UPDATE app_config SET value='false' WHERE key='join_requires_session';
```

**One row. No migration, no deploy, no OTA, no build.** Takes effect on the next `join_table` call —
the flag is read at the top of the function on every invocation.

**Why flipped now, on ZERO traffic (this was the argument, and it is the right one):** there has been
no real MP join since 2026-07-12. Waiting for "enough real observations" is not a gate, it is an
indefinite hold — the measurement cannot complete until traffic returns, and traffic returning is
exactly when a breaking change becomes expensive. Zero traffic is the cheapest window this project
will ever get to find out whether strict mode breaks a join path. If it breaks, it breaks for nobody.

**Observability shipped FIRST (the flip would otherwise be invisible):**
- `join_rejected` analytics event on **every** `no_session` rejection, at **both** sites:
  `stage='strict_pre_room'` (strict mode, fires BEFORE the room lookup — which is why the existing
  `join_identity` row does NOT cover it) and `stage='club_guard'`. Non-blocking subtransaction
  (`BEGIN … EXCEPTION WHEN OTHERS THEN NULL`), same pattern as `join_identity`.
- `phase0_mp_traffic_tripwire()` extended: alerts on ANY `no_session` rejection in the last 65 min,
  own suppression key (`JOIN-STRICT LOCKOUT`), and the alert text **contains the rollback SQL above**.
  Placed BEFORE the phase0 self-disarm on purpose — shipping channel authz must not silence a lockout
  alarm. Verified end-to-end: synthetic rejection → `lockout_fired: true` → `whatsapp_outbound` row
  `pending` → reverted inside the same transaction (never visible to the `*/2` flush cron) → re-armed.

**What strict mode changes:** `join_table` no longer falls back to the client-supplied `p_player_id`.
No verified `auth.uid()` → `{"ok":false,"error":"no_session"}`. The client already handles this and
shows `JOIN_NO_SESSION_MESSAGE`. This closes the device-id impersonation branch for **public** tables
(club tables were already closed by the M1 guard on 2026-07-31).

**If a real player is ever locked out:** the WhatsApp alert arrives within the hour and carries the
rollback. Roll back first, diagnose after.

### 2026-07-31 (P) — PHASE 0 DESIGN + **MP IS KNOWN-EXPLOITABLE UNTIL PHASE 0 SHIPS**

**VERBATIM, DO NOT SOFTEN:** *Multiplayer is known-exploitable until Phase 0 (realtime channel
authorisation + private card transport) ships. Any person holding the anon key — which ships inside the
public web bundle — can subscribe to `caps-room-{roomCode}` and read every seat's hole cards off the
wire, with no session, no seat and no club membership. Proven on live 2026-07-31.*

***Therefore the leaderboard cannot be treated as trustworthy for any MP result recorded before Phase 0
ships.*** Every MP hand ever played was fully visible to anyone who asked, so MP-derived standings,
chip totals and win records from that period must be assumed potentially manipulated. If the
leaderboard is ever used for anything that matters (prizes, rankings, marketing claims), that caveat
must travel with it.

**Exposure, not severity:** no MP session since ~2026-07-12 (`mp_game_started` 24 events / 19 devices in
30d, all older than three weeks), so this is not an emergency shutdown — but that is a statement about
traffic and must be revisited the instant MP play resumes.
**Tripwire live:** `phase0_mp_traffic_tripwire()` + hourly cron `caps_phase0_tripwire` → alerts via
`whatsapp_outbound` if `mp_game_started` fires while Phase 0 is unshipped. Self-disarms once
`app_config.phase0_channel_authz_shipped` = true. Dry-run verified (`fired:false`, cron active).

**P1 ANSWERED — `private: true` is a REAL control, not theatre.** Supabase docs, verbatim: *"A public
broadcast only reaches public channels and a private broadcast only reaches private channels."* Public
and private are separate DELIVERY DOMAINS, not a permission check on one shared topic — an attacker who
omits the flag lands in the public domain and receives nothing broadcast privately. No project-level
"force private" setting exists or is needed. NOT empirically branch-tested (would need a paid branch or
a shared-project policy); run that as the gate before flipping any client to `private: true`.

**P2 — the durable fix is architectural, and channel authz alone is NOT enough.** A seated OPPONENT is
legitimately authorised on the channel and still receives everyone's cards today (`targetId` filtering
is client-side only). Secrets must leave the channel entirely:
- `CARDS_DEALT` → per-caller HTTPS slice from `deal_hand` (**already built in Phase A**).
- `BOARD_REVEAL` → server-released staged reveal (needs the reveal cursor `dealt_hands` lacks).
- Channel reduced to coordination: turn order, timers, presence, ready/ack, chat, post-settlement deltas.

**THIS REFRAMES PHASE A: its value is the PRIVATE TRANSPORT, not the shuffle.**
- Promoted into PHASE 0: `deal_hand` EF + `sliceForPlayer` no-leak boundary + JWT/roster `authz.ts` +
  `dealt_hands` storage + `private: true` + a `realtime.messages` policy keyed on room membership.
- Stays PHASE B: staged reveal cursor, server-side `evaluateAllBoards`, `calculateChipDeltas` + rake,
  HMAC commit–reveal.
- The identity work (`room_players.user_id`, `join_requires_session`, club guard) is a PREREQUISITE for
  Phase 0, because the channel policy keys off room membership.

**Spectate channel is CLEAN** — `spectate:{roomCode}` carries open community cards, names/ready state,
winner name and hand-rank *labels* only. No hole cards, no closed cards. Phase 0 must preserve exactly
that scope. Full design: `docs/PHASE_0_CHANNEL_AUTHZ.md`.

### 2026-07-31 (N) — **PHASE 0 = REALTIME CHANNEL AUTHORISATION.** The fairness roadmap was solving the right problem in the wrong order.

**PROVEN ON LIVE, not inferred.** From a context holding ONLY the anon key — no session, no seat, no
club membership — I subscribed to `caps-room-<code>` and received the host's broadcasts verbatim:

- `attacker_session: "none"` · `attacker_subscribe_status: SUBSCRIBED` · `messages_received_count: 2`
- Received `BOARD_REVEAL` in full: `closedCards` **and** `playerHands` for **every seat**.
- Received `CARDS_DEALT` **addressed to a different player** (`targetId: 'some-other-player'`).

**Why:** channels are created as `supabase.channel('caps-room-'+roomCode, { config: { presence: {...} } })`
(`utils/realtimeMultiplayer.ts:209` host, `:911` client) — **no `private: true`**, so Realtime
Authorization is off and `realtime.messages` RLS is never consulted. That table has RLS enabled with
**ZERO policies**, which is irrelevant while the channels are public.

**`targetId` is CLIENT-SIDE FILTERING ONLY** (`realtimeMultiplayer.ts:932`:
`if (targetId && targetId !== this.playerId) return;`). Per-player messages are broadcast to the whole
channel and merely *ignored* by well-behaved clients. So every player's hole cards travel to every
listener at deal time.

**Channel name has no entropy.** `caps-room-{roomCode}`, room code = 4 chars over a 32-char alphabet
(32^4 ≈ 1.05M). Public codes are returned in plaintext by `list_public_tables` — zero guessing needed;
private codes are trivially enumerable.

**ROADMAP CONSEQUENCE — state it plainly:** Phase A (server-authoritative shuffle) and Phase B
(server-authoritative evaluation/reveal) both assume the transport is private. It is not. An observer
reads the cards off the wire regardless of who shuffled them or who evaluated the showdown, so those
phases protect nothing on their own. **Channel authorisation is PHASE 0 and precedes both.** It is not a
tightening of Phase A — it is the precondition that makes Phase A meaningful.

**NOT FIXED THIS SPRINT, deliberately.** The fix (private channels + `realtime.messages` RLS keyed on
room membership) is a protocol change touching every client; half-applied it would break live MP for
everyone. Needs its own plan. Also note it interacts with the seat/identity work: RLS on
`realtime.messages` would key off room membership, which is exactly what `room_players.user_id` +
`join_requires_session` make trustworthy — so the identity work is a prerequisite for a real channel
policy, not a competitor to it.

**ALSO FIXED TODAY (N1, applied live — `join_table_club_idempotency_uid_only`):** the `already_joined`
early-return sat after the club guard but BEFORE the membership check and matched on
`device_id` too, so an AUTHENTICATED non-member replaying a seated member's (world-readable)
`device_id` got `ok:true, already_joined:true` plus `room_code`/`status`/`game_config` — without the
membership check ever running. Club rooms now match idempotency on the verified uid ONLY; public rooms
keep the permissive uid-or-device match (unchanged). Verified live: replay → `not_a_member`,
`leaked_game_config=false`; genuine member still idempotent; public idempotency unchanged.

### 2026-07-31 (later) — CLUB SPOOF CLOSED + join identity instrumentation + client timeout telemetry

**PROVEN EXPLOITABLE, THEN CLOSED.** An apikey-only caller (never authenticated) had `auth.uid() = NULL`,
so `v_identity := COALESCE(v_uid, p_player_id)` took a CLIENT-SUPPLIED uuid. The FK to auth.users only
forces the uuid to be REAL — and real uids are publicly harvestable (`room_players` and `club_members`
both carry `SELECT ... TO public USING (true)`). I reproduced the full chain on live: harvest a uid ->
replay it -> seat written under an identity the caller never proved it owned (impersonation SUCCEEDED),
then cleaned up. The **device branch was equally broken** (club_members.device_id is readable the same way).

**FIX (migration `join_table_club_requires_verified_session`, applied live):** a club table ALWAYS
requires a verified session — `IF v_room.club_id IS NOT NULL AND v_uid IS NULL THEN return no_session` —
and club membership is matched on the **verified uid ONLY** (no client identity, no device branch).
Asymmetry is deliberate: public tables stay permissive (`join_requires_session` remains FALSE while the
48h measurement runs) because a spoofed identity there costs a seat and nothing more; a club table is an
access-control boundary and this check is the only thing enforcing it. Safe: all club members have uids
(2/2), zero device-only members, so nobody who works today is excluded.
Verified live: uid-spoof -> `no_session` · device-spoof -> `no_session` · genuine member -> joins ·
authed non-member -> `not_a_member` · public 9-check smoke byte-identical. Test club deleted afterwards.

**MEASUREMENT RUNNING (do not conclude yet):** `join_identity` rows (source uid/device/none) written
inside join_table, non-blocking. Client-side `join_auth_timeout` shipped via **OTA group
4869f1f0-2c23-4d64-a23f-8e3e219ab1fb** (runtime 2.7.0, from main 00b3686) — the DB cannot measure the
2500 ms bound because `auth.uid()` is non-null whenever a session JWT is attached. NOTE the client
numbers start LATER than the server ones (OTA rollout), so judge the window with that offset.
### 2026-07-31 — RLS WRITE LOCKDOWN + gated join_table identity hardening — **APPLIED TO LIVE**

Merge `422ee3b` -> main. Live bundle `index-2e9455b7e30ac350baa6ef716725006f`, verified new by fetching
the JS and confirming it contains `resolveJoinIdentity` + the literal "Couldn't sign you in" — a hash
change alone is not proof.

**APPLIED (two separate migrations, in this order):**

1. `rls_write_lockdown_game_rooms_room_players` — DROPPED 5 permissive write policies:
   - `rooms_host_or_player_update` — membership-only UPDATE, and RLS cannot scope columns, so ANY
     seated authenticated player could rewrite status / game_config / current_players / max_players /
     is_public / host_id of their room.
   - `players_update_own` — rewritable `seat_index` / `is_host` = a seat-swap primitive.
   - `"Anyone can join rooms"` — INSERT room_players TO public WITH CHECK true: anyone could seat
     themselves in ANY room, unauthenticated.
   - `players_leave_own` — a direct DELETE bypasses leave_table's `current_players` decrement, leaving
     a room that reads FULL with an empty seat (un-joinable, un-startable).
   - `game_rooms_authenticated_insert` — mint arbitrary rooms, bypassing create_table.
   SELECT policies RETAINED: "Anyone can read rooms", "Anyone can read room_players".
   Safe because NO client build has EVER written these tables directly (`git log -S` across all
   branches, 6 spelling variants, zero hits); every write goes through SECURITY DEFINER RPCs, all
   `prosecdef=true`.
   **Why it still mattered even though the app never used them:** the anon key ships inside the web
   bundle, so an attacker never needed the app — a seated session plus a crafted REST call was enough.
   Dead weight to the app, live attack surface.

2. `join_table_identity_hardening_gated` — `join_table` derives identity from `auth.uid()` and IGNORES
   the client-supplied `p_player_id`, **gated on `app_config.join_requires_session`**.
   **The key is ABSENT => default FALSE => the migration is INERT.** Legacy identity
   `COALESCE(auth.uid(), p_player_id)` is byte-identical to prior behaviour. Flipping it TRUE is a
   SEPARATE decision with its own report. The `device_id` OR-branch is preserved in both modes
   (idempotent rejoin after restart + device-identified club members).
   Client half: `joinTable` now bounds the anon-auth wait at 2500 ms (`utils/joinIdentity.ts`) and falls
   back to the device identity on timeout/reject, so it can never hang a join.

**VERIFIED ON LIVE after each step** — real anonymous session, real RPCs, run three times (before the
migrations / after the lockdown / after the hardening) with identical results:
lobby list (9 tables) · join (seat 0, is_host) · seat visible with `user_id=SET` (previously NULL — the
identity fix demonstrably working) · heartbeat · leave · seat released · create · finish.

**MONITORING since merge:** `bug_reports` 0 in 24h and 0 since merge; friction views show 1
`stuck_dwell` (background noise, no new signal).

**ROLLBACK — restores all 5 policies in one statement:**

```sql
CREATE POLICY rooms_host_or_player_update ON public.game_rooms FOR UPDATE TO authenticated USING (host_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM room_players WHERE room_id=game_rooms.id AND user_id=(SELECT auth.uid()))) WITH CHECK (host_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM room_players WHERE room_id=game_rooms.id AND user_id=(SELECT auth.uid()))); CREATE POLICY game_rooms_authenticated_insert ON public.game_rooms FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL); CREATE POLICY players_update_own ON public.room_players FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid())); CREATE POLICY players_leave_own ON public.room_players FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid())); CREATE POLICY "Anyone can join rooms" ON public.room_players FOR INSERT TO public WITH CHECK (true);
```

**STILL OFF / NOT DONE:** `join_requires_session` FALSE (key absent) · `server_deal_enabled` absent ·
`deal_hand` Edge Function NOT deployed · `feat/server-deal-phase-a` dormant and untouched at `6352843`.

### 2026-07-26 — SERVER-DEAL PHASE A: **DORMANT / PHASE-B PREREQUISITE** (branch feat/server-deal-phase-a)

**STATUS: frozen, not shippable alone, NOT a dark feature awaiting a cutover.** Nothing applied,
deployed, merged or flag-enabled. `server_deal_enabled` and `join_requires_session` both default FALSE.

**SCOPE STATEMENT (the sprint's key output):** *Phase A is server-authoritative SHUFFLE,
client-authoritative ENGINE. It moves who shuffles, not who can see.* The host's `RealtimeServer` holds
`this.playerHands` (all seats) + `this.boards[].closedCards`, evaluates showdown in memory
(`evaluateAllBoards` :662, `calculateChipDeltas` :663-667) and broadcasts closed cards + every seat's
holes (`sendBoardReveal` :676-689). So with the flag ON the host advantage **survives intact** — and
worse, the engine cannot run at all, because the EF correctly refuses to hand it the deck. The
"NO-LEAK payload" property is true of the Edge Function and **false of the system**.

**CONSEQUENCE — the 2-device client cutover is CANCELLED (wasted work).** `dealt_hands.boards` is a
single jsonb blob with no reveal cursor and no release authorisation, so Phase B replaces that schema;
wiring clients against it now means wiring twice. EF deploy + p50/p95 measurement are DEFERRED to
Phase B, not near-term gates.

**PHASE B must move server-side:** staged board reveal (release board *n*'s closed cards only at board
*n*, equally to all clients), showdown evaluation, chip settlement — the same server authority the rake
needs. `dealt_hands` does NOT support staged reveal today.

**What was split OUT and is going live separately:** the RLS write lockdown + gated `join_table`
identity hardening → branch `fix/rls-hardening` (off main, no deal machinery). That fixes a real live
hole independent of dealing.

**Also on the dormant branch (correct, unused):** `hand_seq` monotonic anchor, `begin_next_hand` +
`request_next_hand` (unanimity over LIVE seats, acked by seat PK — user_id is nullable and acking by
uid deadlocks a table forever), `promote_starting_to_playing` (CAS), `reap_stuck_starting_rooms(45s)`,
`dealt_hands` + 24h TTL. Gate on the branch (MEASURED clean 2026-07-31): tsc 0, 39/39 suites, **2635/2635**. (An earlier 2630 was stale — serverDeal went 13 -> 18 with the H1 deadlock tests.)

### 2026-07-25 RECAP — final state after the autonomous hardening session

LIVE: main `921c4e3`, OTA group `6f51338e` (branch production, runtime 2.7.0), web caps.ftable.co.il.
Build 507 device (external Xcode, not EAS). Field: ~98 devices on 2.7.0 receiving OTA (confirmed).
jest suite = 2614+ (the long-tracked "2505" was stale).

SHIPPED THIS SESSION (all live): mp reveal (mpBoardReveal via app_config kill-switch
`mp_board_reveal_enabled=true`, confirmed on 2 devices), practice-to-live jump (`PRACTICE_LIVE_ENABLED`),
OTA-COSMETIC (chips hidden in practice / lobby >=11pt no-wrap / Auto-Place 11pt + 44pt-hitSlop),
auto-learn friction heatmap (rage_tap / stuck_dwell / screen_abandon / error_boundary_hit + views
friction_heatmap / top_rage_tap_targets / top_abandon_screens / top_stuck_screens), games_played
practice-guard, discoverable bug-report button, native-layout-fix + web-mobile-layout (dvh / safe-area,
GameView reactive dims, font floors), panel-felt (classic green #10281A->#0E2418 lifted, Five-O
byte-identical), get_poker_shop 409 idempotent fix (DB migration), friction screen auto-tag on every
route + null-screen boundary close.

KEY LEARNINGS: (1) `rs()`/`rf()` at `StyleSheet.create()` module scope are FROZEN on web (capture 393)
— use `useWindowDimensions()` inside components. (2) The narrow-device layout bug is
REAL-MOBILE-SAFARI-only: web preview, 320px iframe, and Cowork simulation ALL miss it (dvh / URL-bar /
env() safe-area differ) — only a real mobile browser on a narrow iPhone reproduces it. (3) MP has ONE
acceptance test = 2 real devices; unit tests and single-device "it worked" are NOT verification (Iron
Rule 10). (4) When DB contradicts a confirmed real-world observation, the DB read is suspect
(rooms_2p_playing_ever=0 was misleading — cleanup_expired_rooms hard-deletes finished rooms;
analytics_events is the durable record). (5) Independent verification catches bugs BOTH agents miss for
different reasons (null vs '?' screen).

OPEN / BLOCKED ON PHYSICAL DEVICE (cannot close from code/web/DB — do NOT claim fixed without hardware):
(1) Board 2 card overflow on narrow iOS, (2) MP face-down turn/river cards missing vs solo, (3) MP
2-device sync/parity. All three have best-effort code fixes shipped or branched, NONE device-confirmed.

OPEN / NEEDS OWNER: economy is inflationary — 7d ~48k credits / ~0 debits. rake is vestigial (fired
once ever, -12). daily_streak dominates faucets. Real fix = server-computed-amounts refactor -> working
rake -> reconnect a sink to multiboard/MP results. Touches every real chip; needs owner present +
testers. NOT started.

BRANCHES: main is truth. feat/panel-felt-transparency MERGED. ~20 stale cruft branches, no pending work.

### 2026-07-10 — Economy single-writer refactor (strategist-verified vs live DB)
LIVE BUNDLE = e0a78cd8aeb48d34b509d3d81cb56436 (S62 ship). Runtime 2.7.0.

Batches:
- S57 MEMORY-BACKFILL (dd8cb01, docs). S58 ECON-WRITE-PATH-AUDIT (read-only).
- S59 ECON-SINGLEWRITER-P1 (d113981 | OTA 4a62f899): per-hand net routed to record_hand_net;
  submit_score demoted to read-back; hand_won/streak_5_wins removed from per-hand path.
- S60 ECON-ACHIEVEMENT-LEDGER (fd1dcb6 | OTA c564024e): achievements + referral routed to
  record_reward (fixed a LIVE regression where achievement chips were erased post-P1).
- S61 ECON-MP-PATH-AUDIT (read-only): MP writes per-own-device net; found record_hand_net had
  NO server dedup.
- S62 hand_id dedup (1bcfe59 | OTA 4fde5feb): client passes RevealData.handId; server dedup live.
- S63 ECON-PRE-PHASE3-AUDIT (read-only): Phase 3 cleared except MP net verification.

Strategist DB migrations (via apply_migration; DB is strategist-owned, NOT the bot):
- record_hand_net(p_device_id text, p_net integer, p_hand_id text) → jsonb{ok,new_balance,net,
  clamped,duplicate?}. Ledgered 'hand_net' delta, clamp +/-10000, hand_id idempotency.
  Reverse: DROP FUNCTION.
- record_reward(p_device_id text, p_amount integer, p_event_type text, p_once boolean) →
  jsonb{ok,granted,new_balance,already_granted?,clamped?}. Clamp [0,2000], p_once dedup.
- INDEX uq_hand_net_ref: UNIQUE (device_id, reference_id) WHERE event_type='hand_net' AND
  reference_id IS NOT NULL. (hand_id stored in chip_transactions.reference_id.)
- submit_score: NEVER-LOWER guard added (v_chips := GREATEST(v_chips, v_prev)). Kills the stale
  read-back clobber. Signature/stats/return unchanged. This is INTERIM Phase-3.
- Deleted junk row chip_transactions AUDIT_TEST +999,999 (device AUDIT-PROBE-DELETE-ME).

Economy truth (corrects the old "635k credits / 0 debits / no sink" framing — that was a LEDGER
artifact): leaderboard.total_chips is authoritative; ledger missed ~70% of real chips because
submit_score wrote absolute + un-ledgered. Snapshot 2026-07-10: 150 devices, 336,855 total.
hand_net 10 rows (4 with hand_id). Junk 'test' (+20, 2 rows) still pending purge.

OPEN:
- PHASE 3 FULL (strip submit_score's total_chips write) is BLOCKED on a live MP hand WITH A
  WINNER. Both MP hands observed so far netted 0/0 (tie or an MP net-computation bug — unresolved).
  Remaining Phase-3 steps when unblocked: (1) submit_score stats-only (read+return current);
  (2) client retry-on-failure for record_hand_net (safe via hand_id); (3) route gameover.tsx:57
  bust-reset through claim_low_chip_rescue; (4) genesis snapshot Option A at cutover.
- Native Board-2 overflow + wordmark clip: needs a 320/375 device capture.
- chip_config reconciliation (referral 300 != client 100; 9 of 12 achievements missing) — deferred;
  client literals are the live truth.
- BoardResultCard visibleBoardCount=0 dead-render still open (see chip-gate coupling note above).

## 2026-07-09 — CHIP-GATE SWEEP + DEAD-RENDER COUPLING (S52–S56)
- **Practice-mode chip UI fully gated (S52–S55):** every chip figure in the game flow now respects `isPractice` (the single source of truth) — results Net/Balance/board-by-board/earned-CTA/FloatingChips/win-overlay/tie-bonus, BoardReveal delta/FloatingChips/intermission, CompleteBanner bonus line, **CompleteOverlay "BONUS +N" full-screen flash** (S55 headline fix), GameView header balance pill, and the BoardArrangement "WIN ALL → +N" banner. Live: main `c768fa4`, web bundle `index-a199ec36`, OTA `b5749ca4`. Regression test `components/__tests__/CompleteOverlay.test.ts` (gate extracted to `components/completeOverlayGate.ts` — this project's jest is logic-only, no JSX rendering).
- **DEAD-RENDER (S54, OPEN — not yet fixed, no speculative refactor):** `BoardResultCard` is imported + mapped in `app/results.tsx`, but `visibleBoardCount` (hooks/useResultsAnimations.ts) stays **0** on web because `InteractionManager.runAfterInteractions` never resolves — so its per-board animated fade-in never appears and `BoardResultCard` + its offscreen `SingleBoardShareCard`/`StoryShareCard` are effectively dead in the live results flow (instrumented, confirmed 25 render passes over 16s). The compact "Board by board" list is what users actually see.
  - ⚠️ CHIP-GATE COUPLING (S55): FloatingChips-dup, BoardResultCard+ShareCards, and StoryShareCard/FullGameShareCard are currently chip-UNGATED and safe ONLY because they are unreachable. ANY change that makes them render again (especially fixing visibleBoardCount=0) MUST gate their chip figures behind isPractice IN THE SAME PR.

### S52–S56 batch history (backfilled 2026-07-09; strategist-verified vs live bundles)
- S52 OTA-COSMETIC — SHA b6192d3 | bundle b0fceafa → 3354a01db16696bc991324f191a3fac8 |
  OTA 48dd0d81. Results XP-only: hid coin icons / ±deltas / CURRENT BALANCE. Lobby instant-bot
  subtitle shortened to `${n}P · ${b} boards · instant` + 11pt floor (a11y label kept verbose).
  Per-board Auto-Place tag 11pt. tsc 0, jest 2505.
- S53 OTA-CHIP-UI-PARITY — SHA b797c99 | bundle 3354a01 → 1202589a36a11db6a84c04adf2280b39 |
  OTA ca5485d9. CompleteBanner gated by isPractice (verified chip-free). ShareCard potAmount fix
  landed on DEAD code (see S54). jest 2505.
- S54 S53-VERIFY (no ship) — instrumented: BoardResultCard NOT reached, visibleBoardCount stuck
  at 0 (25 passes). ShareCards = captureRef/react-native-view-shot, wired but unreachable.
  CompleteBanner practice render correct (screenshot). Real Share Hand/COMPLETE = plain text,
  chip-safe. OPEN BUG: visibleBoardCount=0 dead-render (BoardResultCard animated view).
- S55 PRACTICE-CHIP-GATE-SWEEP — SHA c768fa4 | bundle 1202589a →
  a199ec36fb26c4e8d9662d91b18cfbce | OTA b5749ca4. Single gate = isPractice (29 uses). Gated
  every REACHABLE chip render; headline = CompleteOverlay `🏆 COMPLETE! +50% BONUS (+${x})`.
  Forced practice+real COMPLETE sweeps screenshotted (practice = 0 chips, real = intact).
  +3 tests → jest 2508. >>> CURRENT LIVE BUNDLE = a199ec36fb26c4e8d9662d91b18cfbce <
- S56 MEMORY-COUPLING-NOTE (docs only) — SHA 2f3cece. Added the chip-gate coupling note.
- DB (strategist, Supabase MCP): deleted junk chip_transactions row AUDIT_TEST +999,999
  (device AUDIT-PROBE-DELETE-ME, no user, no leaderboard/economy_log dependency). Post-delete
  economy truth: credits 635,695 vs debits −6,950; sink (quick_poker buy-ins) DEAD since
  2026-06-24; active faucets = daily_streak (+508k/984 rows), daily_login, daily_reward.
  `test` (+20) rows left for the economy-track purge.
- Category status: practice chip-parity CLOSED after S55. Open real work: native Board-2
  overflow (needs 320/375 device capture) + economy sink refactor (submit_score
  server-computed amounts).

## 2026-07-06 — RECAP
- **Live:** main `f660e33`, web bundle `index-4a6f7182`, OTA `ac8cf3f5`, build 506.
- **Shipped this session (14 batches):** unified `GameView`; leave-recovery; QA batches A/B/C; UX-1/2; daily_login leak server-lock; Vercel rename (Wingman hijack recovery); Dependabot cleared; S-batch; lobby bot-practice tables + Practice-vs-Bots rename + Play Online CTA + declutter + fake-online-count removed; practice-session counter + games_played practice-guard + discoverable bug-report button; **POLISH-1** (onboarding ends in a dealt hand, Play-Online first-tap fix); **REALTIME-JUMP ENABLED** (`PRACTICE_LIVE_ENABLED=true` — 2P practice holds a real realtime seat → 30s synced countdown → jump to MP; monitored, 0 ghost seats); **RESPONSIVE-FIX** (Home Play-button truncation, bug-report FAB moved to an in-flow row, game-screen board-scroll cap, +`screen_width`/`screen_height`/`device_model` on `app_opened`).
- **KEY LEARNING:** `rs()`/`rf()` called at `StyleSheet.create()` module scope are **FROZEN on web** — they capture the 393 fallback once and never react to the real viewport width. Only `useWindowDimensions()` used *inside a component body* reacts on web. Native is unaffected (device width is captured correctly at launch).
- **OPEN:**
  1. **Economy is still problem #1** — last 7d: 66,550 credits / **0 debits**. A rake sink is **not buildable yet** — no settle path exists; every chip outcome is client-attested via `submit_score` absolute writes. Needs the server-computed-amounts refactor first (flagship batch).
  2. **responsive-fix shipped but NOT verified** on the original narrow-device tester's phone.
  3. **0 bug reports from 49 testers** — the bug-report button may not be discoverable enough despite shipping.
- **NEXT (needs owner/testers present, not background work):** verify the narrow-device fix; measure conversion post-responsive-fix; server-computed-amounts + rake refactor.

## 2026-07-05 — FULL RECAP
- **Live:** main `353597f`, web bundle `index-10270cc5`, OTA `22f8c09e`, build 506, runtime 2.7.0.
- **Shipped this session (11 batches):** unified `GameView` (MP renders == SOLO); leave-recovery (52s reconnect window); QA batches A/B/C; UX-1; UX-2; **daily_login leak fix** (110,850 leaked → server-locked: `daily_login` no-op + event whitelist + amount clamp); **Vercel incident** (Wingman project hijacked the domain → renamed `dist` → `caps-poker-web` to reclaim); Dependabot alerts cleared; **S-batch** (COMPLETE bonus curve via `app_config.complete_bonus_pct_by_boards` `{2:25,3:50,4:75}` + skip-board-reveal toggle); **lobby bot-practice tables** (`table_kind`, seeded `current_players=0`, XP-only, `submit_score` delta-clamp +2000/call); **Practice vs Bots rename** + Play Online CTA + home declutter + removed fake "32 online"; **practice-session demo counter** (transient, economy-neutral); **games_played practice-guard** (practice skips `update_leaderboard_elo`); **discoverable bug-report button** (Home 🐛 FAB + Settings→TOOLS row → `bug_reports`, AI-triage trigger).
- **DORMANT behind `PRACTICE_LIVE_ENABLED=false`:** realtime practice-to-live jump (seat-hold + 30s host-clock synced countdown + cut-and-jump into `/multiplayer-game`). Unit-tested (10 tests), **NOT 2-device verified**. Flip flag to `true` ONLY after a real 2-device pass. Code: `utils/practiceLiveSession.ts` + `components/PracticeLiveOverlay.tsx`; protocol `JUMP_COUNTDOWN`/`JUMP_CANCELLED` in `realtimeMultiplayer.ts`.
- **Economy STILL #1 problem:** last 7d credits **69,050** / debits **0** = **NO SINK**. Flagship batch = server-computed earn amounts refactor → **5% house rake** (the real sink) → Royalties. NOTE: rake won't fix **SOLO inflation** (bot chips are invented, not from another player) — SOLO needs its **own sink**.
- **Iron Rule 5:** bot may be heuristic (updated, no longer random-only). **Iron Rule 14:** a code comment is a claim, not evidence.
- **NEXT (measure before building more):** release to testers, then measure (a) bot-table vs human-table taps, (b) bug reports, (c) drop-off points. THEN: 2-device test for the realtime-jump, flagship rake batch, and presence-coordination ("invite friend to table") if the bot-lobby doesn't bridge real humans.

## 2026-07-02 — RECAP
- **Live:** main `9bb4777`, web bundle `index-5112899a`, OTA `61746d4e-1079-4107-b024-c4ca09a5873a`, runtime 2.7.0.
- **Shipped since 06-28:** unified GameView (MP===SOLO render) · MP leave-recovery (non-host fast-path, **52s measured** 2-client on prod) · QA batch A/B/C+rule · UX-BATCH-1 (clubs rehydration, Auto-Place ALL, lobby presence, Omaha rule copy) · UX-BATCH-2 (ADVANCED settings, share-hand CTA, quiet daily bonus, chips 2000 + server-first sync, js-yaml, stale-doc purge) · daily_login leak fixed + server-locked (whitelist+clamp) · Vercel incident (Wingman alias hijack) + project rename `dist`→`caps-poker-web` · Dependabot 12→0 · S-batch: COMPLETE bonus curve via app_config `complete_bonus_pct_by_boards` {2:25,3:50,4:75} + skip-reveal toggle (unlocks after 3 games).
- **Economy state:** starting 2000 · curve live · daily_login=0 (retired) · last 7d: credits 67,270 / debits 0 = **NO SINK**.
- **DECISION — flagship batch order:** (1) server-computed earn amounts refactor → (2) **5% house rake** (server-side, dilutes chips slowly, the real sink) → (3) Royalties → (4) improved SOLO bot (Iron Rule 5 UPDATED: heuristic allowed, no longer random-only).

## 2026-07-02 — earn_chips incident
- `earnChips('daily_login')` on every Home mount credited **+50/open** — `earn_chips` had NO server gate (unconditional ledger + leaderboard UPDATE, `p_amount DEFAULT 50`). Damage: **110,850 chips leaked across 1,130 devices**. Client call removed (hotfix `e34baea`, OTA `c3253f4f`); server hardened: `daily_login`=no-op, event-type whitelist, amount clamp **[-500,+1500]** on BOTH earn_chips overloads (migration `harden_earn_chips_server_gate`).
- The daily bonus itself is now server-gated end-to-end: `claim_daily_reward` (DB once-per-day gate + `daily_rewards` ledger row as proof) is the only claim path; no local reward math, no client-wins submitScore push.
- **Residual risk:** the clamp is a ceiling, not event validation — a client can still send an inflated amount within the clamp for a legit event. Full fix = server-computed amounts per event (like claim_daily_reward). Planned, not built — see TODO below.

## 2026-07-02 — state of truth
- **Live:** main `f704607`, web bundle `index-2fc1cfd5`, OTA group `eb67b693-5d51-40d4-9e4f-1733c1a410a7`, runtime 2.7.0, build 506. Web = caps.ftable.co.il via Vercel (GH Action deploys on push to main).
- **Vercel:** project RENAMED `dist` → **`caps-poker-web`** (same projectId `prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP`, domain unaffected). Why: on 7/1 a Wingman CLI deploy (branch test/core-loop-smoke) landed on the then-named "dist" project and the caps.ftable.co.il alias auto-followed it — the live site served the Wingman dating app until restored via `vercel promote` of the CAPS deploy. Cleanup done: stray `web-dist/.vercel` link deleted; stale unused `caps-poker` Vercel project deleted. **LESSON: never deploy to a Vercel project you didn't verify by projectId; a production custom domain follows the NEWEST production deploy.**
- **Chips:** starting = **2000**. The CLIENT reads `leaderboard.total_chips` (default now 2000). `user_profiles.chips` is NOT the read path — never "reset chips" via user_profiles alone.
- **Shipped since last update:** QA batch A/B/C + stale-rule (`d1de124`: English hand badges, first-run 3P selector on mount, non-host leave-recovery clean-cancel + full roster cleanup via finish_table); UX-BATCH-1 (`f704607`: clubs rehydration fix — resolve ids inline before my_clubs, Auto-Place ALL, lobby presence count, Omaha rule stated in onboarding card 2).
- **WARNING:** any handoff doc dated 11.3.2026 is obsolete (claims FTP deploy / no backend / import.meta bug / 43 tests — ALL wrong). Trust only this file's dated sections.

- THEME (done 2026-06-15): app-wide obsidian `#161922` / mint `#4FD6A8` (tokens mint, mintLight `#7FE3C2`, mintBright `#A7EED6`, mintDim). Gold = SEMANTIC ONLY: winner highlight (Card.tsx inline literal `#c9a84c`, locked), medals, cup tiers, currency amounts. See docs/GEMS.md → "Headless Visual-QA Loop".

### 2026-06-28 — UNIFY-FINAL state of truth
⚠️ REPO PATH = C:\Projects\POKER\Caps (NOT C:\Projects\Caps — that's an empty placeholder). This bit us 2026-06-29.
📎 Docs: docs/RECAP_2026-06-28.md (cycle narrative + 3-layer QA method) · docs/MIGRATION_HYGIENE.md (qa_* junk migrations vs real ones)

LIVE: web prod = main `16e278f`, bundle `index-62234e03…` (verified, 0 console errors). Native = TestFlight 506 (`aea77e1`) + OTA group `cc58fc53` (UNIFY-FINAL, runtime 2.7.0). DB = gxrpunvhjcrzqnitbqah.

SHIPPED THIS CYCLE: public lobby (always-open 6-table pool, first-joiner-host, self-healing cron) · Friends Clubs (closed groups + member-gated tables + private mini-league) · MP↔SOLO render parity (unified UI) · all 12 in-app popups removed (only first-run onboarding kept) · tightened onboarding copy · 4 deep bugs fixed (below).

4 BUGS FIXED (found by DB simulation, all LIVE):
1. seat_index collision — join_table set seat_index=current_players → collided after a mid-waiting leave → next join threw a unique-constraint 500 (players couldn't join; likely part of the ~40% MP "abandonment"). FIX: smallest-free-seat in [0,max), returns seat_index. Migration fix_join_table_seat_collision_and_club_gate.
2. Club tables not member-gated at JOIN (non-member with code could join). FIX: same migration, join_table rejects non-members of a club_id table with not_a_member.
3. Ghost seats — public waiting tables never expired + no heartbeat. FIX: room_players.last_seen + touch_room_player() (client beats 25s) + evict_ghost_seats(90) on cron caps_evict_ghost_seats (60s). Migrations bug3_heartbeat_and_ghost_eviction + schedule_evict_ghost_seats_cron.
4. Mini-league drift — record_club_result per-client → asymmetric on disconnect. FIX: ledger club_game_results(room_code PK) + record_club_game() idempotent (any alive client submits full roster). Migration bug4_club_game_ledger_idempotent_record.

NEW DB OBJECTS: tables clubs, club_members, club_game_results; columns game_rooms.is_public, game_rooms.club_id, room_players.last_seen. RPCs: ensure_public_lobby, list_public_tables, touch_room_player, evict_ghost_seats, create_club, join_club, my_clubs, club_leaderboard, create_club_table, list_club_tables, record_club_game (record_club_result @deprecated). join_table now does smallest-free-seat + club gate + returns seat_index. Crons: lobby_v2_ensure_public_pool (*/2), caps_evict_ghost_seats (* * * * *), caps_cleanup_expired_rooms (*/2).

CLEAN RESET (for friends): all 739 accounts → 2000 chips, all lifetime stats zeroed, leaderboard emptied, club leagues zeroed. One real club kept (RARP).

PENDING: BoardReveal in MP (flag mpBoardReveal=false, dormant — code wired but NOT verified 2-client; prove via Option B then flip on) · QA pipeline branch feat/qa-pipeline @ 8b73f17 (Layer 1 db-sim + Layer 2 web-e2e scaffolded, NOT run; Layer 3 Maestro chosen not built; run Layer 1 against a Supabase BRANCH not prod) · native E2E (Maestro) = the open corner.

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot may use heuristic strategy (was random-only; changed 2026-07-02 with owner unlock — improved SOLO bot is step 4 of the flagship batch)
- Rule 6: No backend for single-player — local storage only
- Rule 7: Local multiplayer via react-native-tcp-socket (host as WebSocket server) — LOCKED
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2, future sprint) — LOCKED
- Rule 9 (2026-06-28): DB ground-truth beats any bot/agent report — re-run the simulation, read the tables.
- Rule 10 (2026-06-28): Never claim a layer works without watching it run end-to-end.
- Rule 11 (2026-06-28): QA simulations run against a Supabase BRANCH, never the live shared project.
- Rule 12 (2026-06-28): ~15 qa_* migrations in history are throwaway test sims (see docs/MIGRATION_HYGIENE.md) — don't let them replay on a branch.
- Rule 13 (2026-07-02): Stale docs are hazards — MEMORY.md's dated sections are the only trusted state. Verify any claim older than the newest dated section before acting on it.
- Rule 14 (2026-07-02): A code comment is a claim, not evidence — verify against the actual implementation (the "idempotent — safe every open" comment shipped the earn_chips leak).

## TODO
- **Web audio NotAllowedError catch:** wrap web `playSound`/`startAmbient` in a NotAllowedError catch — browser autoplay policy logs 4 console exceptions when audio starts without a user gesture (e.g. after refresh). Benign/cosmetic; next batch.
- **Server-computed earn amounts refactor:** move all chip-amount logic into the RPCs per event type (as claim_daily_reward already does) — the client sends only the event, never an amount; earn_chips's `p_amount` parameter goes away, and each event's value lives server-side in one place (chip_config or per-event RPC). Kills the residual clamp-window risk from the earn_chips incident. Requires a coordinated client+server change: one batch + OTA.

## Tech Stack
- React Native + Expo SDK 55 (React 19, RN 0.83)
- expo-router for navigation (file-based, /lobby sub-route)
- expo-dev-client for custom dev builds (needed for native modules)
- Zustand with persist middleware for state + AsyncStorage
- react-native-reanimated for animations
- react-native-gesture-handler for interactions
- react-native-tcp-socket for local multiplayer networking
- expo-haptics for tactile feedback
- uuid for player/device IDs
- TypeScript strict
- Jest 29 + ts-jest for testing
- EAS Build: development (dev client), preview (TestFlight), production (autoIncrement)

## Current State
- Sprint-42 complete — Phase 2 (leaderboard, internet MP, notifications)
- Version: 1.1.0, buildNumber: 14 (auto-increment)
- App Store: v1.0.0 (build 454ae10a) submitted, v1.1.0 build in progress
- Privacy policy: https://caps.ftable.co.il/privacy.html (updated for leaderboard + online MP)
- Supabase: @supabase/supabase-js installed, utils/supabase.ts shared client
- Iron Rule 8: IMPLEMENTED — RealtimeServer/RealtimeClient via Supabase Realtime channels
- New screens: leaderboard.tsx, lobby/internet-host.tsx, lobby/internet-join.tsx
- New utils: leaderboard.ts, realtimeMultiplayer.ts, notifications.ts, supabase.ts
- Store: playerName, notificationsEnabled, handsWon, biggestWin added (persisted)
- NOTE: Supabase features degrade gracefully when .env not configured
- TypeScript: 0 errors
- Tests: 104/104 passing (14 hand evaluator + 19 simulation + 39 game logic + 7 hand hint + 11 theme + 14 full simulation)
- Web deployed to Vercel: https://caps.ftable.co.il (HTTPS works, auto-SSL)
- Vercel project: dist (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP), team: team_ayrePMw5z8jSPhRe67RiBD0k
- Vercel URL: https://dist-beryl-eta-15.vercel.app (fallback)
- DNS: caps.ftable.co.il A → 76.76.21.21 (Vercel), TTL 300s
- No git remote configured
- NOTE: react-native-tcp-socket requires custom dev client (not Expo Go)

## Game Config (all runtime-configurable in Settings)
- arrangementTime: 60 (sec)
- boardRevealDuration: 5 (sec)
- turnRevealDelay: 800 (ms) — card flip speed within a board
- completeBonusDisplay: 2 (sec)
- startingChips: 1000
- potPerBoard: 25 (buy-in = potPerBoard × NUM_BOARDS = 100)
- completeBonusPercent: 50 (% of buy-in per opponent)
- numberOfPlayers: 2 (2/3/4 selector, for multiplayer)
- botSpeedMin: 5000 (ms)
- botSpeedMax: 30000 (ms)
- soundEnabled: true (toggle in Settings)

## Complete Bonus Definition (LOCKED)
- If a player wins ALL boards in a single hand → receives (buyIn × bonusPercent/100) per opponent
- Example: buy-in=100, 2 players → winner gets +50 chips bonus
- Zero-sum: losers each pay their share of the bonus

## UI Specs (LOCKED)
- Player hand: 2 fixed rows at bottom (no scroll)
- Board reveal: fully automatic, no user input between boards
- Summary: chip counting animation + staggered board fade-in, then "Next Hand" button

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/results.tsx, /app/summary.tsx, /app/settings.tsx
/app/simulate.tsx, /app/multiplayer-game.tsx, /app/reveal.tsx (legacy, unused)
/app/leaderboard.tsx
/app/lobby/_layout.tsx, /app/lobby/host.tsx, /app/lobby/join.tsx
/app/lobby/internet-host.tsx, /app/lobby/internet-join.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts (GamePhase, Player, MultiBoardState, GameSession, ConnectedPlayerInfo)
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts, handHint.ts
/utils/gameServer.ts, gameClient.ts, roomCode.ts
/utils/supabase.ts, leaderboard.ts, realtimeMultiplayer.ts, notifications.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts, gameLogic.test.ts, handHint.test.ts
/constants/gameConfig.ts, theme.ts, networkConfig.ts
/store/gameStore.ts (chips+config+handsPlayed+bestChips+handsWon+biggestWin+playerName+notificationsEnabled persisted; multiplayer+revealData transient)
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json, .npmrc
/scripts/generate-assets.py (Pillow — generates icon, splash, favicon)
/screenshots/README.md (App Store screenshot instructions)
/docs/multiplayer-test-guide.md
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md
/DEV_BUILD_GUIDE.md, MULTIPLAYER_RESEARCH.md, LOCAL_MULTIPLAYER_DESIGN.md

## Multiplayer Architecture
- GameServer: TCP server on host, newline-delimited JSON, heartbeat monitor
- GameClient: TCP client on guest, auto-heartbeat, reconnect (3 attempts with 2s backoff)
- Host is source of truth: deals, evaluates, broadcasts
- Room discovery: 4-digit code + manual IP entry
- Server/client instances stored in Zustand (mpServer/mpClient) — survive screen transitions
- Callbacks updated via updateCallbacks() when navigating between screens
- Host reveal flow: onAllPlayersReady → runRevealSequence → broadcast BOARD_REVEAL + HAND_COMPLETE → build RevealData → navigate to /results
- Guest reveal flow: collect BOARD_REVEAL messages → on HAND_COMPLETE → build RevealData → navigate to /results
- Next-hand flow: NEXT_HAND_REQUEST message → server tracks requests → when all players request → re-deal → broadcast CARDS_DEALT → all navigate to /multiplayer-game
- Disconnected players auto-filled with random card assignments
- DeviceId-based reconnection: server matches reconnecting clients by deviceId, restores seat
- Payload validation: all incoming messages validated, player names truncated to 20 chars
- Message buffer: 64KB max per connection, prevents memory exhaustion
- Background-aware: heartbeat resets after app returns from background (both server+client)
- Double-disconnect prevention: socket disconnect only processed once per client
- Protocol messages: ROOM_JOIN, ROOM_JOIN_ACK, ROOM_STATE, GAME_START, CARDS_DEALT, PLAYER_READY, ALL_READY, BOARD_REVEAL, HAND_COMPLETE, NEXT_HAND_REQUEST, HEARTBEAT/ACK, ERROR, PLAYER_DISCONNECTED

## Deployment
- Web export: `npx expo export --platform web` → dist/ folder
- **Primary**: Vercel (auto-SSL, CDN) — `vercel deploy --prod` from dist/
- Vercel project: dist (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP), team: team_ayrePMw5z8jSPhRe67RiBD0k
- Vercel auth token: in C:/Users/royea/AppData/Roaming/com.vercel.cli/Data/auth.json
- Custom domain: caps.ftable.co.il → A record 76.76.21.21 (Vercel)
- Vercel URL: https://dist-beryl-eta-15.vercel.app (fallback)
- **Legacy (FTP)**: cPanel shared hosting at ftable.co.il (SPD hosting)
- FTP creds: ftableco / CPANEL_PASSWORD_REDACTED (from C:/Projects/ftable/.env)
- cPanel API: https://ftable.co.il:2083/ (Basic auth with same creds)
- Server IP: 195.225.46.105
- SPD SSL still broken (Apache SNI returns compass.spd.co.il) — bypassed by Vercel

## iOS Build Checklist (do NOT auto-trigger)
1. `npx tsc --noEmit` — 0 errors
2. `npx jest` — all tests passing
3. `npx expo-doctor` — all checks passed
4. `node scripts/preflight-check.js` — 10/10
5. `eas build --platform ios --profile production` — submit manually
6. Verify app.json version/buildNumber before submitting
7. Test on physical device via TestFlight before App Store release

## Open Items
- Supabase project not yet created — need to create project at supabase.com and add SUPABASE_URL + SUPABASE_ANON_KEY to .env (see .env.example)
- Supabase tables not yet created (leaderboard, push_tokens) — SQL in utils/leaderboard.ts comments
- App Store: v1.0.0 build 13 submitted — needs metadata + screenshots in ASC dashboard (see APPSTORE_METADATA.md)
- First multiplayer device test pending (needs dev build on 2 devices)
- Multiplayer polish remaining: animated board reveal on guest side, player disconnect toast during game

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
- Sprint 04: TestFlight prep, assets, EAS config, QA checklist
- Sprint 05: Simulation engine, multiplayer logic refactor, OSS research
- Sprint 06: Local multiplayer — host server, client, lobby, game screen
- Sprint 07: EAS dev build config, multiplayer TODOs fixed, resilience, v1.1.0
- Sprint 08: Fix player hand face-up, board community cards layout
- Sprint 09: Board UI polish — selected board highlight, empty slot pulse, tap-to-remove UX
- Sprint 10: Full audit — deal logic verified, 12 new gameLogic tests, dead code cleanup
- Sprint 11: Fix card text color — COLORS.black was #f0f0e8 (same as card bg), changed to #1a1a2e
- Sprint 12: Full audit (61 bugs) + fixes — critical game.tsx race conditions, PlayerHand 2-row grid, summary chip animation, complete bonus calc fix (50% of buy-in not pot), settings overhaul (all params + validation + numberOfPlayers selector + turnRevealDelay), multiplayer networking hardening (deviceId reconnect, payload validation, background heartbeat), web re-deploy, 47 tests
- Sprint 14: Card flip animation (rotateY via reanimated), floating "+chips"/"-chips" text on board reveal, iOS build checklist, 6 new tests (53 total), closed cards render fix for flip support
- Sprint 15: CP branded icon (sharp SVG), Badge in Board+Summary, v1.2.0, EAS preview build, web re-deploy, 4 new tests (57 total)
- Sprint 16: Hand hint indicator (Pair/Trips/Flush Draw etc.), multiplayer test guide, EAS build success (bbb538b7), 7 new tests (64 total)
- Sprint 17: Arrangement UX audit (all 4 checks pass), timer 3-tier colors (green/yellow/red), reveal phase verified, TestFlight needs ascAppId, web re-deploy, 5 new tests (69 total)
- Sprint 21: Gaming visual redesign — neon color palette (theme.ts rewrite), title/logo glow animation, button redesign (gold+neonBlue), board layout polish (neonBlue active pulse, neonGreen complete flash), PlayerHand gold selection glow, gameover shake+neonRed glow, summary neonGreen/neonRed score colors, Card suit colors from theme, 10 new theme tests (79 total), web re-deploy
- Sprint 22: Vertical board layout — 4 boards stacked (no scroll), dynamic card sizing (Dimensions), Board.tsx full-width compact rows, Card.tsx dynamic dimensions props, PlayerHand gold border+scale select, hardcoded colors audit (Badge/Board/Card/game.tsx → COLORS refs), bot row hidden during arrangement, player hand hidden during reveal, web re-deploy
- Sprint 23: Button press fix (reanimated → RN Animated + TouchableOpacity), web shadow deprecation fix (Platform.select for static shadows in Button/Board/Card/PlayerHand), external tester distribution docs, web re-deploy
- Sprint 24-build: v1.4.0, production build 04890b1f (store distribution), TestFlight submitted, buildNumber auto-incremented to 6, removed stale buildNumber from app.json
- Vercel deploy: web export deployed to Vercel, custom domain caps.ftable.co.il with auto-SSL, DNS A record → 76.76.21.21, SSL issue bypassed
- Button-fix-iOS: removed Animated.View wrapper around TouchableOpacity (blocked iOS touches), used AnimatedTouchable instead, added pointerEvents="none" to title glow, v1.4.1 build 7 (1b272517)
- Button-fix-web: AnimatedTouchable blocks clicks on web — platform-split: Pressable for web (renders native &lt;button&gt;), AnimatedTouchable for iOS/Android, web re-deployed to Vercel
- Sprint 32: Fix broken 🪙 emoji → styled gold dots (ChipsDisplay + Board pot), board padding 16px, hand counter polish, web re-deploy to Vercel
- Sprint 33: CRITICAL FIX — Sprint-30 removed PlayerHand from game.tsx, player cards were invisible. Restored PlayerHand at bottom (face-up, 2-row grid). New UX: tap card → select (gold border), tap board slot → place selected card. Board sizing adjusted to fit with PlayerHand (~140px). Web re-deploy to Vercel
- Sprint 34: New app/results.tsx — single results screen replaces 4 sequential reveal screens. Shows all boards at once with small cards (36x50), hand names, WIN/LOSS/TIE badges, chip amounts, animated net count-up, complete bonus banner, NEXT HAND button. Flow: game.tsx → results.tsx → game.tsx (skips summary). Fixed 🪙 emoji in summary.tsx. Web re-deploy to Vercel
- Sprint 35: Full UX audit — 2 critical responsive bugs fixed. Results: changed from side-by-side (overflow on 375px) to vertical stacking, dynamic card sizing from screen width. Game: replaced hardcoded SAFE_AREA=84 with useSafeAreaInsets(), min card height 28px, PLAYER_HAND_H 130. PlayerHand: dynamic card width (fits 8/row on any phone). Home: gap 40→28. All screens fit iPhone SE (375×667) through iPhone 14 Plus (430×932). Web maxWidth 480px. Web re-deploy to Vercel
- Sprint 36: READ-ONLY multiplayer diagnostic. Full protocol map, 9 gap analysis, implementation plan. No code changed.
- Sprint 37: Multiplayer functional — 3 critical gaps fixed. A1: server/client instances stored in Zustand (mpServer/mpClient), survive screen transitions, removed dead onSendReady callback. A2: multiplayer-game.tsx reveal flow builds RevealData and navigates to /results (same as single-player). A3: NEXT_HAND_REQUEST protocol message, server tracks requests, re-deals when all players ready. B1: multiplayer-game vertical board layout (from game.tsx), dynamic card sizing via useSafeAreaInsets, same tap-to-select UX, player names from connectedPlayers. B2: waiting overlay + results.tsx "Waiting for other players" state. v1.6.0, web re-deploy, EAS production build
- Sprint 38: App icon + splash screen generated via Pillow script. Icon: 1024x1024, gold "C" on poker green radial gradient, gold ring border, corner suit symbols. Splash: 1284x2778, "CAPS POKER" on green felt with gold text + suit symbols. Favicon: 64x64. Android adaptive icon updated. Screenshots README created. v1.7.0, web re-deploy, EAS production build
- Sprint 39: Sound effects — 7 WAV files generated via numpy script (cardPlace, cardSelect, cardFlip, chipsWin, lose, complete, timerLow). sounds.ts rewritten with new SoundName type + WAV requires. Wired: cardSelect on tap in game.tsx + multiplayer-game.tsx, timerLow at 10s warning in game.tsx, win/lose conditional in results.tsx. Settings toggle already existed. Preload on app start via _layout.tsx. v1.8.0, web re-deploy, EAS production build
- Sprint 40: Full simulation test suite — 14 new tests (104 total). Tests cover: 2/3/4-player full hands, COMPLETE bonus trigger, game over detection, 10-hand stress test, auto-fill timer, results data shape, card uniqueness, Omaha rule verification (Iron Rule 4). simulate.tsx upgraded with auto-play mode (configurable hands/players, per-hand logs, running chip balance, stop button). SIMULATE button added to home (__DEV__ only). 0 bugs found. Web re-deploy
- Sprint 41: App Store submission — version reset to 1.0.0 (public release), build 13 (454ae10a). Privacy policy page deployed to caps.ftable.co.il/privacy.html. 6 placeholder screenshots generated via Pillow (6.7" + 6.1", home/game/results mockups). APPSTORE_METADATA.md created with all ASC fields. EAS build submitted to App Store Connect. Pending: upload metadata + screenshots in ASC dashboard, submit for Apple review
- Sprint 42: Phase 2 — 3 parallel features. (1) Leaderboard: utils/leaderboard.ts (getDeviceId, submitScore, getLeaderboard), app/leaderboard.tsx (top 20, pull-to-refresh, highlighted current player). (2) Internet multiplayer: utils/realtimeMultiplayer.ts (RealtimeServer + RealtimeClient via Supabase Realtime channels, Presence tracking, same message protocol as TCP), app/lobby/internet-host.tsx + internet-join.tsx. (3) Notifications: utils/notifications.ts (requestPermissions, scheduleLocal, scheduleReengagement, sendPushNotification). Shared: utils/supabase.ts client, .env.example. Store: playerName, notificationsEnabled, handsWon, biggestWin. Settings: player name input, notifications toggle. Index: PLAY ONLINE + LEADERBOARD buttons. Results: auto-submit to leaderboard, track handsWon/biggestWin. Iron Rule 8: IMPLEMENTED. v1.1.0, web re-deploy, EAS build

## Working Style
Read: docs/ROYE_WORKING_STYLE.md before starting any session
