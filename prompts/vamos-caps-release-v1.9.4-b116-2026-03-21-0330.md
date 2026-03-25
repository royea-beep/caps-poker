# VAMOS MEGA PROMPT — Cross-Platform Sync + TestFlight Deploy
**Version:** v1.9.4 | **Build:** b116 | **Date:** 2026-03-21 03:30 IL (UTC+2)

---

## ROLE
You are a **Senior Release Engineer**. Prepare the app for testers on ALL platforms.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## CONTEXT

Since last TestFlight build (#117, b104), we made MASSIVE changes (b104 → b116):
- Five-O theme overhaul (5 rounds of color refinement)
- Premium visual overhaul (buttons, badges, timer, panels)
- Web layout: always portrait, cards bottom, boards top
- Reveal screen: centered layout, bot above/player below
- Results screen: theme-aware
- Hand evaluator stale pre-calc fix
- X button web fix
- CORS fix (sync-bugs-to-drive)
- Google OAuth working
- 116/116 tests

**Now we need to make sure ALL of this works on iOS (native) and deploy to TestFlight.**

---

## TASK 1 — Cross-Platform Audit

### 1.1 Check for Web-Only Code
Many of the recent changes used `Platform.OS === 'web'` conditions and web-only CSS properties. Verify these don't break iOS:

```bash
# Find all Platform.OS === 'web' conditions
grep -rn "Platform.OS === 'web'" app/ components/ --include="*.tsx" | head -30

# Find web-only CSS properties that might cause issues on native
grep -rn "background:.*gradient\|boxShadow\|cursor\|userSelect\|conic-gradient" app/ components/ --include="*.tsx" | head -20
```

For each web-only CSS property, verify it's wrapped in:
- `Platform.select({ web: {...} })` or
- `Platform.OS === 'web' && {...}` conditional

If ANY web CSS leaks to native, it will crash or render wrong on iOS.

### 1.2 Check isLandscape for iOS
We changed `isLandscape` to exclude web. Verify iOS still works in both orientations:
```typescript
const isLandscape = storeOrientation === 'landscape' && Platform.OS !== 'web';
```
- iOS portrait: should use portrait layout ✅
- iOS landscape (user selected): should use landscape layout ✅
- Web: should ALWAYS use portrait layout ✅

### 1.3 Theme on Native
Verify Five-O theme looks correct on iOS:
- radial-gradient fallback: on native, `background: 'radial-gradient(...)'` won't work. Check that `theme.background` solid color is the fallback.
- The `as any` casts for web-specific styles should be ignored by native.
- Card gradient face: `background: 'linear-gradient(...)'` only works on web — verify native uses solid `theme.cardFace`.

### 1.4 Timer on Native
The conic-gradient timer is web-only. Verify:
- Native still uses the original circular border timer
- The `if (Platform.OS === 'web')` return in CircularTimer works correctly

### 1.5 X Button on Native
We skip Alert.alert on web. Verify:
- iOS still shows the confirmation Alert before leaving
- The `if (Platform.OS === 'web') { leave(); return; }` guard works correctly

### 1.6 Reveal + Results on Native
The centered layout changes in RevealSequence and results.tsx should work on native too since they use flexbox (not CSS-specific properties). Verify layout doesn't break on narrow screens (375px iPhone SE).

---

## TASK 2 — Version & Build Numbers

### 2.1 Sync Version Numbers
Current state in app.json:
- version: 1.9.4
- iOS buildNumber: "116" 
- extra.buildNumber: "116"
- Android versionCode: 90 (update if needed)

Verify both buildNumber fields match. The EAS build will increment automatically, but our code buildNumber should be correct.

### 2.2 Update extra.buildNumber
```bash
grep -n "buildNumber" app.json
```
Make sure both `ios.buildNumber` and `extra.buildNumber` are "116".

---

## TASK 3 — Pre-Deploy QA

### 3.1 Full Test Suite
```bash
npx tsc --noEmit
npx jest --forceExit
```
All 116 tests must pass. Zero TypeScript errors.

### 3.2 Quick Smoke Test on Web
```bash
npx expo start --web --port 8081
```
Open in browser, play a full game:
1. Home → Start game
2. Place cards on all 4 boards
3. Hit READY
4. Watch reveal (community cards, bot above, player below)
5. See results (PERFECT! or score)
6. Navigate back to home
7. Switch theme (Classic ↔ Five-O) in Settings
8. Play again in the other theme

### 3.3 Check for Console Errors
No red errors in browser console. Warnings are OK.

---

## TASK 4 — Deploy

### 4.1 Web Deploy (already on Vercel)
```bash
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
```

### 4.2 iOS TestFlight Build via EAS
```bash
# This triggers a new EAS build → TestFlight
# The CI should handle this on push to main, but if not:
eas build --platform ios --profile production --non-interactive
```

Check if GitHub Actions CI is configured to auto-build on push:
```bash
cat .github/workflows/ios-testflight.yml 2>/dev/null | head -30
```

If CI is set up → just push to main and it auto-builds.
If not → run the eas build command manually.

### 4.3 After Build
- Check EAS dashboard for build status: https://expo.dev/accounts/royea/projects/caps-poker/builds
- Once build completes → it auto-submits to TestFlight
- Build number will be #118+ (EAS auto-increment)
- Update MEMORY.md with new EAS build number

---

## TASK 5 — Prepare for Testers

### 5.1 What's New Notes (for TestFlight)
Prepare a "What to Test" summary:

```
What's New in v1.9.4:

🎨 VISUAL OVERHAUL
- Five-O theme: casino red felt, dark navy panels, gold accents
- Premium cards with shadows and gradients
- Depleting timer ring, animated bot status, gold pill badges
- ⚡ AUTO button, ♦ card placement hints

🃏 GAMEPLAY
- Fixed hand evaluation display (was showing wrong hand names)
- Bot above / Player below community cards in reveal
- Results screen shows all boards with correct hand names

🔧 FIXES
- X close button now works
- Google OAuth login working
- CORS errors fixed

📱 LAYOUT
- Web: portrait layout with cards at bottom
- iOS: portrait + landscape support
```

### 5.2 Update MEMORY.md
Record:
- New EAS build number
- TestFlight status
- What changed since last TestFlight (#117, b104)

---

## SUCCESS CRITERIA
- [ ] No web-only CSS leaking to native
- [ ] iOS portrait + landscape work
- [ ] iOS timer uses native style (not conic-gradient)
- [ ] iOS X button shows Alert.alert confirmation
- [ ] 116/116 tests pass | TS: 0 errors
- [ ] Web deployed (Vercel)
- [ ] iOS EAS build triggered
- [ ] MEMORY.md updated with new build number
- [ ] Git pushed with all changes

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
# Push to main triggers CI → EAS build → TestFlight
git add -A && git commit -m "release: v1.9.4-b117 — cross-platform sync + TestFlight deploy" && git push
# Update MEMORY.md with EAS build number once available
```

---

*This is a RELEASE build. Double-check everything. No broken features on iOS. No web-only CSS on native. Clean deploy.*
