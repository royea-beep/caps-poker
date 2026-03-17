# You are continuing the CAPS POKER project.
# PARALLEL SPRINT — 6 tasks simultaneously.
# Launch all 6 agents at once.
# Read MEMORY.md and confirm Iron Rules before starting.

---

## Iron Rules Confirmation
- Rule 1: React Native + Expo only ✓
- Rule 2: iOS portrait only ✓
- Rule 3: All params runtime-configurable ✓
- Rule 4: Full Omaha evaluation ✓
- Rule 5: Bot is random only ✓
- Rule 6: No backend ✓

---

## TASK 1 — Import Wingman Theme System (HIGH PRIORITY)
Agent: theme-importer

A1. Read these files from Wingman:
    - `C:\Projects\Wingman\apps\mobile\src\theme\spacing.ts`
    - `C:\Projects\Wingman\apps\mobile\src\theme\colors.ts`
    - `C:\Projects\Wingman\apps\mobile\src\theme\typography.ts`

A2. Create `C:\Projects\Caps\constants\theme.ts` with adapted versions:
    - Spacing: copy the full scale (xs→xxxl) as-is
    - Typography: copy font weight scale as-is
    - Colors: REPLACE Wingman brand colors with Caps Poker palette:
      ```
      background: '#0a1a0f'        // deep dark green
      surface: '#0f2318'           // card/board surface
      surfaceRaised: '#143020'     // elevated elements
      border: '#1e4028'            // subtle borders
      gold: '#c9a227'              // primary accent
      goldLight: '#e8c547'         // highlights
      goldDim: '#8a6e1a'           // dimmed gold
      text: '#f0f0e8'              // primary text
      textMuted: '#8a9e8a'         // secondary text
      textDim: '#4a6050'           // disabled text
      cardRed: '#e63946'           // hearts/diamonds
      cardBlack: '#f0f0e8'         // spades/clubs
      success: '#4caf50'           // win
      error: '#f44336'             // lose
      overlay: 'rgba(0,0,0,0.85)' // modals
      ```
    - Export a single `THEME` object with `colors`, `spacing`, `typography`

A3. Update `constants\gameConfig.ts`:
    - Remove the old COLORS export
    - Import from theme.ts instead
    - Keep COLORS as re-export of `THEME.colors` for backward compatibility

A4. Run `npx tsc --noEmit` — fix any import errors caused by this change.

A5. Report: files created/modified, TypeScript errors fixed.

---

## TASK 2 — Import Wingman Button + Badge Components (HIGH PRIORITY)
Agent: component-importer

