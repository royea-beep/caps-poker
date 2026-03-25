# VAMOS CAPS SUBMIT-AND-BUILD
**Date:** 2026-03-22 14:57 IST
**Priority:** 🔴 Get build to TestFlight NOW

## SITUATION
- GitHub billing budget increased — Actions work again
- Build 177 sitting finished on EAS — never submitted
- Need to: submit 177 NOW + trigger new build with all fixes

## STEP 1 — Submit Build 177 immediately
```
cd C:\Projects\Caps
eas submit --platform ios --id 75575844-7fc8-4525-8020-b71d00203335 --non-interactive
```

If `--non-interactive` fails because it needs password:
```
# The password should be in environment or EAS secrets:
eas secret:list 2>&1 | grep -i apple

# If EXPO_APPLE_APP_SPECIFIC_PASSWORD is in EAS secrets, it should work.
# If not, try with the CI profile:
eas submit --platform ios --id 75575844-7fc8-4525-8020-b71d00203335 --profile ci --non-interactive
```

If STILL fails — check what password/auth is needed:
```
eas submit --platform ios --id 75575844-7fc8-4525-8020-b71d00203335 2>&1 | head -20
```

## STEP 2 — Trigger new build (178) with auto-submit
```
git commit --allow-empty -m "chore: trigger build 178 — budget restored"
git push origin main
```

This triggers GitHub Actions → EAS build → auto-submit to TestFlight.

## STEP 3 — Verify pipeline is working
```
sleep 30
echo "=== GITHUB ACTIONS ==="
gh run list --repo royea-beep/caps-poker --limit 3

echo ""
echo "=== EAS BUILDS ==="
eas build:list --platform ios --limit 3

echo ""
echo "=== SUBMISSION STATUS ==="
# Check if 177 was submitted:
eas build:view 75575844-7fc8-4525-8020-b71d00203335 2>&1 | head -20
```

## STEP 4 — Monitor until TestFlight ready
```
# Wait for build 178 to finish:
sleep 120
eas build:list --platform ios --limit 3
gh run list --repo royea-beep/caps-poker --limit 3
```

## REPORT
```
═══════════════════════════════════════
SUBMIT AND BUILD — REPORT
═══════════════════════════════════════
Build 177 submitted: [YES / FAILED — reason]
Build 178 triggered: [YES — run ID / NO]
Build 178 status: [queued / building / finished / failed]
Auto-submit: [working / not working]
ETA to TestFlight: [N minutes]
═══════════════════════════════════════
```

## DO NOT
- Do NOT ask user to run any commands
- Do NOT change game code
- If submit fails due to auth — find the password in project files or EAS secrets and use it

VAMOS CAPS SUBMIT-AND-BUILD — END
