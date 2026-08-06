# CAPS Poker — Windows Defender exclusions for the Node/Hermes toolchain
# ============================================================================
# RUN AS ADMINISTRATOR (right-click -> Run with PowerShell as Administrator).
# Reading OR writing Defender exclusions both require elevation; without it
# Get-MpPreference returns the literal string
#   "N/A: Must be an administrator to view exclusions"
# for every exclusion field. That string is NOT an exclusion — it was miscounted
# as one on 2026-08-06, which produced a confident and wrong "exclusions were
# never applied" conclusion. This script PRINTS the state before and after so
# nobody has to infer it again.
#
# THIS SCRIPT DOES EXACTLY ONE THING: apply Defender exclusions.
# ----------------------------------------------------------------------------
# HISTORY — 2026-08-06 (BD2): the previous version was booby-trapped and nobody
# should have run it. After adding the exclusions it did:
#     Set-Location "C:\Projects\Caps"      <- WRONG PATH (real: C:\Projects\POKER\Caps)
#     git add app.json app/_layout.tsx
#     git commit -m "fix(S54B): ..."       <- stale, unrelated commit message
#     git push origin main                 <- PUSHED TO MAIN
# i.e. running a "fix Defender" script would have committed and pushed whatever
# happened to be staged in those two files, under a misleading message, from a
# directory that no longer exists. All of that is removed. No cd, no git, ever.
# ============================================================================

$ErrorActionPreference = 'Stop'

# --- must be elevated -------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "NOT ELEVATED." -ForegroundColor Red
  Write-Host "Right-click this file -> 'Run with PowerShell' as Administrator, or run:" -ForegroundColor Yellow
  Write-Host '  Start-Process powershell -Verb RunAs -ArgumentList ''-ExecutionPolicy Bypass -File "C:\Projects\POKER\Caps\fix-defender.ps1"''' -ForegroundColor Cyan
  exit 1
}

# --- what we are covering, and why -----------------------------------------
# The failing operation is NOT node.exe writing into the repo. It is:
#   node_modules\hermes-compiler\hermesc\win64-bin\hermesc.exe
#     -emit-binary -out $env:TEMP\expo-bundler-*\index.hbc ... -O -output-source-map
# exiting 0xC0000005 (access violation). The pre-2026-08-06 script allowed only
# node.exe and excluded only C:\Projects — neither covers hermesc.exe nor %TEMP%,
# so it would not have fixed this even if it had been run.
$repoRoot = 'C:\Projects\POKER\Caps'
$hermesc  = Join-Path $repoRoot 'node_modules\hermes-compiler\hermesc\win64-bin\hermesc.exe'
$nodeExe  = (Get-Command node -ErrorAction SilentlyContinue).Source
$tempDir  = $env:TEMP

Write-Host "=== BEFORE ===" -ForegroundColor Cyan
$before = Get-MpPreference
Write-Host "ControlledFolderAccess : $($before.EnableControlledFolderAccess)"
Write-Host "ExclusionPath          : $($before.ExclusionPath -join '; ')"
Write-Host "CFA allowed apps       : $($before.ControlledFolderAccessAllowedApplications -join '; ')"

Write-Host "`n=== Applying ===" -ForegroundColor Cyan

# Path exclusions. NOTE ON SCOPE: excluding the WHOLE of %TEMP% is deliberately
# NOT done — %TEMP% is a primary drop point for downloaded/extracted payloads and
# blanket-excluding it is a genuinely bad idea on a machine that browses the web.
# Expo's bundler writes to a predictable per-run subdirectory, so the narrow
# wildcard below covers the crash site without opening all of Temp.
$paths = @(
  $repoRoot,
  (Join-Path $tempDir 'expo-bundler-*'),
  (Join-Path $repoRoot 'node_modules')
)
foreach ($p in $paths) {
  Add-MpPreference -ExclusionPath $p
  Write-Host "  + ExclusionPath  $p" -ForegroundColor Green
}

# Process/app exclusions — hermesc.exe is the one that actually crashes.
$apps = @($hermesc, $nodeExe) | Where-Object { $_ -and (Test-Path $_) }
foreach ($a in $apps) {
  Add-MpPreference -ControlledFolderAccessAllowedApplications $a
  Add-MpPreference -ExclusionProcess (Split-Path $a -Leaf)
  Write-Host "  + CFA allowed + ExclusionProcess  $a" -ForegroundColor Green
}
if (-not (Test-Path $hermesc)) {
  Write-Host "  ! hermesc.exe NOT FOUND at $hermesc — run 'npm install' first, then re-run this script." -ForegroundColor Yellow
}

Write-Host "`n=== AFTER ===" -ForegroundColor Cyan
$after = Get-MpPreference
Write-Host "ControlledFolderAccess : $($after.EnableControlledFolderAccess)"
Write-Host "ExclusionPath          : $($after.ExclusionPath -join '; ')"
Write-Host "ExclusionProcess       : $($after.ExclusionProcess -join '; ')"
Write-Host "CFA allowed apps       : $($after.ControlledFolderAccessAllowedApplications -join '; ')"

Write-Host "`nDone. Nothing was committed, pushed, or deleted — this script only sets exclusions." -ForegroundColor Yellow
Write-Host "Next: re-run 'npx eas update --branch production' normally (WITH source maps) and see" -ForegroundColor Yellow
Write-Host "whether hermesc still exits 0xC0000005. If it does, exclusions are NOT the cause and" -ForegroundColor Yellow
Write-Host "the next hypotheses are a bad Node install or failing RAM — a different investigation." -ForegroundColor Yellow
