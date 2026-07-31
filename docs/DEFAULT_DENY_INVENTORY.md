# DEFAULT-DENY INVENTORY (AA) — 2026-08-01

> **Inventory + plan only. Nothing executed except the authorised `audit_logs` revoke.**
> Measured on live. We have been auditing a sample and treating it as the population.

## AA1 — SECURITY DEFINER functions reachable by `anon` with a client-supplied identity

**82 functions.** We had audited **13**. Because `EXECUTE` defaults to **PUBLIC**, not one of those
grants was ever a decision anybody made.

| Tier | Count | Definition |
|---|---|---|
| **T1** | **31** | writes chips / XP / leaderboard / purchases |
| **T2** | 20 | writes other player-visible state |
| **T3** | 2 | writes only telemetry (`track_event`, `track_push_open`) |
| **T4** | 29 | read-only (but see disclosure note) |

### T1 — 25 NEVER PREVIOUSLY AUDITED

`accept_friend_challenge` · `check_achievements` · `check_cups` · `claim_daily_reward` ·
`claim_daily_streak` · `claim_emergency_chips` · `claim_low_chip_rescue` · `claim_mission` ·
`claim_mission_d` · `claim_share_reward` · `claim_winback_rescue` · `create_club_table` ·
`create_friend_challenge` · `create_table` · **`delete_user_account`** · `get_player_level` ·
`get_poker_shop` · `join_sit_n_go` · `join_sit_n_go_solo` · `join_table` · **`merge_guest_to_user`** ·
`redeem_referral` · **`redeem_starter_offer`** · `start_quick_poker` · `submit_feedback`

*(previously audited: `earn_chips`, `spend_chips`, `record_hand_net`, `record_reward`,
`submit_score`, `update_leaderboard_elo`)*

### NULL-passes-through guards found BEYOND the original 13 — **7**

`accept_friend_challenge` · `claim_emergency_chips` · `claim_mission` · `create_friend_challenge` ·
**`delete_user_account`** · **`merge_guest_to_user`** · **`redeem_starter_offer`**

> ### ⚠️ THE THREE THAT OUTRANK THE CHIP FUNCTIONS
> - **`delete_user_account(p_device_id, p_user_id)`** — NULL-passthrough guard, `anon`-executable.
>   Per CLAUDE.md this deletes across **22 tables**. This is not a chip-inflation bug; it is
>   destruction of another player's account by anyone holding the shipped anon key.
> - **`merge_guest_to_user(p_device_id, p_user_id)`** — NULL-passthrough. Merges a guest's data into
>   a chosen account: an account-takeover primitive rather than a balance bug.
> - **`redeem_starter_offer(p_device_id, p_user_id, p_receipt_id, p_platform)`** — NULL-passthrough,
>   and takes a **receipt**. Same unvalidated-receipt shape as `record_chip_purchase` (Y2).
>
> The remaining `claim_*` / `redeem_referral` family are `NO-UID` — no guard at all, same as
> `earn_chips(text)`: they grant chips against a world-readable `device_id`.

**T4 read-only disclosure:** `get_leaderboard` returns `device_id` for every player (see AA2), and
`get_player_stats*` / `get_hand_history` / `get_cup_collection_by_user` take another player's
identifier. Read-only is not the same as harmless when the identifier is the authorisation.

## AA2 — THE TABLE SIDE IS WORSE: the RPC guards can be skipped entirely

**Proven from a real anon client (rows created, then cleaned up):**

| Attempt | Verbatim result |
|---|---|
| `INSERT` into `chip_transactions`, `amount = 999999` | **INSERTED 1 row — BYPASSES `earn_chips`** (no clamp, no allowlist, no guard) |
| `INSERT` into `leaderboard`, `total_chips = 999999999` | **INSERTED 1 row — BYPASSES `submit_score`** |
| `UPDATE` another player's `leaderboard` row | 0 rows — **blocked** (no UPDATE policy) |
| `DELETE` own inserted `chip_transactions` row | 0 rows — **blocked** (no DELETE policy) |

