# CAPS POKER — Project Memory

## 2026-07-02 — earn_chips incident
- `earnChips('daily_login')` on every Home mount credited **+50/open** — `earn_chips` had NO server gate (unconditional ledger + leaderboard UPDATE, `p_amount DEFAULT 50`). Damage: **110,850 chips leaked across 1,130 devices**. Client call removed (hotfix `e34baea`, OTA `c3253f4f`); server hardened: `daily_login`=no-op, event-type whitelist, amount clamp **[-500,+1500]** on BOTH earn_chips overloads (migration `harden_earn_chips_server_gate`).
- The daily bonus itself is now server-gated end-to-end: `claim_daily_reward` (DB once-per-day gate + `daily_rewards` ledger row as proof) is the only claim path; no local reward math, no client-wins submitScore push.
- **Residual risk:** the clamp is a ceiling, not event validation — a client can still send an inflated amount within the clamp for a legit event. Full fix = server-computed amounts per event (like claim_daily_reward). Planned, not built — see TODO below.

## 2026-07-02 — state of truth
- **Live:** main `f704607`, web bundle `index-2fc1cfd5`, OTA group `eb67b693-5d51-40d4-9e4f-1733c1a410a7`, runtime 2.7.0, build 506. Web = caps.ftable.co.il via Vercel (GH Action deploys on push to main).
- **Vercel:** project RENAMED `dist` → **`caps-poker-web`** (same projectId `prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP`, domain unaffected). Why: on 7/1 a Wingman CLI deploy (branch test/core-loop-smoke) landed on the then-named "dist" project and the caps.ftable.co.il alias auto-followed it — the live site served the Wingman dating app until restored via `vercel promote` of the CAPS deploy. Cleanup done: stray `web-dist/.vercel` link deleted; stale unused `caps-poker` Vercel project deleted. **LESSON: never deploy to a Vercel project you didn't verify by projectId; a production custom domain follows the NEWEST production deploy.**
- **Chips:** starting = **2000**. The CLIENT reads `leaderboard.total_chips` (default now 2000). `user_profiles.chips` is NOT the read path — never "reset chips" via user_profiles alone.
- **Shipped since last update:** QA batch A/B/C + stale-rule (`d1de124`: English hand badges, first-run 3P selector on mount, non-host leave-recovery clean-cancel + full roster cleanup via finish_table); UX-BATCH-1 (`f704607`: clubs rehydration fix — resolve ids inline before my_clubs, Auto-Place ALL, lobby presence count, Omaha rule stated in onboarding card 2).
- **WARNING:** any handoff doc dated 11.3.2026 is obsolete (claims FTP deploy / no backend / import.meta bug / 43 tests — ALL wrong). Trust only this file's dated sections.

- THEME (done 2026-06-15): app-wide obsidian `#161922` / mint `#4FD6A8` (tokens mint, mintLight `#7FE3C2`, mintBright `#A7EED6`, mintDim). Gold = SEMANTIC ONLY: winner highlight (Card.tsx inline literal `#c9a84c`, locked), medals, cup tiers, currency amounts. See docs/GEMS.md → "Headless Visual-QA Loop".

