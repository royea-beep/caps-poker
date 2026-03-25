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
