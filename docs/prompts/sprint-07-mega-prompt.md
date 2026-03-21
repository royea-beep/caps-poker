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
- Rule 6: No backend for single-player ✓
- Rule 7: Local multiplayer via react-native-tcp-socket ✓
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2) ✓

---

## CONTEXT
react-native-tcp-socket does NOT work in Expo Go — requires a custom native build.
Goals this sprint:
1. Configure EAS development build (includes native modules)
2. Fix all TODO markers left in multiplayer code from Sprint 06
3. Full game flow audit — single player + multiplayer
4. Build and install development client on device

---

## TASK 1 — EAS Development Build Config (CRITICAL)
Agent: eas-dev-config

A1. Read `eas.json` and `app.json` fully.

A2. Install expo-dev-client:
    ```
    npx expo install expo-dev-client
    ```

A3. Update `eas.json` — ensure development profile looks exactly like this:
    ```json
    {
      "cli": { "version": ">= 12.0.0" },
      "build": {
        "development": {
          "developmentClient": true,
          "distribution": "internal",
          "ios": {
            "simulator": false,
            "buildConfiguration": "Debug"
          }
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
          "ios": { "appleId": "royearguan@gmail.com" }
        }
      }
    }
    ```

A4. Update `app.json` — add plugins array if missing or incomplete:
    ```json
    "plugins": [
      "expo-router",
      "expo-dev-client",
      "react-native-tcp-socket"
    ]
    ```
    Verify `expo.scheme` = "capspoker" — required for dev client deep linking.

A5. Run `npx expo-doctor 2>&1` — fix any issues found.
    Run `npx tsc --noEmit 2>&1` — must be zero errors.
    Report: what was changed, any issues found.

---

## TASK 2 — Fix All Multiplayer TODOs (CRITICAL)
Agent: todo-fixer

A1. Search all multiplayer files for TODO/FIXME markers:
    ```powershell
    Select-String -Path "app\multiplayer-game.tsx","app\lobby\host.tsx","app\lobby\join.tsx","utils\gameServer.ts","utils\gameClient.ts" -Pattern "TODO|FIXME|HACK|XXX" -CaseSensitive
    ```

A2. Read `app\multiplayer-game.tsx` fully and fix:
    - Wire PLAYER_READY message: when player taps Ready button, send PLAYER_READY message via gameClient (guest) or handle directly (host)
    - Ensure host receives all PLAYER_READY messages before starting reveal
    - Ensure guest UI waits correctly after sending PLAYER_READY

