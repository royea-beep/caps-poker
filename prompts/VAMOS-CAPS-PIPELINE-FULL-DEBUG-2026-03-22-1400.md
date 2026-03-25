# VAMOS CAPS PIPELINE-FULL-DEBUG
**Date:** 2026-03-22 14:00 IST
**Priority:** 🔴🔴🔴 Builds NOT reaching TestFlight — user stuck on old version

## SITUATION
User has been on build 172 for hours. Builds 176/177 supposedly finished and submitted — but NOT showing in TestFlight app on the phone. Something is broken in the pipeline.

## CHECK EVERYTHING. Leave no stone unturned.

```
cd C:\Projects\Caps

echo "═══════════════════════════════════════"
echo "1. GIT — what's the latest?"
echo "═══════════════════════════════════════"
git log --oneline -10
echo "HEAD: $(git rev-parse --short HEAD)"

echo ""
echo "═══════════════════════════════════════"
echo "2. GITHUB ACTIONS — all recent runs"
echo "═══════════════════════════════════════"
gh run list --repo royea-beep/caps-poker --limit 15

echo ""
echo "═══════════════════════════════════════"
echo "3. FAILED RUNS — show errors"
echo "═══════════════════════════════════════"
for RUN_ID in $(gh run list --repo royea-beep/caps-poker --limit 10 --json databaseId,conclusion -q '.[] | select(.conclusion == "failure") | .databaseId'); do
  echo "--- Run $RUN_ID ---"
  gh run view $RUN_ID --log-failed 2>&1 | tail -20
  echo ""
done

echo ""
echo "═══════════════════════════════════════"
echo "4. EAS BUILDS — all recent"
echo "═══════════════════════════════════════"
eas build:list --platform ios --limit 10

echo ""
echo "═══════════════════════════════════════"
echo "5. EAS SUBMISSIONS — did they actually submit?"
echo "═══════════════════════════════════════"
eas submit:list --platform ios --limit 10 2>&1

echo ""
echo "═══════════════════════════════════════"
echo "6. APP.JSON — version and build number"
echo "═══════════════════════════════════════"
grep -A 5 "version\|buildNumber\|versionCode" app.json

echo ""
echo "═══════════════════════════════════════"
echo "7. EAS.JSON — profiles"
echo "═══════════════════════════════════════"
cat eas.json

echo ""
echo "═══════════════════════════════════════"
echo "8. CI WORKFLOW — what does it do after build?"
echo "═══════════════════════════════════════"
cat .github/workflows/ios-testflight.yml

echo ""
echo "═══════════════════════════════════════"
echo "9. EXPO DASHBOARD — check builds via API"
echo "═══════════════════════════════════════"
# Check if builds actually completed:
eas build:list --platform ios --limit 5 --json 2>&1 | head -100

echo ""
echo "═══════════════════════════════════════"
echo "10. APPLE PROCESSING — is Apple holding it?"
echo "═══════════════════════════════════════"
# After EAS submits, Apple processes the build (can take 5-30 min)
# Check if submit succeeded:
eas submit:list --platform ios --limit 5 --json 2>&1 | head -50

echo ""
echo "═══════════════════════════════════════"
echo "11. VERSION NUMBER — is it incrementing?"
echo "═══════════════════════════════════════"
grep "buildNumber\|ios.*buildNumber" app.json
# If buildNumber is NOT auto-incrementing, TestFlight may reject as duplicate

echo ""
echo "═══════════════════════════════════════"
echo "12. CREDENTIALS — are they valid?"
echo "═══════════════════════════════════════"
eas credentials --platform ios 2>&1 | head -20

echo ""
echo "═══════════════════════════════════════"
echo "13. GITHUB SECRETS — are required ones present?"
echo "═══════════════════════════════════════"
gh secret list --repo royea-beep/caps-poker
```

## DIAGNOSE AND FIX

Based on the output above, the problem is ONE of these:

### A. Build didn't complete on EAS
→ Check `eas build:list` — status should be "finished"
→ If "errored" — read the error and fix

### B. Submit didn't run or failed
→ Check `eas submit:list` — should show recent submissions
→ Check CI workflow — does it have a submit step?
→ If submit step is missing or broken — fix it:
```yaml
- name: Submit to TestFlight
  run: eas submit --platform ios --latest --non-interactive
  env:
    EXPO_APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
```

### C. Apple is still processing
→ After submit, Apple takes 5-30 minutes to process
→ Check App Store Connect processing status
→ Nothing to do but wait

### D. buildNumber not incrementing
→ TestFlight rejects builds with same buildNumber
→ Fix: autoIncrement in eas.json:
```json
{
  "build": {
    "production": {
      "ios": {
        "autoIncrement": true
      }
    }
  }
}
```

### E. Provisioning profile issue
→ After removing expo-notifications, profile may need regeneration
→ Fix: `eas credentials --platform ios` → check/regenerate

### F. App Store Connect issue
→ Build submitted but "Waiting for Review" or "Processing"
→ Check: https://appstoreconnect.apple.com/apps/6760429619/testflight

## AFTER FIXING — Trigger a clean build
```
# Bump build number explicitly:
# Read current buildNumber from app.json, increment by 1

# Clean build:
eas build --platform ios --profile production --non-interactive --clear-cache

# Wait for build, then submit:
# (CI should handle this, but if not:)
eas submit --platform ios --latest --non-interactive
```

## REPORT
```
═══════════════════════════════════════
PIPELINE FULL DEBUG — REPORT
═══════════════════════════════════════
Git HEAD: [hash]
Latest GH Actions run: [ID] [status]

EAS Builds:
  Build 177: [status — finished/errored/in-progress]
  Build 176: [status]
  Build 175: [status]

EAS Submissions:
  Latest: [status — submitted/failed/none]
  Error if failed: [message]

App Store Connect:
  Latest build visible: [number]
  Processing status: [ready/processing/rejected]

CI Workflow:
  Has build step: [YES/NO]
  Has submit step: [YES/NO]
  Submit uses APPLE_APP_SPECIFIC_PASSWORD: [YES/NO]

buildNumber auto-increment: [YES/NO]
Current buildNumber: [N]

Credentials:
  Distribution cert: [valid/expired]
  Provisioning profile: [valid/expired/mismatched]

ROOT CAUSE: [exactly what's broken]
FIX APPLIED: [what was done]
Build triggered: [YES — number / NO]
ETA to TestFlight: [N minutes]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change game code
- Do NOT skip any of the 13 checks
- If a build needs to be triggered — DO IT, don't just report

VAMOS CAPS PIPELINE-FULL-DEBUG — END
