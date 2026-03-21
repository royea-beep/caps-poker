# You are continuing the CAPS POKER project.
# PARALLEL SPRINT — TestFlight build preparation.
# Launch all 5 agents at once.
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

## CONTEXT
The app runs successfully on Expo Go. Goal of this sprint:
get a clean TestFlight build via EAS. No new features.
Fix anything that blocks the build. Prepare assets. Submit.

---

## TASK 1 — Pre-Build Validation (CRITICAL)
Agent: pre-build-validator

A1. Run: `npx tsc --noEmit 2>&1` — must be zero errors. Fix anything found.

A2. Run: `npx expo-doctor 2>&1` — read all warnings/errors.
    Fix any that are marked as errors or would block a build.
    Document warnings that are safe to ignore.

A3. Read `app.json` — verify ALL these fields are set:
    - expo.name: "Caps Poker"
    - expo.slug: "caps-poker"
    - expo.version: "1.0.0"
    - expo.orientation: "portrait"
    - expo.userInterfaceStyle: "dark"
    - expo.scheme: "capspoker"
    - expo.ios.bundleIdentifier: "com.capspoker.app"
    - expo.ios.supportsTablet: false
    - expo.owner: must NOT be "PLACEHOLDER_OWNER" — if it is, REMOVE the owner field entirely (EAS will use logged-in account)
    - expo.extra.eas.projectId: leave as placeholder, user will fill after eas build:configure

A4. Read `eas.json` — verify structure is valid JSON and profiles are correct.

A5. Read `package.json` — check for any dependency version conflicts flagged by expo-doctor.
    Run: `npx expo install --fix 2>&1` to auto-fix version mismatches.
    Report what was fixed.

---

## TASK 2 — App Icons + Splash Screen (CRITICAL)
Agent: assets-builder

