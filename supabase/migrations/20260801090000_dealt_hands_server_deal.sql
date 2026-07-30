-- SERVER-DEAL-PHASE-A — server-only storage of the authoritative deal + retention.
--
-- NOT APPLIED TO THE SHARED PROJECT. Branch-only migration (Iron Rule 11). Inert until the deal_hand
-- Edge Function is deployed (verify_jwt=TRUE) AND app_config.server_deal_enabled is turned on.
--
-- RLS is enabled with NO policies -> anon/authenticated roles get ZERO access. Only the deal_hand EF
-- (service_role, bypasses RLS) reads/writes. NOTE: RLS is therefore decorative for the deck — the EF's
-- JWT+roster authz (authz.ts) is the real gate. Do NOT add a client-readable policy.

CREATE TABLE IF NOT EXISTS public.dealt_hands (
  hand_id          text PRIMARY KEY,
  room_id          text NOT NULL,
  player_count     int  NOT NULL CHECK (player_count IN (2, 3, 4)),
  seat_user_ids    jsonb NOT NULL,   -- auth.uid() per seat, in seat order (snapshot of room_players at deal time)
  seed_hex         text NOT NULL,    -- SERVER ONLY (revealed in Phase B commit-reveal)
  deck             jsonb NOT NULL,   -- full shuffled 52-card deck — SERVER ONLY
  player_hands     jsonb NOT NULL,   -- every seat's hole cards — SERVER ONLY
  boards           jsonb NOT NULL,   -- incl. closed cards — SERVER ONLY until reveal
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dealt_hands_room_id_idx ON public.dealt_hands (room_id);
CREATE INDEX IF NOT EXISTS dealt_hands_created_at_idx ON public.dealt_hands (created_at);

ALTER TABLE public.dealt_hands ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: absence of any policy denies all client (anon/authenticated) access.

COMMENT ON TABLE public.dealt_hands IS
  'SERVER-DEAL-PHASE-A: authoritative deal storage. RLS-locked (no client access); only deal_hand EF (service_role) reads/writes. Holds the full deck + all hole/closed cards. 24h TTL via caps_cleanup_dealt_hands.';

-- ── A4 RETENTION ─────────────────────────────────────────────────────────────────────────────────
-- Every row stores a FULL DECK (52 + 32 + 20 card objects ~= 104 * ~40B ~= 5 KB/row, i.e. ~500 KB per
-- 100 hands). cleanup_expired_rooms hard-deletes rooms, so without a TTL these rows orphan and grow
-- without bound AND every stored deck is standing attack surface. Drop anything older than 24h hourly.
CREATE OR REPLACE FUNCTION public.cleanup_dealt_hands()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.dealt_hands WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Idempotent cron registration (safe to re-apply on a branch).
DO $$
BEGIN
  PERFORM cron.unschedule('caps_cleanup_dealt_hands');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('caps_cleanup_dealt_hands', '17 * * * *', $$ SELECT public.cleanup_dealt_hands(); $$);
