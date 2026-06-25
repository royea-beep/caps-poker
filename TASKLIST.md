# CAPS POKER — TASKLIST

_Last updated: 2026-06-25 · main `e046314`. Status: ✅ done · 🟡 in progress/partial · ⬜ not started · 🔒 owner-gated_

See **PREPLAN.md** for the phase/north-star framing.

## P0 — launch-blocking

| # | Task | Phase | Status | Notes |
|---|------|-------|--------|-------|
| P0-1 | **Native parity** — ship post-506 JS (telemetry + lobby + 2-option Play) to native | C | 🔒⬜ | OTA is viable: JS-only since 506, version 2.7.0 unchanged, `appVersion` runtimeVersion → `eas update --branch production` reaches Build 506. OR build 507. Owner runs it. |
| P0-2 | **Device-verify MP lobby on native** (Realtime presence/broadcast on real device + cellular) | C | ⬜ | Only web-verified so far. Must confirm 2 phones can create/join/play a synced hand. |
| P0-3 | **App Store age rating** (gambling theme → 17+/18) | D | 🔒⬜ | Required to submit. Never set. |
| P0-4 | **RLS / INSERT-lock** on `game_rooms` + `room_players` (verify only SECDEF RPCs can write) | A/E | 🟡 | RLS exists (read public, writes authenticated-only); confirm direct client writes are blocked and the SECDEF RPCs are the only mutation path. |

## P1 — should-fix before/around launch

| # | Task | Phase | Status | Notes |
|---|------|-------|--------|-------|
| P1-1 | **Lobby RPC reproducibility** — capture live defs as repo migrations | A | 🟡 | `supabase/migrations/20260625000000_mp_lobby_rpcs.sql` written. join_table/leave_table/finish_table/cleanup = verbatim; **create_table + list_open_tables were RECONSTRUCTED** (MCP was down) → reconcile verbatim against live `pg_get_functiondef` before trusting for a rebuild. |
| P1-2 | **Repoint REMATCH + "Play Online" → `/lobby`** | C/E | ⬜ | `results.tsx` REMATCH and SideMenu/friends "Play Online" still route to the OLD `/lobby/internet-host` (6-digit). Decide: unify onto the new lobby, or keep internet-host for friends. |
| P1-3 | **MP hardening** — reconnection, 3P/4P real-world, presence-drop, spectator | E | 🟡 | Engine has reconnection/snapshot (CAPS 10/12); 3P verified to fill+start in test, not played to completion; 4P unverified. |
| P1-4 | **Verify economy/cups/telemetry on native** (currently web-only) | A/C | ⬜ | Depends on P0-1. Confirm spend_chips deducts, cups award, track_event lands from the native binary. |
| P1-5 | **Single-player polish** (the "polished" half of the north star) | A | 🟡 | Define what "polished" means: result screen, progression, onboarding, difficulty. |

## P2 — polish / cleanup / nice-to-have

| # | Task | Phase | Status | Notes |
|---|------|-------|--------|-------|
| P2-1 | **Dead-code sweep** — remove orphaned WiFi + tournament code | E | ⬜ | Safe (0 live importers): `utils/gameServer.ts`, `utils/gameClient.ts`, `utils/localNetwork.ts` (gameServer→localNetwork chain), `components/TournamentLobby.tsx`. ⚠️ `utils/tournament.ts` is still used by `utils/__tests__/tournament.test.ts` → remove the test too, or keep the backend. |
| P2-2 | **Store listing assets** — screenshots, description, keywords | D | ⬜ | |
| P2-3 | **Verify cleanup cron** reaps stale `playing`/terminal rooms over time | E | 🟡 | Hardened `cleanup_expired_rooms` live on pg_cron jobid 32 (every 2min); confirm it actually purges after the 2h/1d windows in prod. |
| P2-4 | **Lobby UX**: show in-progress/finished counts, friends presence, rematch in-lobby | E | ⬜ | |

## Recently completed (web)

| Task | Status | Ref |
|------|--------|-----|
| GAME-MODES-OVERHAUL (Phase 1 → lobby → 3A/3B → 3D → 3C/3E → Phase 3) | ✅ live | main `e046314` |
| `finish_table` 'playing'-leak fix + hardened cleanup | ✅ live | `df38d64` |
| Telemetry re-activation + web error capture | ✅ live | `127a566` |
| Economy spend contract / cups progression / leaderboard bots | ✅ live (web/DB) | this week |
