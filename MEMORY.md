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
- Sprint-41 complete — App Store submission v1.0.0
- Version: 1.0.0 (public release), buildNumber: 13
- App Store: submitted to ASC (build 454ae10a), pending Apple processing + review
- Privacy policy: https://caps.ftable.co.il/privacy.html
- Screenshots: 6 placeholder mockups (6.7" + 6.1") generated via Pillow
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
- FTP creds: ftableco / Sb9k46-l)WI2Gq (from C:/Projects/ftable/.env)
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
- App Store: v1.0.0 build 13 submitted — needs metadata + screenshots uploaded in ASC dashboard, then submit for review (see APPSTORE_METADATA.md)
- First multiplayer device test pending (needs dev build on 2 devices)
- Multiplayer polish remaining: animated board reveal on guest side, player disconnect toast during game, per-player names in results
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
