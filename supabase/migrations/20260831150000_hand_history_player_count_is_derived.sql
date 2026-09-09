-- CLOSE-THE-SIX 2026-08-31 — hand_history.player_count stops being a column default pretending
-- to be data.
--
-- ═══ WHAT WAS INVALIDATED — STATED BEFORE ANYTHING IS CHANGED ════════════════════════════════
-- `record_hand_result_d(p_device_id, p_won, p_boards_won, p_boards_total, p_session_type,
-- p_client_hand_id)` is the ONLY writer of this table, and it has no player_count parameter and
-- never names the column. So all 73 rows take DEFAULT 2 — including 10 rows whose boards_total is
-- 3 (a three-player hand) and 2 whose boards_total is 2 (four players). The value is not wrong
-- occasionally; it has never once been written.
--
-- WHAT THAT DOES **NOT** INVALIDATE. Nothing on any screen. The `player_count` references in the
-- app are `game_rooms.player_count` (lobby/club table sizing) and an analytics event property —
-- a different column on a different table. No shipped surface reads this one.
--
-- WHAT IT DOES INVALIDATE — every breakdown of hand_history by table size, ours included:
--   * docs/DEPLOY-THE-SEAT-FIX-2026-08-27.md §6 published "2 players real 71 rows, tied 0 |
--     3 players real 42, tied 0 | 4 players real 28, tied 0" and concluded "NO TIE HAS EVER BEEN
--     RECORDED IN REAL PLAY AT ANY TABLE SIZE". A per-table-size split cannot come from a
--     constant, and the row counts do not reconcile with the 73 rows present today either.
--   * ⚠️ AND THE CONCLUSION IS NOW FALSE ON ITS OWN TERMS. Reading `boards_total`, which IS
--     written: ONE TIE HAS BEEN RECORDED IN REAL PLAY — device c0bd-67d6-1f6f, 2026-08-28,
--     boards_total 4 (a two-player hand), and that device is not in v_harness_devices.
--   * handoff 130 said "zero hands ever recorded at 3 or 4 players". That was corrected inside the
--     same document via boards_total and the corrected reading is confirmed again here: of 22 real
--     rows, 2 are four-player, 10 three-player, 10 two-player.
--
-- ═══ THE TRUTH LIVES IN boards_total, SO DERIVE FROM IT ══════════════════════════════════════
-- boards_total IS a parameter and IS written, and the board count determines the player count
-- exactly — it is the inverse of getBoardCount() in constants/gameConfig.ts (2P=4, 3P=3, 4P=2).
-- Deriving is better than adding a parameter here: a new parameter needs a client change and a
-- build, and this sprint ships neither.
--
-- The 51 April rows carry boards_total = 5, which is not a legal board count in this game at any
-- table size — they predate the parameter and took ITS default too. They derive to NULL, which is
-- the honest answer for "unknown", and both defaults are dropped so no future row can inherit a
-- fiction.

-- 1. STOP THE COLUMNS LYING ON NEW ROWS.
ALTER TABLE public.hand_history ALTER COLUMN player_count DROP DEFAULT;
ALTER TABLE public.hand_history ALTER COLUMN boards_total DROP DEFAULT;

-- 2. THE HISTORY. Derive where boards_total is a legal board count; NULL where it is not, because
--    "unknown" is a true statement and "2" was not. Nothing is lost: boards_total is untouched and
--    the derivation is reversible.
UPDATE public.hand_history
   SET player_count = CASE boards_total WHEN 4 THEN 2 WHEN 3 THEN 3 WHEN 2 THEN 4 ELSE NULL END;

-- 3. AND WRITE IT GOING FORWARD. Only the INSERT column list and one CASE change; every guard,
--    the idempotency check, the duplicate return shape and the result JSON are byte-identical.
CREATE OR REPLACE FUNCTION public.record_hand_result_d(p_device_id text, p_won boolean, p_boards_won integer DEFAULT 0, p_boards_total integer DEFAULT 0, p_session_type text DEFAULT 'practice'::text, p_client_hand_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_hand_number integer; v_session_type text;
  v_chips_delta integer; v_rows integer; v_result text; v_player_count integer;
BEGIN
  v_session_type := COALESCE(NULLIF(p_session_type, ''), 'practice');
  IF v_session_type NOT IN ('sng','quick_poker','practice','custom','multiplayer') THEN
    v_session_type := 'practice';
  END IF;

  IF p_client_hand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM hand_history WHERE device_id = p_device_id AND client_hand_id = p_client_hand_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true,
      'elo_delta', COALESCE((SELECT elo_last_delta FROM leaderboard WHERE device_id = p_device_id), 0));
  END IF;

  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;
  SELECT COALESCE(MAX(hand_number),0)+1 INTO v_hand_number FROM hand_history WHERE device_id = p_device_id;
  v_chips_delta := CASE WHEN v_session_type = 'practice' THEN 0 ELSE NULL END;
  v_result := CASE WHEN p_won IS NULL THEN 'tied' WHEN p_won THEN 'won' ELSE 'lost' END;

  -- CLOSE-THE-SIX 2026-08-31 — derived, not defaulted. The inverse of getBoardCount(): 2P=4
  -- boards, 3P=3, 4P=2. Anything else is NULL, because an illegal board count cannot tell us the
  -- table size and a guess here is what produced 73 rows of fiction.
  v_player_count := CASE p_boards_total WHEN 4 THEN 2 WHEN 3 THEN 3 WHEN 2 THEN 4 ELSE NULL END;

  INSERT INTO hand_history (
    user_id, device_id, session_type, hand_number, result, chips_delta,
    boards_won, boards_total, player_count, created_at, client_hand_id
  ) VALUES (
    v_user_id, p_device_id, v_session_type, v_hand_number, v_result, v_chips_delta,
    p_boards_won, p_boards_total, v_player_count, NOW(), p_client_hand_id
  ) ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true,
      'elo_delta', COALESCE((SELECT elo_last_delta FROM leaderboard WHERE device_id = p_device_id), 0));
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'hand_number', v_hand_number, 'result', v_result,
    'boards_won', p_boards_won, 'boards_total', p_boards_total,
    'player_count', v_player_count,
    'session_type', v_session_type, 'chips_delta', v_chips_delta,
    'elo_delta', COALESCE((SELECT elo_last_delta FROM leaderboard WHERE device_id = p_device_id), 0)
  );
END; $function$;

COMMENT ON COLUMN public.hand_history.player_count IS
  'DERIVED from boards_total by record_hand_result_d (2P=4 boards, 3P=3, 4P=2); NULL when '
  'boards_total is not a legal board count. It was a DEFAULT 2 until 2026-08-31 and had never been '
  'written — every breakdown of this table by table size before that date read a constant. See '
  'migration 20260831150000.';
COMMENT ON COLUMN public.hand_history.boards_total IS
  'Boards in the hand: 4 at two players, 3 at three, 2 at four. Written by record_hand_result_d. '
  'Rows carrying 5 predate the parameter and took its old (illegal) default.';
