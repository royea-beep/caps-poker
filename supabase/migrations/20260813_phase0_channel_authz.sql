-- PHASE 0 — channel authorisation for hole cards.
-- WRITTEN 2026-08-13. NOT APPLIED ANYWHERE — not production, not a branch.
--
-- Closes the leak proven on 2026-07-31 (N2) and re-confirmed in client code 2026-08-13: a
-- listener with no session, no seat and no membership receives every seat's hole cards off
-- caps-room-{code}, because the host broadcast privately-intended payloads to the SHARED room
-- channel with a targetId the guest filtered on AFTER delivery.
--
-- MUST LAND IN THE SAME MERGE as utils/privateChannel.ts flipping PRIVATE_CHANNELS_ENFORCED
-- to true. Neither half is shippable alone:
--   * policy without the client flip -> the shared channel stays readable; nothing improves.
--   * client flip without the policy -> private channels have no grant, every guest fails to
--     subscribe, and nobody is dealt to. That is worse than the leak.

-- ---------------------------------------------------------------------------
-- 1. Membership predicate.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER and BOOLEAN ONLY. It must never return rows or identities: a definer
-- function that leaks membership lists is worse than the policy it replaces.
--
-- WHY DEFINER, not an inline EXISTS (the trap documented in docs/PHASE_0_CHANNEL_AUTHZ.md):
-- a realtime.messages policy's EXISTS subquery is evaluated AS THE CONNECTING USER. Today
-- room_players carries "Anyone can read room_players" SELECT TO public, so an inline check
-- happens to work — but tightening that SELECT is on the backlog, and the moment it is
-- tightened the subquery silently returns false and channel access dies for legitimate
-- members. Running the check as the definer decouples channel authz from that table's
-- public-read policy entirely.
--
-- The topic carries room_code; room_players keys on room_id. The code->id resolution happens
-- INSIDE this function so the policy does not acquire a second table dependency.
create or replace function public.is_room_member(p_topic text)
returns boolean
language plpgsql
security definer
stable
set search_path to 'public'
as $$
declare
  v_code   text;
  v_device text;
  v_ok     boolean;
begin
  if p_topic is null then
    return false;
  end if;

  -- Two topic shapes, and they authorise DIFFERENTLY:
  --   caps-room-ABCD                -> shared room traffic; any seated member may read.
  --   caps-room-ABCD-p-<deviceId>   -> ONE seat's private traffic; only that seat may read.
  -- Anything else is denied rather than parsed leniently.
  v_code   := substring(p_topic from '^caps-room-([A-Za-z0-9]+)');
  v_device := substring(p_topic from '^caps-room-[A-Za-z0-9]+-p-(.+)$');
  if v_code is null then
    return false;
  end if;

  if v_device is null then
    -- Shared topic: room membership is the whole test.
    select exists (
      select 1
      from room_players rp
      join game_rooms gr on gr.id = rp.room_id
      where gr.room_code = v_code
        and rp.user_id = auth.uid()
    ) into v_ok;
  else
    -- SEAT OWNERSHIP, not room membership.
    --
    -- CAUGHT 2026-08-13 BEFORE THE BRANCH RUN: the first draft checked only room membership
    -- and threw the -p-<deviceId> suffix away. Member B is a member of the room, so B would
    -- have been authorised to read A's private topic — i.e. the seated-opponent case, the
    -- exact case this whole change exists to close, would have stayed open while every test
    -- except one went green.
    --
    -- The topic's suffix is the DEVICE id (utils/privateChannel.ts privateTopic() is called
    -- with RealtimeClient.playerId, which is getDeviceId()). A device id is client-supplied
    -- and forgeable on its own, so it is NOT trusted as an identity here: it only selects
    -- WHICH seat, and that seat must independently be owned by the connecting auth.uid().
    -- Forging someone else's device id therefore buys nothing — the uid check still fails.
    select exists (
      select 1
      from room_players rp
      join game_rooms gr on gr.id = rp.room_id
      where gr.room_code = v_code
        and rp.device_id = v_device
        and rp.user_id = auth.uid()
    ) into v_ok;
  end if;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.is_room_member(text) from public;
grant execute on function public.is_room_member(text) to authenticated;

