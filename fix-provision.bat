@echo off
echo ===================================
echo CAPS — Provisioning Profile Fix
echo ===================================
echo.
echo WHY: Profile 2A7A3LHJVY (2026-03-19) missing Push Notifications.
echo      Delete it so EAS creates a fresh one with aps-environment.
echo.
echo Step 1: Delete old provisioning profile
echo Navigate: production > Provisioning Profile: Manage > Remove > Yes
echo.
echo Press any key to open eas credentials...
pause >/dev/null
cd /d C:\Projects\Caps
eas credentials --platform ios
echo.
echo Step 2: Trigger rebuild with new profile...
echo Press any key to start build...
pause >/dev/null
eas build --platform ios --profile production --non-interactive
echo.
echo Done! Check: eas build:list --platform ios --limit 1
pause
