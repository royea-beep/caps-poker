# VAMOS CAPS CAPS-REMOVE-VERIFY-STEP
**Date:** 2026-04-26 IST | **Priority:** CRITICAL — actually unblock B462

---

## The previous fix was incomplete

You removed `expo-apple-authentication` from `app.json` ✓ but the workflow file `.github/workflows/ios-testflight.yml` still has a `Verify expo-apple-authentication installed` step that hard-fails when the package isn't there.

---

## TASK 1 — Remove the verify step

Open `.github/workflows/ios-testflight.yml` and find this block:

```yaml
- name: Verify expo-apple-authentication installed
  run: |
    if [ ! -d "node_modules/expo-apple-authentication" ]; then
      echo "ERROR: expo-apple-authentication not in node_modules after npm ci"
      ls node_modules/ | grep expo || true
      exit 1
    fi
    echo "expo-apple-authentication found ✓"
```

**DELETE the entire step** (the `- name:` line through the last line of the block).

---

## TASK 2 — Push and trigger build

```bash
git add .github/workflows/ios-testflight.yml
git commit -m "fix: remove verify step for unused expo-apple-authentication package"
git push origin main
```

---

## TASK 3 — Update build_history

```sql
-- On CAPS DB (gxrpunvhjcrzqnitbqah)
UPDATE build_history SET status = 'failed', completed_at = NOW(),
  notes = 'Verify step in workflow still checking for removed package'
WHERE build_number IN (460, 461) AND status = 'building';

INSERT INTO build_history (build_number, version, platform, status, started_at, fixes)
VALUES (462, '2.7.1', 'ios', 'building', NOW(),
  '["Removed verify step from ios-testflight.yml"]'::jsonb);
```

---

## AFTER AUDIT
```
Verify step removed from ios-testflight.yml:    YES/NO
grep returns no matches:                         YES/NO (run: grep "expo-apple-authentication" .github/workflows/ios-testflight.yml)
Pushed to main:                                  YES/NO
Build B462 triggered:                            YES/NO (gh run list)
B462 passed verify stage:                        YES/NO (watch with gh run watch)
```

Yes, allow all edits.
VAMOS CAPS CAPS-REMOVE-VERIFY-STEP — END
