-- ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STOP. THIS FILE INTENTIONALLY FAILS IF APPLIED.                                              ║
-- ║  It is NOT a migration. It is a REGENERATE-FROM-LIVE procedure.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
--
-- WHY THIS FILE NO LONGER CONTAINS A FUNCTION BODY
--
-- It used to be a whole-function `CREATE OR REPLACE FUNCTION public.join_table(...)` carrying the
-- autostart deal-gate. That shape is a standing landmine: join_table is LIVE and CHANGES OFTEN, so a
-- dormant copy silently rots into a security regression. It went stale TWICE in one week:
--
--   2026-07-31 (1st): missed the M1 club guard — would have re-opened a PROVEN impersonation bypass.
--   2026-07-31 (2nd): after that rebase, still missed
--        (a) the N1 club idempotency fix. The file carried the pre-N1 predicate
--            ((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))
--            while live matches club rooms on rp.user_id = v_uid ONLY. Applying it would have
--            re-opened the club DEVICE branch — exactly the bypass N1 closed.
--        (b) the S1 `join_rejected` rejection logging. Applying it would have deleted the
--            observability that the live join_requires_session=true flip depends on, sending strict
--            rejections back to emitting nothing at all.
--
-- Both were caught only because someone diffed it by hand. That is not a control.
--
-- ── THE ADDITIVE CHANGE THIS FILE REPRESENTS ────────────────────────────────────────────────────
-- ONE behavioural delta, and nothing else:
--   When join_table fills a room and would set status='playing', it must instead set
--   status='starting' + starting_at=now() (columns from 20260801091000), leaving the room in a state
--   the deal-gate can complete. promote_starting_to_playing(...) (20260801093000) then moves it to
--   'playing' once the deal for that hand exists. Autostart otherwise behaves identically, and with
--   app_config.server_deal_enabled false the path must stay byte-identical to today.
--
-- Nothing else about join_table changes. Identity resolution, the join_identity instrumentation, the
-- join_rejected rejection logging, the M1 club guard, the N1 uid-only club idempotency, seat
-- selection and the return shape are all UNTOUCHED — which is precisely why replacing the whole
-- function was the wrong mechanism for expressing it.
--
-- ── HOW TO REGENERATE (do this at APPLY time, never before) ─────────────────────────────────────
--   1. Pull the CURRENT live definition — the only acceptable starting point:
--        SELECT pg_get_functiondef('public.join_table(text,uuid,text,text)'::regprocedure);
--   2. Apply ONLY the delta above to that text: find the autostart block
--        IF v_room.current_players >= v_room.max_players THEN
--          UPDATE game_rooms SET status='playing', started_at=now() ...
--      and make it set status='starting', starting_at=now() when server_deal_enabled is true.
--   3. Diff your result against the live text and confirm the ONLY hunk is that block.
--   4. Verify these markers survive in your regenerated body — absence means you started from a
--      stale copy and must go back to step 1:
--        - 'join_rejected'            (S1 rejection logging, BOTH sites)
--        - 'club guard'               (M1)
--        - 'rp.user_id = v_uid'       (N1 club idempotency, uid-only)
--        - 'join_requires_session'    (gated identity)
--        - 'join_identity'            (instrumentation)
--   5. Write the regenerated statement into a NEW timestamped migration and apply THAT.
--
-- The guard below exists so nobody can skip steps 1-5 by running this file.

DO $$
BEGIN
  RAISE EXCEPTION USING
    MESSAGE = 'REFUSING TO APPLY: 20260801092000 is a regenerate-from-live procedure, not a migration.',
    DETAIL  = 'join_table is live and changes often; this file deliberately carries no function body '
              'so it cannot silently un-ship a security fix. It went stale twice (M1 club guard, then '
              'N1 club idempotency + S1 rejection logging).',
    HINT    = 'Read the header of this file and regenerate the deal-gate from the CURRENT live '
              'definition into a new timestamped migration.';
END $$;
