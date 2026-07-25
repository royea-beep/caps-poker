-- SERVER-DEAL-PHASE-A — server-only storage of the authoritative deal.
--
-- NOT APPLIED TO PROD. This migration file ships on feat/server-deal-phase-a for the owner to apply
-- when going live (after the 2-device acceptance test). It is inert until the deal_hand Edge Function
-- is deployed AND app_config.server_deal_enabled is turned on.
--
-- RLS is enabled with NO policies, so the anon and authenticated roles get ZERO access — clients can
-- never read the deck, opponents' hole cards, or the closed board cards. Only the deal_hand Edge
-- Function (service_role, which bypasses RLS) writes and reads this table.

CREATE TABLE IF NOT EXISTS public.dealt_hands (
  hand_id          text PRIMARY KEY,
  room_id          text,
  player_count     int  NOT NULL CHECK (player_count IN (2, 3, 4)),
  seat_device_ids  jsonb NOT NULL,   -- device_ids in seat order (fixed at deal creation)
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
-- service_role (the Edge Function) bypasses RLS. Do not add a client-readable policy — that would
-- re-open the exact leak this table exists to prevent.

COMMENT ON TABLE public.dealt_hands IS
  'SERVER-DEAL-PHASE-A: authoritative deal storage. RLS-locked (no client access); only the deal_hand Edge Function (service_role) reads/writes. Holds the full deck + all hole/closed cards.';
