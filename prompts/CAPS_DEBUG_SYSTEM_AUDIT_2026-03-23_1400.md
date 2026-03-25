# CAPS — AUDIT DEBUG SCREEN: FIND THE AUTO-TEST RUNNER
**Date:** 2026-03-23 | **Time:** 14:00 IST
**Session:** Find and document the Caps automated debug system
**Sent by:** Strategic AI → Claude Bot

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

---

## CONTEXT

Caps has an automated DEBUG screen that:
1. Runs numbered sequential commands/tests
2. Records the screen during execution
3. When a crash happens — identifies EXACTLY which command caused it
4. This enables auto-fixing bugs by knowing the exact failure point

We need to FIND this code, DOCUMENT how it works, and then REPLICATE it to
ALL projects (9Soccer, Wingman, and every future app).

---

## TASK

### STEP 1 — FIND THE DEBUG SYSTEM IN CAPS

```bash
cd /c/Projects/Caps

echo "=== Search for debug/test runner files ==="
find . -name "*debug*" -o -name "*Debug*" -o -name "*test-runner*" -o -name "*TestRunner*" -o -name "*auto-test*" -o -name "*AutoTest*" -o -name "*sequential*" | grep -v node_modules | grep -v .git | head -20

echo "=== Search for screen recording in code ==="
grep -rn "screenRecord\|ScreenRecord\|captureScreen\|recordScreen\|MediaRecorder\|startRecording\|stopRecording" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

echo "=== Search for numbered steps/commands ==="
grep -rn "step.*[0-9]\|command.*[0-9]\|runStep\|executeStep\|testStep\|STEP_\|currentStep" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

echo "=== Search for crash detection ==="
grep -rn "crash\|Crash\|errorBoundary\|ErrorBoundary\|onError\|unhandledRejection\|lastCommand\|failedAt\|crashAt" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

echo "=== Search for debug screens/pages ==="
find . -path "*debug*" -name "*.tsx" -o -path "*Debug*" -name "*.tsx" -o -path "*test*" -name "*.tsx" | grep -v node_modules | grep -v __tests | head -10
for f in $(find . -path "*debug*" -name "*.tsx" -o -path "*Debug*" -name "*.tsx" | grep -v node_modules | head -5); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Search for QA/audit/automation ==="
grep -rn "autoTest\|auto_test\|runTests\|debugMode\|DEBUG_MODE\|testMode\|TEST_MODE" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

echo "=== Layout - is there a debug toggle? ==="
cat app/_layout.tsx 2>/dev/null
grep -rn "devMode\|DEV_MODE\|__DEV__\|debugPanel\|DebugPanel" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -15

echo "=== Components directory ==="
ls components/ 2>/dev/null
ls app/ 2>/dev/null

echo "=== Any testing utilities ==="
find . -name "*util*test*" -o -name "*test*util*" -o -name "*qa*" -o -name "*QA*" | grep -v node_modules | grep -v __test | head -10

echo "=== Package.json - testing related deps ==="
cat package.json | grep -E "test|debug|record|capture|screenshot|detox|maestro|appium" | head -10

echo "=== Scripts ==="
find . -name "*.sh" -o -name "*.py" -o -name "*.bat" | grep -v node_modules | head -10
cat scripts/*.* 2>/dev/null
```

### STEP 2 — READ EVERYTHING FOUND

For EVERY file found in Step 1 that looks related to the debug system:
```bash
# Read each file COMPLETELY — not just head
# The debug runner could be in any of these
```

### STEP 3 — ALSO CHECK WINGMAN (Roye said both)

```bash
cd /c/Projects/Wingman

echo "=== Same search in Wingman ==="
find . -name "*debug*" -o -name "*Debug*" -o -name "*test-runner*" -o -name "*AutoTest*" | grep -v node_modules | grep -v .git | head -20

grep -rn "screenRecord\|captureScreen\|recordScreen\|MediaRecorder\|startRecording" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

grep -rn "step.*[0-9]\|runStep\|executeStep\|testStep\|STEP_\|currentStep\|numbered" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

grep -rn "crash\|Crash\|errorBoundary\|ErrorBoundary\|lastCommand\|failedAt" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

find . -path "*debug*" -name "*.tsx" -o -path "*Debug*" -name "*.tsx" | grep -v node_modules | head -5
for f in $(find . -path "*debug*" -name "*.tsx" -o -path "*Debug*" -name "*.tsx" | grep -v node_modules | head -5); do
  echo "===== $f ====="
  cat "$f"
done
```

### STEP 4 — DOCUMENT WHAT YOU FIND

Save to: `docs/DEBUG_SYSTEM_AUDIT.md`

```markdown
# Automated Debug System — Audit Report

## What was found:

### Caps:
- Files: [list all related files]
- How it works: [step by step]
- Screen recording: [method used]
- Numbered commands: [how steps are defined]
- Crash detection: [how it catches failures]
- Auto-fix: [how it generates fix suggestions]

### Wingman:
- Files: [list]
- [same structure]

## Architecture:
[Diagram of how the system works end-to-end]

## What can be reused for ALL projects:
[List of components that are portable]

## What needs to be project-specific:
[List of things that change per project]
```

### STEP 5 — IF THE SYSTEM IS PARTIAL OR DIFFERENT THAN DESCRIBED

If what exists is NOT a full "numbered commands + screen recording + crash detection" system,
but rather a simpler debug panel — DOCUMENT that honestly and describe:
- What DOES exist
- What's MISSING to match Roye's description
- What would need to be BUILT to complete it

---

## MEGA FINAL REPORT (MANDATORY)

```
DEBUG SYSTEM AUDIT:

CAPS:
  Files found: [list]
  Numbered command runner: ✅/❌
  Screen recording: ✅/❌
  Crash point detection: ✅/❌
  Auto-fix generation: ✅/❌
  BIBLE comparison: ✅/❌

WINGMAN:
  Files found: [list]
  [same checks]

SYSTEM STATUS:
  Full auto-debug as described: ✅ / ❌ PARTIAL — [what exists vs what's described]
  
  IF PARTIAL — what needs to be built:
  1. [component]
  2. [component]
  3. [component]

RECOMMENDATION:
  [Build the full system in shared-utils? Or enhance what exists?]
```

---

Yes, allow all edits in components
