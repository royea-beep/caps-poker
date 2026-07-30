-- SERVER-DEAL-PHASE-A — join_table identity hardening (D3). BRANCH ONLY — NOT APPLIED TO THE SHARED
-- PROJECT (Iron Rule 11). Ships WITH the client fix as part of the deal cutover, never before it.
--
-- DEFECT (same class just removed from the deal_hand EF): join_table takes the caller's identity as a
-- CLIENT-SUPPLIED PARAMETER (p_player_id uuid) and writes it straight into room_players.user_id. A
-- NULL is silently accepted -> the seat becomes unattributable, and the (correctly) hardened EF then
-- rejects that seat as 'unauthenticated'. A client-supplied identity is also spoofable: any caller can
-- claim a seat as any uuid. Fixing only the client would leave the RPC accepting forged identities —
-- inconsistent with the EF fix, so both are hardened.
--
-- FIX: derive the identity from auth.uid() INSIDE the function and IGNORE the parameter. auth.uid()
-- reads the verified JWT claim and works in SECURITY DEFINER. p_player_id is KEPT IN THE SIGNATURE
-- (so existing call sites keep compiling) but is no longer trusted for anything.
--
-- BEHAVIOUR CHANGE — deliberate, and why it is cutover-gated: a caller with no resolved session gets
-- auth.uid() = NULL and is now REJECTED ('no_session') instead of silently seated as an unattributable
-- row. CAPS already runs anonymous auth (utils/auth.ts signInAnonymously; 1798 anon users live), so a
-- client that AWAITS its session before joining always has a uid. Applying this to the shared project
-- BEFORE the client awaits the session would reject joins during the resolution race — hence branch
-- only, shipped together with the client-side await.
--
-- NOT CHANGED HERE: the auto-start still sets status='playing' directly. Re-pointing that at
-- 'starting' + the server deal is the cutover's job (no wiring this sprint); the 'starting' reaper in
-- 20260726090000_starting_state_reaper.sql is the safety net for when it does.

CREATE OR REPLACE FUNCTION public.join_table(
  p_room_code text,
  p_player_id uuid DEFAULT NULL::uuid,   -- IGNORED (kept for call-site compatibility)
  p_display_name text DEFAULT 'Player'::text,
  p_device_id text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_room game_rooms; v_is_host boolean := false; v_seat int; v_uid uuid;
BEGIN
  -- IDENTITY: verified JWT only. The p_player_id parameter is deliberately not read.
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) AND status='waiting'
    AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;

  -- idempotent: already seated (match on the VERIFIED uid, or the device for the same session)
  IF EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id
       AND (user_id = v_uid OR (p_device_id IS NOT NULL AND device_id = p_device_id))) THEN
    RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
      'max_players',v_room.max_players,'status',v_room.status,'autostarted',false,'already_joined',true,'game_config',v_room.game_config);
  END IF;

  -- club tables are members-only at the JOIN gate too (membership checked against the verified uid)
  IF v_room.club_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM club_members WHERE club_id=v_room.club_id
         AND (user_id = v_uid OR (p_device_id IS NOT NULL AND device_id = p_device_id))) THEN
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

  -- user_id is now GUARANTEED NON-NULL: every seat is attributable, so the deal EF can authorize it.
  INSERT INTO room_players (room_id, user_id, display_name, seat_index, is_host, device_id)
  VALUES (v_room.id, v_uid, COALESCE(NULLIF(p_display_name,''),'Player'), v_seat, v_is_host, p_device_id);

  IF v_is_host THEN
    UPDATE game_rooms SET host_id=v_uid, host_name=COALESCE(NULLIF(p_display_name,''),'Player') WHERE id=v_room.id;
  END IF;

  UPDATE game_rooms SET current_players = current_players + 1 WHERE id=v_room.id RETURNING * INTO v_room;
  IF v_room.current_players >= v_room.max_players THEN
    UPDATE game_rooms SET status='playing', started_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
    IF v_room.is_public THEN PERFORM public.ensure_public_lobby(); END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
    'max_players',v_room.max_players,'status',v_room.status,'autostarted',(v_room.status='playing'),'is_host',v_is_host,'seat_index',v_seat,'game_config',v_room.game_config);
END; $function$;
