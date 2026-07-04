-- PENDING — ONE remaining piece for the STRATEGIST (agent blocked from prod DDL, twice,
-- correctly). Updated 2026-07-04 after the strategist applied lobby_bot_practice_tables
-- (table_kind column ✓, 6 human + 3 bot seeding ✓, submit_score delta clamp ✓).
--
-- REMAINING GAP: list_public_tables does NOT return table_kind (verified:
-- (list_public_tables()->0 ? 'table_kind') = false). Until this lands the client
-- discriminates bot rows by host_name='CAPS Bot' (interim tell; table_kind wins when present).

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