A1. Search for Button, Badge, LoadingSkeleton components in:
    `C:\Projects\Wingman\apps\mobile\src\components\`
    List all .tsx files found first, then read the relevant ones.

A2. Create `C:\Projects\Caps\components\Button.tsx`:
    - Adapt from Wingman's Button (or write fresh if Wingman's is too coupled)
    - Must have: spring press animation (scale 0.95 on press), variants: 'gold' | 'secondary' | 'ghost'
    - 'gold' variant: background gold, bold text, slight glow shadow
    - 'secondary' variant: outlined border, no fill
    - 'ghost' variant: no border, no fill
    - Loading state: show ActivityIndicator instead of label
    - Use THEME for all colors/spacing

A3. Create `C:\Projects\Caps\components\Badge.tsx`:
    - Spring entrance animation (scale from 0 to 1)
    - Props: label (string), variant: 'win' | 'lose' | 'tie' | 'rank'
    - 'win': gold background, dark text
    - 'lose': dark red background, light text
    - 'tie': gray background
    - 'rank': used for hand rank names (ROYAL FLUSH etc) — gold border, transparent bg
    - Use THEME

A4. Replace raw Pressable buttons with Button component:
    - `app\index.tsx` — "New Hand" → Button variant="gold"
    - `app\game.tsx` — "Ready" → Button variant="gold"
    - `app\summary.tsx` — "Next Hand" → Button variant="gold"
    - `app\settings.tsx` — "Reset Defaults" → Button variant="secondary"

A5. Run `npx tsc --noEmit` — fix any errors.

---

## TASK 3 — Game Phase State Machine (HIGH PRIORITY)
Agent: state-machine-refactor

A1. Read `store\gameStore.ts` and `app\game.tsx` fully.

A2. Create `types\gameTypes.ts`:
    ```typescript
    export type GamePhase =
      | { type: 'idle' }
      | { type: 'arranging'; timeLeft: number }
      | { type: 'waiting_for_bot' }
      | { type: 'revealing'; boardIndex: number }
      | { type: 'complete'; winnerId: 'player' | 'bot' | null }
      | { type: 'summary' }
    ```

A3. Create `hooks\useGameTimer.ts`:
    - Props: `initialSeconds: number`, `onExpire: () => void`
    - Returns: `{ timeLeft, isRunning, start, stop, reset }`
    - Uses useRef for interval, cleans up on unmount
    - Does NOT hardcode any values — initialSeconds comes from config

A4. Create `hooks\useRevealSequence.ts`:
    - Props: `boardCount: number`, `revealDuration: number`, `onBoardRevealed: (index: number) => void`, `onAllRevealed: () => void`
    - Returns: `{ currentBoardIndex, isRevealing, startReveal }`
    - Reveals boards one at a time, waits revealDuration between each
    - Cleans up on unmount

A5. Refactor `app\game.tsx`:
    - Replace all boolean flags (isArranging, isRevealing, etc.) with `GamePhase` state
    - Use `useGameTimer` for the countdown timer
    - Use `useRevealSequence` for the board reveal loop
    - Remove manual setTimeout/setInterval logic that was replaced by hooks
    - Keep all existing game logic intact — only refactor the phase/timer/reveal plumbing

A6. Run `npx tsc --noEmit` — fix any errors.

---

## TASK 4 — Zustand Persist Middleware (MEDIUM PRIORITY)
Agent: store-refactor

A1. Read `store\gameStore.ts` and `app\_layout.tsx` fully.

A2. Rewrite `store\gameStore.ts` using Zustand persist middleware:
    ```typescript
    import { create } from 'zustand'
    import { persist, createJSONStorage } from 'zustand/middleware'
    import AsyncStorage from '@react-native-async-storage/async-storage'
    ```
    - Persist only: `chips` and `config`
    - Storage key: `'caps-poker-storage'`
    - Keep all existing actions: setChips, addChips, updateConfig
    - Add new action: `resetConfig: () => void` that sets config back to DEFAULT_CONFIG

A3. Remove `loadPersistedData` from gameStore and its call in `app\_layout.tsx` — persist handles hydration automatically.

A4. In `app\settings.tsx`, wire the "Reset Defaults" button to call `resetConfig()` from the store.

A5. Run `npx tsc --noEmit` — fix any errors.

---

## TASK 5 — Reanimated Animations (MEDIUM PRIORITY)
Agent: animations

A1. Read `components\Card.tsx`, `components\Board.tsx`, `components\CompleteOverlay.tsx` fully.

A2. Upgrade `components\Card.tsx` using Reanimated 2:
    - Import: `useSharedValue, useAnimatedStyle, withSpring, withTiming` from 'react-native-reanimated'
    - Press animation: scale springs to 0.95 on press, back to 1.0 on release
    - Reveal flip: when `faceDown` prop changes false→true, animate rotateY 180deg with withTiming 400ms
    - Highlighted glow: when `highlighted` prop is true, add animated shadow/border pulse

A3. Upgrade `components\Board.tsx`:
    - Active board during reveal: pulsing gold border using withRepeat + withTiming on borderWidth or opacity

A4. Upgrade `components\CompleteOverlay.tsx`:
    - "COMPLETE" text: withSpring entrance (scale 0 → 1.1 → 1.0)
    - Winner text: slide up with withTiming
    - Particles: 12 Animated Views (small gold circles 8px), each animates from center outward in different directions using withTiming on translateX/Y, fading out

A5. Add floating chip text in `app\game.tsx`:
    - After each board reveal, show `+{chips} chips` text near the winning board
    - Animate: translateY from 0 to -50, opacity from 1 to 0, over 1000ms
    - Use Reanimated withSequence or Animated.sequence

A6. Run `npx tsc --noEmit` — fix any errors.

---

## TASK 6 — EAS Build + TestFlight Setup (HIGH PRIORITY)
Agent: testflight-setup

A1. Read all files in `C:\Projects\royea-mobile-launch-kit\` — list them first, then read the most relevant ones (init script, README, eas templates).

A2. Create `eas.json` in `C:\Projects\Caps\`:
    ```json
    {
      "cli": { "version": ">= 12.0.0" },
      "build": {
        "development": {
          "developmentClient": true,
          "distribution": "internal"
        },
        "preview": {
          "distribution": "internal",
          "ios": { "simulator": false }
        },
        "production": {
          "ios": { "buildConfiguration": "Release" }
        }
      },
      "submit": {
        "production": {
          "ios": { "appleId": "PLACEHOLDER_APPLE_ID" }
        }
      }
    }
    ```

A3. Update `app.json` — add these fields if missing:
    - `expo.owner`: `"PLACEHOLDER_OWNER"`
    - `expo.extra.eas.projectId`: `"PLACEHOLDER_PROJECT_ID"`
    - Confirm `expo.ios.bundleIdentifier` = `"com.capspoker.app"`
    - Confirm `expo.scheme` = `"capspoker"`

A4. Create `TESTFLIGHT_GUIDE.md`:
    ```markdown
    # Caps Poker — TestFlight Guide

    ## Prerequisites
    - Expo account at https://expo.dev
    - Apple Developer account ($99/year)
    - EAS CLI: npm install -g eas-cli

    ## One-time Setup (fill these in before building)
    1. app.json → expo.owner: your Expo username
    2. app.json → expo.extra.eas.projectId: from expo.dev dashboard
    3. eas.json → submit.production.ios.appleId: your Apple ID email

    ## Commands
    eas login                                          # login to Expo
    eas build:configure                                # link to Expo project
    eas build --platform ios --profile preview        # build for TestFlight
    eas submit --platform ios --latest                # submit to App Store Connect

    ## Time estimates
    - First build: ~15 min
    - Subsequent: ~10 min
    - TestFlight processing: ~10-20 min
    - Total first time: ~45 min
    ```

A5. Check if eas-cli is installed globally:
    `npm list -g eas-cli 2>&1`
    If not found, run: `npm install -g eas-cli`

A6. Report: all files created, what placeholders user must fill in, exact commands to run for first TestFlight build.

---

## FINAL STEPS (run after all 6 tasks complete)

1. `npx tsc --noEmit 2>&1` — must show zero errors
2. `npx jest utils/__tests__/handEvaluator.test.ts 2>&1 | tail -3` — must show 12/12
3. Update `MEMORY.md`:
   - Current state: "Sprint 03 complete — Wingman theme integrated, state machine refactored, reanimated animations added, EAS/TestFlight configured"
   - Add new files: constants/theme.ts, components/Button.tsx, components/Badge.tsx, hooks/useGameTimer.ts, hooks/useRevealSequence.ts, types/gameTypes.ts, eas.json, TESTFLIGHT_GUIDE.md
   - Open items: remove completed, add any new issues
4. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
5. `git add -A`
6. `git commit -m "sprint-03: wingman theme, state machine, reanimated animations, EAS TestFlight setup"`
7. Report in table format per task: files modified, lines changed, status

---

## DO NOT
- Change any Iron Rules
- Add multiplayer or networking
- Use hardcoded values — always read from config
- Modify the Omaha hand evaluator
- Break existing 12/12 tests
- Touch files in C:\Projects\Wingman — READ ONLY
- Ask the user questions mid-execution
- Skip MEMORY.md update
