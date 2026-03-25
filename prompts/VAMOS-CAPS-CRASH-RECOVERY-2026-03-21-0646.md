# VAMOS CAPS CRASH-RECOVERY
**Date:** 2026-03-21 06:46 IST
**Priority:** 🔴 Recovery — computer crashed mid-sprint

## ROLE
Recovery auditor — check what survived the crash

## RULES
- DO NOT change any code yet
- DO NOT deploy anything yet
- ONLY read and report

## STEP 1 — Git Status
```
cd C:\Projects\Caps
git status -s
git log --oneline -5
git stash list
```

Report:
- Last commit hash + message
- Any uncommitted changes? List them
- Any stashed changes?

## STEP 2 — Code Health
```
npx tsc --noEmit 2>&1 | tail -10
npx jest --forceExit 2>&1 | tail -15
```

Report:
- TypeScript: how many errors?
- Tests: how many pass / how many fail?

## STEP 3 — Was MICRO-FIX Applied?
```
grep -n "HAND HISTORY" app\index.tsx
grep -n "impactAsync" app\results.tsx
```

Report:
- Does index.tsx say "HAND HISTORY" or "HISTORY"? Which line?
- Are there haptic setTimeout calls in results.tsx? YES/NO

## STEP 4 — Web Status
```
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il
```

## STEP 5 — EAS Build Status
```
eas build:list --platform ios --limit 3
```

## OUTPUT FORMAT
```
═══════════════════════════════════════
CRASH RECOVERY REPORT
═══════════════════════════════════════

LAST COMMIT: [hash] [message]
UNCOMMITTED CHANGES: [yes/no — list if yes]
STASHED: [yes/no]

TYPESCRIPT: [N] errors
TESTS: [N]/[N] passing

MICRO-FIX STATUS:
  "HAND HISTORY" label: [DONE / NOT DONE]
  Haptic pulses: [DONE / NOT DONE]

WEB: [HTTP status]
EAS: [last 3 builds]

RECOMMENDATION: [what to do next]
═══════════════════════════════════════
```

VAMOS CAPS CRASH-RECOVERY — END
