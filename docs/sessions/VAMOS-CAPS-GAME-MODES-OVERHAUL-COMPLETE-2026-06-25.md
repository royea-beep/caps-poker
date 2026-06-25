# VAMOS CAPS — GAME-MODES-OVERHAUL COMPLETE (2026-06-25)

Completion of the 3-phase Play overhaul: MP lobby wired to a real synced game (3C/3E),
Phase 3 cleanup + `finish_table` leak fix, then merged to main and web-deployed.

## Shipped to web (origin/main `e046314`, bundle `index-f945e4e3`)

### 3C/3E — lobby tables → real synced multiplayer game
- NEW `app/lobby/table.tsx`: waiting room bridging `game_rooms` discovery → the shipped realtime
  engine (`utils/realtimeMultiplayer.ts` + `app/multiplayer-game.tsx`). Host runs `RealtimeServer`
  on `caps-room-{code}`, joiners run `RealtimeClient`; host auto-deals when presence fills (700ms
  settle), everyone enters `/multiplayer-game`. `mp_game_started`/`mp_game_ended` telemetry.
- Showstopper fixed: `setMpClient` must run BEFORE `connect()` (the guest deals mid-connect and
  navigates before `.then`, so the cancelled-on-unmount guard skipped the store-set → null client →
  no callbacks → guest hang). Plus review hardening (`362d1a9`): no channel leak on host-start
  failure; afford-gate uses the error screen (Alert.alert no-ops on web); host `onDisconnected` wired.

### Phase 3 — Play = Single Player + Multiplayer Lobby
- `app/(tabs)/play.tsx` → 2 cards only. Removed Home Sit&Go/Quick-Poker row + SideMenu
  Tournament/host/join. Deleted routes: quick-poker, tournament, sit-and-go, sit-and-go-lobby,
  lobby/host, lobby/join (+ `_layout` regs, GAME_SCREENS, BugReporter refs). KEPT internet-host/join.

### 'playing' leak fix (DB migration applied live)
- `cleanup_expired_rooms` only reaped waiting/starting → playing rooms + roster leaked forever.
- NEW `finish_table(p_room_code)` — host calls at game end → playing→finished + finished_at + clears
  roster. Idempotent; no-op for legacy 6-digit internet codes. Wired in `multiplayer-game` host paths
  (hand-complete + leave) via `utils/lobbyApi.ts finishTable()`.
- Hardened `cleanup_expired_rooms`: reap playing >2h, purge terminal rooms + roster >1d.
- Captured all lobby RPCs into `supabase/migrations/20260625000000_mp_lobby_rpcs.sql` (reproducibility).

## Verification
- tsc 0, jest 2505/2505.
- 2-client runtime (real Supabase): create→join→auto-start→synced game (identical boards, private
  hands), guest auto-fill on placement timer (no soft-lock), both → `/results` zero-sum; room then
  status=finished + finished_at + 0 roster rows. 3-player table fills + starts.
- Post-deploy: live caps.ftable.co.il loads clean (no white-screen — `scripts/fix-web-html.js` adds
  `type="module"`); `/play` shows 2 cards, `/lobby` renders.

## Merge + deploy
- `feat/mp-lobby` (`df38d64`, --no-ff) → origin/main `fe02c20`→`e046314`. Vercel auto-deploy ~1min →
  bundle `index-72a8f32a`→`index-f945e4e3`. Web only — no native/OTA/store this round.

## Native-vs-web delta (key)
TestFlight Build 506 (from `aea77e1`) PREDATES all of the above + telemetry + Phase 1. Native testers
do NOT have telemetry, the unified game, the MP lobby, or the 2-option Play. See PREPLAN/TASKLIST for
the OTA-vs-rebuild decision.
