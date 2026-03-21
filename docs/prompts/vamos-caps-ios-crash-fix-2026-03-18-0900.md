VAMOS CAPS IOS-CRASH-FIX

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
App crashes on iOS (TestFlight) before the game starts.
Works fine on web. iOS-specific crash.

## TASK A — Find iOS crash

A1. Check GitHub Actions latest build logs:
    gh run list --repo royea-beep/caps-poker --limit 3
    gh run view <latest_id> --log-failed 2>&1 | tail -50

A2. Read app/_layout.tsx in full — anything iOS specific?

A3. Read app/index.tsx — check for web-only APIs used without Platform.OS check:
    - document, window, localStorage — crash on iOS
    - Any CSS properties applied on native

A4. Read components/BugReporter.tsx — check the lazy require fix:
    Make sure expo-haptics is loaded with lazy require, not static import

A5. Check app/game.tsx lines 1-50 — any web-only imports?

A6. Read constants/theme.ts — check for any web-only CSS values like boxShadow used directly

A7. Check if LinearGradient is imported anywhere without being installed:
    grep -r "LinearGradient\|expo-linear-gradient" C:/Projects/Caps/app C:/Projects/Caps/components --include="*.tsx" --include="*.ts"
    If used — verify it's installed: cat package.json | grep linear

A8. Report exactly what is causing the iOS crash

---

## TASK B — Fix iOS crash

B1. Fix whatever was found in Task A

B2. Common iOS crash causes to check and fix:
    - Any `(window as any)` or `document` access without Platform.OS === 'web' guard
    - Any CSS string properties (boxShadow, fontFamily with web fonts) on native
    - Any missing native modules

B3. npx tsc --noEmit — 0 errors
B4. npx jest --silent — all pass

---

## FINAL STEPS
1. npx expo export --platform web
2. node scripts/fix-web-html.js
3. cd dist && vercel --prod --yes
4. git add -A && git commit -m "fix: iOS crash before game start"
5. git push origin main
6. Report root cause + fix

VAMOS CAPS IOS-CRASH-FIX — END
