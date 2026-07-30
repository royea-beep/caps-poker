-- ⚠️ BLOCKER — VERIFY AGAINST THE LIVE `join_table` BEFORE APPLYING. THIS FILE REPLACES THE WHOLE
-- FUNCTION. A stale copy here would silently UN-SHIP live security fixes. Pull the current definition
-- (`SELECT pg_get_functiondef('public.join_table(text,uuid,text,text)'::regprocedure)`) and diff it
-- against this file first. Rebased 2026-07-31 onto the live function; anything applied to production
-- after that date must be folded in again.
--
-- SERVER-DEAL-PHASE-A — join_table: autostart deal-gate (E1a). BRANCH ONLY, NOT APPLIED (Iron Rule 11).
-- Renamed from 20260726091000 -> 20260801092000: every dormant migration here sorted EARLIER than what
-- production has since applied (20260731014755 rls_write_lockdown, 20260731014835 identity hardening,
-- 20260731015819 identity instrumentation, plus the club guard), which would have made this an
-- out-of-order push.
--
-- THIS FILE PRESERVES, VERBATIM FROM LIVE (do not drop any of them):
--   1. the GATED IDENTITY block (v_strict from app_config.join_requires_session; legacy
--      COALESCE(v_uid, p_player_id) when false) — shipped 2026-07-31;
--   2. the join_identity INSTRUMENTATION (non-blocking BEGIN…EXCEPTION…NULL) — shipped 2026-07-31,
--      currently collecting the data that decides whether join_requires_session can be flipped;
--   3. the M1 CLUB GUARD — a club table ALWAYS requires a verified session, and club membership is
--      matched on the VERIFIED uid ONLY (no client identity, no device branch). This closed a PROVEN
--      impersonation bypass; re-opening it would be a live security regression.
-- ON TOP of that it adds ONLY the deal gate: when app_config.server_deal_enabled is true, autostart
-- parks the room in 'starting' + bumps hand_seq instead of going straight to 'playing'.
CREATE OR REPLACE FUNCTION public.join_table(
  p_room_code text,
  p_player_id uuid DEFAULT NULL::uuid,
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
  v_uid uuid; v_identity uuid; v_source text;
  v_hand_id text; v_deal_required boolean := false;
  v_strict boolean := COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='join_requires_session'), false);
  v_server_deal boolean := COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='server_deal_enabled'), false);
BEGIN
  v_uid := auth.uid();

  IF v_strict THEN
    IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_session'); END IF;
    v_identity := v_uid;
  ELSE
    v_identity := COALESCE(v_uid, p_player_id);
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) AND status='waiting'
    AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;

  -- [LIVE] join_identity instrumentation — non-blocking
  BEGIN
    v_source := CASE WHEN v_uid IS NOT NULL THEN 'uid'
                     WHEN p_player_id IS NOT NULL THEN 'device'
                     ELSE 'none' END;
    INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
    VALUES ('join_identity',
            jsonb_build_object('source', v_source, 'strict', v_strict,
                               'has_device_id', (p_device_id IS NOT NULL),
                               'club', (v_room.club_id IS NOT NULL),
                               'is_public', v_room.is_public),
            p_device_id, v_uid, 'join_table');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- [LIVE] M1 CLUB GUARD — a club table ALWAYS requires a verified session
  IF v_room.club_id IS NOT NULL AND v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;

  IF EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id
       AND ((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))) THEN
    RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
      'max_players',v_room.max_players,'status',v_room.status,'autostarted',false,'already_joined',true,'game_config',v_room.game_config);
  END IF;

  -- [LIVE] club membership on the VERIFIED uid ONLY
  IF v_room.club_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM club_members WHERE club_id=v_room.club_id AND user_id = v_uid) THEN
      RETURN jsonb_build_object('ok',false,'error','not_a_member');
    END IF;
  END IF;

  IF v_room.current_players >= v_room.max_players THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;
  v_is_host := (v_room.is_public AND NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id AND is_host));

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

  -- ── THE ONLY ADDITION vs LIVE: the deal gate on autostart ──────────────────────────────────────
  IF v_room.current_players >= v_room.max_players THEN
    IF v_server_deal THEN
      UPDATE game_rooms SET status='starting', starting_at=now(), hand_seq = hand_seq + 1
        WHERE id=v_room.id RETURNING * INTO v_room;
      v_deal_required := true;
    ELSE
      UPDATE game_rooms SET status='playing', started_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
    END IF;
    IF v_room.is_public THEN PERFORM public.ensure_public_lobby(); END IF;
  END IF;

  IF v_deal_required THEN
    v_hand_id := v_room.id::text || ':' || v_room.hand_seq::text;
  END IF;

  RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
    'max_players',v_room.max_players,'status',v_room.status,'autostarted',(v_room.status IN ('playing','starting')),
    'deal_required',v_deal_required,'hand_id',v_hand_id,
    'is_host',v_is_host,'seat_index',v_seat,'game_config',v_room.game_config);
END; $function$;
