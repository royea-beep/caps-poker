@echo off
REM ============================================================================
REM  CAPS — fix the 0xC0000005 access violations in node.exe (tsc / jest-worker)
REM ============================================================================
REM  ROOT CAUSE (diagnosed 2026-07-25): Windows Defender **Controlled Folder
REM  Access** is ENABLED (Get-MpPreference -> EnableControlledFolderAccess = 1)
REM  with Real-Time Protection on. CFA injects into node.exe and intermittently
REM  kills it with an access violation (0xC0000005). That is why BOTH `tsc
REM  --noEmit` AND `jest-worker` crashed with the same code on the same machine —
REM  one root cause, not two "environmental blips". It currently blocks the
REM  crash_audit suite from loading at all ("Tests: 0 total").
REM
REM  Setting Defender exclusions REQUIRES ADMIN, which an agent cannot obtain —
REM  this script self-elevates via UAC so the owner runs ONE command.
REM
REM  OWNER RUNS (from a normal terminal, then click "Yes" on the UAC prompt):
REM      scripts\fix-defender-cfa.bat
REM
REM  Safe + idempotent: adds exclusions only, changes no other Defender setting,
REM  and re-running it is a no-op. Reverse it any time with:
REM      Remove-MpPreference -ExclusionPath 'C:\Projects'
REM ============================================================================

REM --- self-elevate if not already running as admin -------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo [CAPS] Requesting administrator rights ^(UAC prompt^)...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo [CAPS] Running as administrator. Applying Defender exclusions...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Continue';" ^
  "Write-Host '[1/3] Excluding C:\Projects from scanning...';" ^
  "Add-MpPreference -ExclusionPath 'C:\Projects';" ^
  "Write-Host '[2/3] Allowing node.exe through Controlled Folder Access...';" ^
  "$nodes = @();" ^
  "$c = (Get-Command node -ErrorAction SilentlyContinue); if ($c) { $nodes += $c.Source };" ^
  "foreach ($p in @('C:\Program Files\nodejs\node.exe')) { if (Test-Path $p) { $nodes += $p } };" ^
  "$fnm = Join-Path $env:LOCALAPPDATA 'fnm_multishells';" ^
  "if (Test-Path $fnm) { $nodes += (Get-ChildItem $fnm -Recurse -Filter node.exe -ErrorAction SilentlyContinue | Select-Object -Expand FullName) };" ^
  "$nodes = $nodes ^| Sort-Object -Unique;" ^
  "foreach ($n in $nodes) { Write-Host ('      allow: ' + $n); Add-MpPreference -ControlledFolderAccessAllowedApplications $n };" ^
  "Add-MpPreference -ExclusionProcess 'node.exe';" ^
  "Write-Host '[3/3] Verifying...';" ^
  "$mp = Get-MpPreference;" ^
  "Write-Host ('      ControlledFolderAccess : ' + $mp.EnableControlledFolderAccess);" ^
  "Write-Host ('      ExclusionPath          : ' + ($mp.ExclusionPath -join '; '));" ^
  "Write-Host ('      ExclusionProcess       : ' + ($mp.ExclusionProcess -join '; '));" ^
  "Write-Host ('      CFA allowed apps       : ' + (($mp.ControlledFolderAccessAllowedApplications ^| Where-Object { $_ -like '*node*' }) -join '; '))"

echo.
echo [CAPS] Done. Now re-run the gate to confirm:
echo        npm test
echo.
pause
