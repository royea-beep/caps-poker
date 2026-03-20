# Caps Poker — Gotchas & Lessons Learned
**Date:** 2026-03-20 | **Covers:** Sessions 2026-03-18 to 2026-03-20 (b88–b104)

---

## Critical Gotchas (would have caused hours of debugging)

### 1. Hermes Trap: Platform.OS vs typeof window
**Gotcha:** On iOS/Android with Hermes JS engine, `typeof window !== 'undefined'` is `true` even on native — Hermes has a global `window` object. Your web-only code runs on iOS and crashes.

**Fix:** Always use `Platform.OS === 'web'` for web detection in React Native.

```typescript
// ❌ WRONG — crashes on native
if (typeof window !== 'undefined') { window.addEventListener(...) }

// ✅ CORRECT
if (Platform.OS === 'web') { window.addEventListener(...) }
```

---

### 2. Old Arch Modal Crash: No entering= Inside Modal
**Gotcha:** `<Animated.View entering={FadeIn}>` inside a `<Modal>` freezes the app on iOS with Old Architecture (newArchEnabled: false).

**Fix:** Remove `entering` prop from any `Animated.View` inside `Modal`. Use `useSharedValue` + `useAnimatedStyle` instead for entrance animations.

```tsx
// ❌ WRONG — freezes iOS Old Arch
<Modal>
  <Animated.View entering={FadeInDown}>

// ✅ CORRECT — manual animation
<Modal>
  <Animated.View style={manualEnterStyle}>
```

---

### 3. expo-splash-screen is a No-Op on Web
**Gotcha:** `SplashScreen.preventAutoHideAsync()` / `SplashScreen.hideAsync()` do nothing on web. The native splash disappears immediately on web load.

**Fix:** Build a custom splash overlay component in React (`useState` + `Animated`) that shows briefly on both platforms.

```typescript
// ❌ WRONG — only works on native
await SplashScreen.preventAutoHideAsync();

// ✅ CORRECT — custom overlay for both platforms
const [splashDone, setSplashDone] = useState(false); // NOT useState(Platform.OS === 'web')
// Show <SplashOverlay> while !splashDone, use isWeb flag to vary duration
```

---

### 4. EAS credentialsSource: remote → No Local .mobileprovision
**Gotcha:** If `credentialsSource` is `"local"` in eas.json, GitHub Actions CI fails because there's no `.mobileprovision` file on the runner.

**Fix:** Set `credentialsSource: "remote"` — EAS manages all signing credentials in the cloud via expo.dev dashboard.

```json
{ "build": { "production": { "credentialsSource": "remote" } } }
```

---

### 5. sql.js run() Needs Array, Not Spread Args
**Gotcha:** `stmt.run(param1, param2, param3)` doesn't work in sql.js. Unlike better-sqlite3, sql.js requires parameters as an array.

```typescript
// ❌ WRONG — silently fails or throws NOT NULL constraint
stmt.run(projectId, title, description, status);

// ✅ CORRECT
stmt.run([projectId, title, description, status]);
```

---

### 6. WhatsApp Sandbox: SandboxChannels API Doesn't Exist
**Gotcha:** The Twilio API endpoint `POST /2010-04-01/Accounts/{SID}/SandboxChannels/Whatsapp.json` that appears in some docs returns 404. There is no programmatic way to set the sandbox webhook URL.

**Fix:** Set it manually in Twilio Console: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

URL to paste: `https://[supabase-ref].supabase.co/functions/v1/whatsapp-bot-handler`

---

### 7. Apple Upload Rate Limit
**Gotcha:** Apple limits TestFlight uploads per version train. If you push too many builds in a short time (b96, b97, b98 in one day), uploads may be queued or rejected.

**Fix:** Batch fixes into larger builds. Don't push to main for every minor tweak — bundle multiple fixes.

---

### 8. buildNumber in app.json Ignored When versionSource=remote
**Gotcha:** When using EAS with `versionSource: "remote"`, the `ios.buildNumber` in app.json is ignored. EAS uses its own auto-incrementing build number.

**Fix for VersionBadge:** Read `extra.buildNumber` instead of `ios.buildNumber`:
```typescript
import Constants from 'expo-constants';
const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const buildNum = extra?.buildNumber ?? (Constants.expoConfig?.ios?.buildNumber ?? '?');
```
`extra.buildNumber` is always correct because we update it manually before every deploy.

---

### 9. Bot Speed Was 5000-30000ms → Massive UX Issue
**Gotcha:** Bot thinking delay was 5–30 seconds. Users thought the app was frozen.

**Fix:** Changed `botSpeedMin: 1500, botSpeedMax: 4000` in gameConfig.ts. Bot now "thinks" for 1.5–4 seconds — feels natural, not broken.

---

### 10. COLORS.black Was #f0f0e8 → Invisible Spades/Clubs
**Gotcha:** The `COLORS.black` constant was `#f0f0e8` (off-white, matching card face background). Spades and clubs were rendered in this color on white cards — completely invisible.

**Fix:** In Card.tsx, `BLACK_COLOR = '#000000'`. Later refined to `#1a1a2e` for spades in 4-color mode (pure black was too harsh, dark navy reads as black but looks better).

---

### 11. module-level Dimensions.get() Crashes Web
**Gotcha:** Calling `Dimensions.get('window')` at module level (outside a component) works on native but crashes on Expo web because the window dimensions aren't available during module initialization.

**Fix:** Always call inside component with `useWindowDimensions()` hook.

```typescript
// ❌ WRONG — crashes on web
const { width } = Dimensions.get('window'); // module level

// ✅ CORRECT — inside component
function MyComponent() {
  const { width } = useWindowDimensions();
}
```

---

### 12. useSharedValue Must Be Inside Component/Hook
**Gotcha:** `useSharedValue(...)` at module level throws a Reanimated error.

**Fix:** Always inside component function body.

---

### 13. Constants.expoConfig.extra vs process.env in Expo Managed
**Gotcha:** `process.env.EXPO_PUBLIC_SUPABASE_URL` is undefined at runtime in Expo managed workflow (it's available during build-time bundling but not at runtime via Constants).

**Fix:** Use `Constants.expoConfig?.extra?.supabaseUrl` as the authoritative source.

---

## Lessons Learned (Process)

### L1: Parallel Agents = 3–5× Speed
Running 3+ independent agents simultaneously (store-agent, tokens-agent, picker-agent) on a theme system sprint took ~10 minutes vs ~30 minutes sequentially.

### L2: Pre-calculate During UX Delays
Any mandatory wait (countdown, animation, intro screen) is free computation time. Use `setTimeout(heavyComputation, 0)` to run in parallel with the animation.

### L3: Knowledge Preservation Prompts Are Worth It
End-of-session knowledge preservation takes 15 minutes but saves 2+ hours in the next session (no re-reading files, no re-discovering gotchas).

### L4: Iron Rules Prevent Scope Creep
Having explicit locked rules (no Capacitor, Omaha evaluation only, random bot) prevents well-meaning suggestions that would break everything.

### L5: Deploy Immediately After tsc + jest Pass
Don't batch deploys. If tsc=0 and jest=115/115, deploy now. Batching creates merge complexity.

### L6: WhatsApp Bot as Bug Reporter = High Value
Having a WhatsApp bot where you can send a voice note saying "the cards are too small on landscape iPhone" and get an auto-fix deployed is significantly faster than a traditional bug tracker workflow.
