# VAMOS CAPS CAPS-S54B-DEFENDER-FIX
**Date:** 2026-03-24 IST
**Priority:** CRITICAL — OTA not loading because Windows Defender blocked bundle write

---

## ROOT CAUSE
Windows Defender Controlled Folder Access is blocking new file creation from bash/node processes.
Every `eas update` since build 228 produced a broken/empty OTA bundle.
Device shows e004a7fb (old) because newer OTAs were never written correctly.

---

## TASK A — Disable Controlled Folder Access for C:\Projects\Caps

Run this in PowerShell as Administrator:

```powershell
# Option 1 — Add C:\Projects as allowed app path exception:
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\nodejs\node.exe"
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Users\royea\AppData\Roaming\npm\eas.cmd"

# Option 2 — Add C:\Projects to excluded folders:
Add-MpPreference -ExclusionPath "C:\Projects"

# Verify exclusions applied:
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
Get-MpPreference | Select-Object -ExpandProperty ControlledFolderAccessAllowedApplications
```

If PowerShell as Admin fails — use this approach instead:
```bash
# Check if we can write NOW (test):
echo "test" > C:\Projects\Caps\defender-test.txt
cat C:\Projects\Caps\defender-test.txt
rm C:\Projects\Caps\defender-test.txt
```

If the test write succeeds → Defender is no longer blocking → proceed to Task B.

---

## TASK B — Re-deploy ALL missed OTAs in one shot

Once Defender is cleared, re-deploy everything from S49 through S53 in a single OTA:

```bash
cd C:\Projects\Caps

# Verify current code state:
git log --oneline -5
npx tsc --noEmit 2>&1 | tail -3
npx jest --forceExit 2>&1 | tail -3

# Deploy fresh OTA with ALL S49-S53 features:
eas update --branch production --message "fix(S54B): re-deploy S49-S53 after Defender fix — BoardReveal + handHint + tap-to-skip + results animations + card flip"
```

---

## TASK C — Force immediate OTA check on device

Add to app/_layout.tsx to force reload when new OTA is available:

```typescript
import * as Updates from 'expo-updates';

// Inside root layout component, add:
useEffect(() => {
  if (__DEV__) return;
  (async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (_) {}
  })();
}, []);
```

This means: every time the app opens → checks for OTA → if available → downloads → reloads immediately. No more "kill and reopen twice."

---

## TASK D — Verify

```bash
# Confirm new OTA hash:
eas update:list --branch production --limit 3

# Confirm runtimeVersion matches build 228:
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "runtimeVersion|channel|buildNumber"
eas update:list --branch production --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "runtimeVersion|branch|id"
```

runtimeVersion of OTA must match runtimeVersion of build 228.

---

## TASK E — Git

```bash
git add -A && git commit -m "fix(S54B): force OTA check on launch + Defender exclusion documented"
git push origin main
```

---

## AFTER AUDIT

```
═══════════════════════════════════════
CAPS-S54B — AFTER AUDIT
═══════════════════════════════════════
Defender fix:
  - Method used: [PowerShell exclusion / test write succeeded / other]
  - node.exe added to allowed apps: [YES/NO]
  - C:\Projects excluded: [YES/NO]
  - Test write succeeded: [YES/NO]

OTA re-deploy:
  - New OTA hash: [hash]
  - runtimeVersion: [value]
  - Matches build 228 runtimeVersion: [YES/NO]
  - Branch: [production]

Force update check added to _layout.tsx: [YES/NO]

TS errors: 0
Tests: 2234/2234
Git: [commit]
═══════════════════════════════════════
```

## DO NOT
- Do NOT skip the Defender fix — re-deploying without fixing it will produce another broken OTA
- Do NOT rebuild the binary — OTA fix is sufficient
- Do NOT skip the runtimeVersion match check

Yes, allow all edits in components/ during this session.

VAMOS CAPS CAPS-S54B-DEFENDER-FIX — END
