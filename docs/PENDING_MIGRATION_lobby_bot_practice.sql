-- PENDING — for the STRATEGIST to review + apply (agent was correctly blocked from
-- applying production DDL). LOBBY-BOT-PRACTICE 2026-07-04.
-- Client (feat/lobby-bot-practice) is already live-safe without this: it falls back to
-- static bot rows; these rows just make the lobby pool DB-driven + add table_kind.
-- ALSO WANTED (same batch, per owner): submit_score delta clamp — reject/clamp any
-- single-call total_chips INCREASE above +1000 (max legit game win is a few hundred;
-- daily bonus flows through the ledgered earn path, not submit_score).

ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS table_kind text NOT NULL DEFAULT 'human';
DO $$ BEGIN
  ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_table_kind_chk CHECK (table_kind IN ('human','bot_practice'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- list_public_tables: expose table_kind (additive — old clients ignore it)
CREATE OR REPLACE FUNCTION public.list_public_tables()
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',id,'room_code',room_code,'host_name',host_name,'status',status,
    'current_players',current_players,'max_players',max_players,
    'player_count',max_players,'game_config',game_config,'created_at',created_at,
    'table_kind',table_kind
  ) ORDER BY max_players, created_at), '[]'::jsonb)
  FROM game_rooms WHERE is_public AND status='waiting';
$function$;

-- ensure_public_lobby: count only HUMAN tables for the 2-per-size pool (bot rows must
-- not starve the human pool) + self-heal ONE bot_practice row per size.
-- Interactions verified: cleanup_expired_rooms never touches expires_at NULL rows;
-- evict_ghost_seats only touches room_players rows (bot rows have none).
CREATE OR REPLACE FUNCTION public.ensure_public_lobby()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pc int; have int; need int; created int := 0; v_code text; i int; bots int;
BEGIN
  FOREACH pc IN ARRAY ARRAY[2,3,4] LOOP
    SELECT count(*) INTO have FROM game_rooms
      WHERE is_public AND status='waiting' AND max_players=pc AND table_kind='human';
    need := 2 - have;
    WHILE need > 0 LOOP
      LOOP
        v_code := '';
        FOR i IN 1..4 LOOP
          v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random()*32)::int + 1, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code=v_code AND status IN ('waiting','starting','playing'));
      END LOOP;
      INSERT INTO game_rooms (room_code, host_id, host_name, status, player_count, current_players,
        max_players, game_config, is_public, expires_at, table_kind)
      VALUES (v_code, NULL, 'Open Table', 'waiting', pc, 0, pc,
        jsonb_build_object('numberOfPlayers', pc), true, NULL, 'human');
      created := created + 1; need := need - 1;
    END LOOP;

    SELECT count(*) INTO bots FROM game_rooms
      WHERE is_public AND status='waiting' AND max_players=pc AND table_kind='bot_practice';
    IF bots = 0 THEN
      LOOP
        v_code := '';
        FOR i IN 1..4 LOOP
          v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random()*32)::int + 1, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code=v_code AND status IN ('waiting','starting','playing'));
      END LOOP;
      INSERT INTO game_rooms (room_code, host_id, host_name, status, player_count, current_players,
        max_players, game_config, is_public, expires_at, table_kind)
      VALUES (v_code, NULL, 'CAPS Bot', 'waiting', pc, 1, pc,
        jsonb_build_object('numberOfPlayers', pc), true, NULL, 'bot_practice');
      created := created + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'created', created);
END; $function$;

SELECT public.ensure_public_lobby();