### 2026-06-28 — UNIFY-FINAL state of truth
⚠️ REPO PATH = C:\Projects\POKER\Caps (NOT C:\Projects\Caps — that's an empty placeholder). This bit us 2026-06-29.
📎 Docs: docs/RECAP_2026-06-28.md (cycle narrative + 3-layer QA method) · docs/MIGRATION_HYGIENE.md (qa_* junk migrations vs real ones)

LIVE: web prod = main `16e278f`, bundle `index-62234e03…` (verified, 0 console errors). Native = TestFlight 506 (`aea77e1`) + OTA group `cc58fc53` (UNIFY-FINAL, runtime 2.7.0). DB = gxrpunvhjcrzqnitbqah.

SHIPPED THIS CYCLE: public lobby (always-open 6-table pool, first-joiner-host, self-healing cron) · Friends Clubs (closed groups + member-gated tables + private mini-league) · MP↔SOLO render parity (unified UI) · all 12 in-app popups removed (only first-run onboarding kept) · tightened onboarding copy · 4 deep bugs fixed (below).

4 BUGS FIXED (found by DB simulation, all LIVE):
1. seat_index collision — join_table set seat_index=current_players → collided after a mid-waiting leave → next join threw a unique-constraint 500 (players couldn't join; likely part of the ~40% MP "abandonment"). FIX: smallest-free-seat in [0,max), returns seat_index. Migration fix_join_table_seat_collision_and_club_gate.
2. Club tables not member-gated at JOIN (non-member with code could join). FIX: same migration, join_table rejects non-members of a club_id table with not_a_member.
3. Ghost seats — public waiting tables never expired + no heartbeat. FIX: room_players.last_seen + touch_room_player() (client beats 25s) + evict_ghost_seats(90) on cron caps_evict_ghost_seats (60s). Migrations bug3_heartbeat_and_ghost_eviction + schedule_evict_ghost_seats_cron.
4. Mini-league drift — record_club_result per-client → asymmetric on disconnect. FIX: ledger club_game_results(room_code PK) + record_club_game() idempotent (any alive client submits full roster). Migration bug4_club_game_ledger_idempotent_record.

NEW DB OBJECTS: tables clubs, club_members, club_game_results; columns game_rooms.is_public, game_rooms.club_id, room_players.last_seen. RPCs: ensure_public_lobby, list_public_tables, touch_room_player, evict_ghost_seats, create_club, join_club, my_clubs, club_leaderboard, create_club_table, list_club_tables, record_club_game (record_club_result @deprecated). join_table now does smallest-free-seat + club gate + returns seat_index. Crons: lobby_v2_ensure_public_pool (*/2), caps_evict_ghost_seats (* * * * *), caps_cleanup_expired_rooms (*/2).

CLEAN RESET (for friends): all 739 accounts → 2000 chips, all lifetime stats zeroed, leaderboard emptied, club leagues zeroed. One real club kept (RARP).

PENDING: BoardReveal in MP (flag mpBoardReveal=false, dormant — code wired but NOT verified 2-client; prove via Option B then flip on) · QA pipeline branch feat/qa-pipeline @ 8b73f17 (Layer 1 db-sim + Layer 2 web-e2e scaffolded, NOT run; Layer 3 Maestro chosen not built; run Layer 1 against a Supabase BRANCH not prod) · native E2E (Maestro) = the open corner.

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot is random only — no strategy, exists for testing purposes only
- Rule 6: No backend for single-player — local storage only
- Rule 7: Local multiplayer via react-native-tcp-socket (host as WebSocket server) — LOCKED
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2, future sprint) — LOCKED
- Rule 9 (2026-06-28): DB ground-truth beats any bot/agent report — re-run the simulation, read the tables.
- Rule 10 (2026-06-28): Never claim a layer works without watching it run end-to-end.
- Rule 11 (2026-06-28): QA simulations run against a Supabase BRANCH, never the live shared project.
- Rule 12 (2026-06-28): ~15 qa_* migrations in history are throwaway test sims (see docs/MIGRATION_HYGIENE.md) — don't let them replay on a branch.
- Rule 13 (2026-07-02): Stale docs are hazards — MEMORY.md's dated sections are the only trusted state. Verify any claim older than the newest dated section before acting on it.
- Rule 14 (2026-07-02): A code comment is a claim, not evidence — verify against the actual implementation (the "idempotent — safe every open" comment shipped the earn_chips leak).

## TODO
- **Server-computed earn amounts refactor:** move all chip-amount logic into the RPCs per event type (as claim_daily_reward already does) — the client sends only the event, never an amount; earn_chips's `p_amount` parameter goes away, and each event's value lives server-side in one place (chip_config or per-event RPC). Kills the residual clamp-window risk from the earn_chips incident. Requires a coordinated client+server change: one batch + OTA.

## Tech Stack
- React Native + Expo SDK 55 (React 19, RN 0.83)
- expo-router for navigation (file-based, /lobby sub-route)
- expo-dev-client for custom dev builds (needed for native modules)
- Zustand with persist middleware for state + AsyncStorage
- react-native-reanimated for animations
- react-native-gesture-handler for interactions
- react-native-tcp-socket for local multiplayer networking
- expo-haptics for tactile feedback
- uuid for player/device IDs
- TypeScript strict
- Jest 29 + ts-jest for testing
- EAS Build: development (dev client), preview (TestFlight), production (autoIncrement)

## Current State
- Sprint-42 complete — Phase 2 (leaderboard, internet MP, notifications)
- Version: 1.1.0, buildNumber: 14 (auto-increment)
- App Store: v1.0.0 (build 454ae10a) submitted, v1.1.0 build in progress
- Privacy policy: https://caps.ftable.co.il/privacy.html (updated for leaderboard + online MP)
- Supabase: @supabase/supabase-js installed, utils/supabase.ts shared client
- Iron Rule 8: IMPLEMENTED — RealtimeServer/RealtimeClient via Supabase Realtime channels
- New screens: leaderboard.tsx, lobby/internet-host.tsx, lobby/internet-join.tsx
- New utils: leaderboard.ts, realtimeMultiplayer.ts, notifications.ts, supabase.ts
- Store: playerName, notificationsEnabled, handsWon, biggestWin added (persisted)
- NOTE: Supabase features degrade gracefully when .env not configured
- TypeScript: 0 errors
- Tests: 104/104 passing (14 hand evaluator + 19 simulation + 39 game logic + 7 hand hint + 11 theme + 14 full simulation)
- Web deployed to Vercel: https://caps.ftable.co.il (HTTPS works, auto-SSL)
- Vercel project: dist (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP), team: team_ayrePMw5z8jSPhRe67RiBD0k
- Vercel URL: https://dist-beryl-eta-15.vercel.app (fallback)
- DNS: caps.ftable.co.il A → 76.76.21.21 (Vercel), TTL 300s
- No git remote configured
- NOTE: react-native-tcp-socket requires custom dev client (not Expo Go)

## Game Config (all runtime-configurable in Settings)
- arrangementTime: 60 (sec)
- boardRevealDuration: 5 (sec)
- turnRevealDelay: 800 (ms) — card flip speed within a board
- completeBonusDisplay: 2 (sec)
- startingChips: 1000
- potPerBoard: 25 (buy-in = potPerBoard × NUM_BOARDS = 100)
- completeBonusPercent: 50 (% of buy-in per opponent)
- numberOfPlayers: 2 (2/3/4 selector, for multiplayer)
- botSpeedMin: 5000 (ms)
- botSpeedMax: 30000 (ms)
- soundEnabled: true (toggle in Settings)

## Complete Bonus Definition (LOCKED)
- If a player wins ALL boards in a single hand → receives (buyIn × bonusPercent/100) per opponent
- Example: buy-in=100, 2 players → winner gets +50 chips bonus
- Zero-sum: losers each pay their share of the bonus

## UI Specs (LOCKED)
- Player hand: 2 fixed rows at bottom (no scroll)
- Board reveal: fully automatic, no user input between boards
- Summary: chip counting animation + staggered board fade-in, then "Next Hand" button

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/results.tsx, /app/summary.tsx, /app/settings.tsx
/app/simulate.tsx, /app/multiplayer-game.tsx, /app/reveal.tsx (legacy, unused)
/app/leaderboard.tsx
/app/lobby/_layout.tsx, /app/lobby/host.tsx, /app/lobby/join.tsx
/app/lobby/internet-host.tsx, /app/lobby/internet-join.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts (GamePhase, Player, MultiBoardState, GameSession, ConnectedPlayerInfo)
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts, handHint.ts
/utils/gameServer.ts, gameClient.ts, roomCode.ts
/utils/supabase.ts, leaderboard.ts, realtimeMultiplayer.ts, notifications.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts, gameLogic.test.ts, handHint.test.ts
/constants/gameConfig.ts, theme.ts, networkConfig.ts
/store/gameStore.ts (chips+config+handsPlayed+bestChips+handsWon+biggestWin+playerName+notificationsEnabled persisted; multiplayer+revealData transient)
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json, .npmrc
/scripts/generate-assets.py (Pillow — generates icon, splash, favicon)
/screenshots/README.md (App Store screenshot instructions)
/docs/multiplayer-test-guide.md
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md
/DEV_BUILD_GUIDE.md, MULTIPLAYER_RESEARCH.md, LOCAL_MULTIPLAYER_DESIGN.md

## Multiplayer Architecture
- GameServer: TCP server on host, newline-delimited JSON, heartbeat monitor
- GameClient: TCP client on guest, auto-heartbeat, reconnect (3 attempts with 2s backoff)
- Host is source of truth: deals, evaluates, broadcasts
- Room discovery: 4-digit code + manual IP entry
- Server/client instances stored in Zustand (mpServer/mpClient) — survive screen transitions
- Callbacks updated via updateCallbacks() when navigating between screens
- Host reveal flow: onAllPlayersReady → runRevealSequence → broadcast BOARD_REVEAL + HAND_COMPLETE → build RevealData → navigate to /results
- Guest reveal flow: collect BOARD_REVEAL messages → on HAND_COMPLETE → build RevealData → navigate to /results
- Next-hand flow: NEXT_HAND_REQUEST message → server tracks requests → when all players request → re-deal → broadcast CARDS_DEALT → all navigate to /multiplayer-game
- Disconnected players auto-filled with random card assignments
- DeviceId-based reconnection: server matches reconnecting clients by deviceId, restores seat
- Payload validation: all incoming messages validated, player names truncated to 20 chars
- Message buffer: 64KB max per connection, prevents memory exhaustion
- Background-aware: heartbeat resets after app returns from background (both server+client)
- Double-disconnect prevention: socket disconnect only processed once per client
- Protocol messages: ROOM_JOIN, ROOM_JOIN_ACK, ROOM_STATE, GAME_START, CARDS_DEALT, PLAYER_READY, ALL_READY, BOARD_REVEAL, HAND_COMPLETE, NEXT_HAND_REQUEST, HEARTBEAT/ACK, ERROR, PLAYER_DISCONNECTED

## Deployment
- Web export: `npx expo export --platform web` → dist/ folder
- **Primary**: Vercel (auto-SSL, CDN) — `vercel deploy --prod` from dist/
- Vercel project: dist (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP), team: team_ayrePMw5z8jSPhRe67RiBD0k
- Vercel auth token: in C:/Users/royea/AppData/Roaming/com.vercel.cli/Data/auth.json
- Custom domain: caps.ftable.co.il → A record 76.76.21.21 (Vercel)
- Vercel URL: https://dist-beryl-eta-15.vercel.app (fallback)
- **Legacy (FTP)**: cPanel shared hosting at ftable.co.il (SPD hosting)
- FTP creds: ftableco / CPANEL_PASSWORD_REDACTED (from C:/Projects/ftable/.env)
- cPanel API: https://ftable.co.il:2083/ (Basic auth with same creds)
- Server IP: 195.225.46.105
- SPD SSL still broken (Apache SNI returns compass.spd.co.il) — bypassed by Vercel

## iOS Build Checklist (do NOT auto-trigger)
1. `npx tsc --noEmit` — 0 errors
2. `npx jest` — all tests passing
3. `npx expo-doctor` — all checks passed
4. `node scripts/preflight-check.js` — 10/10
5. `eas build --platform ios --profile production` — submit manually
6. Verify app.json version/buildNumber before submitting
7. Test on physical device via TestFlight before App Store release

## Open Items
- Supabase project not yet created — need to create project at supabase.com and add SUPABASE_URL + SUPABASE_ANON_KEY to .env (see .env.example)
- Supabase tables not yet created (leaderboard, push_tokens) — SQL in utils/leaderboard.ts comments
- App Store: v1.0.0 build 13 submitted — needs metadata + screenshots in ASC dashboard (see APPSTORE_METADATA.md)
- First multiplayer device test pending (needs dev build on 2 devices)
- Multiplayer polish remaining: animated board reveal on guest side, player disconnect toast during game

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
- Sprint 04: TestFlight prep, assets, EAS config, QA checklist
- Sprint 05: Simulation engine, multiplayer logic refactor, OSS research
- Sprint 06: Local multiplayer — host server, client, lobby, game screen
- Sprint 07: EAS dev build config, multiplayer TODOs fixed, resilience, v1.1.0
- Sprint 08: Fix player hand face-up, board community cards layout
- Sprint 09: Board UI polish — selected board highlight, empty slot pulse, tap-to-remove UX
- Sprint 10: Full audit — deal logic verified, 12 new gameLogic tests, dead code cleanup
- Sprint 11: Fix card text color — COLORS.black was #f0f0e8 (same as card bg), changed to #1a1a2e
- Sprint 12: Full audit (61 bugs) + fixes — critical game.tsx race conditions, PlayerHand 2-row grid, summary chip animation, complete bonus calc fix (50% of buy-in not pot), settings overhaul (all params + validation + numberOfPlayers selector + turnRevealDelay), multiplayer networking hardening (deviceId reconnect, payload validation, background heartbeat), web re-deploy, 47 tests
- Sprint 14: Card flip animation (rotateY via reanimated), floating "+chips"/"-chips" text on board reveal, iOS build checklist, 6 new tests (53 total), closed cards render fix for flip support
- Sprint 15: CP branded icon (sharp SVG), Badge in Board+Summary, v1.2.0, EAS preview build, web re-deploy, 4 new tests (57 total)
- Sprint 16: Hand hint indicator (Pair/Trips/Flush Draw etc.), multiplayer test guide, EAS build success (bbb538b7), 7 new tests (64 total)
- Sprint 17: Arrangement UX audit (all 4 checks pass), timer 3-tier colors (green/yellow/red), reveal phase verified, TestFlight needs ascAppId, web re-deploy, 5 new tests (69 total)
- Sprint 21: Gaming visual redesign — neon color palette (theme.ts rewrite), title/logo glow animation, button redesign (gold+neonBlue), board layout polish (neonBlue active pulse, neonGreen complete flash), PlayerHand gold selection glow, gameover shake+neonRed glow, summary neonGreen/neonRed score colors, Card suit colors from theme, 10 new theme tests (79 total), web re-deploy
- Sprint 22: Vertical board layout — 4 boards stacked (no scroll), dynamic card sizing (Dimensions), Board.tsx full-width compact rows, Card.tsx dynamic dimensions props, PlayerHand gold border+scale select, hardcoded colors audit (Badge/Board/Card/game.tsx → COLORS refs), bot row hidden during arrangement, player hand hidden during reveal, web re-deploy
- Sprint 23: Button press fix (reanimated → RN Animated + TouchableOpacity), web shadow deprecation fix (Platform.select for static shadows in Button/Board/Card/PlayerHand), external tester distribution docs, web re-deploy
- Sprint 24-build: v1.4.0, production build 04890b1f (store distribution), TestFlight submitted, buildNumber auto-incremented to 6, removed stale buildNumber from app.json
- Vercel deploy: web export deployed to Vercel, custom domain caps.ftable.co.il with auto-SSL, DNS A record → 76.76.21.21, SSL issue bypassed
- Button-fix-iOS: removed Animated.View wrapper around TouchableOpacity (blocked iOS touches), used AnimatedTouchable instead, added pointerEvents="none" to title glow, v1.4.1 build 7 (1b272517)
- Button-fix-web: AnimatedTouchable blocks clicks on web — platform-split: Pressable for web (renders native &lt;button&gt;), AnimatedTouchable for iOS/Android, web re-deployed to Vercel
- Sprint 32: Fix broken 🪙 emoji → styled gold dots (ChipsDisplay + Board pot), board padding 16px, hand counter polish, web re-deploy to Vercel
- Sprint 33: CRITICAL FIX — Sprint-30 removed PlayerHand from game.tsx, player cards were invisible. Restored PlayerHand at bottom (face-up, 2-row grid). New UX: tap card → select (gold border), tap board slot → place selected card. Board sizing adjusted to fit with PlayerHand (~140px). Web re-deploy to Vercel
- Sprint 34: New app/results.tsx — single results screen replaces 4 sequential reveal screens. Shows all boards at once with small cards (36x50), hand names, WIN/LOSS/TIE badges, chip amounts, animated net count-up, complete bonus banner, NEXT HAND button. Flow: game.tsx → results.tsx → game.tsx (skips summary). Fixed 🪙 emoji in summary.tsx. Web re-deploy to Vercel
- Sprint 35: Full UX audit — 2 critical responsive bugs fixed. Results: changed from side-by-side (overflow on 375px) to vertical stacking, dynamic card sizing from screen width. Game: replaced hardcoded SAFE_AREA=84 with useSafeAreaInsets(), min card height 28px, PLAYER_HAND_H 130. PlayerHand: dynamic card width (fits 8/row on any phone). Home: gap 40→28. All screens fit iPhone SE (375×667) through iPhone 14 Plus (430×932). Web maxWidth 480px. Web re-deploy to Vercel
- Sprint 36: READ-ONLY multiplayer diagnostic. Full protocol map, 9 gap analysis, implementation plan. No code changed.
- Sprint 37: Multiplayer functional — 3 critical gaps fixed. A1: server/client instances stored in Zustand (mpServer/mpClient), survive screen transitions, removed dead onSendReady callback. A2: multiplayer-game.tsx reveal flow builds RevealData and navigates to /results (same as single-player). A3: NEXT_HAND_REQUEST protocol message, server tracks requests, re-deals when all players ready. B1: multiplayer-game vertical board layout (from game.tsx), dynamic card sizing via useSafeAreaInsets, same tap-to-select UX, player names from connectedPlayers. B2: waiting overlay + results.tsx "Waiting for other players" state. v1.6.0, web re-deploy, EAS production build
- Sprint 38: App icon + splash screen generated via Pillow script. Icon: 1024x1024, gold "C" on poker green radial gradient, gold ring border, corner suit symbols. Splash: 1284x2778, "CAPS POKER" on green felt with gold text + suit symbols. Favicon: 64x64. Android adaptive icon updated. Screenshots README created. v1.7.0, web re-deploy, EAS production build
- Sprint 39: Sound effects — 7 WAV files generated via numpy script (cardPlace, cardSelect, cardFlip, chipsWin, lose, complete, timerLow). sounds.ts rewritten with new SoundName type + WAV requires. Wired: cardSelect on tap in game.tsx + multiplayer-game.tsx, timerLow at 10s warning in game.tsx, win/lose conditional in results.tsx. Settings toggle already existed. Preload on app start via _layout.tsx. v1.8.0, web re-deploy, EAS production build
- Sprint 40: Full simulation test suite — 14 new tests (104 total). Tests cover: 2/3/4-player full hands, COMPLETE bonus trigger, game over detection, 10-hand stress test, auto-fill timer, results data shape, card uniqueness, Omaha rule verification (Iron Rule 4). simulate.tsx upgraded with auto-play mode (configurable hands/players, per-hand logs, running chip balance, stop button). SIMULATE button added to home (__DEV__ only). 0 bugs found. Web re-deploy
- Sprint 41: App Store submission — version reset to 1.0.0 (public release), build 13 (454ae10a). Privacy policy page deployed to caps.ftable.co.il/privacy.html. 6 placeholder screenshots generated via Pillow (6.7" + 6.1", home/game/results mockups). APPSTORE_METADATA.md created with all ASC fields. EAS build submitted to App Store Connect. Pending: upload metadata + screenshots in ASC dashboard, submit for Apple review
- Sprint 42: Phase 2 — 3 parallel features. (1) Leaderboard: utils/leaderboard.ts (getDeviceId, submitScore, getLeaderboard), app/leaderboard.tsx (top 20, pull-to-refresh, highlighted current player). (2) Internet multiplayer: utils/realtimeMultiplayer.ts (RealtimeServer + RealtimeClient via Supabase Realtime channels, Presence tracking, same message protocol as TCP), app/lobby/internet-host.tsx + internet-join.tsx. (3) Notifications: utils/notifications.ts (requestPermissions, scheduleLocal, scheduleReengagement, sendPushNotification). Shared: utils/supabase.ts client, .env.example. Store: playerName, notificationsEnabled, handsWon, biggestWin. Settings: player name input, notifications toggle. Index: PLAY ONLINE + LEADERBOARD buttons. Results: auto-submit to leaderboard, track handsWon/biggestWin. Iron Rule 8: IMPLEMENTED. v1.1.0, web re-deploy, EAS build

## Working Style
Read: docs/ROYE_WORKING_STYLE.md before starting any session
