-- SERVER-DEAL-PHASE-A / V1 — hand-ordinal monotonicity.
--
-- NOT APPLIED TO THE SHARED PROJECT. Branch-only migration (Iron Rule 11). Inert until the deal_hand
-- Edge Function is deployed AND app_config.server_deal_enabled is turned on.
--
-- WHY: deal_hand is create-or-get keyed on hand_id, so the first authorised caller mints the deal.
-- With a client-chosen ordinal a seated HOST can mint N+1, read its OWN slice, dislike it, mint N+2,
-- and announce whichever dealt it better. Every one of those calls is a genuinely seated player
-- asking for its own cards, so the authz check passes on all of them: the no-leak property holds and
-- the fairness property dies anyway. This adds the SERVER-side counter that makes ordinals
-- single-use and strictly sequential.

-- Ordinal on the deal itself, unique per room: two decks can never exist for one ordinal.
ALTER TABLE public.dealt_hands ADD COLUMN IF NOT EXISTS hand_ordinal int;
UPDATE public.dealt_hands SET hand_ordinal = 1 WHERE hand_ordinal IS NULL;   -- no live rows; belt-and-braces
ALTER TABLE public.dealt_hands ALTER COLUMN hand_ordinal SET NOT NULL;
ALTER TABLE public.dealt_hands ADD CONSTRAINT dealt_hands_ordinal_positive CHECK (hand_ordinal >= 1);
CREATE UNIQUE INDEX IF NOT EXISTS dealt_hands_room_ordinal_uidx
  ON public.dealt_hands (room_id, hand_ordinal);

-- ── THE RETENTION DOOR ───────────────────────────────────────────────────────────────────────────
-- The high-water mark MUST NOT live in dealt_hands. cleanup_dealt_hands() drops decks after 24h; if
-- "expected next ordinal" were max(stored ordinal)+1, deleting rows would LOWER the max and a burned
-- ordinal could be minted a SECOND time with a fresh deck — the re-roll walks back in through the
-- retention door. This cursor is never touched by that TTL. It is a handful of bytes per room.
CREATE TABLE IF NOT EXISTS public.room_hand_cursor (
  room_id      text PRIMARY KEY,
  last_ordinal int NOT NULL CHECK (last_ordinal >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_hand_cursor ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: absence of any policy denies all anon/authenticated access. Only the
-- deal_hand EF (service_role) reads/writes it.
REVOKE ALL ON TABLE public.room_hand_cursor FROM anon, authenticated;

COMMENT ON TABLE public.room_hand_cursor IS
  'SERVER-DEAL-PHASE-A/V1: per-room hand-ordinal high-water mark. Deliberately OUTLIVES the 24h '
  'dealt_hands TTL - deriving the counter from surviving deck rows would let a burned ordinal be '
  're-minted with a fresh deck once retention dropped the row (the retention-door re-roll).';

-- ── ATOMIC CLAIM ─────────────────────────────────────────────────────────────────────────────────
-- Bumps the cursor ONLY when p_ordinal is exactly last_ordinal + 1 (or 1 for a fresh room). Returns
-- TRUE to exactly one caller. Two seats racing to be first-caller cannot both mint: the loser gets
-- FALSE and reads the winner's row. Doing this in ONE statement is what makes it race-safe - a
-- read-then-write in the EF would leave a gap two callers could both pass through.
CREATE OR REPLACE FUNCTION public.claim_hand_ordinal(p_room_id text, p_ordinal int)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE v_claimed boolean := false;
BEGIN
  IF p_ordinal IS NULL OR p_ordinal < 1 THEN RETURN false; END IF;

  INSERT INTO public.room_hand_cursor (room_id, last_ordinal)
  VALUES (p_room_id, p_ordinal)
  ON CONFLICT (room_id) DO UPDATE
    SET last_ordinal = EXCLUDED.last_ordinal, updated_at = now()
    -- the guard: only advance by exactly one, never sideways, never backwards
    WHERE room_hand_cursor.last_ordinal = EXCLUDED.last_ordinal - 1
  RETURNING true INTO v_claimed;

  -- A fresh room may only claim ordinal 1 (the INSERT branch above would otherwise accept any value).
  IF v_claimed AND p_ordinal <> 1 AND NOT EXISTS (
    SELECT 1 FROM public.room_hand_cursor WHERE room_id = p_room_id AND last_ordinal = p_ordinal
  ) THEN
    RETURN false;
  END IF;

  RETURN COALESCE(v_claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_hand_ordinal(text, int) FROM anon, authenticated;

-- Cursor cleanup is tied to the ROOM's lifetime, never to a clock. A cursor removed while its room
-- is still playable would reset the counter and re-open the retention door.
CREATE OR REPLACE FUNCTION public.cleanup_room_hand_cursors()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.room_hand_cursor c
   WHERE NOT EXISTS (SELECT 1 FROM public.game_rooms g WHERE g.id::text = c.room_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
