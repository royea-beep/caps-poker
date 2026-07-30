-- RLS WRITE LOCKDOWN — game_rooms / room_players. Security fix, standalone, no dealing involved.
--
-- THE HOLE: `rooms_host_or_player_update` is a MEMBERSHIP-ONLY UPDATE policy:
--     UPDATE TO authenticated
--     USING/WITH CHECK: host_id = auth.uid()
--                    OR EXISTS (SELECT 1 FROM room_players
--                               WHERE room_id = game_rooms.id AND user_id = auth.uid())
-- RLS cannot scope COLUMNS, so membership grants the WHOLE ROW: any seated authenticated player can
-- UPDATE status, game_config, current_players, max_players, started_at, host_id, is_public of their
-- own room. e.g. rewrite game_config.numberOfPlayers to change the board count mid-table, or flip
-- status to strand/steal a table.
--
-- WHY IT IS ONLY PARTLY EXPLOITABLE TODAY — AND WHY THAT IS NOT A CONTROL: it depends on
-- room_players.user_id being populated, which is unreliable because the client resolves auth.uid()
-- with a fire-and-forget getUser(). That is LUCK, not a control: any change that makes uid population
-- reliable (e.g. the identity hardening in the sibling migration) arms this policy fully.
--
-- SAME CLASS, ALSO DROPPED:
--   players_update_own  (UPDATE room_players USING user_id = auth.uid())
--     -> a seated player could rewrite their OWN seat_index or is_host. seat_index decides which hole
--        cards a seat is entitled to, so a writable seat_index is a seat-swap primitive.
--   "Anyone can join rooms"  (INSERT room_players TO public WITH CHECK true)
--     -> ANYONE could insert an arbitrary roster row and seat themselves in ANY room. Unauthenticated.
--   players_leave_own  (DELETE room_players USING user_id = auth.uid())
--     -> a direct DELETE bypasses leave_table's current_players decrement, desyncing the counter and
--        leaving a room that reads FULL with an empty seat: un-joinable and un-startable.
--   game_rooms_authenticated_insert  (INSERT game_rooms WITH CHECK auth.uid() IS NOT NULL)
--     -> any authenticated client could mint arbitrary rooms, bypassing create_table.
--
-- WHY DROPPING IS SAFE: the client performs ZERO direct writes to either table. Verified by grep over
-- app/ utils/ components/ hooks/ store/ — `from('game_rooms')` and `from('room_players')` return no
-- hits at all (the only `.from(` match in the sweep is `Array.from` in a test). Every write already
-- goes through SECURITY DEFINER RPCs, which bypass RLS: create_table, join_table, leave_table,
-- touch_room_player, finish_table, ensure_public_lobby, evict_ghost_seats, list_public_tables — all
-- confirmed prosecdef=true. utils/lobbyApi.ts even documents the invariant: "Writes never go directly
-- to game_rooms ... only via these RPCs."
--
-- SELECT POLICIES ARE DELIBERATELY RETAINED ("Anyone can read rooms" / "Anyone can read room_players").
-- Reads are harmless, and postgres_changes replication authorises off SELECT — so realtime delivery is
-- unaffected by dropping WRITE policies. (Note: the app's MP layer does not even use postgres_changes;
-- it rides Supabase Realtime BROADCAST channels — verified by grep: every subscription is
-- `.on('broadcast', ...)`, zero `postgres_changes` — so it is doubly insulated from this change.)

DROP POLICY IF EXISTS rooms_host_or_player_update      ON public.game_rooms;
DROP POLICY IF EXISTS game_rooms_authenticated_insert  ON public.game_rooms;
DROP POLICY IF EXISTS players_update_own               ON public.room_players;
DROP POLICY IF EXISTS players_leave_own                ON public.room_players;
DROP POLICY IF EXISTS "Anyone can join rooms"          ON public.room_players;

COMMENT ON TABLE public.game_rooms IS
  'Room state. NO direct client writes: RLS grants SELECT only. Every transition goes through SECURITY DEFINER RPCs (create_table / join_table / leave_table / finish_table) + the reaper crons. Do NOT re-add a membership-based UPDATE policy — RLS cannot scope columns, so it would grant status/game_config/max_players to any seated player.';
COMMENT ON TABLE public.room_players IS
  'Roster. NO direct client writes: RLS grants SELECT only. seat_index decides which hole cards a seat is entitled to, so a client-writable seat_index would be a seat-swap primitive. Seats change only via join_table / leave_table / touch_room_player / the reapers.';
