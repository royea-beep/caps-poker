# VAMOS CAPS CAPS-S54C-DEFENDER-SCRIPT
**Date:** 2026-03-24 IST
**Sprint:** CAPS-S54C — Write fix script directly, one action from Roye

---

## CONTEXT
- Defender blocks bash/git/node from writing to C:\Projects
- Claude Code's Write tool CAN write files (not affected by Defender)
- OTA 5f688d9e already deployed and correct
- Only thing missing: git commit of 2 changed files

---

## TASK A — Write the fix script directly using Write tool

Write this file directly to: `C:\Projects\Caps\fix-defender.ps1`

```powershell
# CAPS Poker — Defender Fix + Git Commit
# Run as Administrator (right-click → Run as Administrator)

Write-Host "=== Step 1: Adding Defender exclusions ===" -ForegroundColor Cyan
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\nodejs\node.exe"
Add-MpPreference -ExclusionPath "C:\Projects"
Write-Host "Exclusions added." -ForegroundColor Green

Write-Host "=== Step 2: Removing test file ===" -ForegroundColor Cyan
Remove-Item "C:\Projects\Caps\defender-test.txt" -Force -ErrorAction SilentlyContinue
Write-Host "Test file removed." -ForegroundColor Green

Write-Host "=== Step 3: Git commit ===" -ForegroundColor Cyan
Set-Location "C:\Projects\Caps"
git add app.json app/_layout.tsx
git commit -m "fix(S54B): force OTA check on launch + Defender exclusion documented"
git push origin main
Write-Host "Git done." -ForegroundColor Green

Write-Host ""
Write-Host "ALL DONE. You can close this window." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
```

---

## TASK B — Also write a shortcut hint file on Desktop

Write this file to: `C:\Users\royea\Desktop\RUN-AS-ADMIN-caps-fix.txt`

Contents:
```
Right-click fix-defender.ps1 → Run as Administrator
Location: C:\Projects\Caps\fix-defender.ps1
```

---

## TASK C — Report

```
═══════════════════════════════════════
CAPS-S54C — REPORT
═══════════════════════════════════════
fix-defender.ps1 written to C:\Projects\Caps\: YES/NO
Desktop hint file written: YES/NO
OTA already live: 5f688d9e ✅
Awaiting: Roye runs fix-defender.ps1 as Admin (one double-click)
═══════════════════════════════════════
```

## ONE ACTION FROM ROYE
After bot finishes: right-click `C:\Projects\Caps\fix-defender.ps1` → Run as Administrator.
That's it.

VAMOS CAPS CAPS-S54C-DEFENDER-SCRIPT — END
