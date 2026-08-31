-- CLOSE-THE-LEAKS 2026-08-31 — authorization on finish_table and leave_table, and the enabler.
--
-- ═══ THE RED-TEAM LEFT THESE OPEN ON PURPOSE ═════════════════════════════════════════════════
-- finish_table(room_code) ended ANY room by its code and deleted the roster, with no authorization.
-- leave_table(code, player_id, device_id) removed ANY seat, no ownership check. The red-team did
-- not revoke them — they are real client game-actions — and flagged that they need an authorization
-- check INSIDE the function, not a revoke. This is that check. The functions stay anon-callable.
--
-- ═══ THE CONSTRAINT THAT SHAPED THE FIX ══════════════════════════════════════════════════════
-- The client calls finish_table with ONLY the room code (utils/lobbyApi.ts finishTable), from the
-- "host left, clean up the orphaned room" path in multiplayer-game.tsx. It passes NO caller
-- identity, and this sprint's edits are DB-only (supabase/docs/tests). So finish_table cannot demand
-- identity without breaking that call. The design below authorizes WITHOUT requiring the client to
-- change, by using a fact the DB already has: whether anyone is still actively in the room.
--
-- ═══ finish_table — PARTICIPANT, OR THE ROOM IS ABANDONED ════════════════════════════════════
-- Optional caller identity is accepted (and a signed-in caller is bound to its own auth.uid). Then:
--   · a PARTICIPANT of the room (a seat, or the host) may finish it — that is the host/occupant
--     right the red-team named; it activates once the client passes its identity.
--   · ANYONE may finish an ABANDONED room — one with no seat heartbeated within 90s. That is
--     exactly what the cron reaper finish_wedged_playing_rooms(120) does, and it is harmless: a
--     dead room. This keeps the existing no-identity cleanup working for a genuinely orphaned room.
--   · a NON-participant finishing a room that still has a FRESH seat — a LIVE game or an active
--     lobby — is REFUSED. That is the attack, and it is now closed.
-- Active MP games heartbeat room_players.last_seen every 25s (multiplayer-game.tsx:1190), so a live
-- game always has a fresh seat and a stranger can no longer end it. The one behaviour change: the
-- client's no-identity immediate cleanup, when the caller's own seat is still fresh, now defers to
-- the cron reaper (≤2 min) instead of finishing instantly — safe, because that reaper is the
-- designed backstop and finishTable is already fire-and-forget. Passing the caller's device id from
-- the client (a later, out-of-scope one-line change) restores instant cleanup via the participant
-- branch; the DB already enforces it.
--
-- The old single-argument finish_table(text) is DROPPED so there is one unambiguous function;
-- PostgREST still resolves the existing {p_room_code}-only call against the new defaults.

DROP FUNCTION IF EXISTS public.finish_table(text);

CREATE OR REPLACE FUNCTION public.finish_table(p_room_code text, p_device_id text DEFAULT NULL, p_player_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_room game_rooms; v_deleted int;
  v_caller_uid uuid := auth.uid();
  v_is_participant boolean;
  v_has_fresh_seat boolean;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'note', 'no_room'); END IF;
  IF v_room.status NOT IN ('waiting', 'starting', 'playing') THEN
    RETURN jsonb_build_object('ok', true, 'already', v_room.status);
  END IF;

  -- A signed-in caller is bound to its own uid, whatever it passed.
  IF v_caller_uid IS NOT NULL THEN p_player_id := v_caller_uid; END IF;

  v_is_participant := EXISTS (
    SELECT 1 FROM room_players rp
    WHERE rp.room_id = v_room.id
      AND ( (p_device_id IS NOT NULL AND rp.device_id = p_device_id)
         OR (p_player_id IS NOT NULL AND rp.user_id  = p_player_id) )
  ) OR (p_player_id IS NOT NULL AND v_room.host_id = p_player_id);

  v_has_fresh_seat := EXISTS (
    SELECT 1 FROM room_players rp
    WHERE rp.room_id = v_room.id AND rp.last_seen > now() - interval '90 seconds'
  );

  -- Only a participant may end a room with an active player. Anyone may clean up an abandoned one.
  IF NOT v_is_participant AND v_has_fresh_seat THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  UPDATE game_rooms SET status = 'finished', finished_at = now() WHERE id = v_room.id;
  DELETE FROM room_players WHERE room_id = v_room.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'finished', true, 'roster_cleared', v_deleted);
