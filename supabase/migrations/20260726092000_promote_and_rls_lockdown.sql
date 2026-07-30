-- SERVER-DEAL-PHASE-A — promote CAS + RLS write lockdown (E1 / E4).
-- BRANCH ONLY — NOT APPLIED TO THE SHARED PROJECT (Iron Rule 11).

-- ═══ 1. PROMOTE: compare-and-swap 'starting' -> 'playing' ════════════════════════════════════════
-- Called by the client that got autostarted:true (or any seated client as backup) AFTER deal_hand
-- returns its slice. The CAS is the whole point: a SLOW DEAL THAT LANDS AFTER THE REAPER ALREADY
-- REVERTED CANNOT RESURRECT THE ROOM — the UPDATE is conditioned on status still being 'starting', so
-- it matches 0 rows and returns not_starting. Double-promote is likewise a harmless no-op.
CREATE OR REPLACE FUNCTION public.promote_starting_to_playing(p_room_id uuid, p_hand_id text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_room game_rooms; v_expected text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_session'); END IF;

  -- only a SEATED player may promote (same authz shape as the deal EF: verified uid + server roster)
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN
    RETURN jsonb_build_object('ok',false,'error','not_seated');
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE id=p_room_id FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  IF v_room.status <> 'starting' THEN
    -- already promoted, or the reaper reverted/abandoned it while the deal was in flight
    RETURN jsonb_build_object('ok',false,'error','not_starting','status',v_room.status);
  END IF;

  -- Bind the hand to the CURRENT hand_seq, so a stale hand_id from a previous round (a deck that was
  -- already reaped) can never promote the room. Anchored on hand_seq, NOT starting_at — this promote
  -- nulls starting_at, so anchoring there would destroy the anchor for the next hand (F1).
  v_expected := v_room.id::text || ':' || v_room.hand_seq::text;
  IF p_hand_id IS DISTINCT FROM v_expected THEN
    RETURN jsonb_build_object('ok',false,'error','stale_hand');
  END IF;

  -- the authoritative deal must actually exist before we let anyone play
  IF to_regclass('public.dealt_hands') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM dealt_hands WHERE hand_id = p_hand_id) THEN
    RETURN jsonb_build_object('ok',false,'error','no_deal');
  END IF;

  -- hand_seq is deliberately PRESERVED here — it is the anchor for the NEXT hand's id.
  UPDATE game_rooms
    SET status='playing', started_at=now(), starting_at=NULL
    WHERE id=p_room_id AND status='starting';           -- <<< the compare-and-swap
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','not_starting');
  END IF;

  RETURN jsonb_build_object('ok',true,'status','playing','hand_id',p_hand_id,'hand_seq',v_room.hand_seq);
END; $function$;

