# VAMOS CAPS CAPS-FULL-REVERT-APPLE-AUTH
**Date:** 2026-04-26 IST | **Priority:** CRITICAL — unblock B463

---

## Full revert and clean state

### What's broken right now:
1. `package.json` — modified (has `expo-apple-authentication` AND `@sentry/react-native`)
2. `package-lock.json` — DELETED (npm install failed on Windows EPERM)
3. `app.json` — has Apple Sign In removed already
4. `node_modules` — partially trashed from failed npm install
5. iOS entitlements still has `applesignin` capability (mentioned earlier)

### Goal:
Get back to a clean, working state with NO Apple Sign In anywhere. Google login only.

---

## TASK 1 — Discard local changes to package.json

Reset package.json to match git (the version we committed with apple-authentication removed):

```bash
cd C:/Projects/POKER/Caps
git checkout package.json
```

Verify it no longer has `expo-apple-authentication`:
```bash
grep "apple-authentication" package.json
# Should return nothing
```

---

## TASK 2 — Restore package-lock.json

```bash
git checkout package-lock.json
```

Verify it exists again:
```bash
ls -la package-lock.json
# Should show the file
```

Verify it has no apple-authentication:
```bash
grep "expo-apple-authentication" package-lock.json
# Should return nothing
```

---

## TASK 3 — Remove Apple Sign In from iOS entitlements

```bash
# Find the entitlements file
find . -name "*.entitlements" -not -path "*/node_modules/*"

# Likely path: ios/CapsPoker/CapsPoker.entitlements or similar
# Open the file and remove this block:
#   <key>com.apple.developer.applesignin</key>
#   <array>
#     <string>Default</string>
#   </array>
```

If the file is in `ios/` folder (managed by prebuild) — actually the issue is in `app.json` config that Expo uses to GENERATE the entitlements during prebuild.

Check if `app.json` has any entitlements config that mentions applesignin:
```bash
grep -i "applesignin\|appleSignIn" app.json
```

If found — remove that block from app.json.

---

## TASK 4 — Try `npm ci` instead of `npm install`

`npm install` is what trashed things last time because:
1. It tried to "auto-fix" missing packages by adding them back
2. Windows EPERM errors on partial cleanup

`npm ci` is stricter — it just installs exactly what's in package-lock.json without modifying anything:

```bash
npm ci
```

This should succeed cleanly.

If it fails with EPERM errors:
- Close VS Code
- Close Metro bundler if running
- Close any other terminals in this directory
- Try again: `npm ci`

---

## TASK 5 — Commit and push

After successful `npm ci`:

```bash
git status
# Should show: nothing to commit, working tree clean (if Tasks 1-4 worked)
# OR: ios/ entitlements changes (if Task 3 modified files)
```

If there ARE changes (entitlements removal):
```bash
git add -A
git commit -m "fix: remove all traces of expo-apple-authentication (entitlements, etc.)"
git push origin main
```

If NO changes — we're already on the last clean state. Trigger a manual build:
```bash
# Empty commit to trigger CI
git commit --allow-empty -m "ci: trigger fresh iOS build"
git push origin main
```

---

## TASK 6 — Update build_history

```sql
-- On CAPS DB (gxrpunvhjcrzqnitbqah)
UPDATE build_history SET status = 'failed', completed_at = NOW(),
  notes = 'expo-apple-authentication still in entitlements/dependencies after partial removal'
WHERE build_number = 462 AND status = 'building';

INSERT INTO build_history (build_number, version, platform, status, started_at, fixes)
VALUES (463, '2.7.1', 'ios', 'building', NOW(),
  '["Full removal of expo-apple-authentication from package.json, lockfile, entitlements"]'::jsonb);
```

---

## AFTER AUDIT
```
package.json reverted (no apple-authentication):    YES/NO
package-lock.json restored (no apple-authentication): YES/NO
Entitlements/app.json have no applesignin:           YES/NO
npm ci succeeded:                                    YES/NO
Pushed to main:                                      YES/NO
B463 triggered:                                      YES/NO
```

Yes, allow all edits.
VAMOS CAPS CAPS-FULL-REVERT-APPLE-AUTH — END