comment on function public.is_room_member(text) is
  'Boolean-only membership predicate for realtime channel authorisation. Returns no rows and no '
  'identities. Resolves room_code -> room_id internally so the calling policy has a single '
  'dependency. SECURITY DEFINER on purpose: the policy EXISTS runs as the connecting user, so an '
  'inline check would break when room_players SELECT is tightened.';

-- ---------------------------------------------------------------------------
-- 2. realtime.messages policy. This schema has ZERO policies today.
-- ---------------------------------------------------------------------------
-- APPLIES CLEANLY AS `postgres`. VERIFIED on branch phase0-proof-2, 2026-08-13.
--
-- RETRACTION: an earlier version of this header claimed these policies could only be created
-- from the Supabase dashboard because `postgres` is not the owner of realtime.messages. That
-- was WRONG, and it was a misattributed error. The `must be owner of table messages` failure
-- came from the `alter table realtime.messages enable row level security` statement that used
-- to sit here — NOT from CREATE POLICY. RLS on realtime.messages is ALREADY ENABLED on a fresh
-- project, so that ALTER was both unnecessary and the only statement that ever failed. With it
-- removed, both CREATE POLICY statements succeed as `postgres` with no elevated role.
--
-- (For the record, since it was tested rather than assumed: `grant supabase_realtime_admin to
-- postgres` is refused — "role memberships are reserved, only superusers can grant them" — and
-- `set role supabase_realtime_admin` is refused too. Neither is needed.)
--
-- ONE OPERATIONAL NOTE FOR A FRESH PROJECT ONLY: realtime.messages is date-partitioned, and a
-- newly created branch has no partition for today, which surfaces to the client as
-- "MissingPartition: Realtime was unable to find the expected messages partition" on subscribe.
-- Production has partitions already. This is not needed on prod and is deliberately not
-- included below.

drop policy if exists "caps room members read own room topics" on realtime.messages;
create policy "caps room members read own room topics"
  on realtime.messages
  for select
  to authenticated
  using (public.is_room_member((select realtime.topic())));

drop policy if exists "caps room members write own room topics" on realtime.messages;
create policy "caps room members write own room topics"
  on realtime.messages
  for insert
  to authenticated
  with check (public.is_room_member((select realtime.topic())));

-- ---------------------------------------------------------------------------
-- 3. ⚠️ UNDECLARED DEPENDENCY: this policy REQUIRES join_requires_session = TRUE.
-- ---------------------------------------------------------------------------
-- RETRACTION 2026-08-13: an earlier draft of this header warned that device-anonymous seats
-- would be denied because auth.uid() is NULL for them. That was WRONG and is corrected here.
-- "Device-anonymous" is not "unauthenticated": CAPS calls supabase.auth.signInAnonymously()
-- (utils/auth.ts:43), which issues a real session with a real auth.uid(). Verified on live:
-- 2,427 anonymous users, 529 active in 7 days. Anonymous seats pass this policy.
--
-- THE REAL COUPLING. Verified in the live join_table, which carries BOTH branches:
--
--   strict (join_requires_session = TRUE):  IF v_uid IS NULL THEN RETURN 'no_session';
--                                           v_identity := v_uid;
--   lax    (join_requires_session = FALSE): v_identity := COALESCE(v_uid, p_player_id);
--
-- and then: INSERT INTO room_players (room_id, user_id, ...) VALUES (v_room.id, v_identity, ...)
--
-- So while the flag is TRUE, every seat that can exist has user_id = auth.uid() BY
-- CONSTRUCTION and this predicate cannot fail. Flip the flag to FALSE and the lax branch can
-- write a device-derived p_player_id into user_id that does NOT equal auth.uid() — those
-- players are seated, holding cards, and silently receive nothing. It would present as a
-- transport failure, not a policy one, which is the worst possible failure mode to debug.
--
-- DO NOT "fix" that by widening the predicate to accept a device id. A device id is
-- client-supplied and therefore forgeable; putting a forgeable value in a security policy is
-- precisely how the club-table bypass happened. The guard belongs on the FLAG, not the policy.
--
-- Recommended guard (NOT built here): a tripwire that alarms if join_requires_session ever
-- reads FALSE while this policy exists. See docs/PHASE_0_CHANNEL_AUTHZ.md.
--
-- (room_players held 0 rows at authoring time, so there is no legacy seat data to migrate.)
