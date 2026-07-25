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

## Prerequisite surfaced (Rule 9 — DB ground truth, do NOT paper over)
The correct authz (verified JWT + `room_players.user_id` match) requires every player to have a stable
`auth.uid()`. **Verified against the live DB + client code:** CAPS has **no `signInAnonymously`**;
`auth.getUser()` is always `?? null`; `touch_room_player` is called with `p_user_id: userId ?? null`.
So device-anon players (the majority — Google login is prompted only after games 3–5) have
`auth.uid() = NULL` and `room_players.user_id = NULL`, and are **rejected** by the fixed EF by design.
**Before the flag can go on, MP must adopt an anonymous Supabase session** (`signInAnonymously`) so
every player has a `user_id` that `join_table` records into `room_players`. That client change is part
of the 2-device cutover and is a hard blocker for flag-on — not an EF bug.

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
