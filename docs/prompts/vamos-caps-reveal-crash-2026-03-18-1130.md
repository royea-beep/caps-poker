VAMOS CAPS REVEAL-CRASH 2026-03-18-1130

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
App freezes/crashes DURING the reveal sequence on iOS.
Player sees bot cards flipping, then it freezes.
New Architecture is already disabled (newArchEnabled: false).

---

## TASK A — Audit RevealSequence completely
Agent: reveal-auditor

A1. Read components/RevealSequence.tsx in FULL

A2. Read hooks/useRevealSequence.ts in FULL

A3. Trace the reveal flow step by step:
    1. Component mounts → what happens first?
    2. Board loop starts → for each board?
    3. Cards flip one by one → animation?
    4. Winner shown → what triggers?
    5. Next board → how does it advance?

A4. Find ALL potential freeze/crash points:
    - Any infinite loop in useEffect?
    - Any state update that triggers re-render loop?
    - setInterval/setTimeout that never clears?
    - Any animation that blocks the JS thread?
    - Any large computation on main thread during animation?

A5. Check ADVANCE_DELAY — is it too long? Does it ever fire?

A6. Check if allBotCards rendering causes a crash:
    - allBotCards is an array of arrays — nested map?
    - Any undefined access in the nested structure?

---

## TASK B — Fix reveal freeze

B1. Fix all issues found in Task A

B2. Add timeout safety — if reveal gets stuck, auto-advance after 15 seconds:
    In useRevealSequence.ts add a safety timeout:
    ```ts
    // Safety: if stuck for 15s, force advance
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        onComplete?.();
      }
    }, 15000);
    return () => clearTimeout(safetyTimer);
    ```

B3. Wrap the entire RevealSequence render in try/catch error boundary

B4. Simplify the reveal animation on iOS — if Platform.OS === 'ios', use simpler fade instead of flip:
    Check if the card flip animation (rotateY) causes issues on Old Arch iOS

B5. npx tsc --noEmit — 0 errors
B6. npx jest --silent — all pass

---

## FINAL STEPS
1. npx expo export --platform web
2. node scripts/fix-web-html.js
3. cd dist && vercel --prod --yes
4. git add -A && git commit -m "fix: reveal sequence freeze on iOS"
5. git push origin main
6. Report what caused the freeze and what was fixed

VAMOS CAPS REVEAL-CRASH — END
