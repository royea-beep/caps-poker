# VAMOS CAPS MP-LOBBY — Phase 2 (backend RPCs + lobby UI)

**Date:** 2026-06-24 · **Branch:** `feat/mp-lobby`
**Scope this session (per owner pacing):** TASK 1 (backend RPCs) + TASK 2 (lobby UI) + lobby telemetry.
TASK 3 (in-game realtime sync + placement-timer soft-lock fix) and Phase 3 (remove QuickPoker/Tournament/
WiFi) are NEXT. Telemetry stays live.

## TASK 1 — Lobby backend (APPLIED LIVE to DB, verified) ✅
Three SECURITY DEFINER RPCs on the existing (empty) `game_rooms` table. RLS unchanged (read=public,
insert/update=authenticated only) → all writes go through these RPCs (no blanket access), matching the
leaderboard-lock pattern.
- `list_open_tables()` → waiting, non-expired rooms (room_code, current/max, game_config, host) ordered by size.
- `create_table(p_player_count, p_host_id uuid, p_host_name)` → inserts a `waiting` room, host seated 1/N,
  unique 4-char code (safe charset), `expires_at = now()+30min`, `game_config={numberOfPlayers:N}`.
- `join_table(p_room_code, p_player_id)` → **atomic** seat claim: `UPDATE … SET current_players+1 WHERE
  status='waiting' AND current_players < max_players` (row-lock guard = no overfill past max). When it
  reaches max → `status='playing'` + `started_at` (**AUTO-START**). Returns `{ok, current/max, status,
  autostarted}` or `{ok:false, error:'table_full_or_gone'}`.

**Verified live (test rows then deleted, game_rooms back to 0):**
- create 2P → `{room_code:'RMTH', waiting, 1/2}`; appears in `list_open_tables()`.
- join → `{status:'playing', autostarted:true, 2/2}` (auto-start fires).
- join again → `{ok:false, error:'table_full_or_gone'}` (overfill guard).
- `list_open_tables()` excludes the now-`playing` table.
- **GEM:** `game_rooms_status_check` allows only `waiting|starting|playing|finished|abandoned` — auto-start
  uses `'playing'` (not 'active', which violates the constraint). host_id is **uuid**.

## TASK 2 — Lobby UI (branch; ships on web-deploy with owner say-so) ✅
- `utils/lobbyApi.ts` — typed wrappers (`listOpenTables`/`createTable`/`joinTable`/`groupTablesByType`), fire-safe.
- `app/lobby/index.tsx` — the lobby: 3 sections (Heads-Up 2P / 3-Player / 4-Player), each lists its open
  tables (seat dots current/max, Join / Full) + "+ Create {type} table"; an "enter a friend's code" row
  (invite-by-code = room_code); shows YOUR table code after creating; poll-refresh (5s) + pull-to-refresh.
  On join (or auto-start) → launches the UNIFIED `/game` with that `numberOfPlayers`.
- `app/(tabs)/play.tsx` — added a "🌐 Multiplayer Lobby" card → `/lobby` (additive; the other modes are
  removed in Phase 3).

## TASK 4 (partial) — lobby telemetry
`lobby_opened`, `table_created`, `table_joined`, `table_autostarted`, `mp_game_started` fire via `track()`
(→ analytics_events, with player_count + room_code; session_id+app_version ride along). `mp_game_ended`
lands with TASK 3 (in-game).

**Verify:** tsc 0 · jest 2505/2505 · RPC flow proven live (above).

## NOT done (next sessions)
- TASK 3: wire each table to the unified `/game` over the realtime channel (room_code) — shared boards +
  individual hole cards, host-authoritative reveal→results; FOLD IN placement-timer auto-place-on-timeout
  (compute ready from refs + broadcast OUTSIDE the setState/setBoards updater — the known double-invoke
  anti-pattern); handle a player leaving mid-game (presence) gracefully. Add `mp_game_ended`.
- Phase 3: remove Quick Poker / Tournament / local WiFi as separate modes + clean dead routes — ONLY
  after the lobby is verified working end-to-end.

## Constraints
RPCs applied live (additive, empty table, required for the tasked verification). Client UI on branch; no
web deploy without explicit owner say-so. No App Store submit. Telemetry stays live.
