# VAMOS CAPS EXPO-DASHBOARD-SETUP
**Date:** 2026-03-22 09:15 IST
**Priority:** 🟡 Infrastructure upgrade — make Expo dashboard fully operational

## ROLE
DevOps engineer — connect, configure, and verify all Expo platform features

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\app.json
cat C:\Projects\Caps\eas.json
cat C:\Projects\Caps\package.json | grep -E "expo-updates|expo-insights"
```

═══════════════════════════════════════════════════════════
AGENT 1 — OTA UPDATES (expo-updates)
═══════════════════════════════════════════════════════════

This is the #1 priority. Push JS-only fixes in 30 seconds without a new build.

### 1A. Install
```
cd C:\Projects\Caps
npx expo install expo-updates
```

### 1B. Configure app.json
Add to `expo` section:
```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "url": "https://u.expo.dev/114b97d5-5cb3-4798-9a97-8233a6a37c07",
      "fallbackToCacheTimeout": 3000,
      "checkAutomatically": "ON_LOAD"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

### 1C. Add update check on app start
In `app/_layout.tsx`, add near the top:
```typescript
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

// Check for OTA updates on app start
useEffect(() => {
  if (!__DEV__) {
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // restart app with new code
        }
      } catch (e) {
        // Silent fail — don't crash the app
        console.log('Update check failed:', e);
      }
    })();
  }
}, []);
```

### 1D. Verify
```
npx expo export --platform ios --dev false 2>&1 | tail -5
```
Should succeed without errors.

### 1E. How to use after setup
```bash
# Push an OTA update (JS-only changes, no native module changes):
eas update --branch production --message "fix: card sizing tweak"

# This deploys in ~30 seconds. All users get it on next app open.
# NO new build needed. NO App Store review.
```

═══════════════════════════════════════════════════════════
AGENT 2 — CONNECT GITHUB TO EXPO
═══════════════════════════════════════════════════════════

### 2A. Link repo
```
eas init  # if not already done
```

Then check if GitHub is already connected:
```
eas project:info
```

### 2B. Connect via Expo Dashboard
This step MAY require manual action in the browser:
1. Go to: https://expo.dev/accounts/royea/projects/caps-poker
2. Scroll to "More" → "Connect GitHub"
3. Authorize Expo to access `royea-beep/caps-poker`

If the bot CAN do this via CLI:
```
eas project:link --github
```

### 2C. Verify
After connecting:
- Expo dashboard should show commits
- PR builds should be possible
- Build triggers should show GitHub commit hashes

═══════════════════════════════════════════════════════════
AGENT 3 — EXPO INSIGHTS (crash reports + analytics)
═══════════════════════════════════════════════════════════

### 3A. Install
```
npx expo install expo-insights
```

If `expo-insights` doesn't exist as a package, use the Expo dashboard native insights:

### 3B. Check if Insights module exists
```
npm search expo-insights 2>&1 | head -5
```

If it's a dashboard-only feature (no SDK needed):
- Go to: https://expo.dev/accounts/royea/projects/caps-poker/insights
- Enable from dashboard
- Should auto-collect: crashes, app opens, update adoption

If SDK is needed:
```typescript
// In app/_layout.tsx:
import * as Insights from 'expo-insights';

useEffect(() => {
  if (!__DEV__) {
    Insights.initialize();
  }
}, []);
```

═══════════════════════════════════════════════════════════
AGENT 4 — FIX SUBMISSIONS (3 yellow warnings)
═══════════════════════════════════════════════════════════

### 4A. Check what's wrong with submissions
```
eas submit:list --platform ios --limit 5
```

Look at the warnings. Common issues:
- Missing `APPLE_APP_SPECIFIC_PASSWORD` → check GitHub secrets
- Missing metadata (description, screenshots) → App Store Connect
- Entitlement mismatch → provisioning profile

### 4B. Check credentials
```
eas credentials --platform ios
```

Verify:
- Distribution certificate: valid?
- Provisioning profile: matches bundle ID `com.capspoker.app`?
- Push notification entitlement: removed (we uninstalled expo-notifications)

### 4C. Fix the auto-submit workflow
Check the EAS Submit workflow:
```
cat C:\Projects\Caps\.github\workflows\ios-testflight.yml | grep -A 20 "submit"
```

Make sure `eas submit` is using the correct profile:
```yaml
- name: Submit to TestFlight
  run: eas submit --platform ios --profile production --latest --non-interactive
```

If the submit step needs `EXPO_APPLE_APP_SPECIFIC_PASSWORD`:
```
# Check if it's in GitHub secrets:
gh secret list --repo royea-beep/caps-poker | grep APPLE
```

If missing — tell user to add it manually:
```
MANUAL: Add APPLE_APP_SPECIFIC_PASSWORD to GitHub repo secrets
Go to: https://github.com/royea-beep/caps-poker/settings/secrets/actions
```

