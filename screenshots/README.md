# App Store Screenshots

## Required Sizes

| Device Class        | Resolution  | Required |
|---------------------|-------------|----------|
| 6.7" (iPhone 14 Plus / 15 Plus) | 1290x2796 | Yes |
| 6.1" (iPhone 14 / 15)           | 1179x2556 | Yes |
| 5.5" (iPhone 8 Plus)            | 1242x2208 | Yes |

## Screens to Capture

1. **Home Screen** — Shows balance, stats, buttons (NEW HAND, HOST GAME, JOIN GAME, SETTINGS)
2. **Game Screen (mid-placement)** — Timer running, some cards placed on boards, PlayerHand visible at bottom with remaining cards
3. **Results Screen** — All boards shown with WIN/LOSS badges, net chip count, NEXT HAND button
4. **Multiplayer Lobby** — Room code displayed, connected players list, START GAME button

## How to Capture

1. Build a dev client: `eas build --platform ios --profile development`
2. Install on physical device via TestFlight or direct install
3. Navigate to each screen and set up the desired state
4. Take screenshot on device (Side button + Volume Up)
5. Transfer screenshots to this folder
6. Upload in App Store Connect under each device size
