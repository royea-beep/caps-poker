-- SERVER-DEAL-PHASE-A — join_table: autostart deal-gate + identity hardening (E1a / E3).
-- BRANCH ONLY — NOT APPLIED TO THE SHARED PROJECT (Iron Rule 11).
--
-- E1 CORRECTION: I designed the deal gate around "the host marks 'playing' only after deal_hand
-- returns". THAT STEP DOES NOT EXIST. The transition is AUTOSTART, inside the LAST joiner's join
-- transaction (verified on live):
--     UPDATE game_rooms SET current_players = current_players + 1 ... RETURNING * INTO v_room;
--     IF v_room.current_players >= v_room.max_players THEN
--       UPDATE game_rooms SET status='playing', started_at=now() ...
-- waiting -> playing is server-side, atomic, triggered by the Nth join, and the RPC returns
-- autostarted:true. No host, no separate start call.
--
-- OPTION CHOSEN: (a) — autostart parks the room in 'starting'; a follow-up compare-and-swap promotes
-- 'starting' -> 'playing' once the deal lands (see 20260726092000_promote_and_rls_lockdown.sql).
--   (b) calling the EF from inside join_table via pg_net is REJECTED: this function holds FOR UPDATE
--       on the room row, so it would pin a row lock across a network round-trip — every other joiner
--       blocks behind a cold Deno boot, and an EF timeout becomes a database lock-hold. Never.
--   (c) letting autostart write 'playing' and dealing afterwards is REJECTED: a failed deal leaves a
--       room 'playing' with no cards, and finish_wedged_playing_rooms only reaps when ALL heartbeats
--       are stale — live players staring at a cardless table keep heartbeating, so it is NEVER reaped.
--       A permanent wedge with users inside it is the worst possible outcome.
--
-- WHO CALLS THE EF (there is no host at fill time — is_host on a public pool table is the FIRST
-- joiner, not the last): the client whose join_table call returns `autostarted:true`. Exactly one
-- client can receive it, because the transition happens once inside the row-locked transaction — that
-- is a deterministic election with no extra coordination.
--   IF THAT CLIENT DIES: any other seated client that observes status='starting' past a short grace
--   may also call deal_hand. That is SAFE because (1) hand_id is DETERMINISTIC — derived below from
--   room_id + starting_at, so every client computes the identical id; (2) deal_hand is create-or-get
--   on the hand_id PK, so a second caller receives the SAME deal, never a re-deal; (3) promote is a
--   compare-and-swap, so a double promote is a no-op. If nobody calls at all, the room is reaped after
--   45s by reap_stuck_starting_rooms and the pool is topped back up.
--
-- E3 — KILL-SWITCH. A migration has no kill-switch; app_config does. BOTH behaviour changes here are
-- gated on app_config flags so this migration is INERT when applied and each change is revertible in
-- seconds without another migration:
--   * server_deal_enabled   (default FALSE) -> autostart writes 'playing' exactly as today.
--   * join_requires_session (default FALSE) -> legacy identity: COALESCE(auth.uid(), p_player_id),
--       i.e. byte-identical to today's behaviour, plus the free improvement that a verified uid wins
--       over the client-supplied one when present.
--     When TRUE: identity is auth.uid() ONLY, p_player_id is ignored, and a NULL uid is rejected
--       ('no_session') — the hardening. Staged rollout: apply migration (inert) -> ship the client
--       that awaits the session -> flip join_requires_session -> then deploy the EF and flip
--       server_deal_enabled. ROLLBACK at any point = set the flag back to false; no migration needed.
--
-- DEVICE_ID PATH PRESERVED: today's idempotency and club-membership checks are
-- `(p_player_id IS NOT NULL AND user_id=...) OR (p_device_id IS NOT NULL AND device_id=...)`. Both OR
-- branches are kept below, so an idempotent rejoin after an app restart and a device-identified club
-- member still work in BOTH modes. Only the INSERT identity and the NULL-uid rejection change.