-- ═══ 1b. HANDS 2+ : begin_next_hand (F2) ═════════════════════════════════════════════════════════
-- The autostart election ("the single client whose join_table returned autostarted:true") exists ONLY
-- at fill. On hand #2 nobody joins, so nobody receives that signal. TODAY hands 2+ never reach the DB
-- at all: RealtimeServer.startNewHand() -> startGame() just does `this.handId++` in memory while the
-- room sits at 'playing', so the elector is implicitly the MP HOST (the one client holding the
-- RealtimeServer instance = the first joiner, is_host).
--
-- Relying on that host is fragile: on a public pool table is_host is the FIRST joiner, and
-- leave_table/evict_ghost_seats can remove that player mid-table, after which nothing would ever start
-- hand #2. So this RPC does NOT require host: ANY seated player may call it, and the COMPARE-AND-SWAP
-- makes the election deterministic and single-valued without coordination —
--   * exactly one caller can win the 'playing' -> 'starting' transition (row-locked CAS);
--   * every other caller reads the SAME resulting row -> the SAME hand_seq -> the SAME hand_id, and
--     deal_hand is create-or-get on that id, so they all converge on ONE deal, never a re-deal;
--   * if the winner then dies before promoting, the 45s reaper recovers the room exactly as it does
--     for hand #1.
-- (Host departure remains a pre-existing weakness of the realtime layer itself — the RealtimeServer
--  object is what actually broadcasts — but it is no longer able to strand the DEAL path.)
-- G1 — GRIEFING GUARD (this RPC was UNSAFE as first written). "Any seated player may call" + a CAS
-- proves exactly one caller WINS; it does NOT ask whether that caller may call AT ALL. A player staring
-- at a losing board could call it, advance hand_seq, orphan the in-flight hand_id and destroy the hand
-- everyone was playing — repeatable at will, at no cost. That is worse than the peeking it replaces.
-- Guards now required to advance:
--   1. UNANIMITY — every seated player must have requested the next hand (request_next_hand below).
--      This mirrors RealtimeServer's existing in-memory rule (nextHandRequests.size >= connected.length,
--      realtimeMultiplayer.ts:526-531) but ENFORCES it server-side, so one player cannot reset a hand.
--   2. MIN INTERVAL — at least MIN_HAND_SECONDS (10s) since the hand started, as a cheap secondary
--      guard against rapid-fire resets even with collusion.
--   3. RATE LIMIT — at most one advance per room per MIN_HAND_SECONDS window (implied by 2, since
--      started_at only moves on promote), and request_next_hand is idempotent per uid so spamming it
--      cannot inflate the ack set.
-- HONEST LIMIT: completion is still CLIENT-ASSERTED. The DB has no notion of a finished hand because
-- the engine is in memory (see the Phase-A scope statement), so unanimity raises the bar from "any one
-- player" to "the whole table" but cannot prove the hand truly ended. A real completion signal requires
-- server-side evaluation = Phase B.
CREATE OR REPLACE FUNCTION public.request_next_hand(p_room_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_room game_rooms; v_acks jsonb; v_seated int; v_have int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_session'); END IF;
  SELECT * INTO v_room FROM game_rooms WHERE id=p_room_id FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN
    RETURN jsonb_build_object('ok',false,'error','not_seated');
  END IF;
  IF v_room.status <> 'playing' THEN
    RETURN jsonb_build_object('ok',false,'error','not_playing','status',v_room.status);
  END IF;

  -- idempotent per uid: re-requesting cannot inflate the ack set
  v_acks := v_room.next_hand_acks;
  IF NOT (v_acks @> to_jsonb(v_uid::text)) THEN
    v_acks := v_acks || to_jsonb(v_uid::text);
    UPDATE game_rooms SET next_hand_acks = v_acks WHERE id = p_room_id;
  END IF;

  SELECT count(*) INTO v_seated FROM room_players WHERE room_id=p_room_id;
  SELECT count(*) INTO v_have FROM room_players rp
    WHERE rp.room_id=p_room_id AND v_acks @> to_jsonb(rp.user_id::text);
  RETURN jsonb_build_object('ok',true,'acks',v_have,'seated',v_seated,'unanimous',(v_have >= v_seated));
END; $function$;

CREATE OR REPLACE FUNCTION public.begin_next_hand(p_room_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_room game_rooms; v_seated int; v_have int;
  MIN_HAND_SECONDS constant int := 10;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_session'); END IF;
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN
    RETURN jsonb_build_object('ok',false,'error','not_seated');
  END IF;

  SELECT * INTO v_room FROM game_rooms WHERE id=p_room_id FOR UPDATE;
  IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;

  -- G1.2 minimum inter-hand interval (started_at only moves on promote, so this also rate-limits
  -- advances to one per window per room)
  IF v_room.started_at IS NOT NULL AND v_room.started_at > now() - make_interval(secs => MIN_HAND_SECONDS) THEN
    RETURN jsonb_build_object('ok',false,'error','too_soon');
  END IF;

  -- G1.1 UNANIMITY: every seated player must have acked at this hand_seq
  SELECT count(*) INTO v_seated FROM room_players WHERE room_id=p_room_id;
  SELECT count(*) INTO v_have FROM room_players rp
    WHERE rp.room_id=p_room_id AND v_room.next_hand_acks @> to_jsonb(rp.user_id::text);
  IF v_seated = 0 OR v_have < v_seated THEN
    RETURN jsonb_build_object('ok',false,'error','not_unanimous','acks',v_have,'seated',v_seated);
  END IF;

  -- CAS 'playing' -> 'starting' + bump the anchor + clear the acks for the new hand.
  UPDATE game_rooms
    SET status='starting', starting_at=now(), hand_seq = hand_seq + 1, next_hand_acks='[]'::jsonb
    WHERE id=p_room_id AND status='playing'
    RETURNING * INTO v_room;

  IF v_room.id IS NULL THEN
    -- someone else already began this hand (or the room is not playable) — return the CURRENT row so
    -- every caller still converges on the same hand_id.
    SELECT * INTO v_room FROM game_rooms WHERE id=p_room_id;
    IF v_room.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
    IF v_room.status <> 'starting' THEN
      RETURN jsonb_build_object('ok',false,'error','not_playing','status',v_room.status);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'status',v_room.status,'hand_seq',v_room.hand_seq,
    'hand_id', v_room.id::text || ':' || v_room.hand_seq::text);
END; $function$;

-- ═══ 2. RLS WRITE LOCKDOWN ═══════════════════════════════════════════════════════════════════════
-- E4: my D3 fix (reliably populating room_players.user_id) ARMS policies that were dormant only
-- because user_id was unreliable. RLS cannot scope COLUMNS, so a membership-only UPDATE policy grants
-- the whole row:
--
--   rooms_host_or_player_update  UPDATE TO authenticated
--     USING/WITH CHECK: host_id = auth.uid() OR EXISTS (SELECT 1 FROM room_players
--                       WHERE room_id = game_rooms.id AND user_id = auth.uid())
--   -> any seated player could UPDATE status / game_config / current_players / max_players /
--      started_at / host_id / is_public. Once the deal is gated on status, that player could promote
--      their OWN room (bypassing the deal entirely) or rewrite game_config.numberOfPlayers to change
--      the board count mid-table.
--
--   players_update_own  UPDATE TO authenticated  USING/WITH CHECK: user_id = auth.uid()
--   -> a seated player could rewrite their OWN seat_index or is_host. seat_index is now an AUTHZ INPUT
--      (the EF snapshots room_players into seat_user_ids and returns the slice for the caller's seat),
--      so a player who can rewrite seat_index could request a DIFFERENT seat's cards THROUGH the
--      roster check — defeating the A1 fix by the back door. This is the sharpest one.
--
--   "Anyone can join rooms"  INSERT TO public  WITH CHECK: true
--   -> anyone could INSERT an arbitrary room_players row and seat THEMSELVES in any room, which is a
--      direct path into the deal roster. (Found during this audit; same class.)
--
--   players_leave_own  DELETE  /  game_rooms_authenticated_insert  INSERT
--   -> a direct DELETE bypasses leave_table's current_players decrement, desyncing the counter and
--      producing exactly the un-joinable full room E2 is about; direct room INSERT bypasses create_table.
--
-- FIX (preferred option from the brief): revoke DIRECT writes entirely and route every transition
-- through the SECURITY DEFINER RPCs, which bypass RLS. This is safe because the client performs ZERO
-- direct writes — verified by grep over app/ utils/ components/ hooks/ store/: every reference to
-- game_rooms / room_players is a COMMENT, and all traffic goes through list_public_tables,
-- ensure_public_lobby, create_table, join_table, leave_table, touch_room_player, finish_table
-- (utils/lobbyApi.ts even documents the invariant: "Writes never go directly to game_rooms").
-- SELECT policies are deliberately KEPT — reads are harmless and realtime subscriptions rely on them.
DROP POLICY IF EXISTS rooms_host_or_player_update      ON public.game_rooms;
DROP POLICY IF EXISTS game_rooms_authenticated_insert  ON public.game_rooms;
DROP POLICY IF EXISTS players_update_own               ON public.room_players;
DROP POLICY IF EXISTS players_leave_own                ON public.room_players;
DROP POLICY IF EXISTS "Anyone can join rooms"          ON public.room_players;

COMMENT ON TABLE public.game_rooms IS
  'Room state. NO direct client writes: RLS grants SELECT only. Every transition goes through SECURITY DEFINER RPCs (create_table / join_table / leave_table / promote_starting_to_playing / finish_table) + the reaper crons. Do NOT re-add a membership-based UPDATE policy — RLS cannot scope columns, so it would grant status/game_config/max_players to any seated player.';
COMMENT ON TABLE public.room_players IS
  'Roster. NO direct client writes: RLS grants SELECT only. seat_index is an AUTHZ INPUT for deal_hand (seat -> which hole cards you receive), so a client-writable seat_index would let a player request another seat''s slice. Seats change only via join_table / leave_table / touch_room_player / the reapers.';
