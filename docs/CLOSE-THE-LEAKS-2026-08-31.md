# CLOSE-THE-LEAKS — 2026-08-31

Closing the two holes the RED-TEAM sprint left open **on purpose** (they needed
authorization logic, not a revoke) plus two smaller items. DB-only session
(`supabase/`, `docs/`, `tests/`). No merge, no build. Real players untouched.

MAP: finish_table+leave_table authorized · ELO ladder de-identified · earn_chips floored · harness detector patched · list_open_tables private-code leak closed.

---

## 1 · Table actions now carry authorization

Migration: `supabase/migrations/20260831220000_authorize_table_actions.sql`

### finish_table — participant, or the room is abandoned
The client calls `finish_table` with **only** the room code (from the "host
left, clean up the orphaned room" path in `multiplayer-game.tsx`, via
`utils/lobbyApi.ts` `finishTable`), and this sprint edits DB only — so the
function cannot *demand* a caller identity without breaking that call. The fix
authorizes on a fact the DB already holds: **is anyone still actively in the
room.**

- **How the host/occupant is identified.** `game_rooms.host_id` (uuid) is the
  host; `room_players` rows carry both `user_id` and `device_id` for every seat.
  A signed-in caller is bound to its own `auth.uid()` (it cannot claim another
  uuid). `v_is_participant` = a seat whose `device_id` or `user_id` matches the
  caller, **or** `host_id` = caller uuid.
- **The rule.** A participant may finish any of their rooms. Anyone may clean up
  an **abandoned** room — no seat heartbeated within 90 s, exactly what the cron
  reaper `finish_wedged_playing_rooms(120)` already does. **A non-participant
  finishing a room with a fresh seat (a live game or active lobby) is REFUSED**
  (`not_authorized`). Active MP games heartbeat `room_players.last_seen` every
  25 s (`multiplayer-game.tsx:1190`), so a live game always has a fresh seat and
  a stranger can no longer end it.
- **One behaviour change, documented.** The client's no-identity immediate
  cleanup, *when the caller's own seat is still fresh*, now defers to the cron
  reaper (≤2 min) instead of finishing instantly — safe, because that reaper is
  the designed backstop and `finishTable` is already fire-and-forget. Passing
  the caller's device id from the client (a later, out-of-scope one-line change)
  restores instant cleanup via the participant branch; the DB already enforces it.
- **Foreign refused — proven.** On the branch replica (below): a stranger
  identity against a room with a fresh seat → `{"ok":false,"reason":"not_authorized"}`;
  the room's own participant → finished; a stranger against an abandoned room
  (no fresh seat) → finished. Both directions.
- The old single-arg `finish_table(text)` was **DROPPED**; the new
  `finish_table(text, text DEFAULT NULL, uuid DEFAULT NULL)` is one unambiguous
  function and PostgREST still resolves the existing `{p_room_code}`-only call
  against the defaults (proven from outside: `{"ok":true,"note":"no_room"}`).

### leave_table — a signed-in caller removes only its own seat
- A signed-in caller: `auth.uid()` must equal the `p_player_id` being removed;
  otherwise `not_authorized`. This closes the specific chain the red-team
  enabled (ELO leak → uuid + room code → kick a signed-in player); the ELO leak
  is closed in §2 and this removes the kick even if a uuid is obtained elsewhere.
- **The anon device path is unchanged, and why.** For an anonymous player the
  `device_id` **is** the credential — there is no session to bind. `leave_table`
  already removes only the seat whose device id is named, so a caller can affect
  only a device it can name, and naming a victim's device requires knowing that
  device id, which does not leak from any public surface (red-team established).
  Same bearer-credential model as every other device-keyed RPC.
- **Self-only foreign-refused — proven** on the branch replica: signed-in caller
  A trying to remove B's seat → `not_authorized`; caller A removing its own seat
  → removed.

### Branch used + minimal replica
Development branch **`close-the-leaks-table-authz`** (`zcoxpqarryhjfadpxnea`).
The migration history does **not** rebuild the DB (a fresh branch comes up with
~5 tables, 0 functions), so a **minimal replica was built by hand** —
`game_rooms` + `room_players` with the columns exercised, seeded rooms (fresh
seat / abandoned / signed-in) — and **named as a replica** in the run. Both
directions proven for `finish_table` and `leave_table`, and single-arg
resolution proven. **Branch deleted** afterwards (`da5f8b6b`). Rule 11: QA on a
branch, never production.

### anon still callable, app unbroken — proven from outside
With the public anon key against production:
```
finish_table {"p_room_code":"ZZZ9NOPE"}                       → {"ok":true,"note":"no_room"}
leave_table  {"p_room_code":"ZZZ9NOPE","p_device_id":"…"}     → {"ok":true,"note":"no_room"}
```
Both resolve and run for anon; the single-arg finish_table resolves against the
new defaults. Multiplayer leave/cleanup path intact.

