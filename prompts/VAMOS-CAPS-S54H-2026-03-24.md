# VAMOS CAPS CAPS-S54H-KILL-CURSOR
**Date:** 2026-03-24 IST

---

## TASK — Overwrite fix-defender.bat — kill Cursor first

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

echo === Killing Cursor and git processes ===
taskkill /f /im "Cursor.exe" 2>nul
taskkill /f /im "cursor.exe" 2>nul
taskkill /f /im "git.exe" 2>nul
timeout /t 2 /nobreak >nul
echo Done.

echo === Removing git locks ===
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\.git\index.lock' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\.git\objects\tmp_test' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Force 'C:\Projects\Caps\defender-test.txt' -ErrorAction SilentlyContinue"
echo Done.

echo === Waiting 3 seconds ===
timeout /t 3 /nobreak >nul

echo === Git commit ===
cd /d C:\Projects\Caps
git add app.json app/_layout.tsx
git commit -m "fix(S54B): force OTA check on launch + Defender exclusion documented"
git push origin main

echo.
echo ALL DONE — you can reopen Cursor now.
pause
```

Report: `fix-defender.bat updated: YES/NO`

VAMOS CAPS CAPS-S54H-KILL-CURSOR — END
