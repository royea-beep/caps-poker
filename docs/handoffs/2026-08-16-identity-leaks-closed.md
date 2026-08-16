# 2026-08-16 — The four identity leaks, closed

Shipped `f027fb2` on `main`, deployed, verified on the wire and on both engines.

## What the client actually read — established before anything was revoked

| table | direct client reads | verdict |
|---|---|---|
| `game_rooms` | **none** — `utils/lobbyApi.ts` is 100% `.rpc()` | pure revoke, no RPC work |
| `clubs` | **none** — `utils/clubApi.ts` is 100% `.rpc()` | pure revoke |
| `club_members` | **none** — same module | pure revoke |
| `sit_and_go_players` | `app/(tabs)/index.tsx` activity feed (2 reads) | moved to an RPC first |

Searched `.from('x')`, `from("x")`, backtick forms, and bare table names across all `.ts`/`.tsx`.
The only hits outside the feed were **writes** in `utils/matchmaking.ts`.

Also checked, because a revoke that kills realtime is worse than the leak: **there are no
`postgres_changes` subscriptions anywhere**. Every channel is presence/broadcast
(`realtimeMultiplayer.ts`, `privateChannel.ts`, `useLobbyPresence.ts`, `spectate.tsx`), so no
realtime path depended on these grants.

## `sit_and_go_players` — the one that needed a client move

Home's Sit&Go activity feed made two reads, the second pulling **other players' `device_id`** as
`winner_id`. The render used it for exactly one thing (`index.tsx:1708`):

```js
const won = item.winner_id === item.player_id;
```

An equality test. The identity never reached the screen — only the boolean did. So
`get_sng_activity_feed(p_device_id, p_limit)` (SECURITY DEFINER, STABLE) resolves the winner
server-side and returns `{ won, chips_won, ended_at }`. No id in the payload.

It mirrors the old logic exactly, including `chips_won` staying null unless I won, and a null-safe
`won` so a session with no winner row yields `false` as the old `null === deviceId` did.

**Proved with rows that exist.** The table has 36 rows but **zero with `finish_position` set**, so
the feed returns `[]` for everyone and an empty result would have proved nothing. I inserted a
two-session fixture — one I won, one I lost — and got:

```
[{"won":false,"ended_at":"2026-08-16 10:00:00+03","chips_won":null},
 {"won":true, "ended_at":"2026-08-16 09:00:00+03","chips_won":400}]
```

Both branches exercised, newest first, no `device_id`. Fixture deleted; back to 36 players / 6
sessions.

**`anon`'s INSERT was already dead.** Policy `sng_players_insert` is
`WITH CHECK (auth.uid() IS NOT NULL)` and CAPS is device-anonymous, so `auth.uid()` is NULL and the
insert has always been refused. Revoking it matches reality rather than changing behaviour — the
same shape as the `hand_history` 403 closed last week.

## The revokes

```sql
REVOKE ALL ON public.game_rooms   FROM anon, authenticated;
REVOKE ALL ON public.clubs        FROM anon, authenticated;
REVOKE ALL ON public.club_members FROM anon, authenticated;
REVOKE ALL ON public.sit_and_go_players FROM anon, authenticated;
GRANT INSERT (session_id, player_name, chips)        ON public.sit_and_go_players TO authenticated;
GRANT UPDATE (chips, finish_position, is_eliminated) ON public.sit_and_go_players TO authenticated;
```

**Nothing re-granted for `anon` anywhere.** After the client move it reads none of these tables
directly, and SECURITY DEFINER RPCs run as the function owner, so they do not depend on the
caller's grants. Three tables end with no `anon` grant at all, as the brief specified.

`authenticated` was included because there are zero direct reads for it either — leaving it would
have closed the leak only for anonymous users while a signed-in one could still read `host_id` and
`owner_device_id`. Its **writes** on `sit_and_go_players` are preserved as explicit columns
(`matchmaking.ts` inserts a seat; policy `sng_players_update` lets a signed-in player update their
own row). The identity column is not among them.

Resulting grants — the only ones left on all four tables:

```
sit_and_go_players | authenticated | INSERT | chips, player_name, session_id
sit_and_go_players | authenticated | UPDATE | chips, finish_position, is_eliminated
```

## Verified on the wire, not in `information_schema`

`tests/identity-leak-wire.mjs`, live anon HTTPS against tables that **have rows** (game_rooms 11,
clubs 1, club_members 2, sit_and_go_players 36) — an empty table would return `[]` and look
identical to a successful block.

| request | status | payload |
|---|---|---|
| `game_rooms?select=*` | **401** | `permission denied for table game_rooms` |
| `game_rooms?select=host_id` | **401** | blocked |
| `clubs?select=*` | **401** | `permission denied for table clubs` |
| `clubs?select=owner_device_id` / `owner_user_id` | **401** | blocked |
| `club_members?select=*` / `device_id` | **401** | `permission denied for table club_members` |
| `sit_and_go_players?select=*` / `device_id` | **401** | `permission denied for table sit_and_go_players` |

Both the whole-row read and the **targeted column** read were tested — a whole-row block could
still leave a column-scoped grant working.

**The screens still work**, same run:

```
list_public_tables    status 200 | 11 tables
list_open_tables      status 200 | 11 tables
get_sng_activity_feed status 200 | 0 items
my_clubs              status 200 | 0 items
```

`list_public_tables` payload keys — `host_id` is absent, and always was:

```
["id","status","host_name","room_code","created_at","table_kind",
 "game_config","max_players","player_count","current_players"]
```

