-- join_table IDENTITY HARDENING — gated, INERT ON APPLY. No dealing involved.
--
-- DEFECT: join_table takes the caller's identity as a CLIENT-SUPPLIED PARAMETER (p_player_id uuid) and
-- writes it straight into room_players.user_id. Two consequences:
--   1. SPOOFABLE — a caller can claim a seat as any uuid it likes.
--   2. NULL is silently accepted, so the seat becomes unattributable. (Today the client resolves
--      auth.uid() with a FIRE-AND-FORGET getUser(), so a fast joiner genuinely lands with user_id NULL.)
-- Unattributable seats are also what makes the dropped RLS policies only *partly* exploitable — i.e.
-- the safety there is luck. Fixing identity is what turns that luck into a control.
--
-- FIX: derive the identity from auth.uid() INSIDE the function (works in SECURITY DEFINER: it reads the
-- verified JWT claim) and IGNORE the parameter. p_player_id stays in the signature so existing call
-- sites keep compiling, but it is no longer trusted.
--
-- KILL-SWITCH (a migration has no rollback switch; app_config does): the whole behaviour change is
-- gated on app_config.join_requires_session, DEFAULT FALSE.
--   FALSE (default, and the state this migration is applied in) -> LEGACY: identity is
--     COALESCE(auth.uid(), p_player_id), i.e. byte-identical to today's behaviour plus the free
--     improvement that a verified uid wins over the client-supplied one when one exists. Applying this
--     migration therefore changes NOTHING observable.
--   TRUE -> HARDENED: identity is auth.uid() ONLY, p_player_id ignored, NULL uid rejected ('no_session').
--   ROLLBACK = set the flag back to false. No migration, no deploy, seconds.
-- ROLLOUT LADDER: apply (inert) -> confirm clients resolve their anon session before joining -> flip
--   join_requires_session -> watch join success rate -> flip back instantly if it regresses.
--
-- WHY NOT REJECT NULL UNCONDITIONALLY: CAPS runs anonymous auth (utils/auth.ts signInAnonymously; 1798
-- is_anonymous users live, 430 active/30d) so "most" clients have a uid — but "most" is not "all". An
-- auth outage or an offline first-launch that used to seat via device_id would otherwise fail to join
-- at all. The flag makes that a deliberate, reversible decision instead of a silent one.
--
-- DEVICE_ID PATH PRESERVED IN BOTH MODES: today's idempotency and club-membership checks are
-- `(p_player_id IS NOT NULL AND user_id=...) OR (p_device_id IS NOT NULL AND device_id=...)`. Both OR
-- branches are kept below, so an idempotent rejoin after an app restart and a device-identified club
-- member still work with the flag either way. Only the INSERT identity and the NULL rejection change.

CREATE OR REPLACE FUNCTION public.join_table(
  p_room_code text,
  p_player_id uuid DEFAULT NULL::uuid,   -- IGNORED when join_requires_session = true
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
  v_uid uuid; v_identity uuid;
  v_strict boolean := COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='join_requires_session'), false);
BEGIN
  v_uid := auth.uid();

  IF v_strict THEN
    IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_session'); END IF;
    v_identity := v_uid;                        -- verified JWT only; parameter not trusted
  ELSE
    v_identity := COALESCE(v_uid, p_player_id); -- legacy: exactly today's behaviour
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE room_code=upper(p_room_code) AND status='waiting'
    AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','table_full_or_gone'); END IF;

  -- idempotent: already seated (identity OR device — device branch preserved for rejoin-after-restart)
  IF EXISTS (SELECT 1 FROM room_players WHERE room_id=v_room.id
       AND ((v_identity IS NOT NULL AND user_id=v_identity) OR (p_device_id IS NOT NULL AND device_id=p_device_id))) THEN
    RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
      'max_players',v_room.max_players,'status',v_room.status,'autostarted',false,'already_joined',true,'game_config',v_room.game_config);
  END IF;

  -- club tables are members-only at the JOIN gate too (identity OR device — preserved)
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
  IF v_room.current_players >= v_room.max_players THEN
    UPDATE game_rooms SET status='playing', started_at=now() WHERE id=v_room.id RETURNING * INTO v_room;
    IF v_room.is_public THEN PERFORM public.ensure_public_lobby(); END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'id',v_room.id,'room_code',v_room.room_code,'current_players',v_room.current_players,
    'max_players',v_room.max_players,'status',v_room.status,'autostarted',(v_room.status='playing'),'is_host',v_is_host,
    'seat_index',v_seat,'game_config',v_room.game_config);
END; $function$;
