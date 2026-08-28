-- ============================================================================================
-- 32% OF THE MONEY IN THE GAME HAD NO LEDGER ROW.
--
--     float  (sum of leaderboard.total_chips) : 1,219,217
--     ledger (sum of chip_transactions.amount):   834,724
--     UNTRACKED                                :   384,493   = 31.5%
--
-- Every economic report ever produced for this project was missing roughly a third, including
-- the two I wrote. Before money exists, the ledger must explain the balance — otherwise a
-- purchase dispute has nothing to appeal to.
--
-- ── IT IS NOT A FUNCTION. IT IS A COLUMN DEFAULT. ───────────────────────────────────────────
-- I expected to find the grant inside ensure_leaderboard_row(). Its entire body is:
--
--     INSERT INTO leaderboard (device_id) VALUES (p_device_id) ON CONFLICT DO NOTHING;
--
-- The 2,000 comes from `leaderboard.total_chips DEFAULT 2000`. So it is not one function that
-- forgets to write a ledger row — ANY INSERT INTO leaderboard MINTS 2,000 SILENTLY, from any of
-- the paths that create a row and from any path added later. Fixing ensure_leaderboard_row alone
-- would have left every other door open.
--
-- ── SO IT IS A TRIGGER, NOT AN EDIT ─────────────────────────────────────────────────────────
-- One place, catching every insert path that exists or will exist. That is the same
-- single-writer discipline the play grant follows, applied to the one event that had no writer
-- at all.
--
-- THE ORDERING THIS DEPENDS ON, STATED BECAUSE IT IS LOAD-BEARING: record_hand_net writes its
-- chip_transactions rows (play_grant, hand_net, rake) BEFORE its INSERT INTO leaderboard. So
-- "this device has no ledger rows yet" cleanly separates a genuine opening balance from a row
-- created as a side effect of settling a hand. Without that test the trigger would DOUBLE-COUNT
-- a new player's first hand: once as settlement and again as an opening grant.
--
-- ── NOT BACKFILLED ──────────────────────────────────────────────────────────────────────────
-- The existing 384,493 stays untracked and no balance is adjusted. Inventing 534 historical
-- rows would replace a known gap with a fabricated record, which is worse. The cutoff is
-- recorded below, as it was for the MP relabel, the tie rows and the build table.
-- ============================================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_starting_grant_ref
  ON public.chip_transactions (device_id, reference_id)
  WHERE event_type = 'starting_grant' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ledger_starting_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Nothing to record for a row that opens at zero.
  IF COALESCE(NEW.total_chips, 0) = 0 THEN RETURN NEW; END IF;

  -- THE GUARD THAT PREVENTS DOUBLE-COUNTING. A leaderboard row created as a side effect of
  -- settling a hand already has its ledger rows (record_hand_net writes them first). Only a row
  -- whose device has NO ledger history at all is a genuine opening balance.
  IF EXISTS (SELECT 1 FROM chip_transactions WHERE device_id = NEW.device_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO chip_transactions (device_id, amount, event_type, action, description, reference_id)
  VALUES (NEW.device_id, NEW.total_chips, 'starting_grant', 'credit',
          'opening balance (leaderboard.total_chips default)', 'start:' || NEW.device_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_ledger_starting_grant ON public.leaderboard;
CREATE TRIGGER trg_ledger_starting_grant
  AFTER INSERT ON public.leaderboard
  FOR EACH ROW EXECUTE FUNCTION public.ledger_starting_grant();

COMMENT ON FUNCTION public.ledger_starting_grant() IS
  'Writes the chip_transactions row for the opening balance that leaderboard.total_chips DEFAULT '
  '2000 mints on every insert. A trigger rather than an edit to ensure_leaderboard_row, because '
  'the grant is a COLUMN DEFAULT and at least six paths insert into leaderboard. Skips rows whose '
  'device already has ledger history, which is what separates a real opening balance from a row '
  'created while settling a hand (record_hand_net writes its ledger rows first).';

-- ── THE CUTOFF, RECORDED RATHER THAN INVENTED ───────────────────────────────────────────────
INSERT INTO app_config (key, value) VALUES
  ('ledger_untracked_cutoff',
   '"Opening balances were UNLEDGERED before 2026-08-28. Untracked at cutoff: 384,493 chips (float 1,219,217 vs ledger 834,724) across 534 leaderboard rows. NOT backfilled — the gap is recorded, not invented. From 2026-08-28 every NEW leaderboard row writes a starting_grant row via trg_ledger_starting_grant. Reconciliation is only exact for devices created after the cutoff, and only once the five other unledgered writers named in docs/THE-SINK-2026-08-28.md are closed."'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

COMMENT ON COLUMN public.leaderboard.total_chips IS
  'Opening balance is minted by this column DEFAULT (2000), not by any function. Every insert '
  'therefore mints chips; trg_ledger_starting_grant records it. Cutoff 2026-08-28 — see '
  'app_config.ledger_untracked_cutoff for the untracked amount before that date.';
