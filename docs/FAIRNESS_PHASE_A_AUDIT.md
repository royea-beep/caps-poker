# SERVER-DEAL-PHASE-A — Audit & Hardening (2026-07-25)

Branch `feat/server-deal-phase-a`. Audit of the Phase-A deal foundation. **Nothing deployed/applied/
merged; flag off.** Fixes below are code-on-branch only.

## Gaps found & fixed

### 1. AUTHZ (CRITICAL) — identity from the request body, no seat check → FIXED
- **Was:** `index.ts` read `device_id` from the request body and computed the seat as
  `client_supplied_seats.indexOf(device_id)`. Both the identity **and** the roster came from the
  caller, so a caller who passed another player's `device_id` (present in the client `seats`) would
  receive that player's slice. The service-role EF bypasses `dealt_hands` RLS, so RLS was decorative —
  this function is the sole authz boundary for the full deck.
- **Now:** identity comes ONLY from the **verified JWT** (`auth.uid()`, via a caller-scoped client);
  the seat is looked up from the **server-side roster** (`room_players`, snapshotted onto the deal row
  as `seat_user_ids`). There is no request field that selects a seat, so the spoof is structurally
  impossible. Decision extracted to a pure, unit-tested `authz.ts` (`authorizeDealRequest`).
- **Config:** `supabase/config.toml` pins `[functions.deal_hand] verify_jwt = true` — do NOT inherit
  the `verify_jwt=false` default 6 of the other EFs use, or anyone with the shipped anon key could call it.

### 2. RNG bias → FIXED
- **Was:** `floor(u/2^32 * (i+1))` — a multiply mapping that is modulo-biased (unequal buckets). "Provably
  fair" but provably slightly unfair.
- **Now:** **rejection sampling** (`seededIntBelow`) rejects the top `2^32 mod n` words so every bucket
  is exactly equal. Deterministic (same seed → same draws, rejections included). Seed source unchanged:
  `crypto.getRandomValues` (CSPRNG), never `Math.random`.

### 3. Retention (missing) → ADDED (migration, branch only)
- Each row stores a FULL DECK; `cleanup_expired_rooms` hard-deletes rooms, so these rows orphan and
  grow unbounded — standing attack surface. Added `cleanup_dealt_hands()` (drops rows > 24h) + hourly
  `caps_cleanup_dealt_hands` cron + `created_at` index.
- **Row growth:** ~52+32+20 ≈ 104 card objects × ~40 B ≈ **~5 KB/row → ~500 KB per 100 hands**; the 24h
  TTL caps total at one day's hand volume.

## RETRACTED premise (Rule 14 — I inferred, the strategist verified me wrong, 2026-07-25)
A prior version of this doc claimed **"CAPS has no `signInAnonymously`, so `auth.uid()` is NULL and the
EF rejects everyone → MP must adopt anonymous sessions before flag-on."** **That was a Rule-14
violation — inferred from `room_players.user_id` being empty, never verified.** Corrected with evidence:

- **Anonymous auth HAS been running in prod for ~3 months.** `utils/auth.ts:43` calls
  `sb.auth.signInAnonymously()` (+ `:41 getSession`, `:163 onAuthStateChange`, `:24 is_anonymous`).
  Live `auth.users`: **1798 `is_anonymous=true`** rows, first 2026-04-27, latest **today**, 430
  active/30d. So signed-in clients DO have a stable `auth.uid()`.
- **The client attaches the token.** `serverDeal.client.ts` calls `supabase.functions.invoke('deal_hand')`
  — invoke() attaches `Authorization: Bearer <session.access_token>`. (The raw-`fetch` failure mode —
  apikey only, no user token — does NOT apply here; we use invoke.) So the EF's `getUser()` resolves
  `auth.uid()` for a signed-in caller.
- **`join_table` records the identity.** It `INSERT`s `room_players.user_id = p_player_id`, and the
  client passes `p_player_id = auth.getUser().id` (`app/lobby/table.tsx:132` → `userIdRef` → `joinTable`).
  So the roster's `seat_user_ids` snapshot carries the anon uid the EF sees → authz grants the seat.

