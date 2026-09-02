# VAMOS CAPS — TOTAL AUDIT (2026-09-02)

Pre-tester audit of the whole project (main @ 6c7e5a9, build 514 on TestFlight, Supabase
`gxrpunvhjcrzqnitbqah`). Default posture: **report, don't fix.** Every finding verified twice —
against the live DB, the deployed function bodies, and live anon probes with the shipped public key.
All live probes used clearly-marked throwaway `AUDIT-*` device_ids and were deleted immediately;
the ledger is byte-for-byte restored (gap 0, lb_sum 1,028,120, 511 rows — identical to pre-audit).

## GROUND TRUTH (measured, not claimed)
leaderboard 511 · device_identity 6 · ledger_sum == leaderboard_sum == 1,028,120 → **gap 0** ·
min balance 2000 · 0 negatives · chip_purchases 0 · iap_enabled false · web_payments_enabled false ·
hands 76 · played (distinct device) 6 in hand_history · dual_write_retry_queue 0 pending / 0 dead.
The strategist's numbers reproduce. **gap 0 means the ledger is internally consistent — it does NOT
mean chips are hard to mint (see S1: the mint RPCs write both sides, so the metric stays green while
the product fails).**

---

# FINDINGS (ranked by cost to the product)

## 🔴 S1 — UNAUTHENTICATED CHIP MINT: a stranger with only the public key mints spendable chips. **FAIL. Verified live, twice.**
**The single most important finding.** Three economy RPCs are `SECURITY DEFINER`, anon-executable,
and mint to a client-supplied `device_id`, because the identity gate **fails open for a session-less
caller**.

Root cause — `econ_bind_ok(text)`:
```
IF ... OR v_uid IS NULL THEN RETURN true; END IF;   -- no session ⇒ waved through
... EXCEPTION WHEN OTHERS THEN RETURN true;           -- any error ⇒ waved through
```
`econ_binding_enabled` is **true**, yet a caller who simply never signs in has `auth.uid() = NULL`
and skips binding entirely. Real clients sign in (anonymous auth) and bind; an attacker opts out of
the session and the gate evaporates.

Proven live (raw anon key, NO sign-in, throwaway devices, all deleted):
- **`record_hand_net(device, +10000, hand_id)`** → `new_balance 9580` then **`19160`** in two calls.
  Client-supplied `p_net`, capped ±10000/call and **+20,000/day**; no counterparty debit required
  when called directly, so it is a straight mint, not a zero-sum settlement. **~20k spendable/day/device.**
- **`record_reward(device, 999999, 'x')`** → clamped to 2000, then a 2nd event → **`new_balance 4000`**.
  Capped 2000/call, **5,000/day** (`record_reward` daily cap).
- **`submit_score(new_device, ...)`** → creates a leaderboard row whose `ledger_starting_grant`
  trigger mints **+2000** to `chip_transactions` per brand-new `device_id` (root cause of the h151
  residue). One-time per device_id, unlimited fabricated device_ids.
- `redeem_referral` pays the referrer 300 via `record_reward` — same faucet, same cap.

Both writes land in `chip_transactions` (the spendable ledger) **and** `leaderboard.total_chips`
(the public ranking). **Impact:** anyone can top the leaderboard instantly and make unlimited
"rich" devices. Today the real-world harm is bounded — play-money, no cash-out, pre-launch — but
(a) the competitive leaderboard is already untrustworthy, (b) the "chips in circulation" integrity
metric is corruptible at will, and (c) **the day payments turn on, this is a revenue hole** (cheat
instead of buy). Direct table writes are correctly denied (chip_transactions INSERT 401, leaderboard
INSERT 401, chip_transactions SELECT 401, app_config write = 0-row no-op) — the hole is the RPC gate,
not RLS.

