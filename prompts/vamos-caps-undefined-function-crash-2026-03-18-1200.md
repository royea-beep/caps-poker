VAMOS CAPS UNDEFINED-FUNCTION-CRASH 2026-03-18-1200

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## EXACT CRASH (from device screen):
TypeError: undefined is not a function
at commitHookEffectListMount (main.jsbundle:66474:32)
at recursivelyTraverseReconnectPassiveEffects (main.jsbundle:19507:32)

## MEANING
A useEffect is calling a function that is undefined at mount time.
This happens on iOS when the app first loads (index.tsx or _layout.tsx).

---

## TASK A — Find the undefined function call

A1. Search ALL useEffect calls in the app for functions that could be undefined:
    grep -rn "useEffect" C:/Projects/Caps/app C:/Projects/Caps/components C:/Projects/Caps/hooks --include="*.tsx" --include="*.ts"

A2. For each useEffect — check if any callback inside could be undefined:
    - Zustand store selectors called before store is initialized
    - Optional chaining missing: callback() should be callback?.()
    - Props passed as callbacks that might not be provided
    - Expo modules not yet loaded (Audio, Haptics, Font)

A3. Check app/index.tsx useEffect calls specifically:
    Read app/index.tsx in full
    Any sound.play() or Audio calls without null check?
    Any Haptics call without null check?

A4. Check app/_layout.tsx useEffect:
    Read app/_layout.tsx in full
    Any font loading callback that could be undefined?

A5. Check hooks/useGameTimer.ts:
    Any callback prop called without null check?

A6. Check components/Board.tsx:
    Any onPress or callback called without ?.() 

A7. The crash is at mount (commitHookEffectListMount) — so it happens when a screen FIRST renders.
    Most likely in: app/index.tsx or app/_layout.tsx

---

## TASK B — Fix all undefined function calls

B1. Add optional chaining to EVERY callback call in useEffect:
    callback() → callback?.()
    onPress() → onPress?.()
    onComplete() → onComplete?.()
    sound.play() → sound?.play?.()

B2. Check every Audio/Sound usage:
    grep -rn "Audio\|sound\|playAsync\|loadAsync" C:/Projects/Caps --include="*.tsx" --include="*.ts" | grep -v node_modules
    Add null checks to all of them

B3. Check every Haptics usage:
    grep -rn "Haptics\|haptic" C:/Projects/Caps --include="*.tsx" --include="*.ts" | grep -v node_modules
    Make sure all calls are wrapped in try/catch

B4. npx tsc --noEmit — 0 errors
B5. npx jest --silent — all pass

---

## FINAL STEPS
1. npx expo export --platform web
2. node scripts/fix-web-html.js
3. cd dist && vercel --prod --yes
4. git add -A && git commit -m "fix: undefined is not a function — null check all callbacks in useEffect"
5. git push origin main
6. Report exactly which file/line had the undefined function call

VAMOS CAPS UNDEFINED-FUNCTION-CRASH — END
