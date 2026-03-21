VAMOS CAPS FULL-PIPELINE-AUDIT 2026-03-18-1030

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
App keeps crashing on iOS. Multiple fixes attempted, still crashing.
Need full pipeline audit to find ALL crash sources at once.

---

## TASK A — Read the FULL game flow end to end
Agent: pipeline-auditor

A1. Read these files COMPLETELY (not just parts):
    - app/game.tsx (full)
    - app/results.tsx (full)
    - hooks/useGameTimer.ts (full)
    - hooks/useRevealSequence.ts (full)
    - store/gameStore.ts (full)
    - components/RevealSequence.tsx (full)

A2. Trace the COMPLETE game flow:
    1. Player opens game → initializeGameMulti()
    2. Player arranges cards → handleSelectCard, handleBoardPress
    3. Player presses READY → setPlayerReady
    4. Bot places cards → placeSingleBotCards (setTimeout)
    5. Both ready → navigateToReveal()
    6. setRevealData() → router.replace('/results')
    7. results.tsx loads → RevealSequence shows
    8. Each board reveals → turn/river flip
    9. Done → summary

A3. At EACH step — find any potential crash:
    - Undefined access
    - setState after unmount
    - Missing null check
    - Navigation to screen that doesn't exist
    - Reanimated worklet crash
    - Platform-specific crash (iOS New Architecture)

A4. List ALL issues found with file + line number

---

## TASK B — Fix ALL issues at once
Agent: crash-fixer

B1. Fix every issue found in Task A

B2. Specifically check these known iOS New Architecture issues:
    - pointerEvents as JSX prop (already fixed — verify)
    - Reanimated: withTiming inside useAnimatedStyle conditionally
    - StyleSheet.flatten() issues
    - Any direct DOM manipulation
    - Any window/document access without Platform guard

B3. Add global error boundary in app/_layout.tsx:
    ```tsx
    import { ErrorBoundary } from 'expo-router';
    // expo-router already provides this — make sure it's enabled
    ```

B4. Add try/catch to EVERY navigation call:
    - router.replace('/results') → wrap in try/catch
    - router.push() → wrap in try/catch

B5. Check if expo-router version supports RN 0.83:
    cat package.json | grep expo-router

B6. npx tsc --noEmit — 0 errors
B7. npx jest --silent — all pass

---

## TASK C — Verify the CI build actually ran
Agent: ci-checker

C1. Check latest CI build status:
    gh run list --repo royea-beep/caps-poker --limit 5

C2. Check if TestFlight has a new build (v1.9.2+):
    eas build:list --platform ios --limit 3

C3. If CI is failing — fix it

C4. Report which version is currently in TestFlight

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: full pipeline audit, all iOS crash sources"
7. git push origin main
8. Report: complete list of all crashes found and fixed, CI status, TestFlight version

VAMOS CAPS FULL-PIPELINE-AUDIT — END
