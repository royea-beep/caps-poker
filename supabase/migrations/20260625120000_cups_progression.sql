-- ============================================================================
-- CUPS progression — reproducibility anchor (gap #39).
-- These changes are ALREADY LIVE on prod (applied during the Jun-23 cups fix);
-- this file captures them VERBATIM so a fresh create_branch / rebuild reproduces prod.
-- DO NOT treat as a new change — it is idempotent re-statement of live state.
-- ============================================================================

-- Cup requirements: hands_won thresholds per tier.
UPDATE cups SET requirement_type='hands_won', requirement_value=10  WHERE id='bronze';
UPDATE cups SET requirement_type='hands_won', requirement_value=50  WHERE id='silver';
UPDATE cups SET requirement_type='hands_won', requirement_value=100 WHERE id='gold';
UPDATE cups SET requirement_type='hands_won', requirement_value=150 WHERE id='platinum';
UPDATE cups SET requirement_type='hands_won', requirement_value=200 WHERE id='diamond';

-- check_cups RPC (verbatim from live): evaluates ALL cups, grants chips + best-effort XP.
CREATE OR REPLACE FUNCTION public.check_cups(p_device_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_stats RECORD; v_cup RECORD; v_awarded text[] := '{}'; v_stat_val numeric;
BEGIN
  SELECT hands_won, total_chips FROM leaderboard WHERE device_id=p_device_id INTO v_stats;
  IF v_stats IS NULL THEN RETURN jsonb_build_object('awarded', '{}'); END IF;
  FOR v_cup IN SELECT * FROM cups ORDER BY tier LOOP
    IF NOT EXISTS(SELECT 1 FROM device_cups WHERE device_id=p_device_id AND cup_id=v_cup.id) THEN
      v_stat_val := CASE v_cup.requirement_type
        WHEN 'hands_won'   THEN COALESCE(v_stats.hands_won, 0)
        WHEN 'total_chips' THEN COALESCE(v_stats.total_chips, 0)
        ELSE NULL END;
      IF v_stat_val IS NOT NULL AND v_stat_val >= v_cup.requirement_value THEN
        INSERT INTO device_cups (device_id, cup_id) VALUES (p_device_id, v_cup.id) ON CONFLICT DO NOTHING;
        UPDATE leaderboard SET total_chips = total_chips + v_cup.chip_reward WHERE device_id = p_device_id;
        BEGIN PERFORM public.add_xp(p_device_id, v_cup.xp_reward, 'cup'); EXCEPTION WHEN OTHERS THEN NULL; END;
        v_awarded := array_append(v_awarded, v_cup.id);
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('awarded', v_awarded);
END; $function$;
