# VAMOS CAPS OTA-DEBUG
**Date:** 2026-03-22 IST
## DO NOT change game code. ONLY diagnose OTA.

```
cd C:\Projects\Caps

echo "=== app.json updates config ==="
grep -A 10 "updates" app.json

echo ""
echo "=== eas.json channels ==="
cat eas.json | grep -A 5 "channel\|branch"

echo ""
echo "=== _layout.tsx update check ==="
grep -A 20 "Updates\|checkForUpdate\|fetchUpdate\|reloadAsync" app/_layout.tsx

echo ""
echo "=== runtimeVersion ==="
grep -A 3 "runtimeVersion" app.json

echo ""
echo "=== EAS update history ==="
eas update:list --limit 5

echo ""
echo "=== EAS channel list ==="
eas channel:list 2>&1

echo ""
echo "=== EAS branch list ==="
eas branch:list 2>&1

echo ""
echo "=== Latest build's channel ==="
eas build:list --platform ios --limit 3 --json 2>&1 | grep -E "channel|updateChannel|runtimeVersion" | head -10

echo ""
echo "=== Current update branch ==="
eas update:list --branch production --limit 3 2>&1
```

Common OTA failures:
1. Build was made BEFORE expo-updates was installed → build doesn't check for updates
2. runtimeVersion mismatch → build expects v1.0.0 but update was published for v1.0.1
3. Channel mismatch → build on "preview" channel but update on "production" channel
4. expo-updates not in plugins in app.json
5. Update check code not running (missing import or __DEV__ guard blocks it)

Report:
```
═══════════════════════════════════════
OTA DEBUG
═══════════════════════════════════════
expo-updates installed: [YES/NO]
expo-updates in plugins: [YES/NO]
updates.url in app.json: [YES/NO + value]
runtimeVersion in app.json: [value]
Update check in _layout.tsx: [YES/NO]
__DEV__ guard blocks check: [YES/NO]

Latest OTA update:
  branch: [name]
  runtimeVersion: [value]
  published: [when]

Latest build (172):
  channel: [name]
  runtimeVersion: [value]
  includes expo-updates: [YES/NO — was it built AFTER expo-updates added?]

MATCH: [YES — should work / NO — mismatch on X]
FIX: [what needs to change]
═══════════════════════════════════════
```

If the build was made BEFORE expo-updates was installed → OTA will NEVER work on that build.
Need a NEW build with expo-updates included. Report this clearly.

VAMOS CAPS OTA-DEBUG — END
