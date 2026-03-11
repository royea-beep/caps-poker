# How to Build Caps Poker

## Development Build (for testing multiplayer)
```
eas build --platform ios --profile development
npx expo start --dev-client
```
See `DEV_BUILD_GUIDE.md` for full details.

---

# TestFlight Build

## Step 1 — Login (one time)
```
eas login
```
Enter your Expo account credentials.

## Step 2 — Link project (one time)
```
eas build:configure
```
This updates app.json with your projectId automatically.

## Step 3 — Pre-flight check
```
node scripts/preflight-check.js
```
All checks must pass before building.

## Step 4 — Build
```
eas build --platform ios --profile preview
```
Takes ~10-15 minutes. You'll get a download link when done.

## Step 5 — Submit to TestFlight
```
eas submit --platform ios --latest
```
Requires Apple Developer account. First time: it will ask for your Apple ID and app-specific password.

## Step 6 — TestFlight
- Open App Store Connect: https://appstoreconnect.apple.com
- Go to TestFlight tab
- Your build will appear within 10-20 minutes
- Add yourself as internal tester
- Install via TestFlight app on iPhone

## Troubleshooting
- "Not logged in": run `eas login`
- "Project not found": run `eas build:configure`
- Build fails: check logs at https://expo.dev/builds
- "No bundle identifier": verify app.json has expo.ios.bundleIdentifier
