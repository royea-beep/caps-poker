@echo off
REM ===========================================================================
REM CAPS Poker - Defender exclusions launcher.
REM
REM This file is now a THIN LAUNCHER for fix-defender.ps1 and nothing else.
REM
REM 2026-08-06 (BD2) - the previous version of this .bat was destructive and
REM nobody should have run it. It self-elevated via UAC and then:
REM     taskkill /f /im "Cursor.exe"      <- force-killed the user's EDITOR
REM     taskkill /f /im "git.exe"
REM     Remove-Item .git\index.lock       <- deleted a git lock under a running git
REM     cd /d C:\Projects\Caps            <- WRONG PATH (real: C:\Projects\POKER\Caps)
REM     git add app.json app/_layout.tsx
REM     git commit -m "fix(S54B): ..."    <- stale, unrelated message
REM     git push origin main              <- PUSHED TO MAIN
REM Force-killing an editor risks unsaved work, and deleting index.lock while a
REM git process may still hold it risks repository corruption - all from a script
REM whose name promises only an antivirus tweak. Every bit of that is gone.
REM ===========================================================================

echo Launching fix-defender.ps1 (will prompt for Administrator)...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','%~dp0fix-defender.ps1'"
