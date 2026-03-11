# CAPS POKER — Project Memory

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot is random only — no strategy, exists for testing purposes only
- Rule 6: No backend for single-player — local storage only
- Rule 7: Local multiplayer via react-native-tcp-socket (host as WebSocket server) — LOCKED
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2, future sprint) — LOCKED

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
- Sprint 17 complete — arrangement UX audit, timer colors, TestFlight prep, web deploy
- Version: 1.2.0, latest build: bbb538b7 (FINISHED, preview/internal)
- TypeScript: 0 errors
- Tests: 69/69 passing (14 hand evaluator + 19 simulation + 29 game logic + 7 hand hint)
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
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx
/app/simulate.tsx, /app/multiplayer-game.tsx
/app/lobby/_layout.tsx, /app/lobby/host.tsx, /app/lobby/join.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts (GamePhase, Player, MultiBoardState, GameSession, ConnectedPlayerInfo)
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts, handHint.ts
/utils/gameServer.ts, gameClient.ts, roomCode.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts, gameLogic.test.ts, handHint.test.ts
/constants/gameConfig.ts, theme.ts, networkConfig.ts
/store/gameStore.ts (chips+config persisted; multiplayer state+onSendReady transient)
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json, .npmrc
/docs/multiplayer-test-guide.md
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md
/DEV_BUILD_GUIDE.md, MULTIPLAYER_RESEARCH.md, LOCAL_MULTIPLAYER_DESIGN.md

## Multiplayer Architecture
- GameServer: TCP server on host, newline-delimited JSON, heartbeat monitor
- GameClient: TCP client on guest, auto-heartbeat, reconnect (3 attempts with 2s backoff)
- Host is source of truth: deals, evaluates, broadcasts
- Room discovery: 4-digit code + manual IP entry
- onSendReady callback in store bridges game screen to server/client
- Disconnected players auto-filled with random card assignments
- DeviceId-based reconnection: server matches reconnecting clients by deviceId, restores seat
- Payload validation: all incoming messages validated, player names truncated to 20 chars
- Message buffer: 64KB max per connection, prevents memory exhaustion
- Background-aware: heartbeat resets after app returns from background (both server+client)
- Double-disconnect prevention: socket disconnect only processed once per client

## Deployment
- Web export: `npx expo export --platform web` → dist/ folder
- Hosting: cPanel shared hosting at ftable.co.il (SPD hosting)
- FTP creds: ftableco / Sb9k46-l)WI2Gq (from C:/Projects/ftable/.env)
- cPanel API: https://ftable.co.il:2083/ (Basic auth with same creds)
- Server IP: 195.225.46.105
- Subdomain: caps.ftable.co.il → public_html/caps
- HTTP works: http://caps.ftable.co.il/ serves the app correctly
- SSL issue: cert installed in cPanel but Apache SNI returns compass.spd.co.il (shared hosting default) for ALL subdomains. Needs hosting provider to rebuild Apache SSL vhost config (WHM-level fix).

## iOS Build Checklist (do NOT auto-trigger)
1. `npx tsc --noEmit` — 0 errors
2. `npx jest` — all tests passing
3. `npx expo-doctor` — all checks passed
4. `node scripts/preflight-check.js` — 10/10
5. `eas build --platform ios --profile production` — submit manually
6. Verify app.json version/buildNumber before submitting
7. Test on physical device via TestFlight before App Store release

## Open Items
- TestFlight submission: needs `ascAppId` in eas.json → run `eas submit --platform ios` interactively first time to set up App Store Connect app, or add `ascAppId` manually from ASC dashboard
- SSL fix for caps.ftable.co.il — needs hosting provider to rebuild Apache SNI config (confirmed still broken 2026-03-11)
- First multiplayer device test pending (needs dev build)
- Internet multiplayer (Supabase) — future sprint

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