═══════════════════════════════════════════════════════════
AGENT 5 — ENVIRONMENT VARIABLES IN EXPO
═══════════════════════════════════════════════════════════

### 5A. Move secrets from .env to Expo environment variables

Instead of relying on `.env` files, use Expo's built-in secret management:

```
# Set secrets for production builds:
eas secret:create --scope project --name SUPABASE_URL --value "https://gxrpunvhjcrzqnitbqah.supabase.co" --type string
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "$(grep SUPABASE_ANON_KEY C:\Projects\Caps\.env | cut -d= -f2)" --type string
```

### 5B. Check existing secrets
```
eas secret:list
```

### 5C. Access in code
```typescript
// These become available as process.env.SUPABASE_URL in EAS builds
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.supabaseUrl;
```

Note: Only move NON-sensitive values to `EXPO_PUBLIC_*` (visible in client bundle).
Sensitive keys stay as EAS secrets (available only during build).

═══════════════════════════════════════════════════════════
AGENT 6 — VERIFY WORKFLOWS (fix red EAS Submit)
═══════════════════════════════════════════════════════════

### 6A. Check why EAS Submit → iOS is failing
```
# Get the latest workflow run ID
eas workflow:list 2>&1 | head -10

# Or check from the dashboard:
# https://expo.dev/accounts/royea/projects/caps-poker/workflows
```

### 6B. Common fixes:
1. **Missing Apple credentials in EAS:**
```
eas credentials --platform ios
# If distribution cert expired → eas credentials --platform ios --clear
# Then: eas credentials --platform ios (regenerate)
```

2. **App Store Connect API key:**
```
# If using ASC API key:
eas secret:create --scope project --name APPLE_API_KEY_ID --value "WTWALQMG5N" --type string
eas secret:create --scope project --name APPLE_API_ISSUER_ID --value "$(cat C:\Projects\wingman\keys\apple_api_issuer_id.txt)" --type string
```

3. **App-specific password for submit:**
```
eas secret:create --scope project --name EXPO_APPLE_APP_SPECIFIC_PASSWORD --value "xxxx-xxxx-xxxx-xxxx" --type string
```

═══════════════════════════════════════════════════════════
AGENT 7 — HOSTING (optional — evaluate)
═══════════════════════════════════════════════════════════

Expo Hosting could replace Vercel for the web version.

### 7A. Check if it makes sense
Current web deploy: Vercel (caps.ftable.co.il)
Expo Hosting: Would give us `caps-poker.expo.app` or custom domain

### 7B. Decision:
- If Expo Hosting supports custom domains → could simplify deployment
- If not → keep Vercel (already working)

```
# Check Expo Hosting docs:
eas hosting:info 2>&1 | head -10
```

**Only set up if it's clearly better than current Vercel setup. Don't break what works.**

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 724+ pass
F3. npx expo export --platform ios --dev false — verify bundle
F4. git add -A && git commit -m "feat: expo-updates OTA + insights + dashboard integration"
F5. git push origin main
F6. Update MEMORY.md
```

## REPORT
```
═══════════════════════════════════════
EXPO DASHBOARD SETUP — REPORT
═══════════════════════════════════════
OTA Updates (expo-updates):
  Installed: [YES/NO]
  Configured in app.json: [YES/NO]
  Update check in _layout.tsx: [YES/NO]
  Test: eas update --branch production works: [YES/NO/NOT TESTED]

GitHub Connected:
  [YES — via CLI/dashboard / NO — MANUAL NEEDED]
  Steps if manual: [list]

Insights:
  Enabled: [YES — SDK/dashboard-only / NO]
  Crash reports: [auto / manual / not available]

Submissions Fixed:
  Warning cause: [describe]
  Fixed: [YES/NO]
  Credentials valid: [YES/NO]
  Auto-submit working: [YES/NO / NEEDS MANUAL STEP]

Environment Variables:
  Secrets in EAS: [N] secrets configured
  [list them without values]

Workflows:
  EAS Submit → iOS: [FIXED / STILL BROKEN — reason]

Hosting:
  [EVALUATED — worth it / not worth it / SKIPPED]
  Reason: [explain]
═══════════════════════════════════════
```

## DO NOT
- Do NOT break the current build pipeline
- Do NOT remove working Vercel deployment
- Do NOT expose sensitive keys in EXPO_PUBLIC_ vars
- Do NOT change game code
- Do NOT skip the OTA setup — it's the #1 priority

## MANUAL STEPS (if needed)
List ANY steps that require browser/manual action:
```
MANUAL_1: [what + URL]
MANUAL_2: [what + URL]
```

VAMOS CAPS EXPO-DASHBOARD-SETUP — END