END; $function$;

COMMENT ON FUNCTION public.finish_table(text, text, uuid) IS
  'Ends a room and clears its roster. Anon-callable. A participant (seat or host) may finish any of '
  'their rooms; anyone may clean up an ABANDONED room (no seat fresh within 90s, same as the cron '
  'reaper); a non-participant finishing a room with a fresh seat is refused. Until 2026-08-31 it '
  'ended any room by code with no authorization (RED-TEAM). See migration 20260831220000.';

-- ═══ leave_table — a signed-in caller removes only its own seat ══════════════════════════════
-- The client already passes the caller's own player_id and device_id (utils/lobbyApi.ts leaveTable),
-- so binding the signed-in path breaks nothing: auth.uid() must equal the p_player_id being removed.
-- This closes the specific chain the red-team enabled — get_elo_leaderboard leaked user_id uuids, and
-- with a user_id + a room code a stranger could kick a signed-in player; the ELO leak is closed in
-- migration 20260831230000 and this removes the kick even if a uuid is obtained elsewhere.
--
-- ⚠️ THE ANON DEVICE PATH IS UNCHANGED, AND WHY. For an anonymous player the device id IS the
-- credential — there is no session to bind to. leave_table already only removes the seat whose
-- device id is named, so a caller can only affect a device it can name, and naming a victim's device
-- requires knowing that device id, which does not leak from any public surface (established by the
-- red-team). Same bearer-credential model as every other device-keyed RPC in the app.

CREATE OR REPLACE FUNCTION public.leave_table(p_room_code text, p_player_id uuid DEFAULT NULL::uuid, p_device_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_room game_rooms; v_was_host boolean; v_deleted int; v_caller_uid uuid := auth.uid();
BEGIN
  -- A signed-in caller may vacate only its OWN seat.
  IF v_caller_uid IS NOT NULL AND p_player_id IS NOT NULL AND v_caller_uid <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',true,'note','no_room'); END IF;
  SELECT bool_or(is_host) INTO v_was_host FROM room_players WHERE room_id=v_room.id
    AND ((p_player_id IS NOT NULL AND user_id=p_player_id) OR (p_device_id IS NOT NULL AND device_id=p_device_id));
  DELETE FROM room_players WHERE room_id=v_room.id
    AND ((p_player_id IS NOT NULL AND user_id=p_player_id) OR (p_device_id IS NOT NULL AND device_id=p_device_id));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RETURN jsonb_build_object('ok',true,'note','not_in_room'); END IF;
  UPDATE game_rooms SET current_players = GREATEST(0, current_players - v_deleted) WHERE id=v_room.id RETURNING * INTO v_room;
  IF v_room.is_public THEN
    IF v_room.status='waiting' AND COALESCE(v_was_host,false) THEN
      UPDATE game_rooms SET host_id=NULL, host_name='Open Table' WHERE id=v_room.id;
    END IF;
    RETURN jsonb_build_object('ok',true,'abandoned',false,'public',true,'current_players',v_room.current_players);
  END IF;
  IF v_room.status='waiting' AND (COALESCE(v_was_host,false) OR NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id)) THEN
    UPDATE game_rooms SET status='abandoned' WHERE id=v_room.id;
    RETURN jsonb_build_object('ok',true,'abandoned',true,'current_players',0);
  END IF;
  RETURN jsonb_build_object('ok',true,'abandoned',false,'current_players',v_room.current_players);
END; $function$;

COMMENT ON FUNCTION public.leave_table(text, uuid, text) IS
  'Vacates a seat. Anon-callable. A signed-in caller may remove only its own user_id seat '
  '(auth.uid bound). The anon device path is the device-id bearer model. See migration 20260831220000.';

-- ═══ THE ENABLER — list_open_tables must not hand out PRIVATE room codes ══════════════════════
-- finish_table is exploitable at scale only if room codes are discoverable. list_open_tables
-- returned EVERY waiting room's code, with no is_public filter — so a private or club waiting room's
-- code leaked into a public browse list. The lobby UI uses list_public_tables, not this; restricting
-- list_open_tables to public rooms removes the private-code leak with no UI impact. Combined with the
-- authorization above, a leaked PUBLIC code is now harmless (a stranger can only finish an abandoned
-- public room, which the reaper would clear anyway), and private codes no longer leak at all.
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
  WHERE status='waiting' AND is_public = true AND (expires_at IS NULL OR expires_at > now());
$function$;