**Corrected diagnosis: the JWT+roster authz is usable NOW for anon-authed clients — NOT blocked on
"adopting sessions" (already adopted) and NOT a missing token (invoke attaches it).** The one real
residual prerequisite is a **timing/population** concern, fixable in the join flow, not an auth rewrite:
`table.tsx:132` fetches `getUser()` **async** and sets `userIdRef` after; a player who reaches
`join_table` before that resolves passes `p_player_id = null` → `room_players.user_id = NULL` → that
seat's slice is unreachable and the EF correctly returns `unauthenticated`. **The cutover must ensure
the anon session is resolved (await `getUser`/`getSession`) before `join_table`, and reject/repair any
seat left with a NULL `user_id` before dealing.** (`room_players` is empty on live right now only
because rooms are hard-deleted on finish — that is NOT evidence the column stays NULL in play.)

Runtime confirmation that `auth.uid()` resolves end-to-end (invoke → verify_jwt → getUser) is the
**deploy-step gate** on a Supabase branch (Rule 10) — see the note in A5; not run this sprint (branch
creation replays the qa_* migrations, Rule 12, and the diagnosis above is settled by direct evidence,
not inference).

### Separate live bug found (C3 — report only, not fixed here)
`push_tokens` has ONE INSERT policy — `anon_insert_device_token TO anon WITH CHECK (user_id IS NULL AND
device_id IS NOT NULL)` — and **no `authenticated` INSERT policy.** Once a device signs in anonymously
its role is `authenticated`, so the `TO anon` policy no longer applies → its `push_tokens` INSERT is
denied. Live `push_tokens`: **3 rows total (2 in 2026-03, 1 in 2026-04), all `user_id` NULL, none since
April** — i.e. registration stalled right when anon auth was adopted (Apr 27). **Push-token registration
has been failing silently for ~3 months.** Fix belongs in a `push_tokens` policy for `authenticated`,
not in this sprint. (This also explains why `record_hand_net`'s `SELECT user_id FROM push_tokens` is
always NULL — the same empty table, not "no auth".)

## SCOPE STATEMENT — what Phase A does and does NOT cover (F1/F2, do not read this as a complete deal path)

**As first built, Phase A covered only the FIRST deal of a table.** The anchor was
`hand_id = room_id:epoch(starting_at)` while `promote` set `starting_at = NULL` — so the anchor was
destroyed by the very first promote, and hand #2 had nothing to derive an id from. Verified: `game_rooms`
has **no** hand/seq/round column, and there is no live per-hand table (`shared_hands` / `hand_history`
are archives). Hands 2+ never reach the DB at all today —
`RealtimeServer.startNewHand() -> startGame()` just does `this.handId++` **in memory**
(`utils/realtimeMultiplayer.ts:534-540, 556`) while the room stays `status='playing'`.

**Fixed:** a monotonic per-room `game_rooms.hand_seq` is now the anchor for BOTH the `hand_id` and the
promote guard. It is incremented when a hand enters `'starting'`, **survives promote**, and is never
reused — so a reaped+retried hand mints a fresh deck by construction. `begin_next_hand(room_id)` is the
hands-2+ entry point: a CAS `'playing' -> 'starting'` callable by **any seated player** (not the host —
`is_host` is the first joiner on a pool table and can be evicted mid-table), where the CAS makes the
election deterministic and single-valued and every loser reads the same `hand_seq`, hence the same
`hand_id`, hence the same create-or-get deal.

**STILL NOT COVERED (2-device cutover work):** wiring `startNewHand()` to call `begin_next_hand` +
`deal_hand` + `promote`, and the reveal-release of closed cards. The migrations make the server side
correct; the client protocol inversion is unchanged and unverified.

## F3 — `'starting'` visibility: nothing breaks, but nothing surfaces either

