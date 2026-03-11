# CAPS POKER — Project Memory

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot is random only — no strategy, exists for testing purposes only
- Rule 6: No backend — everything local, AsyncStorage for persistence

## Proposed Iron Rules (user must approve)
- Rule 7 (proposed): Local multiplayer via react-native-tcp-socket WebSocket server on host device
- Rule 8 (proposed): Internet multiplayer via Supabase Realtime (Broadcast + Presence + Edge Functions)

## Tech Stack
- React Native + Expo SDK 55 (React 19, RN 0.83)
- expo-router for navigation
- Zustand with persist middleware for state + AsyncStorage
- react-native-reanimated for animations
- react-native-gesture-handler for interactions
- expo-haptics for tactile feedback
- TypeScript strict
- Jest 29 + ts-jest for testing
- EAS Build configured for TestFlight

## Current State
- Sprint 05 complete — simulation engine + multiplayer research
- TypeScript: 0 errors
- Expo doctor: 17/17 checks passed
- Preflight: 10/10 checks passed
- Tests: 31/31 passing (12 hand evaluator + 19 simulation)
- iOS bundle: 1464 modules, ~3.8 MB
- Simulation engine validates 2/3/4 player game logic (zero-sum verified)

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx, /app/simulate.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts (includes Player, MultiBoardState, GameSession)
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts
/constants/gameConfig.ts, theme.ts
/store/gameStore.ts
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md
/MULTIPLAYER_RESEARCH.md, LOCAL_MULTIPLAYER_DESIGN.md

## Multiplayer Architecture
- Phase 1 (local): Host-as-server via react-native-tcp-socket + WS framing, room code + IP join
- Phase 2 (internet): Supabase Realtime (Broadcast for actions, Presence for room state, Edge Functions for secret cards)
- Key principle: Game logic is pure functions, transport-agnostic
- N-player types already in codebase: Player, MultiBoardState, dealCardsMultiplayer, evaluateAllBoards, calculateChipDeltas
- Card math: 2P=16 cards/4 boards, 3P=12 cards/3 boards, 4P=8 cards/2 boards

## Simulation Results
- 2P: zero-sum verified, COMPLETE ~2-5% of hands
- 3P: zero-sum verified, COMPLETE rare (<1%)
- 4P: zero-sum verified, COMPLETE very rare
- All player counts stable over 100+ hand batches

## Open Items
- Replace placeholder dark green icons with designed CP logo
- First device test via TestFlight (EAS build in progress)
- Card flip animation (rotateY) not yet implemented
- Floating "+chips" text after board reveal not yet implemented
- Badge component created but not yet used in Board/Summary screens
- handleAllRevealed callback in game.tsx is effectively dead code
- Multiplayer UI not yet built (Sprint 06)
- Hot-seat/pass-and-play mode not yet implemented

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
- Sprint 04: TestFlight prep, assets, EAS config, QA checklist
- Sprint 05: Simulation engine, multiplayer logic refactor, OSS research
