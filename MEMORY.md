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
- Zustand for state
- AsyncStorage for persistence
- react-native-reanimated for animations
- react-native-gesture-handler for interactions
- expo-haptics for tactile feedback
- TypeScript strict
- Jest + ts-jest for testing

## Current State
- Sprint 01 complete — ready for first device test
- TypeScript: 0 errors
- Hand evaluator: 12/12 tests passing

## Issues Found & Fixed (Sprint 01 Audit)
- babel.config.js was missing — created with reanimated/plugin last
- Chip math bug: winners only got potPerBoard (1x) instead of 2x (both contributions) — fixed
- COMPLETE bonus calculated from single-player pot, now from total pot — fixed
- netChips was gross instead of net in game.tsx — fixed
- summary.tsx double-subtracted totalPaid — fixed
- handEvaluator.ts: added guards for <2 player / <3 board cards, try/catch, null-safe return
- gameStore.ts: added isNaN guard on parseInt for persisted chips
- summary.tsx: wrapped JSON.parse in try/catch with Array.isArray validation
- game.tsx: added mountedRef to prevent post-unmount state updates
- game.tsx: all setTimeout/setInterval tracked and cleared on unmount
- game.tsx: handleAutoFillAndReady rewritten to avoid stale-closure hazard
- Board/Card sizes reduced for iPhone 14 Pro fit (34x48 small cards)
- Boards grid wrapped in ScrollView for overflow safety
- PlayerHand: keyboardShouldPersistTaps added

## File Structure
/app/_layout.tsx
/app/index.tsx
/app/game.tsx
/app/summary.tsx
/app/settings.tsx
/components/Card.tsx
/components/Board.tsx
/components/PlayerHand.tsx
/components/ChipsDisplay.tsx
/components/CompleteOverlay.tsx
/utils/deck.ts
/utils/handEvaluator.ts
/utils/gameLogic.ts
/utils/__tests__/handEvaluator.test.ts
/constants/gameConfig.ts
/store/gameStore.ts
/babel.config.js
/jest.config.js

## Open Items
- First run on device not yet verified
- Tap-to-place UX needs real device testing
- Animations (card reveal, chip movement) not yet tested on device
- reanimated animations not yet implemented (static transitions only)

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
