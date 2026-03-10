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
- Sprint 02 complete — cross-project audit done, integration plan ready
- TypeScript: 0 errors
- Hand evaluator: 12/12 tests passing

## Audit Findings (Sprint 02)
Top items to integrate from sibling projects:

### From Wingman (highest value — same tech stack)
- **Theme system**: spacing.ts, colors.ts, typography.ts — complete design tokens, copy and adapt
- **Button component**: 5 variants, spring press animation, loading state, gradient support
- **Badge component**: status badges with spring entrance, good for hand rankings
- **DailyRewardModal**: celebration pattern with particles — adapt for COMPLETE overlay
- **LoadingSkeleton**: composable pulse-animated skeletons
- Source: `C:\Projects\Wingman\apps\mobile\src\`

### Architecture Improvements (from crypto-arb-bot + TokenWise patterns)
- Replace game phase booleans with discriminated union state machine
- Extract useGameTimer and useRevealSequence custom hooks
- Use Zustand persist middleware instead of manual AsyncStorage calls

### TestFlight Path (from royea-mobile-launch-kit)
- Run init-project.js to generate eas.json + preflight checks
- ~45 min to TestFlight with EAS Build
- Kit at: `C:\Projects\royea-mobile-launch-kit\`

### Skipped
- ftable / ftable-hands: no game logic (tournament mgmt + video OCR)
- shared-utils: mostly backend/web utilities, not applicable to local-only RN game
- FlushQueue: event buffer pattern noted but no backend to flush to

## Issues Found & Fixed (Sprint 01 Audit)
- babel.config.js was missing — created with reanimated/plugin last
- Chip math bug: winners only got potPerBoard (1x) instead of 2x — fixed
- COMPLETE bonus calculated from single-player pot, now from total pot — fixed
- netChips was gross instead of net in game.tsx — fixed
- summary.tsx double-subtracted totalPaid — fixed
- handEvaluator.ts: added guards for edge cases, try/catch, null-safe return
- gameStore.ts: added isNaN guard on parseInt for persisted chips
- summary.tsx: wrapped JSON.parse in try/catch
- game.tsx: mountedRef, timer cleanup, handleAutoFillAndReady rewrite
- Board/Card sizes reduced for iPhone 14 Pro fit
- Boards grid wrapped in ScrollView

## File Structure
/app/_layout.tsx, /app/index.tsx, /app/game.tsx, /app/summary.tsx, /app/settings.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, __tests__/handEvaluator.test.ts
/constants/gameConfig.ts
/store/gameStore.ts
/babel.config.js, /jest.config.js
/AUDIT_REPORT.md

## Open Items
- First run on device not yet verified
- Tap-to-place UX needs real device testing
- Integrate Wingman theme system (spacing, colors, typography)
- Refactor gameStore with Zustand persist middleware
- Extract useGameTimer + useRevealSequence hooks
- Implement reanimated animations (card reveal, chip movement, spring press)
- Upgrade CompleteOverlay with celebration particles (DailyRewardModal pattern)
- Run royea-mobile-launch-kit init for EAS/TestFlight setup

## Commit History
- Sprint 01: Initial full build
- Sprint 01 audit: dependency fix, crash prevention, layout fixes, game flow fix, tests
- Sprint 02: Cross-project audit complete