**`host_name` kept.** It is the displayed value (`"Open Table"`, `"CAPS Bot"`), not an identifier,
and it was never a grant question — the RPC serves it and never served `host_id`.

**On live, both engines:** home and lobby mount (`#root` 1 child), lobby lists **6 room codes**,
`supabase 4xx: []`. A network trace of Home shows `RPC rpc/get_sng_activity_feed` firing and
**zero** direct reads of the four tables.

One honest limit: the feed *section* does not render on Home at all, so I did not watch a populated
feed. It returns `[]` now exactly as the old code did (`if (!myRows?.length) setActivityFeed([])`),
and with zero finished Sit&Go sessions it has been empty for every user all along.

## ⚠️ A pre-existing type error, and a flaw in my own checks

`tsc` reports one error, deterministic across runs:

```
components/Card.tsx(458,38): error TS1355: A 'const' assertion can only be applied to
references to enum members, or string, number, boolean, array, or object literals.
```

`OBSIDIAN.mint as const` — a const assertion on a property reference. **Not mine.** `Card.tsx` is
unmodified in my working tree and is on the do-not-touch list; the line arrived in `694565f`
(Aug 14, other card work). **CI reproduces it exactly** on clean hardware — I pulled the
`tsc-output` artifact — so it is real, not the dev machine.

It has not been blocking deploys because the CI typecheck is **deliberately non-blocking**
(`continue-on-error: true` plus `exit 0`, `web-deploy.yml:57-78`), by design pending Roye's call to
turn it into a gate. So a green deploy has never implied a clean typecheck.

**And my own earlier reports were unverified.** I ran `tsc` and judged it by empty output without
checking the exit code — an OOM-killed compiler produces exactly that. Three "tsc: PASSED clean"
lines in this session's handoffs should be read as "produced no output", which is not the same
claim. Corrected here; from now on the exit code is captured. My changes add **no new** errors:
the run reports exactly this one, in a file I did not touch.

## DB state

`room_players` 0 · `bug_reports` 250 · rooms **11/11 clean** · `54YU` untouched ·
`CJTK`/`QW7U` still `CAPS Bot` · `sit_and_go_players` 36 · `sit_and_go_sessions` 6 · probe rows 0.

`hand_history` is **151, not the 146** I last recorded. The five extra rows are dated Aug 13-15,
all `practice`, all distinct devices — real activity between my sessions. **Not mine, not deleted.**
151 is the current figure, not a deviation to restore.

Also noticed: `origin/main` had been rewound to `867178a`, so my push shows `867178a..f027fb2` as a
single commit. My earlier work is still present — `components/ChipCountUp.tsx` exists in the
`origin/main` tree and `00f83cd` is an ancestor — another session rearranged history above it.
Nothing lost, but the linear log no longer shows those commits.

## Carried forward

1. `components/Card.tsx:458` TS1355 — pre-existing, on the do-not-touch list, needs Roye's call.
2. Whether to make the CI typecheck blocking (`exit 0` → `exit $code`).
3. Why `isMultiplayer` is false at `/results` for one client.
4. Google OAuth / anonymous-to-signed-in progression loss.
5. Progression systems actually being earned; performance across 20 hands.

MACHINE: unchanged — memory test still not run; local checks remain PROVISIONAL.

=== STRATEGIST HANDOFF — IDENTITY LEAKS ===
Per table:
  game_rooms   — client reads: NONE (lobbyApi.ts 100% .rpc()). REVOKE ALL from anon+authenticated,
                 nothing re-granted. anon select=* AND select=host_id both 401 permission denied.
                 No screen broke: lobby lists 6 codes on both engines.
  clubs        — client reads: NONE (clubApi.ts 100% .rpc()). REVOKE ALL, nothing re-granted.
                 owner_device_id and owner_user_id both 401.
  club_members — client reads: NONE. REVOKE ALL, nothing re-granted. device_id 401.
  sit_and_go_players — reads were app/(tabs)/index.tsx:583-597, MOVED to get_sng_activity_feed
                 (SECURITY DEFINER, returns {won, chips_won, ended_at}). REVOKE ALL from anon;
                 authenticated keeps only INSERT(session_id,player_name,chips) +
                 UPDATE(chips,finish_position,is_eliminated) for matchmaking.ts. device_id 401.
  Payload keys from list_public_tables: id, status, host_name, room_code, created_at, table_kind,
  game_config, max_players, player_count, current_players — no host_id.
game_rooms: does list_public_tables cover every read, making the direct grant unnecessary? YES —
  zero .from('game_rooms') in the codebase; it was a pure revoke.
clubs: how does the UI answer "am I the owner"? It does not ask — there is no client read of clubs
  at all; my_clubs/club_leaderboard RPCs serve the screens. No boolean was needed.
host_name kept or removed? KEPT — it is the displayed label ("Open Table"/"CAPS Bot"), not an
  identifier, and the RPC already served it while never serving host_id.
MACHINE: memory test still not run; local checks PROVISIONAL.
HANDOFF: file + vamos_handoffs slug 2026-08-16-identity-leaks-closed + chars, code-point match? Y
WHAT I DID NOT CHECK: whether a signed-in (authenticated) SnG join still inserts end-to-end — no
  Google sign-in was exercised; the feed section does not render on Home so I saw no populated
  feed; I did not touch Card.tsx or the CI blocking decision.
tsc: 1 PRE-EXISTING error (Card.tsx:458 TS1355, arrived Aug 14 in 694565f, reproduced by CI on
  clean hardware). Zero new errors from this work. NOTE: my earlier "tsc PASSED clean" lines this
  session checked output only, not the exit code — they meant "no output", which a crashed
  compiler also produces.
=== END ===
