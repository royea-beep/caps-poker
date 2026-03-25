# VAMOS CAPS BUILD-167-STATUS
**Date:** 2026-03-22 IST
## DO NOT change code. ONLY check.

```
cd C:\Projects\Caps

echo "=== GIT STATUS ==="
git log --oneline -5
echo "HEAD: $(git rev-parse --short HEAD)"

echo ""
echo "=== GITHUB ACTIONS ==="
gh run list --repo royea-beep/caps-poker --limit 10

echo ""
echo "=== LATEST FAILED RUN? ==="
LATEST_RUN=$(gh run list --repo royea-beep/caps-poker --limit 1 --json databaseId,status,conclusion -q '.[0]')
echo "$LATEST_RUN"

echo ""
echo "=== IF FAILED — SHOW ERROR ==="
LATEST_ID=$(gh run list --repo royea-beep/caps-poker --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $LATEST_ID --log-failed 2>&1 | tail -50

echo ""
echo "=== EAS BUILDS ==="
eas build:list --platform ios --limit 5
```

If build failed — show the EXACT error and fix it.
If build is still queued — report status.
If build succeeded but not on TestFlight — check if `eas submit` ran.

Report:
```
Build 167: [QUEUED / BUILDING / FAILED / SUCCEEDED]
Error (if failed): [exact error]
TestFlight: [available / not yet / failed]
Fix needed: [YES — what / NO]
```

VAMOS CAPS BUILD-167-STATUS — END
