# VAMOS CAPS BUILD-NUMBER-MISMATCH
**Date:** 2026-03-23 12:25 IST
**Priority:** 🔴🔴🔴🔴🔴 CRITICAL DISCOVERY — Build number mismatch may explain ALL crashes

## THE EVIDENCE
- TestFlight shows: Build 198
- WhatsApp crash alert shows: Build 116
- The app THINKS it's build 116 while running on build 198 binary

## WHY THIS MATTERS
If the app reports build 116, it means:
1. The build number in app.json/Constants is WRONG or STALE
2. OTA updates may not be loading because runtimeVersion doesn't match
3. ALL our crash fixes may never have reached the device
4. The user has been testing OLD CODE this entire time

## INVESTIGATE IMMEDIATELY

```
cd C:\Projects\Caps

echo "═══════════════════════════════════════"
echo "1. What does app.json say?"
echo "═══════════════════════════════════════"
grep -A 5 "buildNumber\|version\|runtimeVersion" app.json

echo ""
echo "═══════════════════════════════════════"
echo "2. What does eas.json say about auto-increment?"
echo "═══════════════════════════════════════"
cat eas.json | python -m json.tool

echo ""
echo "═══════════════════════════════════════"
echo "3. Where does the app READ the build number?"
echo "═══════════════════════════════════════"
grep -rn "buildNumber\|BUILD\|build.*number\|Constants.*version\|expoConfig.*build\|nativeBuildVersion" \
  app/ components/ utils/ | grep -v node_modules | grep -v __tests__ | head -20

echo ""
echo "═══════════════════════════════════════"
echo "4. What does the crash alert code use?"
echo "═══════════════════════════════════════"
grep -n "build\|BUILD\|version\|VERSION" utils/crashAlert.ts utils/crashDetector.ts utils/dirtyShutdown.ts | head -20

echo ""
echo "═══════════════════════════════════════"
echo "5. What does VersionBadge show?"
echo "═══════════════════════════════════════"
grep -n "buildNumber\|build\|version\|Constants" components/VersionBadge.tsx | head -10
cat components/VersionBadge.tsx

echo ""
echo "═══════════════════════════════════════"
echo "6. What does Constants actually return?"
echo "═══════════════════════════════════════"
# Constants.expoConfig reads from app.json at BUILD time
# But EAS auto-increment changes buildNumber DURING build
# If app.json says 116 and EAS increments to 198 — 
# Constants.expoConfig.ios.buildNumber might still say 116!
grep -n "expoConfig\|manifest\|Constants\." utils/ components/ app/ | grep -v node_modules | head -20

echo ""
echo "═══════════════════════════════════════"
echo "7. Check EAS auto-increment config"
echo "═══════════════════════════════════════"
grep -A 10 "autoIncrement\|buildNumber" eas.json

echo ""
echo "═══════════════════════════════════════"
echo "8. What's the ACTUAL buildNumber in app.json right now?"
echo "═══════════════════════════════════════"
python -c "import json; d=json.load(open('app.json')); print('ios.buildNumber:', d.get('expo',{}).get('ios',{}).get('buildNumber','NOT SET'))"

echo ""
echo "═══════════════════════════════════════"
echo "9. Check OTA runtimeVersion"
echo "═══════════════════════════════════════"
eas update:list --branch production --limit 3 2>&1

echo ""
echo "═══════════════════════════════════════"
echo "10. Check latest build's runtimeVersion"
echo "═══════════════════════════════════════"
eas build:list --platform ios --limit 3 --json 2>&1 | grep -E "runtimeVersion|appVersion|buildNumber" | head -10
```

## THE FIX

### If app.json has buildNumber: "116" (hardcoded):
EAS auto-increment happens DURING build — it changes the number in the binary.
But Constants.expoConfig reads from the COMPILED app.json — which SHOULD have 198.
HOWEVER: if OTA is loading, it may use the OTA's app.json which has 116.

### The real fix:
```typescript
// Don't read buildNumber from Constants.expoConfig (unreliable with OTA)
// Instead use: Application.nativeBuildVersion (reads from the BINARY)

import * as Application from 'expo-application';

const BUILD_NUMBER = Application.nativeBuildVersion ?? 'unknown';
// This reads from the iOS binary's Info.plist — always correct
```

Update EVERY file that reads build number:
```bash
grep -rn "expoConfig.*buildNumber\|Constants.*build" utils/ components/ app/ | grep -v node_modules | head -20
```

Replace all instances:
```typescript
// BEFORE (wrong — reads OTA app.json):
Constants.expoConfig?.ios?.buildNumber

// AFTER (correct — reads native binary):
import * as Application from 'expo-application';
Application.nativeBuildVersion
```

### Also check: is expo-application installed?
```bash
grep "expo-application" package.json
# If not:
npx expo install expo-application
```

## DEPLOY
```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

eas update --branch production --message "fix: build number — use Application.nativeBuildVersion instead of Constants"
git add -A && git commit -m "fix: build number mismatch — read from native binary, not OTA app.json"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
BUILD NUMBER MISMATCH — REPORT
═══════════════════════════════════════
app.json buildNumber: [value]
EAS auto-increment: [YES/NO — config]
Constants.expoConfig.ios.buildNumber at runtime: [value]
Application.nativeBuildVersion: [value — if installed]

Root cause: [app.json hardcoded / OTA overrides / Constants reads wrong source]
Fix: [describe]

Files updated: [list]
expo-application: [installed / already present]

OTA runtimeVersion matches build: [YES/NO]
═══════════════════════════════════════
```

VAMOS CAPS BUILD-NUMBER-MISMATCH — END