A3. Read `app\lobby\host.tsx` fully and verify:
    - After "Start Game" tapped: dealNewHand() called with correct playerCount
    - Each player receives ONLY their own cards (not other players' cards)
    - Host navigates to multiplayer-game.tsx as player index 0
    - All guests receive GAME_START + CARDS_DEALT and navigate automatically

A4. Read `app\lobby\join.tsx` fully and verify:
    - After GAME_START received: navigate to /multiplayer-game with correct params
    - Player index is passed correctly (seat number from ROOM_JOIN_ACK)

A5. Read `utils\gameServer.ts` — verify the reveal sequence:
    - After all PLAYER_READY received: evaluateAllBoards() called
    - BOARD_REVEAL messages sent sequentially with boardRevealDuration delay
    - HAND_COMPLETE sent after all boards revealed with full chip deltas
    - Host updates chip balance in store

A6. Run `npx tsc --noEmit 2>&1` — zero errors required.

---

## TASK 3 — Network Resilience (IMPORTANT)
Agent: network-resilience

A1. Read `utils\gameServer.ts` and `utils\gameClient.ts` fully.

A2. Add connection timeout handling in gameClient.ts:
    - If connect() doesn't succeed within connectionTimeoutMs (30s), reject with clear error
    - Show user-friendly error message in join.tsx: "Could not connect. Check the IP address and try again."

A3. Add player disconnect handling mid-game in gameServer.ts:
    - If a guest disconnects during arrangement phase: auto-fill their boards randomly, mark them as bot
    - If a guest disconnects during reveal phase: continue reveal, show "Disconnected" for that player
    - If host disconnects: all guests receive ERROR message and return to home screen

A4. Add reconnect attempt in gameClient.ts:
    - On unexpected disconnect: attempt reconnect up to reconnectAttempts (3) times
    - Show "Reconnecting..." UI state in multiplayer-game.tsx
    - If all attempts fail: navigate back to home with error message

A5. Run `npx tsc --noEmit 2>&1` — zero errors required.

---

## TASK 4 — Single Player Game Flow Audit (IMPORTANT)
Agent: singleplayer-auditor

A1. Read `app\game.tsx` fully — trace the entire game flow:
    - Phase: idle → arranging → waiting_for_bot → revealing → complete/summary
    - Verify each phase transition is triggered correctly
    - Verify timer starts on arranging phase
    - Verify bot places cards when in waiting_for_bot phase

A2. Run the simulation from utils/simulate.ts as a proxy for the game logic:
    ```
    node -e "
    const { simulateHand } = require('./utils/simulate');
    const { DEFAULT_CONFIG } = require('./constants/gameConfig');
    for (let i = 0; i < 10; i++) {
      const r = simulateHand(2, DEFAULT_CONFIG);
      const sum = r.chipDeltas.reduce((a,b) => a+b, 0);
      console.log('Hand', i+1, '— zero-sum:', sum === 0 ? 'OK' : 'FAIL', '— complete:', r.completeWinner !== null);
    }
    "
    ```
    Report results.

A3. Read `app\summary.tsx` — verify it correctly displays:
    - Winner/loser per board
    - Net chips change
    - COMPLETE bonus if applicable
    - Chip balance updated in store

A4. Read `hooks\useGameTimer.ts` and `hooks\useRevealSequence.ts` — verify no memory leaks:
    - Cleanup on unmount
    - No stale closures
    - Timer stops when component unmounts

A5. Document any bugs found (do NOT fix — report to Task integration agent).

---

## TASK 5 — Build Instructions Update + Dev Build Guide (IMPORTANT)
Agent: build-guide

A1. Read `BUILD_INSTRUCTIONS.md` and `TESTFLIGHT_GUIDE.md` fully.

A2. Create `DEV_BUILD_GUIDE.md`:
    ```markdown
    # Caps Poker — Development Build Guide

    ## Why you need a dev build
    react-native-tcp-socket (used for local multiplayer) requires
    native code that is NOT included in Expo Go.
    You need a custom development build to test multiplayer features.

    ## Build the dev client (one time per major change)
    eas build --platform ios --profile development

    ## Install on device
    - Scan QR code from the build page
    - Or download .ipa and install via Apple Configurator 2

    ## Run the app
    npx expo start --dev-client
    # Then scan QR with your dev build app (not Expo Go)

    ## Testing multiplayer locally
    1. Both devices must be on the same WiFi network
    2. Device A: tap "HOST GAME" — note the IP and room code shown
    3. Device B: tap "JOIN GAME" — enter the IP and room code
    4. Host selects player count and taps "START GAME"
    5. Both devices arrange cards within 60 seconds
    6. Boards reveal automatically

    ## Rebuild when needed
    - New native package installed
    - app.json plugins changed
    - Major Expo SDK upgrade
    DO NOT rebuild for JS-only changes — just restart with npx expo start --dev-client

    ## Preview build (for TestFlight, no dev tools)
    eas build --platform ios --profile preview
    ```

A3. Update `BUILD_INSTRUCTIONS.md` with dev build section at the top.

A4. Update `QA_CHECKLIST.md` — add multiplayer section:
    ```markdown
    ## Local Multiplayer
    - [ ] HOST GAME button visible on home screen
    - [ ] JOIN GAME button visible on home screen
    - [ ] Host lobby shows room code and IP address
    - [ ] Guest can connect via IP + room code
    - [ ] Player list updates on both devices when guest joins
    - [ ] Host can select player count (2/3/4)
    - [ ] Start Game deals correct card counts
    - [ ] Each player only sees their own cards
    - [ ] Both players can arrange cards independently
    - [ ] Ready button sends signal to host
    - [ ] Reveal sequence runs on both devices simultaneously
    - [ ] Chip deltas are correct and zero-sum
    - [ ] Disconnection handled gracefully
    ```

A5. Report: files updated, any gaps found in documentation.

---

## TASK 6 — Final Verification + New Preview Build Prep (IMPORTANT)
Agent: build-prep

A1. Run all checks:
    ```
    npx tsc --noEmit 2>&1
    npx jest 2>&1 | tail -5
    node scripts/preflight-check.js 2>&1
    npx expo-doctor 2>&1 | tail -5
    ```
    All must pass.

A2. Update `app.json` version to "1.1.0" — multiplayer is a significant feature addition.
    Update `ios.buildNumber` to "2" if it exists, or add it.

A3. Update `MEMORY.md`:
    - Current state: "Sprint 07 complete — EAS dev build configured, multiplayer TODOs fixed, ready for device testing"
    - Add DEV_BUILD_GUIDE.md to file structure
    - Update open items: remove fixed TODOs, add "First multiplayer device test pending"
    - Lock Rule 7 and Rule 8 explicitly

A4. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`

A5. `git add -A`
    `git commit -m "sprint-07: EAS dev build config, multiplayer TODOs fixed, resilience, v1.1.0"`

A6. Print the exact commands user needs to run to get the dev build:
    ```
    # Step 1 — build dev client (run once)
    eas build --platform ios --profile development

    # Step 2 — start dev server
    npx expo start --dev-client

    # Step 3 — scan QR with the installed dev build app (NOT Expo Go)
    ```

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors
2. `npx jest 2>&1 | tail -5` — 31/31
3. Update MEMORY.md
4. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
5. `git add -A`
6. `git commit -m "sprint-07: EAS dev build config, multiplayer TODOs fixed, resilience, v1.1.0"`
7. Report in table format

---

## DO NOT
- Change any Iron Rules
- Break existing 31/31 tests
- Remove or modify single-player bot game
- Use hardcoded values
- Ask the user questions mid-execution
- Skip MEMORY.md update
- Actually run `eas build` — configure only, user runs the build manually