A1. Check what's currently in the `assets/` folder:
    `Get-ChildItem C:\Projects\Caps\assets\`

A2. The current icons are from the Expo template (blank). We need real icons.
    Create a proper icon using React Native's built-in approach:
    
    Generate `assets/icon.png` — a 1024x1024 PNG:
    - Dark green background (#0a1a0f)
    - Gold text "CP" centered, bold, large
    - Use sharp-cli or canvas if available, otherwise use the existing placeholder and document what user needs to replace

A3. Check if `sharp-cli` or `canvas` npm package is available:
    `npm list -g sharp-cli 2>&1`
    `node -e "require('canvas')" 2>&1`
    
    If neither available, create a Node.js script `scripts/generate-icon.js` that:
    - Uses jimp (install if needed: `npm install jimp --save-dev`)
    - Creates a 1024x1024 dark green image
    - Saves to assets/icon.png
    Then run it.

A4. For splash screen — update `app.json`:
    - expo.splash.backgroundColor: "#0a1a0f"
    - expo.splash.resizeMode: "contain"
    Verify splash image exists (assets/splash-icon.png or similar).

A5. Verify `assets/adaptive-icon-foreground.png` exists (needed for Android, but won't block iOS build).
    Report asset status.

---

## TASK 3 — EAS Account Setup Commands (CRITICAL)
Agent: eas-setup

A1. Check if eas-cli is installed and what version:
    `eas --version 2>&1`
    If not found: `npm install -g eas-cli 2>&1`

A2. Check if user is logged in to Expo:
    `eas whoami 2>&1`
    Report the result. If not logged in, the user will need to run `eas login` manually — document this clearly.

A3. Read `TESTFLIGHT_GUIDE.md` — verify it's accurate and complete.
    Update it if anything is missing based on current project state.

A4. Create `scripts/preflight-check.js` — a Node.js script the user can run before building:
    ```javascript
    const fs = require('fs');
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
    
    const checks = [
      { name: 'Bundle ID set', pass: appJson.expo.ios?.bundleIdentifier !== undefined },
      { name: 'Scheme set', pass: appJson.expo.scheme !== undefined },
      { name: 'Version set', pass: appJson.expo.version !== undefined },
      { name: 'EAS preview profile exists', pass: easJson.build?.preview !== undefined },
      { name: 'No PLACEHOLDER in appleId', pass: !JSON.stringify(easJson).includes('PLACEHOLDER_APPLE_ID') || true }, // warn only
    ];
    
    checks.forEach(c => console.log(`${c.pass ? '✅' : '❌'} ${c.name}`));
    ```

A5. Create clear `BUILD_INSTRUCTIONS.md`:
    ```markdown
    # How to Build Caps Poker for TestFlight

    ## Step 1 — Login (one time)
    eas login
    # Enter your Expo account credentials

    ## Step 2 — Link project (one time)
    eas build:configure
    # This will update app.json with your projectId automatically

    ## Step 3 — Build
    eas build --platform ios --profile preview
    # Takes ~10-15 minutes
    # You'll get a download link when done

    ## Step 4 — Submit to TestFlight
    eas submit --platform ios --latest
    # Requires Apple Developer account
    # First time: it will ask for your Apple ID and password

    ## Step 5 — TestFlight
    - Open App Store Connect: https://appstoreconnect.apple.com
    - Go to TestFlight tab
    - Your build will appear within 10-20 minutes
    - Add yourself as internal tester

    ## Troubleshooting
    - "Not logged in": run `eas login`
    - "Project not found": run `eas build:configure`
    - Build fails: check logs at https://expo.dev/builds
    ```

---

## TASK 4 — Metro + Bundle Optimization (IMPORTANT)
Agent: bundle-optimizer

A1. Check if `metro.config.js` exists. If not, create it:
    ```javascript
    const { getDefaultConfig } = require('expo/metro-config');
    const config = getDefaultConfig(__dirname);
    module.exports = config;
    ```

A2. Read `app.json` — add these iOS-specific optimizations if missing:
    ```json
    "ios": {
      "bundleIdentifier": "com.capspoker.app",
      "supportsTablet": false,
      "infoPlist": {
        "UIRequiresFullScreen": true,
        "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"]
      }
    }
    ```

A3. Check `babel.config.js` — verify:
    - `react-native-reanimated/plugin` is the LAST plugin
    - No duplicate entries

A4. Run: `npx expo export --platform ios 2>&1 | tail -20`
    This does a dry-run bundle. If it fails, read the full error and fix it.
    If it succeeds, report bundle size.

A5. Run final check: `npx tsc --noEmit 2>&1` — must be zero errors after all changes.

---

## TASK 5 — Final Pre-Submit Smoke Test (IMPORTANT)
Agent: smoke-tester

A1. Run: `npx jest 2>&1 | tail -5` — verify 12/12 still pass.

A2. Read through `app\game.tsx` — do a logic sanity check:
    - Can a hand actually start? (chips deducted, boards dealt)
    - Can player place cards on boards?
    - Does Ready button appear when all boards filled?
    - Does reveal sequence run after both ready?
    - Does summary screen receive correct data?
    Document any obvious logic gaps found (do NOT fix them — report only).

A3. Read `app\settings.tsx` — verify all config params have:
    - A label
    - An input/slider
    - Save on change or explicit save button
    Document any missing params.

A4. Read `app\summary.tsx` — verify it shows:
    - Result per board (win/lose/tie)
    - Net chips delta
    - COMPLETE bonus if applicable
    - "Next Hand" button
    Document any missing elements.

A5. Create `QA_CHECKLIST.md`:
    ```markdown
    # Caps Poker — QA Checklist (Pre-TestFlight)

    ## Core Game Flow
    - [ ] App launches without crash
    - [ ] Home screen shows chip balance
    - [ ] "New Hand" starts a game
    - [ ] 16 cards dealt to player hand
    - [ ] Timer counts down from 60 seconds
    - [ ] Cards can be placed on boards (tap card → tap board)
    - [ ] Cards can be removed from boards (tap placed card)
    - [ ] Ready button appears when all 4 boards have 4 cards
    - [ ] Bot places cards within configured time
    - [ ] Reveal sequence runs left to right
    - [ ] Winning hand cards are highlighted
    - [ ] Chips animate to winner
    - [ ] Summary screen shows correct results
    - [ ] "Next Hand" returns to home or starts new hand
    - [ ] Chip balance persists between sessions

    ## COMPLETE Bonus
    - [ ] COMPLETE overlay appears when player wins all boards
    - [ ] Bonus chips are calculated correctly (50% of total pot)
    - [ ] Overlay dismisses after configured duration

    ## Settings
    - [ ] All parameters visible and editable
    - [ ] Changes take effect immediately in next hand
    - [ ] Reset to defaults works

    ## Edge Cases
    - [ ] Timer runs out → remaining slots auto-filled
    - [ ] Tie on a board → pot split or returned
    - [ ] App goes to background mid-game → returns correctly
    ```

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors required
2. `npx jest 2>&1 | tail -3` — 12/12 required
3. Update `MEMORY.md`:
   - Current state: "Sprint 04 complete — TestFlight build ready, awaiting eas login + build:configure"
   - Add BUILD_INSTRUCTIONS.md, QA_CHECKLIST.md, scripts/preflight-check.js to file structure
   - Open items: update with TestFlight steps remaining
4. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
5. `git add -A`
6. `git commit -m "sprint-04: TestFlight prep, assets, EAS config, QA checklist"`
7. Final report: what user needs to do manually to get first build

---

## DO NOT
- Change any Iron Rules
- Add new game features
- Modify the Omaha hand evaluator
- Break existing 12/12 tests
- Ask the user questions mid-execution
- Skip MEMORY.md update
- Run `eas login` or `eas build` — setup commands only, no actual build execution
