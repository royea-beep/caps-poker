# Deal-gate: REGENERATE FROM LIVE (this is deliberately NOT a migration)

> There is intentionally **no `join_table` migration file** on this branch. The deal-gate must be
> re-derived from the CURRENT live function at apply time and written into a **new** timestamped
> migration. If you are looking for `20260801092000_join_table_autostart_deal.sql`, it was removed on
> purpose — read on.

## Why the file was deleted rather than kept

It used to be a whole-function `CREATE OR REPLACE FUNCTION public.join_table(...)` carrying the
autostart deal-gate. That shape is a standing landmine: `join_table` is **live and changes often**, so
a dormant copy silently rots into a security regression. It went stale **twice in one week**:

| When | What the dormant copy was missing | What applying it would have done |
|---|---|---|
| 2026-07-31 (1st) | the M1 club guard | re-opened a **proven** impersonation bypass |
| 2026-07-31 (2nd) | the N1 club idempotency fix — it still carried `((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))` while live matches club rooms on `rp.user_id = v_uid` **only** | re-opened the club **device** branch — exactly the bypass N1 closed |
| 2026-07-31 (2nd) | the S1 `join_rejected` rejection logging | deleted the observability the live `join_requires_session=true` flip depends on; strict rejections would emit **nothing** |

Both were caught only by a hand diff. **A hand diff is not a control.**

An intermediate version of this file kept the `.sql` extension and ended in `RAISE EXCEPTION` so a
blind apply would fail loudly. That protected against a blind apply but **broke the whole migration
set** — an ordered `db push` stopped dead at it, blocking the step-1 migrations that have nothing to
do with the deal-gate. Deleting the file is strictly better: there is now no artifact to apply blindly
at all, and the only path forward is the regeneration below, which is the required workflow anyway.

See also the standing rule in `MEMORY.md` (2026-07-31 V): *a dormant branch may never carry a
whole-function `CREATE OR REPLACE` of a live, actively-changing function.*

## The additive change this represents

**One behavioural delta, and nothing else.** When `join_table` fills a room and would set
`status='playing'`, it must instead set `status='starting'` + `starting_at=now()` (columns from
`20260801091000`), leaving the room in a state the deal-gate can complete.
`promote_starting_to_playing(...)` (`20260801093000`) then moves it to `'playing'` once the deal for
that hand exists. Gated on `app_config.server_deal_enabled`, so the flag-off path stays
**byte-identical** to today.

Nothing else about `join_table` changes — identity resolution, the `join_identity` instrumentation,
the `join_rejected` rejection logging, the M1 club guard, the N1 uid-only club idempotency, seat
selection and the return shape are all untouched. That is precisely why replacing the whole function
was the wrong mechanism for expressing it.

## How to regenerate (do this at APPLY time, never before)

1. Pull the **current live** definition — the only acceptable starting point:
   ```sql
   SELECT pg_get_functiondef('public.join_table(text,uuid,text,text)'::regprocedure);
   ```
2. Apply **only** the delta above to that text: find the autostart block
   ```sql
   IF v_room.current_players >= v_room.max_players THEN
     UPDATE game_rooms SET status='playing', started_at=now() ...
   ```
   and make it set `status='starting'`, `starting_at=now()` when `server_deal_enabled` is true.
3. Diff your result against the live text and confirm the **only** hunk is that block.
4. Verify these markers survive in your regenerated body. Absence of any one of them means you
   started from a stale copy — go back to step 1:
   - `join_rejected` (S1 rejection logging, **both** sites)
   - `club guard` (M1)
   - `rp.user_id = v_uid` (N1 club idempotency, uid-only)
   - `join_requires_session` (gated identity)
   - `join_identity` (instrumentation)
5. Write the regenerated statement into a **new timestamped migration** and apply that.
