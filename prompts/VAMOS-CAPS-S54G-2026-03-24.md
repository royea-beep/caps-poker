# VAMOS CAPS CAPS-S54G-BAT-FINAL
**Date:** 2026-03-24 IST

---

## TASK — Overwrite fix-defender.bat with PowerShell-based lock removal

Overwrite `C:\Projects\Caps\fix-defender.bat` with:

```bat
@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit
)

echo === Adding Defender exclusions ===
powershell -Command "Add-MpPreference -ExclusionPath 'C:\Projects'"
powershell -Command "Add-MpPreference -ControlledFolderAccessAllowedApplications 'C:\Program Files\nodejs\node.exe'"
powershell -Command "Add-MpPreference -ControlledFolderAccessAllowedApplications 'C:\Program Files\Git\bin\git.exe'"
powershell -Command "Add-MpPreference -ControlledFolderAccessAllowedApplications 'C:\Program Files\Git\mingw64\bin\git.exe'"
powershell -Command "Add-MpPreference -ControlledFolderAccessAllowedApplications 'C:\Program Files\Git\usr\bin\bash.exe'"
echo Done.

echo === Removing git locks via PowerShell ===
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\.git\index.lock' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\.git\objects\tmp_test' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\defender-test.txt' -ErrorAction SilentlyContinue"
echo Locks cleared.

echo === Waiting 5 seconds for Defender to apply ===
timeout /t 5 /nobreak >nul

echo === Git commit ===
cd /d C:\Projects\Caps
git add app.json app/_layout.tsx
git commit -m "fix(S54B): force OTA check on launch + Defender exclusion documented"
git push origin main

echo.
echo ALL DONE.
pause
```

Report: `fix-defender.bat updated: YES/NO`

VAMOS CAPS CAPS-S54G-BAT-FINAL — END
