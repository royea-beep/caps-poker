# CAPS POKER — Project Memory

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot is random only — no strategy, exists for testing purposes only
- Rule 6: No backend for single-player — local storage only
- Rule 7: Local multiplayer via react-native-tcp-socket (host as WebSocket server)
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2, future sprint)

## Tech Stack
- React Native + Expo SDK 55 (React 19, RN 0.83)
- expo-router for navigation (file-based, including /lobby sub-route)
- Zustand with persist middleware for state + AsyncStorage
- react-native-reanimated for animations
- react-native-gesture-handler for interactions
- react-native-tcp-socket for local multiplayer networking
- expo-haptics for tactile feedback
- TypeScript strict
- Jest 29 + ts-jest for testing
- EAS Build configured for TestFlight
- uuid for player/device IDs

## Current State
- Sprint 06 complete — local multiplayer implemented
- TypeScript: 0 errors
- Tests: 31/31 passing (12 hand evaluator + 19 simulation)
- Expo doctor: 17/17 checks passed
- iOS bundle: ~1464 modules
- NOTE: react-native-tcp-socket requires custom dev client (not Expo Go)

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx
/app/simulate.tsx, /app/multiplayer-game.tsx
/app/lobby/_layout.tsx, /app/lobby/host.tsx, /app/lobby/join.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts (GamePhase, Player, MultiBoardState, GameSession, ConnectedPlayerInfo)
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts
/utils/gameServer.ts, gameClient.ts, roomCode.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts
/constants/gameConfig.ts, theme.ts, networkConfig.ts
/store/gameStore.ts (chips, config persisted; multiplayer state transient)
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json, .npmrc
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md
/MULTIPLAYER_RESEARCH.md, LOCAL_MULTIPLAYER_DESIGN.md

## Multiplayer Architecture
- GameServer: TCP server on host device, newline-delimited JSON protocol
- GameClient: TCP client on guest devices, auto-heartbeat, reconnect support
- Host is source of truth: deals cards, collects arrangements, evaluates, broadcasts
- Room discovery: 4-digit code + manual IP entry
- Zustand store has transient multiplayer state (mode, roomCode, hostIP, connectedPlayers, gameSession)
- Message types: ROOM_JOIN, ROOM_JOIN_ACK, ROOM_STATE, GAME_START, CARDS_DEALT, PLAYER_READY, ALL_READY, BOARD_REVEAL, HAND_COMPLETE, HEARTBEAT, ERROR, PLAYER_DISCONNECTED

## Open Items
- Device test of multiplayer on real devices (needs custom dev client build)
- TODO markers in multiplayer-game.tsx for wiring PLAYER_READY send
- Replace placeholder icons with designed CP logo
- Card flip animation (rotateY) not yet implemented
- Floating "+chips" text after board reveal not yet implemented
- Badge component not yet used in Board/Summary screens
- Internet multiplayer (Supabase) — future sprint

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
- Sprint 04: TestFlight prep, assets, EAS config, QA checklist
- Sprint 05: Simulation engine, multiplayer logic refactor, OSS research
- Sprint 06: Local multiplayer — host server, client, lobby, game screen
