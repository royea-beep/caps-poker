# VAMOS CAPS CAPS-FIX-IOS-BUILD
**Date:** 2026-04-23 IST | **Priority:** CRITICAL — blocking launch

---

## B459 FAILED — Prebuild can't find expo-apple-authentication

### EXACT ERROR (from GH run 24837903027):
```
PluginError: Failed to resolve plugin for module "expo-apple-authentication" 
relative to "/Users/runner/work/caps-poker/caps-poker". 
Do you have node modules installed?
##[error]Process completed with exit code 1.
```

### ROOT CAUSE:
The previous "fix" — `packager-command: skip` on `expo/expo-github-action@v8` — was wrong direction. It skipped the package installation entirely. Even though `npm ci` ran in a separate step, the EAS prebuild step needs `expo-apple-authentication` available, and it's not.

Two possibilities:
1. `expo-apple-authentication` is NOT in package.json
2. It IS in package.json but not getting installed properly

---

## TASK 1 — Diagnose

```bash
cd C:\Projects\POKER\Caps

# Check package.json
grep -A2 -B2 "expo-apple-authentication" package.json

# Check package-lock.json
grep "expo-apple-authentication" package-lock.json | head -3

# Check app.json/app.config.js for the plugin reference
grep -rn "expo-apple-authentication" app.json app.config.js app.config.ts 2>/dev/null | head -5
```

---

## TASK 2 — Fix based on findings

### Scenario A — Plugin referenced in app.json but package not installed:

Install it:
```bash
npx expo install expo-apple-authentication
```

This adds it to package.json with the SDK 55-compatible version.

### Scenario B — Package installed but workflow not picking it up:

Open `.github/workflows/build-ios.yml` (or whatever the build workflow is named):
```bash
ls .github/workflows/
```

Find the `expo/expo-github-action@v8` step. The current setting is probably:
```yaml
- uses: expo/expo-github-action@v8
  with:
    eas-version: latest
    token: ${{ secrets.EXPO_TOKEN }}
    packager-command: skip   # <-- THIS IS THE PROBLEM
```

Remove `packager-command: skip` OR change to `packager-command: install`:
```yaml
- uses: expo/expo-github-action@v8
  with:
    eas-version: latest
    token: ${{ secrets.EXPO_TOKEN }}
    # packager-command removed — let it auto-detect and install
```

Then make sure there's an explicit install step BEFORE the prebuild:
```yaml
- name: Install dependencies
  run: npm ci

- name: Verify expo-apple-authentication installed
  run: |
    if [ ! -d "node_modules/expo-apple-authentication" ]; then
      echo "ERROR: expo-apple-authentication not in node_modules after npm ci"
      ls node_modules/ | grep expo
      exit 1
    fi
    echo "expo-apple-authentication found ✓"

- name: Expo Prebuild
  run: npx expo prebuild --platform ios --clean
```

### Scenario C — Both A and B (most likely):

Do both — install the package AND fix the workflow.

---

## TASK 3 — Verify before triggering build

Before pushing, verify locally:
```bash
# Clean install
rm -rf node_modules
npm ci

# Try local prebuild
npx expo prebuild --platform ios --clean

# If this succeeds, the build will succeed
```

If local prebuild succeeds → push → build will work.
If local prebuild fails → tell us the exact error.

---

## TASK 4 — Trigger new build

After fix:
```bash
git add -A
git commit -m "fix: expo-apple-authentication missing — restore package install in iOS workflow"
git push origin main

# Watch the build
gh run watch
```

Update DB:
```sql
-- After build succeeds
INSERT INTO build_history (build_number, version, platform, status, started_at, features)
VALUES (460, '2.7.1', 'ios', 'building', NOW(), 
  '["All B459 changes + expo-apple-authentication fix"]'::jsonb);
```

---

## ALSO — Update Empire HQ

```sql
-- On Empire HQ (vjxqlqtlywovnbidovit)
SELECT bot_register_session('caps-poker', 'cc-caps-build-fix', 'claude_code', 'Fix iOS build B459 failure - expo-apple-authentication');
```

---

## AFTER AUDIT
```
expo-apple-authentication in package.json:    YES/NO
Installed in node_modules:                    YES/NO
packager-command: skip removed:               YES/NO
Local prebuild succeeds:                      YES/NO
New build triggered (B460):                   YES/NO
GH run ID:                                    [number]
Tests still passing:                          [N]/[N]
```

Yes, allow all edits.
VAMOS CAPS CAPS-FIX-IOS-BUILD — END
