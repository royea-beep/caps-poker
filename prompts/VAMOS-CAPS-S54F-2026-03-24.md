# VAMOS CAPS CAPS-S54F-BAT-UPDATE
**Date:** 2026-03-24 IST

---

## TASK — Update fix-defender.bat with git.exe added to allowed apps

Overwrite `C:\Projects\Caps\fix-defender.bat` with this content:

```bat
@echo off
:: Self-elevate to Administrator
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

echo === Cleaning git locks ===
del /f /q "C:\Projects\Caps\.git\index.lock" 2>nul
del /f /q "C:\Projects\Caps\.git\objects\tmp_test" 2>nul
del /f /q "C:\Projects\Caps\defender-test.txt" 2>nul

echo === Waiting 3 seconds for Defender to apply ===
timeout /t 3 /nobreak >nul

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

VAMOS CAPS CAPS-S54F-BAT-UPDATE — END
