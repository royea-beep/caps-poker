# account_delete: THE COVERAGE GAP. Read before deploying.

> The EF is **correct**. It is also, today, **close to a no-op for real players.** Deploying it
> without understanding this would replace a dangerous function with one that quietly deletes almost
> nothing — and reports success while doing so.

## The structural picture is fine

All **22** tables the old `delete_user_account` touched carry **both** `user_id` and `device_id`, so
a uid-keyed delete is structurally possible for every one. (`user_profiles` keys on `id` and is
handled separately; `auth.users` via `auth.admin.deleteUser`.)

## The data picture is not

Measured on live 2026-08-01:

| Table | Rows | With a non-null `user_id` | Coverage |
|---|---|---|---|
| `daily_rewards` | 306 | **0** | **0%** |
| `achievements` | 47 | 1 | 2% |
| `chip_transactions` | 3,971 | 276 | **7%** |
| `analytics_events` | 6,966 | 1,880 | 27% |
| `hand_history` | 57 | 51 | 89% |
| `leaderboard` | 323 | 323 | 100% *(see below)* |
| `user_missions` | 3,024 | 3,024 | 100% *(see below)* |

**And the populated ones mostly do not hold a real auth identity:**

- `leaderboard.user_id` matches `auth.users`: **0 of 323**. It equals `leaderboard.id` for all 323 —
  it is a **copy of the random PK**, not an auth uid.
- `chip_transactions`: **1** distinct `user_id` matches `auth.users`.
- `user_missions`: **1** distinct `user_id` matches `auth.users`.

**So a JWT-derived delete would remove essentially nothing for any existing player.** This is the
same root finding as Z2 (no device→owner mapping was ever recorded), arriving from the other side:
not only can we not prove which device a caller owns, we cannot find that caller's rows at all,
because nothing links a row to a real `auth.users` id.

## What this means, stated plainly

1. **The EF is still the right thing to deploy** — it removes the vulnerability and is correct for
   any player created *after* ownership starts being recorded (the Z2 option-(c) forward-only path).
2. **It does NOT restore working account deletion for the 319 existing players.** Claiming otherwise
   would be the same class of error as `record_chip_purchase` returning `ok:true` while crediting
   zero.
3. **App Store compliance needs a separate answer in the meantime.** The honest one is a
   support-driven manual deletion executed with `service_role`, keyed on `device_id` supplied by the
   user through a channel we can attribute (the in-app support path), rather than by an unauthenticated
   RPC that accepts a device id from anyone.
4. **The EF should therefore report what it actually deleted** — it returns a per-table row count, so
   a delete that removes 0 rows is visible rather than silent. That is deliberate.

## Sequencing

This gap closes itself once Z2 option (c) lands: new economy writes key on `auth.uid()`, so rows
created from that point carry a real identity and the EF covers them. Existing rows stay frozen and
are deleted through the support path. **Do not block the EF on the gap — deploy it, and be honest in
the release note about what it does and does not cover.**
