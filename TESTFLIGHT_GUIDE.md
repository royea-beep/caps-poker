# Caps Poker — TestFlight Guide

## Prerequisites
- Expo account at https://expo.dev
- Apple Developer account ($99/year)
- EAS CLI: npm install -g eas-cli

## One-time Setup (fill these in before building)
1. app.json → expo.owner: your Expo username
2. app.json → expo.extra.eas.projectId: from expo.dev dashboard
3. eas.json → submit.production.ios.appleId: your Apple ID email

## Commands
```
eas login                                    # login to Expo
eas build:configure                          # link to Expo project
eas build --platform ios --profile preview   # build for TestFlight
eas submit --platform ios --latest           # submit to App Store Connect
```

## Time estimates
- First build: ~15 min
- Subsequent: ~10 min
- TestFlight processing: ~10-20 min
- Total first time: ~45 min
