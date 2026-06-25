-- ============================================================================
-- MP LOBBY RPCs — reproducibility capture (VAMOS-CAPS GAME-MODES-OVERHAUL)
--
-- These SECURITY DEFINER functions back the Multiplayer Lobby (game_rooms +
-- room_players). They were originally APPLIED LIVE via the Supabase MCP across the
-- Jun-24/25 sessions and were NOT previously captured as repo migrations — so a fresh
-- DB rebuild would have lacked them. This file closes that gap.
--
-- All six functions are VERBATIM from live `pg_get_functiondef` (gxrpunvhjcrzqnitbqah):
-- list_open_tables, create_table, join_table, leave_table, finish_table,
-- cleanup_expired_rooms (hardened). Reproducibility gap closed.
--
-- Tables assumed to exist (created earlier): game_rooms, room_players. status check
-- allows: waiting | starting | playing | finished | abandoned.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- list_open_tables() — joinable tables (waiting + not expired). VERBATIM from live.
-- Returns a jsonb array shaped exactly to the client's OpenTable (player_count = max_players).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_open_tables()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'room_code', room_code, 'host_name', host_name, 'status', status,
    'current_players', current_players, 'max_players', max_players,
    'player_count', max_players, 'game_config', game_config, 'created_at', created_at
  ) ORDER BY max_players, created_at), '[]'::jsonb)
  FROM game_rooms
  WHERE status='waiting' AND (expires_at IS NULL OR expires_at > now());
$function$;

-- ---------------------------------------------------------------------------
-- create_table(...) — open a waiting room, seat the host (roster seat 0). VERBATIM from live.
-- 4-char code (charset ABCDEFGHJKLMNPQRSTUVWXYZ23456789), expires +30min, game_config={numberOfPlayers:N}.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_table(p_player_count integer, p_host_id uuid DEFAULT NULL::uuid, p_host_name text DEFAULT 'Player'::text, p_device_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_row game_rooms; i int;
BEGIN
  IF p_player_count NOT IN (2,3,4) THEN RETURN jsonb_build_object('ok',false,'error','bad_player_count'); END IF;
  LOOP
    v_code := '';
    FOR i IN 1..4 LOOP v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random()*32)::int + 1, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code=v_code AND status IN ('waiting','starting','playing'));
  END LOOP;
  INSERT INTO game_rooms (room_code, host_id, host_name, status, player_count, current_players, max_players, game_config, expires_at)
  VALUES (v_code, p_host_id, COALESCE(NULLIF(p_host_name,''),'Player'), 'waiting', p_player_count, 1, p_player_count,
          jsonb_build_object('numberOfPlayers', p_player_count), now() + interval '30 minutes')
  RETURNING * INTO v_row;
  INSERT INTO room_players (room_id, user_id, display_name, seat_index, is_host, device_id)
  VALUES (v_row.id, p_host_id, COALESCE(NULLIF(p_host_name,''),'Player'), 0, true, p_device_id);
  RETURN jsonb_build_object('ok',true,'id',v_row.id,'room_code',v_row.room_code,'status',v_row.status,
    'current_players',v_row.current_players,'max_players',v_row.max_players,'game_config',v_row.game_config);
END; $function$;

-- ---------------------------------------------------------------------------
-- join_table(...) — atomic seat claim (row-locked, no overfill); autostart when full.
-- VERBATIM from live.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_table(p_room_code text, p_player_id uuid DEFAULT NULL::uuid, p_display_name text DEFAULT 'Player'::text, p_device_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_room game_rooms;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) AND status='waiting'
    AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;
  -- idempotent: already seated (by user_id or device_id) -> no double count
  IF EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id
       AND ((p_player_id IS NOT NULL AND user_id=p_player_id) OR (p_device_id IS NOT NULL AND device_id=p_device_id))) THEN
    RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
      'max_players',v_room.max_players,'status',v_room.status,'autostarted',false,'already_joined',true,'game_config',v_room.game_config);
  END IF;
  IF v_room.current_players >= v_room.max_players THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;
  INSERT INTO room_players (room_id, user_id, display_name, seat_index, is_host, device_id)
  VALUES (v_room.id, p_player_id, COALESCE(NULLIF(p_display_name,''),'Player'), v_room.current_players, false, p_device_id);
  UPDATE game_rooms SET current_players = current_players + 1 WHERE id=v_room.id RETURNING * INTO v_room;
  IF v_room.current_players >= v_room.max_players THEN
    UPDATE game_rooms SET status='playing', started_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
    'max_players',v_room.max_players,'status',v_room.status,'autostarted',(v_room.status='playing'),'game_config',v_room.game_config);
