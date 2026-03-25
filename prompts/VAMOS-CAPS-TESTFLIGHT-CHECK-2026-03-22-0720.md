# VAMOS CAPS TESTFLIGHT-CHECK
**Date:** 2026-03-22 07:20 IST
## DO NOT change code. ONLY check build status.

```
cd C:\Projects\Caps
git log --oneline -3

echo "=== EAS BUILDS ==="
eas build:list --platform ios --limit 5

echo "=== LATEST COMMIT ==="
echo "HEAD: $(git rev-parse --short HEAD)"
```

If the latest build does NOT include commit 8873280 (responsive system):
```
eas build --platform ios --profile production --non-interactive
```

Report: latest build number + status + which commit it includes.

VAMOS CAPS TESTFLIGHT-CHECK — END
