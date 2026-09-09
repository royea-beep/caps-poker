-- TWO-CURRENCIES-AND-RESET — 2026-09-01 — reset the REAL balance clean, float = ledger from zero.
--
-- ═══ WHAT THIS DOES, AND WHY IT IS SHAPED THIS WAY ══════════════════════════════════════════════
-- Roye approved a clean reset before testers arrive, so the real currency has real scarcity — every
-- device (his own account and the six real bindings included) starts equal at the same value a brand-
-- new tester gets. Only the REAL balance resets. Nothing else moves.
--
-- THE REAL BALANCE is exactly one column: leaderboard.total_chips (integer). `leaderboard.chips` is a
-- GENERATED ALWAYS column (= total_chips), a read-alias, so it follows automatically and is never
-- written directly. Practice is NOT in this table at all — it is client-local and chip-neutral
-- (results.tsx settles practice hands with record_hand_net net 0), so a reset of the real balance does
-- not touch practice by construction.
--
-- ═══ WHY A CLEAN BASELINE, NOT A DELTA ══════════════════════════════════════════════════════════
-- Today float (Σ leaderboard.total_chips) minus ledger (Σ chip_transactions.amount) = 335,330 of
-- unrecorded float. Writing the reset as per-device DELTAS (start − current) would move float and
-- ledger by the SAME amount and LEAVE the 335,330 gap intact — recreating exactly the bug this is
-- meant to end. So this re-baselines: it ARCHIVES the whole ledger (history preserved, not lost),
-- sets every balance to the starting value, and writes ONE opening-balance ledger row per device.
-- After it, for every device total_chips = starting AND its ledger sums to starting, so float = ledger
-- globally and per-device, and the gap is ZERO from a recorded cutoff.
--
-- ═══ WHAT SURVIVES — ONLY THE BALANCE RESETS ════════════════════════════════════════════════════
--   · identity bindings   device_identity (6 rows)      — untouched
--   · purchased cosmetics  client-local (gameStore/AsyncStorage); purchases/chip_purchases are empty
--                          (payments off) — untouched, ownership is not chips
--   · achievements         achievements (154 rows)       — untouched
--   · hand history         hand_history (71 rows)        — untouched (this is gameplay history, a
--                          DIFFERENT table from the chip_transactions economy ledger being rebaselined)
--   · trophies             device_cups (6 rows)          — untouched
--   · skill / stats        leaderboard.elo, hands_played, hands_won, biggest_win, games_played, wins —
--                          untouched. "Only the balance resets" is literal: only total_chips changes.
-- Practice currency: it has no server state and no meaning, so it starts fresh for free the moment a
-- player opens practice again — nothing to reset here.
--
-- ═══ CONFIG-DRIVEN STARTING VALUE ═══════════════════════════════════════════════════════════════
-- The starting value is read from app_config.starting_chips (added here, = 2000) so it retunes without
-- a deploy, like the faucet. 2000 matches leaderboard.total_chips's column default and the
-- starting_grant the new-device trigger already writes, so a reset device and a brand-new tester begin
-- identical. (Wiring the new-device INSERT path to read this same key is a later, out-of-scope change;
-- the values already agree.)
--
-- No FK references chip_transactions (verified), so re-baselining the ledger is safe. The reset UPDATEs
-- existing leaderboard rows (never INSERTs), so the AFTER-INSERT starting-grant trigger does not fire
-- and cannot double-write. Runs in one transaction — atomic.

-- 1 · config-driven starting value (single source; retunes without a deploy)
INSERT INTO app_config (key, value)
VALUES ('starting_chips', to_jsonb(2000))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DO $reset$
DECLARE
  v_start  integer     := COALESCE((SELECT (value #>> '{}')::int FROM app_config WHERE key = 'starting_chips'), 2000);
  v_cutoff timestamptz := now();
  v_archive text       := 'chip_transactions_prereset_' || to_char(now(), 'YYYYMMDD');
BEGIN
  -- 2 · archive the entire ledger before rebaselining (history preserved, recoverable)
  EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I AS TABLE public.chip_transactions', v_archive);

  -- 3 · reset ONLY the real balance for EVERY device (chips generated column follows; stats/elo untouched)
  UPDATE leaderboard SET total_chips = v_start, updated_at = now();

  -- 4 · re-baseline the ledger so float = ledger and the gap is zero from the recorded cutoff
  DELETE FROM chip_transactions;
  INSERT INTO chip_transactions (device_id, user_id, amount, action, event_type, reference_id, description, created_at)
  SELECT l.device_id,
         (SELECT di.auth_uid FROM device_identity di WHERE di.device_id = l.device_id LIMIT 1),
         v_start, 'credit', 'reset_baseline',
         'reset:' || l.device_id,
         'TWO-CURRENCIES clean reset opening balance (' || to_char(v_cutoff, 'YYYY-MM-DD') || ')',
         v_cutoff
  FROM leaderboard l;

  RAISE NOTICE 'reset: % devices to % chips; float=ledger=%; archive=%',
    (SELECT count(*) FROM leaderboard), v_start,
    (SELECT COALESCE(SUM(total_chips),0) FROM leaderboard), v_archive;
END $reset$;
