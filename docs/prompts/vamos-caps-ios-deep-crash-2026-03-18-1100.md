VAMOS CAPS IOS-DEEP-CRASH 2026-03-18-1100

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## STILL CRASHING ON iOS AFTER ALL PREVIOUS FIXES
Need to find the REAL crash. Previous fixes addressed symptoms, not root cause.

---

## TASK A — Get the actual crash log

A1. Check Xcode crash logs via EAS:
    eas diagnostics 2>&1 | head -20
    eas build:list --platform ios --limit 1 2>&1

A2. Check if there are crash logs in the EAS build:
    gh run list --repo royea-beep/caps-poker --limit 1 2>&1
    gh run view <id> --log 2>&1 | grep -i "error\|crash\|fatal\|exception" | head -30

A3. Check BugReporter Supabase table for NEW reports (after v1.9.2):
    Use Supabase credentials from .env
    SELECT * FROM bug_reports WHERE created_at > '2026-03-18' ORDER BY created_at DESC

A4. Add VISIBLE error display to the app — when a crash happens on iOS,
    show the error on screen instead of crashing silently:
    
    In app/_layout.tsx, add ErrorBoundary with UI:
    ```tsx
    export function ErrorBoundary({ error }: { error: Error }) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: '#ff0000', fontSize: 16, textAlign: 'center', marginBottom: 10 }}>
            CRASH DETAILS:
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 12, textAlign: 'center' }}>
            {error?.message ?? 'Unknown error'}
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 10, textAlign: 'center', marginTop: 10 }}>
            {error?.stack?.slice(0, 500) ?? ''}
          </Text>
        </View>
      );
    }
    ```

A5. Also add global error handler in app/_layout.tsx useEffect:
    ```tsx
    useEffect(() => {
      const handler = (error: ErrorEvent) => {
        console.error('GLOBAL ERROR:', error.message, error.error?.stack);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('error', handler);
        return () => window.removeEventListener('error', handler);
      }
    }, []);
    ```

---

## TASK B — Audit Reanimated usage (most common iOS New Arch crash)

B1. Search for ALL useAnimatedStyle and withTiming usage:
    grep -rn "useAnimatedStyle\|withTiming\|withSpring\|useSharedValue\|runOnJS\|runOnUI" C:/Projects/Caps/app C:/Projects/Caps/components --include="*.tsx"

B2. For EACH useAnimatedStyle — check:
    - No conditional hooks inside
    - No JavaScript functions called directly (must use runOnJS)
    - No state reads from React state (must use shared values)

B3. Known iOS New Arch Reanimated issue: calling JS functions from worklets without runOnJS
    Fix any violations found

B4. Check if react-native-reanimated version is compatible with RN 0.83 + New Arch:
    cat node_modules/react-native-reanimated/package.json | grep '"version"'
    Check expo SDK 55 compatibility matrix

B5. Fix all Reanimated violations

---

## TASK C — Nuclear option: Disable New Architecture temporarily
If all else fails, disable New Architecture to confirm it's the cause:

C1. Check app.json for newArchEnabled:
    cat app.json | grep -i "newArch\|new_arch\|fabric"

C2. If newArchEnabled is true or not set (default true in SDK 55+):
    Add to app.json expo.ios section:
    "newArchEnabled": false

C3. This will confirm if New Architecture is the crash source
    If app works after this → we know the exact cause

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors  
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: disable new arch, error boundary UI, reanimated audit"
7. git push origin main
8. Report: what was found, what was disabled/fixed

VAMOS CAPS IOS-DEEP-CRASH — END