- **Lobby:** `list_public_tables` filters `WHERE is_public AND status='waiting'`, so a room in
  `'starting'` disappears from the lobby for the ~deal window. That is *correct* (it must not be
  joinable mid-deal) but it is a real UX consequence of the 45s worst case.
- **Client status branches: THERE ARE NONE.** Grepped `app/ utils/ components/` — no client code
  branches on the room's DB status. `app/lobby/table.tsx`'s `status` is **local React state**
  (`'connecting' | 'waiting' | 'starting' | 'error'`), unrelated to the DB column, and it already has a
  `'starting'` branch for its own UI (`:381`). The only consumption of the RPC's returned status is
  `res.autostarted` (`app/lobby/index.tsx:167`). So an unrecognised `'starting'` **cannot hang, bounce
  or throw — it is simply never inspected.**
- **Consequence (honest gap):** a `'starting' -> 'abandoned'` reap surfaces **NO user-visible message
  today**, because nothing subscribes to the room row and the game flow is driven by the realtime
  `CARDS_DEALT` message rather than by DB status. Making the reap visible (poll/subscribe + an error
  state) is REQUIRED cutover work, not something the migrations can provide.
- **`leave_table` during `'starting'`:** it does **not** guard on status — it deletes the player's row
  and decrements `current_players` unconditionally. That is **safe, and actually desirable**: the room
  is no longer full, so the reaper's `current_players >= max_players` test fails and it takes the
  REVERT branch instead of abandoning — leaving a genuinely joinable `'waiting'` room with a free seat.
  The stale deal is deleted by the reaper and `hand_seq` has already advanced, so the next fill deals a
  fresh deck. (It also skips the `host_id` reset, which is guarded on `status='waiting'` — harmless.)

## Seed / deck leakage (A3) — checked, none
Grep of every response/console/error path in `index.ts` + `serverDeal.client.ts`: the `seed_hex` and
`deck` are written to the `dealt_hands` row and read back into the server-side `ServerDeal`, but the
only thing returned to a caller is `sliceForPlayer` (own hole + open cards + closed **count**). No
`console.*`, no `log-error` call, no seed/deck in any payload. Seed is unreachable by clients in Phase A.

## A5 — Failure-mode design (no wiring this sprint)

**EF cold start / timeout / 500 at deal time → bounded retry, then FAIL the hand. Do NOT fall back to
the client-side deal.** A fairness feature that silently degrades to the old host-shuffles-and-holds-
the-deck path on error is worse than a clean failure — it re-opens the exact cheating vector Phase A
closes and makes commit-reveal verification (Phase B) non-deterministic. So: ~2 attempts (~2–3 s each),
then abort with a user-facing "couldn't start the hand — try again"; the room stays, no cards dealt, no
chips moved.

**Interaction with the 90 s host deal-clock and `caps_finish_wedged_playing` (120 s):** the deal is the
**first** step of hand start and MUST gate the room's `playing` transition — the host marks the room
`playing` (and navigates) only AFTER `deal_hand` succeeds; on failure the room stays `waiting/arranging`.
With that ordering, an EF failure creates **no new wedge**: the room never enters `playing` without a
deal, so `finish_wedged_playing` has nothing half-started to catch. Timing budget: EF retry (~5–6 s) ≪
90 s deal-clock ≪ 120 s wedge cron, so the deal resolves long before either timer. **New wedge risk
exists ONLY if the state transition is not gated on deal success** — that ordering is the required
contract for the cutover.

**deal_hand p50/p95 incl. cold start → UNMEASURED (cannot measure without deploying, forbidden this
sprint).** Estimate only: warm ~150–400 ms (1 JWT verify + 1–2 `room_players`/`dealt_hands` reads +
deal compute + 1 insert), cold start ~1–3 s (Deno EF boot). Rematch and next-hand also traverse this
path. **Measuring real p50/p95 is a required gate at the deploy step** (on a Supabase branch), not
something to assert now (Rule 10).