**The one fix that closes all of it:** make the economy write-path fail **closed** with no session —
in `econ_bind_ok`, `v_uid IS NULL ⇒ RETURN false` (and drop the `WHEN OTHERS ⇒ true`), or gate
record_hand_net / record_reward / submit_score / redeem_referral on `auth.role() = 'authenticated'`.
One change; four mints closed. (Recommendation, not applied — it is an economy/security change that
needs the owner's sign-off and a re-test with a real signed-in client.)

## 🔴 S2 — LADDER FORGERY & GRIEFING: alter any player's ELO/wins/win_rate. **FAIL. Verified live.**
`hand_history` allows an anon-authed INSERT (RLS `with_check` = `auth.uid() = user_id`), and the
AFTER-INSERT trigger `tg_hand_history_leaderboard_counters` updates
`leaderboard … WHERE device_id = NEW.device_id` — but **`device_id` is never validated against the
caller**. So an attacker sets `user_id` to their own uid and `device_id` to **anyone's**.

Proven live: inserting one `{session_type:'multiplayer', result:'won', device_id:<throwaway>}` row
(HTTP 201) moved that device's `elo 1000 → 1020, games 0 → 1, wins 0 → 1, win_rate → 100` — no real
hand. Swap in a victim's device_id with `result:'lost'` and you drive their elo down (−10/row, floor
100) and tank their win_rate. It does **not** move chips (the trigger doesn't touch the ledger), so
this is integrity/griefing, not theft. **Fix:** the trigger must update only the row whose identity
matches the authenticated caller (bind device_id to auth.uid via device_identity), or the RLS check
must cover device_id, not just user_id.

## 🟠 S3 — `referral_links` fully world-readable. **FAIL (low). Verified live.**
Policy "Anyone can read referral links" + anon SELECT grant → an anon reads all 2,007 rows
(`device_id` fragments, referral codes, click/conversion counts). Referral codes are meant to be
shared, but enumerating every device fragment + code is needless disclosure and, combined with S1's
faucet, a farming aid. Low severity; tighten to owner-scoped or drop `device_id` from the readable
columns.

## 🔴 E1 — THE DATABASE CANNOT BE REBUILT FROM THE REPO. **FAIL. Verified twice (independently).**
`supabase/migrations/` = **37 files → 6 `CREATE TABLE` (5 real tables) + ~32 functions.** Production
has **73 tables + 9 views + 198 functions**, and `supabase_migrations.schema_migrations` records
**366** applied versions (first `20260313000000`, last `20260901065622`). A fresh branch replaying
the repo comes up with ~5/73 tables — **≈329 changes reached production with no migration file in the
repo.** Compounding: the server money-math (`supabase/functions/_shared/handEvaluator.ts`,
`chipMath.ts`, `cards.ts`) and `resolver-probe` are **not in git** (regenerated at deploy by
`scripts/gen-edge-shared.mjs`, which IS present). This is the top operability/DR risk: an incident
that loses the project DB cannot be reconstructed from source control. **Report only — do not attempt
the repair** (rebuilding history is its own multi-day, high-risk project).

## 🟠 C1 — TWO SOURCES OF TRUTH on the hand outcome: history/replay disagree with results/stats. **FAIL. Verified both sides.**
`app/hand-history.tsx:126-127` & `:305-306` and `app/replay.tsx:110-111` decide win/loss/tie from
the **collapsed** board token count (`playerWins > botWins ? win : < ? loss : tie`), which merges all
opponents into one bucket — the exact thing `boardTally.ts:29-34` says it must not be used for.
Every other reader (`results.tsx:149`, `statsEngine.ts:127`, `shareHand.ts:103`, `achievements.ts:65`)
uses `deriveHandOutcome(hand.boards)` off the stored `winnerSeat`. **Concrete divergence:** a
3-player hand where each seat wins exactly one board → `deriveHandOutcome` = **TIE** (results/stats/
server), but history/replay compute `1 < 2` = **LOSS** (red border, filed under "Losses"). Same
record, two answers. 3-player hands are reachable (onboarding forces 3P for some first-run users).
Non-economic; visible; a tester will report it. **Trivial, safe fix available** (three call sites →
`deriveHandOutcome(hand.boards)`) — flagged as the one code change worth making, not applied here
because it touches shipped-screen outcome logic and warrants a render check + the owner's nod.

## 🟠 E2 — Single 3.62 MB web bundle, no code-splitting. **FAIL (report-only).**
`app.json` web.output "single"; shipped `index-*.js` = 3,802,868 B, one file. Every route pays the
full download up front. Known trade-off; note for post-tester.

## 🟡 E3 — Game screen: `Board` is not memoized; ~20 shared values on one screen. **FAIL (report-only).**
`components/Board.tsx` `export default function Board` (no `React.memo`), rendered up to 4× by
`BoardArrangement`. Board documents a 5-shared-value ceiling **per board**, but nothing caps the
board COUNT, so a 2P screen runs ~20 SVs against MEMORY's "5 per screen" guidance, and any setState
re-renders all boards together. Leaf `Card`/`StaticCard` ARE memoized (good). Top frame-cost hotspot;
watch on device.

## 🟡 E4 — Dead code (safe cleanup). **Verified 0 importers.**
`components/DealMeInButton.tsx` (known; solid #FFD700), `utils/webPayments.ts`,
`hooks/useSimpleReveal.ts`, `computeOmahaEquity` export in `utils/handEvaluator.ts` (0 runtime
callers). Removable, low value.

## 🟡 E5 — Dead / superseded DB surface (candidates, not auto-delete). 
Clean dead tables (0 rows, 0 writers): `learning_events`, `player_cups` (superseded by `device_cups`),
`qa_reports`. Superseded/unwired RPCs: `get_home_screen_v2`, `get_play_of_the_day_v2`,
`watch_rewarded_ad`, the SNG join entrypoints, a parallel account-deletion path
(`request_account_deletion` vs the live `delete_user_account`). Leftover backup/temp tables:
`chip_transactions_prereset_20260901` (4,237), `_backup_starter_redemptions_20260816` (649),
`_econ_fn_backup` (10), `_tmp_commit_blobs` (2) — safe to archive off-DB. `purchases` AND
`chip_purchases` both exist and are both empty — confirm they aren't a schema duplication before
payments.

## 🟡 C2 / C3 — Latent tie/dimension traps (report-only, off the live path).
- `utils/gameLogic.ts:170-176` `calculateHandResults` hardcodes `NUM_BOARDS` (=4) for
  isComplete/total-pot. **Not on the live path** (live flow is `calculateHandResultsMulti` →
  `calculateChipDeltasCore`, dynamic). Only `debug-suite.ts` + tests call it. Deprecation JSDoc
  already warns. Latent.
- `app/multiplayer-game.tsx:813-829` MP guest fallback board hardcodes `winner:'tie'` and drops
  `winnerSeat`, forcing the whole hand onto the collapsed-token path (same class as C1). Requires a
  dropped realtime payload; rare.

---

# CHECKED AND CLEAN (PASS) — verified, not assumed
- **Direct writes/reads denied:** anon INSERT chip_transactions 401, INSERT leaderboard 401, SELECT
  chip_transactions 401, PATCH app_config = 0-row no-op (iap_enabled unchanged since 2026-06-22 —
  the 204 was a silent RLS deny, NOT a flip; instrument trap avoided).
- **Payment path gated:** `verify-purchase` edge fn `verify_jwt = true`; payments off
  (iap_enabled/web_payments_enabled false); `purchases`/`chip_purchases` empty.
- **`resolve-hand` (public, verify_jwt=false) is NOT a mint:** it reads the deal the SERVER dealt from
  `game_hands` (caller supplies only room_code + hand_no — no client cards), evaluates with the shared
  generated evaluator, settles via idempotent zero-sum `record_hand_net` (claim is a conditional
  PATCH; per-(room,hand) idempotency). An unauthenticated caller can only trigger resolution of a real
  pending hand. **This corrects the engineering sweep's "divergent hand evaluator" claim** — the
  server `_shared` evaluator/chipMath are GENERATED from the app source of record by
  `scripts/gen-edge-shared.mjs` (present), not a hand-maintained copy (an instrument error: repo
  absence ≠ divergence).
- **`record_hand_net` settlement:** ±10000/call clamp, +20000/day gain cap, `GREATEST(0,…)` floor
  (no negatives), idempotent per (device_id, reference_id), rake + play_grant ledgered. Zero-sum holds
  **when driven by resolve-hand/the client** (the mint in S1 is the direct-call bypass, not a
  settlement bug).
- **Tie handled in the write path:** `handOutbox.ts` sends a tie as `p_won=null` → stored 'tied';
  the leaderboard trigger counts a tie as games+1 only (elo/wins unchanged); resolve-hand does a
  correct 3-way boards-won outcome (one leader = won, ≥2 = tied, else lost).
- **Outcome readers (except C1):** results/stats/share/achievements all derive from
  `deriveHandOutcome` off `winnerSeat`. Empty-array guards present (`getSpecificHandName` guards
  `length===0`). No live hardcoded board/player counts on the settlement path.
- **Practice is ladder-neutral:** `tg_hand_history_leaderboard_counters` early-returns on
  `session_type='practice'` (elo/games untouched) — deliberate, documented.
- **RLS is ON** for every sensitive table; device_identity/econ_rate_counters have RLS with zero
  anon policies (deny); user_profiles/hand_history/chip_purchases are own-uid scoped.

---

# COULD NOT VERIFY (stated plainly)
- **Native rendering on a real iOS device** — the container browser cannot reach the live backend;
  514 is the first Hebrew build on iOS. Felt/beam/gilded masthead/chip bevel/Hebrew RTL unseen on device.
- **Two real MP clients / MP under load** — needs Supabase realtime + a second device; the empty
  lobby (0 room_players, 25 players ever) can't be exercised in-container.
- **The `gen-edge-shared --check` drift guard is actually wired into deploy** — the header claims
  "--check fails the deploy," but no `gen-edge-shared` reference exists in package.json or
  `.github/workflows/`. The generator exists; its enforcement is unproven.
- **`verify_jwt`-off-at-PayPlus is recorded where it will be seen** — the standing ⚠️ (when PayPlus
  is wired, verify_jwt comes off verify-purchase and the webhook signature becomes the only gate).
  verify_jwt is on today; whether the "signature is the only gate" reminder lives somewhere a future
  session will hit is not established.

---

# DOMAIN H — value built but not surfaced (modelled, not measured)
- **Multiplayer ("the opponent is a person")** is fully built and route-reachable (lobby/table/
  multiplayer-game), but lands in an **empty lobby** — 25 devices ever, 0 room_players. The lever
  isn't code-unreachable, it's socially unreachable; it needs a populated table (scheduled
  play-together windows, or bot-backed "online" tables that seed presence) before a tester feels it.
- **Daily missions**: 20 defined, system built, but flag-inactive (no nav entry). A whole retention
  loop dark.
- **Referrals**: 2,007 links generated, **0 redemptions** — the invite→reward loop is built but the
  redemption path is unused/buried (and S1/S3 make it farmable if switched on as-is).

---

# RECOMMENDATIONS (separate from findings; cost · risk · reuse)
1. **Close the mint (S1).** `econ_bind_ok`: no session ⇒ fail closed; drop the `WHEN OTHERS ⇒ true`.
   Cost: ~1 line + re-test with a signed-in client. Risk: could reject a real client that calls an
   economy RPC before sign-in — verify the app always signs in (anonymous) before the first economy
   call. Highest ROI security fix; do before any competitive-leaderboard or payments milestone.
2. **Bind the ladder trigger to the caller (S2).** Update leaderboard only for the caller's own bound
   device. Cost: small trigger change. Risk: low.
3. **Fix the outcome divergence (C1).** Three call sites → `deriveHandOutcome(hand.boards)`. Cost:
   trivial. Risk: low (render-check history/replay after). Reuses the existing single derivation.
4. **Back up the DB out-of-band and start capturing new changes as migrations (E1).** Do NOT rebuild
   history; instead `pg_dump` a source-of-truth snapshot now and require a migration file for every
   new change going forward, plus commit `_shared`/`resolver-probe` or wire `gen-edge-shared --check`
   into CI. Cost: process + one dump. Risk: none. Highest operability ROI.
5. Surface one built-but-dark retention lever for the tester round (H) — most cheaply, seed presence
   so Play Online isn't an empty room. Reuse the existing lobby + ChipButton.

---

# VERDICT
1. **Is CAPS ready for a tester round?** Yes for a *closed, friendly* tester round on the game itself
   — the first session reads clean, rules settle correctly, the ledger is consistent, payments are
   off — but NOT for anything that treats the leaderboard as real or invites adversarial users.
2. **What would you not want a tester to hit?** The public leaderboard — it can be topped in one
   unauthenticated call (S1), and any player's ELO can be griefed (S2); and the 3-player TIE that
   reads as a LOSS in history/replay (C1). None of these break a friendly tester's own game, but the
   first two make the competitive surface meaningless and the third looks like a bug.
3. **Single most valuable next thing:** close the unauthenticated mint (S1) — one line in
   `econ_bind_ok` — because it is the only finding that is both trivial to fix and load-bearing for
   everything the game is about to become (a real leaderboard, then real payments); every other
   finding is either cosmetic to a friendly tester (C1), operational rather than user-facing (E1), or
   already correctly defended.

*(Visual/layout (E) and accessibility (F) and the read-as-a-person first-session (D) walk are covered
in the section below, rendered from a fresh local export both languages at 320/393.)*
