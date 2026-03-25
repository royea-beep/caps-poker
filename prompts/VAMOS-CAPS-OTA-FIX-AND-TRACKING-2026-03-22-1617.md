# VAMOS CAPS OTA-FIX-AND-TRACKING
**Date:** 2026-03-22 16:17 IST
**Priority:** 🔴 OTA not loading on build 178 + need deploy tracking

## TWO TASKS

═══════════════════════════════════════════════════════════
TASK 1 — Why is OTA not loading on Build 178?
═══════════════════════════════════════════════════════════

```
cd C:\Projects\Caps

echo "=== 1. What runtimeVersion is in app.json? ==="
grep -A 3 "runtimeVersion" app.json

echo ""
echo "=== 2. What channel/branch are OTA updates on? ==="
eas update:list --branch production --limit 5 2>&1

echo ""
echo "=== 3. What channel was Build 178 built with? ==="
eas build:list --platform ios --limit 3 --json 2>&1 | grep -E "channel|runtimeVersion|appVersion|buildNumber" | head -15

echo ""
echo "=== 4. Is expo-updates in the plugins? ==="
grep "expo-updates" app.json

echo ""
echo "=== 5. Is the update check code running? ==="
grep -A 15 "checkForUpdate\|Updates\." app/_layout.tsx

echo ""
echo "=== 6. Is __DEV__ blocking the check? ==="
grep "__DEV__" app/_layout.tsx

echo ""
echo "=== 7. What's the EXACT updates config? ==="
grep -A 10 '"updates"' app.json

echo ""
echo "=== 8. Is expo-updates actually in package.json? ==="
grep "expo-updates" package.json

echo ""
echo "=== 9. Was Build 178 built AFTER expo-updates was added? ==="
# Check the commit that Build 178 was built from:
eas build:list --platform ios --limit 3 --json 2>&1 | grep -E "gitCommitHash|id" | head -10

echo ""
echo "=== 10. Check if runtimeVersion matches ==="
# The build's runtimeVersion MUST match the update's runtimeVersion
# If app.json says policy:"appVersion" and version is "1.9.4"
# Then both build and update must have runtimeVersion = "1.9.4"
```

### Common OTA failures:
1. **runtimeVersion mismatch** — build expects "1.9.4" but update published for "1.9.5"
2. **Channel mismatch** — build on "production" but update on "preview"
3. **expo-updates not in plugins** — installed but not configured
4. **Updates disabled** — `enabled: false` in app.json
5. **checkAutomatically: "ON_ERROR_RECOVERY"** instead of "ON_LOAD"
6. **__DEV__ guard too aggressive** — blocks even in TestFlight
7. **Build was compiled before expo-updates was added to native modules** — even if package.json has it, the native module wasn't compiled in

### FIX based on findings:

If runtimeVersion mismatch:
```
# Re-publish update with correct runtimeVersion:
eas update --branch production --message "fix: match runtimeVersion to build 178"
```

If channel mismatch:
```
# Map the channel:
eas channel:edit production --branch production
```

If expo-updates not in native build:
```
# Need a NEW build — expo-updates must be compiled into the binary:
# This is the most likely issue if it was added after build 178 was queued
eas build --platform ios --profile production --auto-submit-with-profile ci --non-interactive
```

If __DEV__ blocking:
```typescript
// Change from:
if (!__DEV__) { /* check updates */ }
// To:
// Always check (TestFlight is NOT __DEV__ but some configs might flag it)
(async () => {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.log('Update check:', e);
  }
})();
```

═══════════════════════════════════════════════════════════
TASK 2 — Deploy Tracking: Know when a new version goes live
═══════════════════════════════════════════════════════════

### 2A. Add version display in-app that shows OTA status

In `app/_layout.tsx` or a visible component:
```typescript
import * as Updates from 'expo-updates';

// Show current update info:
const updateInfo = Updates.isEmbeddedLaunch 
  ? 'embedded (no OTA loaded)'
  : `OTA: ${Updates.updateId?.slice(0, 8)}`;

// Display somewhere visible (VersionBadge component):
// v1.9.4 (178) | OTA: 29005263
```

### 2B. Push notification on deploy (WhatsApp)

Add to GitHub Actions workflow, AFTER successful build+submit:
```yaml
- name: Notify deploy via WhatsApp
  if: success()
  run: |
    BUILD_NUM=$(grep -o '"buildNumber": "[0-9]*"' app.json | grep -o '[0-9]*')
    VERSION=$(grep -o '"version": "[^"]*"' app.json | grep -o '[0-9.]*')
    curl -X POST "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
      -H "Content-Type: application/json" \
      -d "{\"deploy_notification\": true, \"message\": \"🚀 CAPS v${VERSION} (${BUILD_NUM}) deployed to TestFlight!\"}"
```

### 2C. OTA deploy notification

Add to the OTA update command (create a script):
```bash
# scripts/deploy-ota.sh
#!/bin/bash
MESSAGE="${1:-hotfix}"
eas update --branch production --message "$MESSAGE"

# Notify via WhatsApp:
curl -X POST "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -d "{\"deploy_notification\": true, \"message\": \"⚡ OTA Update: $MESSAGE\"}"

echo "OTA deployed + notification sent"
```

### 2D. Supabase deploy log table

```sql
CREATE TABLE IF NOT EXISTS deploy_log (
  id serial PRIMARY KEY,
  type text NOT NULL, -- 'build' or 'ota'
  version text,
  build_number text,
  commit_hash text,
  message text,
  deployed_at timestamptz DEFAULT now()
);

ALTER TABLE deploy_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON deploy_log FOR SELECT USING (true);
CREATE POLICY "service_insert" ON deploy_log FOR INSERT WITH CHECK (true);
```

Log every deploy:
```bash
# After EAS build submit:
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/deploy_log" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"build","version":"1.9.4","build_number":"178","commit_hash":"'$(git rev-parse --short HEAD)'","message":"auto-submit pipeline"}'
```

### 2E. Add to bug dashboard

Update `web-dashboard/index.html` (caps.ftable.co.il/bugs/) to show a "Deploys" tab:
- Read from `deploy_log` table
- Show: type (build/OTA), version, timestamp, message
- Auto-refresh

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit
F2. npx jest --forceExit 2>&1 | tail -5
F3. Fix OTA issue based on findings
F4. If new build needed: eas build --platform ios --profile production --auto-submit-with-profile ci --non-interactive
F5. git add -A && git commit -m "fix: OTA loading + deploy tracking (WhatsApp + Supabase + dashboard)"
F6. git push origin main
```

## REPORT
```
═══════════════════════════════════════
OTA FIX + DEPLOY TRACKING — REPORT
═══════════════════════════════════════
OTA Issue:
  Root cause: [runtimeVersion mismatch / channel mismatch / not compiled in / other]
  Fix: [what was done]
  New build needed: [YES — triggered / NO — OTA fix sufficient]

Deploy Tracking:
  WhatsApp notification on build: [YES/NO]
  WhatsApp notification on OTA: [YES/NO]
  deploy_log table created: [YES/NO]
  Dashboard updated: [YES/NO]
  Version badge shows OTA status: [YES/NO]
═══════════════════════════════════════
```

## DO NOT
- Do NOT skip the OTA diagnostics — find the REAL reason
- Do NOT forget the try-catch crash fix from the previous VAMOS
- Do NOT remove the KILL switch yet — crash still needs fixing

VAMOS CAPS OTA-FIX-AND-TRACKING — END
