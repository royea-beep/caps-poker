# VAMOS CAPS CAPS-S54D-BAT
**Date:** 2026-03-24 IST

---

## TASK — Write a self-elevating .bat file

Write this file directly to: `C:\Projects\Caps\fix-defender.bat`

```bat
@echo off
:: Self-elevate to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit
)

:: Now running as Admin
echo === Adding Defender exclusions ===
powershell -Command "Add-MpPreference -ControlledFolderAccessAllowedApplications 'C:\Program Files\nodejs\node.exe'"
powershell -Command "Add-MpPreference -ExclusionPath 'C:\Projects'"
echo Done.

:: Remove test file
del /f /q "C:\Projects\Caps\defender-test.txt" 2>nul

:: Git commit
cd /d C:\Projects\Caps
git add app.json app/_layout.tsx
git commit -m "fix(S54B): force OTA check on launch + Defender exclusion documented"
git push origin main

echo.
echo ALL DONE.
pause
```

Report: `fix-defender.bat written: YES/NO`

VAMOS CAPS CAPS-S54D-BAT — END
