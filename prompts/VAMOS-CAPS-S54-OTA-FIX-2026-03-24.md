# VAMOS CAPS CAPS-S54-OTA-FIX
**Date:** 2026-03-24 IST
**Sprint:** CAPS-S54 — OTA Not Loading on Device (Critical Fix)

---

## PROBLEM
Device shows OTA: e004a7fb (old)
Latest OTA deployed: e7309bb6 (S53)
Device build: 228
OTA is NOT updating even after kill + reopen twice.

---

## BEFORE AUDIT

```bash
cd C:\Projects\Caps

echo "=== Current OTA list on production branch ==="
eas update:list --branch production --limit 10

echo "=== app.json OTA config ==="
cat app.json | python -m json.tool | grep -A 20 '"updates"'
cat app.json | python -m json.tool | grep -E '"runtimeVersion"|"channel"|"sdkVersion"|"version"'

echo "=== eas.json channels ==="
cat eas.json

echo "=== What channel does build 228 use? ==="
eas build:list --platform ios --limit 3 --json 2>/dev/null | python -m json.tool | grep -E "channel|runtimeVersion|buildNumber|id" | head -20
```

---

## TASK A — DIAGNOSE

A1. Run the commands above and report exact output.

A2. The most common causes of OTA not updating:
- **runtimeVersion mismatch** — OTA was deployed with runtimeVersion X but build has runtimeVersion Y → OTA silently ignored
- **Wrong channel** — OTA deployed to branch "production" but build was compiled with channel "preview" or "main"
- **updates.checkOnLaunch = "NEVER"** — disabled in app.json
- **OTA group ID mismatch** — eas update used wrong branch

A3. Check specifically:
```bash
# What runtimeVersion does the latest OTA have?
eas update:list --branch production --limit 3 --json 2>/dev/null | python -m json.tool | grep -E "runtimeVersion|branch|id|message" | head -30

# What runtimeVersion does the binary (build 228) have?
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "runtimeVersion|channel|buildNumber" | head -10
```

---

## TASK B — FIX

Based on diagnosis, apply the correct fix:

### If runtimeVersion mismatch:
```bash
# Check current runtimeVersion policy in app.json
# If policy="appVersion" → runtimeVersion = app version string (e.g. "1.9.4")
# OTA must be deployed targeting same runtimeVersion as the binary

# Re-deploy S53 OTA to correct branch/runtimeVersion:
eas update --branch production --message "fix(S54): re-deploy S53 with correct runtimeVersion — BoardReveal + handHint"
```

### If wrong channel:
```bash
# Find what channel build 228 uses (from eas build:list output)
# Re-deploy OTA to THAT channel:
eas update --branch [CORRECT_CHANNEL] --message "fix(S54): S53 features to correct channel"
```

### If updates.checkOnLaunch is wrong:
In app.json, set:
```json
"updates": {
  "enabled": true,
  "checkOnLaunch": "ALWAYS",
  "fallbackToCacheTimeout": 0
}
```
Then rebuild is required — but try OTA re-deploy first.

### If all config looks correct:
Force update check by adding this to app/_layout.tsx (temporary, remove after confirmed working):
```typescript
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

// In root layout useEffect:
useEffect(() => {
  async function checkForUpdate() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (e) {
      // ignore in production
    }
  }
  if (!__DEV__) checkForUpdate();
}, []);
```
This forces an immediate OTA check and reload on every app open.

---

## TASK C — VERIFY FIX

After fix is applied:

C1. Report: what was the root cause?
C2. Report: what exact fix was applied?
C3. Deploy new OTA if needed:
```bash
eas update --branch [correct-branch] --message "fix(S54): OTA delivery fix + S53 features confirmed"
git add -A && git commit -m "fix(S54): OTA update check — force reload on launch"
git push origin main
```

---

## AFTER AUDIT

```
═══════════════════════════════════════
CAPS-S54 — OTA FIX REPORT
═══════════════════════════════════════
Root cause: [runtimeVersion mismatch / wrong channel / config / other]
Binary (build 228) channel: [channel name]
Binary (build 228) runtimeVersion: [value]
Latest OTA runtimeVersion: [value]
Match: [YES/NO]

Fix applied: [description]
Force update check added to _layout.tsx: [YES/NO]

New OTA hash: [hash]
New OTA targets channel: [channel]
New OTA runtimeVersion: [value]

TS errors: 0
Tests: 2234/2234
Git: [commit]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change runtimeVersion policy without understanding the impact
- Do NOT rebuild the binary unless OTA fix is impossible
- Do NOT skip the diagnosis — fix the root cause, not the symptom

Yes, allow all edits in components/ during this session.

VAMOS CAPS CAPS-S54-OTA-FIX — END