END; $function$;

-- ---------------------------------------------------------------------------
-- leave_table(...) — free a seat; host-leave-while-waiting or last-player -> abandoned.
-- VERBATIM from live.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_table(p_room_code text, p_player_id uuid DEFAULT NULL::uuid, p_device_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_room game_rooms; v_was_host boolean; v_deleted int;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',true,'note','no_room'); END IF;
  SELECT bool_or(is_host) INTO v_was_host FROM room_players WHERE room_id=v_room.id
    AND ((p_player_id IS NOT NULL AND user_id=p_player_id) OR (p_device_id IS NOT NULL AND device_id=p_device_id));
  DELETE FROM room_players WHERE room_id=v_room.id
    AND ((p_player_id IS NOT NULL AND user_id=p_player_id) OR (p_device_id IS NOT NULL AND device_id=p_device_id));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RETURN jsonb_build_object('ok',true,'note','not_in_room'); END IF;
  UPDATE game_rooms SET current_players = GREATEST(0, current_players - v_deleted) WHERE id=v_room.id RETURNING * INTO v_room;
  IF v_room.status='waiting' AND (COALESCE(v_was_host,false) OR NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id)) THEN
    UPDATE game_rooms SET status='abandoned' WHERE id=v_room.id;
    RETURN jsonb_build_object('ok',true,'abandoned',true,'current_players',0);
  END IF;
  RETURN jsonb_build_object('ok',true,'abandoned',false,'current_players',v_room.current_players);
END; $function$;

-- ---------------------------------------------------------------------------
-- finish_table(...) — host marks the room finished at game end + clears roster.
-- Fixes the 'playing' leak. VERBATIM from live (Phase 3).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_table(p_room_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_room game_rooms; v_deleted int;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'note', 'no_room'); END IF;
  IF v_room.status NOT IN ('waiting', 'starting', 'playing') THEN
    RETURN jsonb_build_object('ok', true, 'already', v_room.status);
  END IF;
  UPDATE game_rooms SET status = 'finished', finished_at = now() WHERE id = v_room.id;
  DELETE FROM room_players WHERE room_id = v_room.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'finished', true, 'roster_cleared', v_deleted);
END; $function$;

-- ---------------------------------------------------------------------------
-- cleanup_expired_rooms() — pg_cron jobid 32 (every 2min). Hardened in Phase 3 to
-- self-heal stale 'playing' rooms + purge old terminal rooms. VERBATIM from live.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_rooms()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE game_rooms SET status = 'abandoned'
    WHERE expires_at < NOW() AND status IN ('waiting', 'starting');

  UPDATE game_rooms SET status = 'finished', finished_at = NOW()
    WHERE status = 'playing' AND COALESCE(started_at, created_at) < NOW() - interval '2 hours';

  DELETE FROM room_players WHERE room_id IN (
    SELECT id FROM game_rooms WHERE status IN ('finished', 'abandoned')
      AND COALESCE(finished_at, started_at, created_at) < NOW() - interval '1 day');

  DELETE FROM game_rooms WHERE status IN ('finished', 'abandoned')
    AND COALESCE(finished_at, started_at, created_at) < NOW() - interval '1 day';
END;
$function$;

-- Grants (these RPCs are called from the anon/authenticated client).
GRANT EXECUTE ON FUNCTION public.list_open_tables() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_table(int, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_table(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_table(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_table(text) TO anon, authenticated;

-- NOTE: cleanup_expired_rooms is driven by pg_cron jobid 32 (every 2 min), scheduled live:
--   SELECT cron.schedule('cleanup-expired-rooms', '*/2 * * * *', 'SELECT public.cleanup_expired_rooms()');