**So every guard, clamp, allowlist and idempotency key we audited in Y1/Z1 can simply be walked
around.** An attacker never needs to call `earn_chips` at all.

Note the asymmetry: an attacker can **create** unlimited rows but cannot **modify or remove** them.
Corruption is additive and therefore *detectable and reversible* — which is why this is still latent
rather than catastrophic. It also means my own probe rows could not be cleaned up as `anon`; I
removed them with service role and re-verified (`max(total_chips)` back to 7,720, `max(amount)` back
to the 1,500 clamp, 0 probe rows).

### What `leaderboard_insert` / `insert_tx` exist FOR: **NOTHING. Both are droppable.**

Grepped every direct client table write. The **only** ones that exist are `shared_hands`,
`crash_reports` and `bug_reports`. **No client writes `leaderboard` or `chip_transactions`
directly** — all economy writes go through SECURITY DEFINER RPCs, which run as owner and do **not**
need these policies. They are pure surface.

### Unrestricted public write policies (`WITH CHECK true`) — 15 tables

**Rank 1 — forged writes corrupt the economy:** `chip_transactions` (`insert_tx`) ·
`leaderboard` (`leaderboard_insert`) · `purchases` · `daily_rewards` · `device_cups` ·
`achievements` · `economy_log` · `starter_pack_redemptions` (`starter_insert_any`, incl. `anon`)
**Rank 2 — corrupt player-visible content:** `shared_hands` (`anon_insert`)
**Rank 3 — pollute telemetry / cost money:** `analytics_events` · `crash_reports` · `bug_reports` ·
`heatmap_events` · `learning_events` · `debug_sessions` · `deploy_log` · `prompt_execution_log`

*Correctly scoped, leave alone:* `user_profiles` (`auth.uid() = id`), `push_tokens`
(`user_id IS NULL AND device_id IS NOT NULL` for anon; owner-scoped delete),
`sit_and_go_*` (`auth.uid() IS NOT NULL`).

## AA4 — CORRECTLY PROTECTED. DO NOT "FIX".

**`hand_history`** — holds `hole_cards`, `opponent_hand`, `player_cards`, `boards_data`, governed by
`users_own_hh`: `ALL` with `auth.uid() = user_id`. **This is the reference shape every other policy
should have.** It fails CLOSED for NULL-`user_id` rows.

> **Consequence worth recording: completed hands are NOT readable from the database by strangers.
> The card exposure Phase 0 addresses is specifically a TRANSPORT problem, not a storage one.**

## DEFAULT-DENY PLAN (not executed)

Sequenced so nothing on the live path breaks. **Verification template per step is the X1 pattern:
revoke → prove the write attempts fail from a real anon AND authenticated client → re-run the smoke.**

| Step | Action | Verify |
|---|---|---|
| **1** | Drop `insert_tx` + `leaderboard_insert` (no caller — proven above) | anon INSERT into both fails verbatim; economy smoke (earn/spend/hand_net/submit_score) still 6/6 |
| **2** | `REVOKE ALL` on Rank-1 tables from `anon`,`authenticated`; `GRANT SELECT` back only where a client reads (`leaderboard` yes; `chip_transactions` — check, likely no) | 8 write attempts fail per table; home screen + leaderboard render |
| **3** | Same for Rank-2/3, keeping INSERT **only** for `shared_hands`, `crash_reports`, `bug_reports` (the three real client writers), ideally narrowed to `WITH CHECK` on ownership | bug report + crash upload + share still work end-to-end |
| **4** | T1 functions: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on every one the client never calls — **start with `delete_user_account`, `merge_guest_to_user`, `redeem_starter_offer`** | per-function anon call returns `permission denied`; app smoke |
| **5** | Remaining T1 the client DOES call: the Y1/Z2 forward-only identity guard behind `econ_requires_session` | the 48h `econ_authz` window decides the flip |

**Order matters:** steps 1–3 close the bypass, so the function-level work in 4–5 becomes meaningful.
Fixing functions first would be fixing the lock while the window is open.

**Rollback for every step is one line** (`GRANT ...` / `CREATE POLICY ...`), recorded per step at
execution time.
