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
- react-native-reanimated for animations (spring press, pulsing borders, particle effects)
- react-native-gesture-handler for interactions
- expo-haptics for tactile feedback
- TypeScript strict
- Jest + ts-jest for testing
- EAS Build configured for TestFlight

## Current State
- Sprint 03 complete — Wingman theme integrated, state machine refactored, reanimated animations added, EAS/TestFlight configured
- TypeScript: 0 errors
- Hand evaluator: 12/12 tests passing

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx, Button.tsx, Badge.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, __tests__/handEvaluator.test.ts
/constants/gameConfig.ts, theme.ts
/store/gameStore.ts
/babel.config.js, /jest.config.js, /eas.json
/AUDIT_REPORT.md, /TESTFLIGHT_GUIDE.md

## Sprint 03 Changes
- constants/theme.ts: Full design system (spacing, colors, typography) adapted from Wingman
- gameConfig.ts: COLORS now re-exports from theme.ts with backward-compatible aliases
- Button.tsx: 3 variants (gold/secondary/ghost), spring press animation, loading/disabled states
- Badge.tsx: 4 variants (win/lose/tie/rank), spring entrance animation
- All raw Pressable buttons replaced with Button component across index, game, summary, settings
- types/gameTypes.ts: GamePhase discriminated union (idle/arranging/waiting_for_bot/revealing/complete/summary)
- hooks/useGameTimer.ts: Reusable countdown with start/stop/reset
- hooks/useRevealSequence.ts: Sequential board reveal with configurable duration
- game.tsx refactored: boolean flags replaced with GamePhase, manual timers replaced with hooks
- gameStore.ts: Zustand persist middleware, removed manual loadPersistedData/persistChips
- _layout.tsx: Simplified, no manual hydration needed
- Card.tsx: Animated highlight glow with spring physics
- Board.tsx: Pulsing gold border when active during reveal
- CompleteOverlay.tsx: Spring scale entrance, fade-in text, slide-up bonus, 12-particle gold burst
- eas.json + app.json: EAS Build configured for TestFlight (3 placeholders to fill)
- TESTFLIGHT_GUIDE.md: Step-by-step deployment guide

## Open Items
- First run on device not yet verified
- Fill TestFlight placeholders: expo.owner, eas.projectId, appleId
- Tap-to-place UX needs real device testing
- Card flip animation (rotateY) not yet implemented
- Floating "+chips" text after board reveal not yet implemented
- Badge component created but not yet used in Board/Summary screens

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
- Sprint 03: Wingman theme, state machine, reanimated animations, EAS TestFlight setup
