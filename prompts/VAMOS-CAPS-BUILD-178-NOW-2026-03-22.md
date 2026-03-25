# VAMOS CAPS BUILD-178-NOW
**Date:** 2026-03-22 IST
## DO NOT change code. ONLY check and fix.

```
cd C:\Projects\Caps

echo "=== BUILD 178 STATUS ==="
eas build:list --platform ios --limit 3

echo ""
echo "=== GITHUB ACTIONS — latest ==="
gh run list --repo royea-beep/caps-poker --limit 5

echo ""
echo "=== IF BUILD FAILED ==="
gh run list --repo royea-beep/caps-poker --limit 1 --json databaseId,conclusion -q '.[0]'
LATEST_ID=$(gh run list --repo royea-beep/caps-poker --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $LATEST_ID --log-failed 2>&1 | tail -30

echo ""
echo "=== EAS BUILD STATUS JSON ==="
eas build:list --platform ios --limit 1 --json 2>&1 | head -30

echo ""
echo "=== IS AUTO-SUBMIT WORKING? ==="
grep -A 10 "auto-submit\|submit" .github/workflows/ios-testflight.yml | head -15
```

If build finished but NOT submitted:
```
echo "=== MANUAL SUBMIT NOW ==="
eas submit --platform ios --latest --non-interactive
```

If build still in queue/progress — report exact status and ETA.
If build failed — show error and fix immediately.

VAMOS CAPS BUILD-178-NOW — END
