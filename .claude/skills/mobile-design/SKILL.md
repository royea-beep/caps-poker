---
name: mobile-design
description: "Mobile-first UX for React Native / iOS. Touch targets, Fitts' Law, iOS HIG, thumb zones, battery-conscious animations, safe areas, haptics."
---
# Mobile Design Skill — CAPS Poker Edition

## Touch Targets (Fitts' Law)
- Minimum tap target: **44×44pt** on all interactive elements
- Preferred: 48×48pt for primary actions
- Apply `hitSlop={{ top:8, bottom:8, left:8, right:8 }}` when visual size < 44pt
- Never place two tappable elements < 8pt apart

## iOS Human Interface Guidelines
- Safe areas: always use `SafeAreaView` or `useSafeAreaInsets()`
- Status bar: respect top inset — never overlap
- Home indicator: respect bottom inset (usually 34pt on Face ID devices)
- Back swipe: don't block iOS swipe-back gesture unless intentional
- Modal presentation: use `expo-router` modal routes, not custom overlays

## Thumb Zone Ergonomics (one-hand portrait)
- **Green zone** (easy): bottom 40% of screen — primary actions here
- **Yellow zone** (stretch): middle 40% — secondary actions OK
- **Red zone** (hard): top 20% — avoid critical actions
- Implication for CAPS: DEAL button stays at bottom, settings at top is fine (less critical)

## Battery-Conscious Animations
- Prefer `useNativeDriver: true` — runs on GPU, not JS thread
- `Animated.loop` with `sequence` for repeating — NOT `withRepeat(-1)`
- Stop animations when component unmounts — always `anim.stop()` in cleanup
- Avoid continuous opacity/scale loops in list items
- Max 3 simultaneous animated values per screen on lower-end devices

## Haptics (Expo)
```ts
// Impact (button presses):
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)   // subtle tap
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)  // confirm
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)   // win/lose

// Notification (outcomes):
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
```

## React Native Gotchas
- `gap` requires RN 0.71+ — always check Expo SDK support
- `position: absolute` children need explicit width/height
- `overflow: hidden` on iOS clips shadows — use border trick instead
- `borderRadius` on Android: use `overflow: hidden` on parent
- Text `numberOfLines` + `ellipsizeMode` for truncation
- `flex: 1` on ScrollView children breaks scroll — use `flexGrow: 1` in `contentContainerStyle`

## Card Game Specific
- Card tap area: minimum 44pt even if card is smaller — use hitSlop
- Drag gestures: `PanResponder` or `react-native-gesture-handler` GestureDetector
- Board scroll: `scrollEnabled={false}` when cards are being dragged
- Prevent accidental taps during animations: disable `pointerEvents` during transitions
