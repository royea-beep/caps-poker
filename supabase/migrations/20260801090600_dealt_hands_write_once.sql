-- SERVER-DEAL-PHASE-A / W1 — WRITE-ONCE for stored decks.
--
-- NOT APPLIED TO THE SHARED PROJECT. Branch-only migration (Iron Rule 11).
--
-- WHY THIS IS IN THE SCHEMA AND NOT ONLY IN THE EF.
-- The deal_hand EF runs as service_role, which BYPASSES RLS. So RLS on dealt_hands is decorative for
-- anything the EF does, and "the EF checks it" is a promise, not a control — a bug or a future edit
-- to the EF silently removes it. A trigger binds every writer, service_role included.
--
-- WHAT IT PREVENTS. In store-and-serve the HOST uploads the deck. Without write-once the host can
-- swap the deck AFTER clients have already fetched their slices — the same re-roll, moved from
-- "before the hand" to "during the hand", which is worse because the victims have already acted on
-- the first deck.
--
-- WHY DELETE IS RESTRICTED TOO, AND NOT JUST UPDATE.
-- Blocking UPDATE alone is not write-once: DELETE-then-INSERT is an overwrite by another name. But
-- the 24h retention job needs DELETE. Resolution: allow DELETE only for rows that are already past
-- the retention age, so cleanup_dealt_hands() works unchanged while a swap attempt on a live hand
-- fails. The trigger reads the row's own created_at — no flag a caller can set.

CREATE OR REPLACE FUNCTION public.dealt_hands_write_once()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'dealt_hands is write-once: a stored deck can never be modified (hand_id=%)', OLD.hand_id
      USING HINT = 'A hand''s deck is fixed at upload. Overwriting it after clients have fetched their '
                   'slices is a mid-hand re-roll. If a new deal is needed, use a new hand_id.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Retention may reap aged rows; nobody may delete a live hand (delete-then-insert = overwrite).
    IF OLD.created_at > now() - interval '24 hours' THEN
      RAISE EXCEPTION 'dealt_hands is write-once: a live hand''s deck cannot be deleted (hand_id=%)', OLD.hand_id
        USING HINT = 'Only rows past the 24h retention age may be deleted, by cleanup_dealt_hands().';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dealt_hands_write_once_trg ON public.dealt_hands;
CREATE TRIGGER dealt_hands_write_once_trg
  BEFORE UPDATE OR DELETE ON public.dealt_hands
  FOR EACH ROW EXECUTE FUNCTION public.dealt_hands_write_once();

-- X1.5 — REVOKE ALL, not just UPDATE/DELETE. The public-schema DEFAULT ACL grants
-- anon=arwdDxtm and authenticated=arwdDxtm (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES,
-- TRIGGER, MAINTAIN) on EVERY new table, from two separate default-ACL entries (postgres and
-- supabase_admin). So dealt_hands is created with full client write access and the earlier
-- "REVOKE UPDATE, DELETE" left INSERT and TRUNCATE in place — a client could have inserted a deck
-- (injection) or TRUNCATEd every stored deck the moment RLS was disabled.
--
-- dealt_hands gets NO client access of any kind, SELECT included: the row holds the full deck and
-- every seat's hole cards. Only the deal_hand EF (service_role) may touch it.
REVOKE ALL ON TABLE public.dealt_hands FROM anon, authenticated;

COMMENT ON FUNCTION public.dealt_hands_write_once() IS
  'W1: dealt_hands is append-only. UPDATE is always refused; DELETE only past the 24h retention age '
  '(delete-then-insert would be an overwrite). Enforced in the schema because the deal_hand EF runs '
  'as service_role and bypasses RLS - an EF-only check is a promise, not a control.';

-- ── W1: the deck may only be uploaded by the HOST ───────────────────────────────────────────────
-- is_host is server-computed: it is written only by SECURITY DEFINER RPCs (join_table, create_table,
-- leave_table, evict_ghost_seats), and room_players has RLS enabled with a SELECT-only policy, so a
-- client cannot promote itself. This helper keeps the check on the server side of the boundary; the
-- EF calls it rather than trusting anything in the request body.
CREATE OR REPLACE FUNCTION public.is_room_host(p_room_id uuid, p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
     WHERE room_id = p_room_id
       AND user_id = p_user_id
       AND is_host
       AND p_user_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_host(uuid, uuid) FROM anon, authenticated;
