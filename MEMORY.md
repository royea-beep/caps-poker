# CAPS POKER — Project Memory

## Iron Rules (NEVER change without explicit "UNLOCK [rule]" from user)
- Rule 1: React Native + Expo only — no bare workflow, no Capacitor
- Rule 2: iOS portrait only — no landscape, no tablet
- Rule 3: All game parameters must be runtime-configurable via Settings screen — never hardcoded
- Rule 4: Hand evaluation uses full Omaha rules — exactly 2 player cards + 3 board cards
- Rule 5: Bot is random only — no strategy, exists for testing purposes only
- Rule 6: No backend — everything local, AsyncStorage for persistence

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
- Sprint 04 complete — TestFlight build ready, awaiting eas login + build:configure
- TypeScript: 0 errors
- Expo doctor: 17/17 checks passed
- Preflight: 10/10 checks passed
- Hand evaluator: 12/12 tests passing
- iOS bundle: 1462 modules, 3.9 MB

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, __tests__/handEvaluator.test.ts
/constants/gameConfig.ts, theme.ts
/store/gameStore.ts
/scripts/generate-icon.js, preflight-check.js
/babel.config.js, jest.config.js, metro.config.js, eas.json
/BUILD_INSTRUCTIONS.md, TESTFLIGHT_GUIDE.md, QA_CHECKLIST.md, AUDIT_REPORT.md

## TestFlight — Next Steps (manual)
1. Run: eas login
2. Run: eas build:configure (sets projectId in app.json)
3. Run: eas build --platform ios --profile preview
4. Run: eas submit --platform ios --latest (needs Apple Developer account)
5. Replace placeholder icons with designed assets before public release

## Open Items
- Replace placeholder dark green icons with designed CP logo
- First device test via TestFlight
- Card flip animation (rotateY) not yet implemented
- Floating "+chips" text after board reveal not yet implemented
- Badge component created but not yet used in Board/Summary screens
- handleAllRevealed callback in game.tsx is effectively dead code (noted in smoke test)

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
- Sprint 04: TestFlight prep, assets, EAS config, QA checklist
