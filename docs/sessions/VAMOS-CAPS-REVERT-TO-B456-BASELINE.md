# VAMOS CAPS CAPS-REVERT-TO-B456-BASELINE
**Date:** 2026-04-27 IST | **Priority:** CRITICAL — final attempt after 13 failed builds

---

## THE ONE FIX

13 builds failed (B458-B470) trying to incrementally fix B457's broken plugin chain.
We're stopping that. **Reverting configs to B456 (last working build) + keeping all new code on top.**

### What's on Roye's phone right now:
**VERSION 2.0.0 build 456** — last actually-installed build, from before this whole mess.

### The plan:
1. Restore `app.json` + `package.json` + `package-lock.json` to commit `98e7cb8` (B456 — Apr 18, last working configs)
2. KEEP all new code from current main (Card Bible, account deletion, privacy, terms, footer, auth infrastructure)
3. Bump `version` to `2.7.0` in app.json (above anything Apple has seen)
4. Single commit, single push, single build attempt
5. If it succeeds → reaches TestFlight → Roye taps Update → all features visible
6. If it fails → we have ONE clean log from ONE attempt, not a chain of confusion

### CRITICAL RULES:
- ❌ **DO NOT** edit individual plugins one by one
- ❌ **DO NOT** add "verify steps" to the workflow
- ❌ **DO NOT** push fix commits if this fails — STOP and report
- ✅ **DO** verify locally before pushing if possible
- ✅ **DO** run a single push and watch one build to completion

---

## TASK 1 — Restore configs to B456 working state

```bash
cd C:/Projects/POKER/Caps

# Make sure working tree is clean first
git status

# If there are uncommitted changes, stash them
git stash push -m "pre-revert stash"

# Restore the 3 critical config files from B456 commit
git checkout 98e7cb8 -- app.json package.json package-lock.json

# Verify what we got back
echo "=== app.json plugins ==="
grep -A 30 '"plugins"' app.json

echo "=== package.json dependencies count ==="
grep -c '":' package.json

echo "=== package-lock.json exists ==="
ls -la package-lock.json
```

**Expected:**
- `app.json` plugins should NOT include sentry-expo, expo-secure-store, expo-apple-authentication
- These were the plugins added in B457 that broke everything

---

## TASK 2 — Bump version to 2.7.0

Edit `app.json`:
- Change `"version": "2.0.0"` (or whatever is there) to `"version": "2.7.0"`
- Leave `buildNumber` alone (EAS manages it remotely via `eas.json appVersionSource: remote`)

Verify:
```bash
grep '"version"' app.json
# Should show: "version": "2.7.0"
```

---

## TASK 3 — Verify code/configs are aligned

Check that the new code (which is already in main from today's commits) doesn't import packages we just removed:

```bash
# Search for any imports of the removed packages
grep -rn "expo-secure-store\|sentry-expo\|@sentry\|expo-apple-authentication" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ utils/ 2>/dev/null | head -20
```

**If any matches found:**
- Comment out those imports OR
- Replace with stubs (e.g., for secure-store, fall back to AsyncStorage)
- Sentry imports can be removed entirely — we don't need crash reporting for this build to work

If you find imports you can't quickly stub, **STOP and report which file/line**. Don't push.

---

## TASK 4 — Restore stashed changes if needed

If TASK 1 stashed changes:
```bash
git stash list
# If there's a "pre-revert stash" entry and you need anything from it:
git stash show -p stash@{0}
# Apply selectively if needed, otherwise leave it stashed
```

---

## TASK 5 — Single clean push

```bash
git status
# Should show modified: app.json, package.json, package-lock.json (and maybe a few code stubs from TASK 3)

git add app.json package.json package-lock.json
# Only add code files if you needed to stub imports in TASK 3

git commit -m "fix: revert configs to B456 baseline + bump to v2.7.0

Restoring app.json/package.json/package-lock.json to commit 98e7cb8 (B456 working state).
Removes broken plugin chain (sentry-expo, expo-secure-store, expo-apple-authentication)
that caused 13 consecutive build failures B458-B470.

All new code from today's commits (Card Bible, account deletion, privacy, terms,
footer disclaimer, auth infrastructure) remains in place.

Version bumped to 2.7.0. EAS will auto-increment buildNumber to next available."

git push origin main
```

---

## TASK 6 — Watch ONE build, no chain

```bash
# Get the latest run ID
gh run list --workflow=ios-testflight.yml --limit 1

# Watch it to completion
gh run watch
```

**If it succeeds:**
- Build will appear in TestFlight ~30-40 minutes total
- Roye gets notification on phone
- He taps Update → installs → sees ALL the changes from the past 2 weeks at once

**If it fails:**
- DO NOT push another fix
- Report the exact failure stage + last 50 lines of log
- Update build_history with status='failed' + the actual error
- We diagnose from one clean failure, not a chain

---

## TASK 7 — Update DB

After push, register the build:

```sql
-- On CAPS DB (gxrpunvhjcrzqnitbqah)
INSERT INTO build_history (build_number, version, platform, status, started_at, fixes, commits)
VALUES (
  471,
  '2.7.0',
  'ios',
  'building',
  NOW(),
  '["REVERT TO B456 BASELINE: restored app.json/package.json/package-lock.json to commit 98e7cb8. Removed broken plugin chain. Kept all new code from today."]'::jsonb,
  '[{"hash":"<NEW_COMMIT_SHA>","msg":"fix: revert configs to B456 baseline + bump to v2.7.0"}]'::jsonb
);
```

(Manager will run this after CC reports the commit SHA.)

---

## REPORT BACK

When done, report:
1. New commit SHA
2. GH run ID
3. Whether stubs were needed in TASK 3 (and if so, which files)
4. Build outcome: success / failed at which stage

---

## AFTER AUDIT
```
Configs restored from 98e7cb8:                YES/NO
Version bumped to 2.7.0:                       YES/NO
No imports of removed packages broken:         YES/NO (or list files needing stubs)
Single clean commit:                           YES/NO
Pushed to main:                                YES/NO + commit SHA
GH run ID:                                     [number]
Build outcome:                                 success / failed at [stage]
B471 reached TestFlight:                       YES/NO
```

Yes, allow all edits.
VAMOS CAPS CAPS-REVERT-TO-B456-BASELINE — END
