# Caps Poker — Development Build Guide

## Why you need a dev build
react-native-tcp-socket (used for local multiplayer) requires native code
that is NOT included in Expo Go.
You need a custom development build to test multiplayer features.

Single-player (vs Bot) mode still works in Expo Go.

## Build the dev client (one time per major change)
```
eas build --platform ios --profile development
```

## Install on device
- Scan QR code from the EAS build page
- Or download .ipa and install via Apple Configurator 2

## Run the app
```
npx expo start --dev-client
```
Then scan QR with your dev build app (not Expo Go).

## Testing multiplayer locally
1. Both devices must be on the same WiFi network
2. Device A: tap "HOST GAME" — note the IP and room code shown
3. Device B: tap "JOIN GAME" — enter the IP and room code
4. Host selects player count and taps "START GAME"
5. Both devices arrange cards within 60 seconds
6. Boards reveal automatically after all players ready

## Rebuild when needed
- New native package installed
- app.json plugins changed
- Major Expo SDK upgrade

DO NOT rebuild for JS-only changes — just restart with `npx expo start --dev-client`

## Preview build (for TestFlight, no dev tools)
```
eas build --platform ios --profile preview
```

## Troubleshooting
- "Not logged in": run `eas login`
- "Project not found": run `eas build:configure`
- Build fails: check logs at https://expo.dev/builds
- Multiplayer not connecting: ensure both devices are on same WiFi subnet