### list_open_tables / room codes — reasoned, not assumed
`finish_table` is exploitable at scale only if room codes are discoverable.
`list_open_tables` returned **every** waiting room's code with **no is_public
filter** — so a private/club waiting room's code leaked into a public browse
list. The lobby UI uses `list_public_tables`, not this, so restricting
`list_open_tables` to `is_public = true` removes the private-code leak with no
UI impact.

**Do room codes need to be unguessable?** No. With the authorization above, a
leaked **public** code is harmless — a stranger can only finish an *abandoned*
public room, which the reaper would clear anyway — and **private** codes no
longer leak at all. The authorization check, not code secrecy, is what makes
public codes safe. Proven from outside: `list_open_tables` returns only
`is_public=true` rows (9/9 waiting rooms are public right now; 0 private rooms
currently exist to exclude, so the exclusion's effect was shown on the branch
replica).

---

## 2 · ELO ladder no longer leaks uuids or real names

Migration: `supabase/migrations/20260831230000_elo_ladder_drop_user_id.sql`

`get_elo_leaderboard` returned, to anyone with the public anon key, the auth
`user_id` **and** the real `user_profiles.display_name` ("Roye Arguan", "Avi
Avitan").

- **user_id DROPPED** from the projection. An auth uuid must never cross a
  public surface (it is also the join key to everything a user owns).
- **Matches the normal-board pattern.** `get_leaderboard` never returns a device
  id or uuid and shows the chosen handle `leaderboard.player_name`. The ELO
  ladder now returns `COALESCE(l.player_name, 'Player')` from the same
  `leaderboard` row, and the `user_profiles` join (the real-name source) is
  **removed entirely**. Signature, other return keys, ordering and the
  `elo_games > 0` filter are unchanged, so the client keeps rendering.
- **Real names — surfaced, not decided.** This ships the chosen-handle pattern
  because the instruction was to match the normal board. Whether a real-name
  "serious" ELO ladder is wanted is **Roye's** product call. The options
  (documented in the migration COMMENT):
  - **(a)** chosen handle only — what this ships; matches the normal board; no PII.
  - **(b)** real name shown, `user_id` still dropped — identity on the ladder,
    not the account key.
  - **(c)** a dedicated opt-in ladder display-name.
  The uuid comes out in **every** case; only the name question is his. Right now
  both rated players have no chosen handle on their leaderboard row, so they
  render as `"Player"` — a real display name would appear if set.
- **Proven from outside** with the public anon key:
  ```
  get_elo_leaderboard {"p_limit":5}
  → [{"elo":1216,"name":"Player","peak":1216,"games":1,"win_rate":0},
     {"elo":1184,"name":"Player","peak":1200,"games":1,"win_rate":0}]
  ```
  No `user_id` key, no real name — exactly what the normal leaderboard exposes,
  nothing more.

---

## 3 · The two smaller items

Migration: `supabase/migrations/20260831240000_earn_chips_floor_and_harness_referral.sql`

### earn_chips floor
Both overloads now (a) **refuse a negative `p_amount`** outright
(`invalid_amount`) — no legitimate caller passes one; debits go through
`spend_chips`, which already refuses negatives — and (b) **floor the balance at
0** on the update (`GREATEST(0, total_chips + v_amt)`) as defence in depth. The
allowlist, 5,000/day cap, purchase-grant refusal and reward clamp are otherwise
byte-identical.

- **earn_chips floor: added** | **negative refused: proven** from outside:
  ```
  earn_chips {"p_device_id":"aaaa-bbbb-cccc","p_event_type":"hand_won","p_amount":-500}
  → {"ok":false,"reason":"invalid_amount","chips_earned":0}
  ```

### v_harness_devices scans referral_links
The detector's synthetic-id union covered leaderboard, analytics_events,
chip_transactions, hand_history, device_identity, player_streaks and
heatmap_events — **not referral_links**. Found while cleaning up the red-team's
own `RT-REF-OWNER`, which had only a `referral_links` row and slipped the
detector. `referral_links` is now in the union.

- **Fixed — proven:** `pg_get_viewdef(v_harness_devices)` now contains
  `referral_links` (`view_scans_referral_links = true`). No synthetic
  referral-only device exists at present (1,620 referral devices, all matching
  the normal device-id patterns; `RT-REF-OWNER` already cleaned), so the blind
  spot is closed structurally with nothing new to catch today.

---

## Invariants held

- **Gap still 335,330** — confirmed by fresh SELECT:
  float `1,161,938` − ledger `826,608` = **335,330**. Unchanged.
- **Real players untouched.** All three migrations are pure DDL (CREATE OR
  REPLACE FUNCTION / VIEW, DROP FUNCTION) — **zero data writes**. No UPDATE or
  DELETE ran against any player row. The earn_chips floor changes behaviour only
  for a negative amount, which no legitimate caller sends.
- **Instrument failures: 0.** All verification calls returned; no errors.
- **Production unchanged** where it must be: no flag flipped, no faucet opened,
  no rake/economy value or art touched, missions inactive. Only the three
  function/view definitions above changed.

## Not done, by instruction
No merge, no build. The real-name ladder question is left for Roye (options
surfaced). No client (`app/`/`components/`/`utils/`) edits — out of scope.