CREATE OR REPLACE FUNCTION public.join_table(
  p_room_code text,
  p_player_id uuid DEFAULT NULL::uuid,   -- IGNORED when join_requires_session=true
  p_display_name text DEFAULT 'Player'::text,
  p_device_id text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_room game_rooms; v_is_host boolean := false; v_seat int;
  v_uid uuid; v_identity uuid; v_hand_id text; v_deal_required boolean := false;
  v_strict boolean := COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='join_requires_session'), false);
  v_server_deal boolean := COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='server_deal_enabled'), false);
BEGIN
  v_uid := auth.uid();

  IF v_strict THEN
    -- HARDENED: verified JWT only. A client-supplied identity is not trusted (same defect class that
    -- was removed from the deal_hand EF).
    IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_session'); END IF;
    v_identity := v_uid;
  ELSE
    -- LEGACY (default): exactly today's behaviour, preferring the verified uid when we have one.
    v_identity := COALESCE(v_uid, p_player_id);
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) AND status='waiting'
    AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;

  -- idempotent: already seated (uid OR device — device branch preserved for rejoin-after-restart)
  IF EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id
       AND ((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))) THEN
    RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
      'max_players',v_room.max_players,'status',v_room.status,'autostarted',false,'already_joined',true,'game_config',v_room.game_config);
  END IF;

  -- club tables are members-only at the JOIN gate too (uid OR device — device branch preserved)
  IF v_room.club_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM club_members WHERE club_id=v_room.club_id
         AND ((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))) THEN
      RETURN jsonb_build_object('ok',false,'error','not_a_member');
    END IF;
  END IF;

  IF v_room.current_players >= v_room.max_players THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;
  v_is_host := (v_room.is_public AND NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id AND is_host));

  -- smallest unused seat in [0, max_players) — never collides after a leave
  SELECT s.i INTO v_seat
  FROM generate_series(0, v_room.max_players - 1) s(i)
  WHERE NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id AND seat_index=s.i)
  ORDER BY s.i LIMIT 1;
  IF v_seat IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;

  INSERT INTO room_players (room_id, user_id, display_name, seat_index, is_host, device_id)
  VALUES (v_room.id, v_identity, COALESCE(NULLIF(p_display_name,''),'Player'), v_seat, v_is_host, p_device_id);

  IF v_is_host THEN
    UPDATE game_rooms SET host_id=v_identity, host_name=COALESCE(NULLIF(p_display_name,''),'Player') WHERE id=v_room.id;
  END IF;

  UPDATE game_rooms SET current_players = current_players + 1 WHERE id=v_room.id RETURNING * INTO v_room;

  -- AUTOSTART on fill
  IF v_room.current_players >= v_room.max_players THEN
    IF v_server_deal THEN
      -- Deal-gated: park in 'starting' and let the deal + CAS promote finish the transition.
      UPDATE game_rooms SET status='starting', starting_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
      v_deal_required := true;
    ELSE
      -- Today's behaviour, untouched while the flag is off.
      UPDATE game_rooms SET status='playing', started_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
    END IF;
    IF v_room.is_public THEN PERFORM public.ensure_public_lobby(); END IF;
  END IF;

  -- DETERMINISTIC hand id: every seated client derives the identical value from the room row, so a
  -- backup caller converges on the SAME create-or-get deal. A reaped+retried hand gets a new
  -- starting_at and therefore a brand-new id (and a fresh deck) by construction.
  IF v_room.starting_at IS NOT NULL THEN
    v_hand_id := v_room.id::text || ':' || floor(extract(epoch from v_room.starting_at))::text;
  END IF;

  RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
    'max_players',v_room.max_players,'status',v_room.status,'autostarted',(v_room.status IN ('playing','starting')),
    'deal_required',v_deal_required,'hand_id',v_hand_id,
    'is_host',v_is_host,'seat_index',v_seat,'game_config',v_room.game_config);
END; $function$;
