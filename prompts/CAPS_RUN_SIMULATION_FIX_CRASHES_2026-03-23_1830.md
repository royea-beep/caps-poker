# CAPS — RUN SIMULATION + FIX WHATEVER CRASHES
**Date:** 2026-03-23 | **Time:** 18:30 IST
**Session:** Run the 10-player simulation, find crash, read evidence from DB, fix it
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** 26ae664

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## CONTEXT

Caps has a full crash evidence system: dashcam screenshots, step log, crash codes,
WhatsApp threading. The simulation runs 10 players — 2 deliberately crash.
But the app also has REAL crashes that users hit. 

Run the simulation, check crash_reports DB for any REAL crashes too,
read the fix prompts, and FIX every crash found.

---

## TASK

### STEP 1 — CHECK FOR EXISTING CRASH REPORTS IN DB

```bash
cd /c/Projects/Caps

echo "=== Supabase credentials ==="
SUPABASE_URL=$(grep "EXPO_PUBLIC_SUPABASE_URL\|NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY\|EXPO_PUBLIC_SUPABASE_ANON_KEY" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "URL: $SUPABASE_URL"

echo "=== All crash reports ==="
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?order=created_at.desc&limit=10" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || \
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?order=created_at.desc&limit=10" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"

echo "=== Unresolved crashes ==="
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?status=eq.new&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || echo "No unresolved"

echo "=== Fix prompts from crashes ==="
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?select=crash_code,error_message,last_screen,last_action,fix_prompt,created_at&status=eq.new&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null
```

### STEP 2 — READ THE AUTO-DEBUG SUITE + RUN IT PROGRAMMATICALLY

```bash
echo "=== Auto-debug suite ==="
cat lib/debug-suite.ts 2>/dev/null || find . -name "debug-suite*" | grep -v node_modules | head -1 | xargs cat
cat lib/auto-debug.ts 2>/dev/null || find . -name "auto-debug*" | grep -v node_modules | head -1 | xargs cat

echo "=== Simulation code ==="
cat lib/debug-simulation.ts 2>/dev/null || find . -name "debug-simulation*" | grep -v node_modules | head -1 | xargs cat

echo "=== Can we run steps from CLI? ==="
# The debug steps test game LOGIC (not UI), so we can run them from Node:
grep -n "action:" lib/debug-suite.ts 2>/dev/null | head -10
```

If the debug steps are pure logic tests (they should be — Caps uses logic tests):

```bash
# Create a CLI runner script
cat > /tmp/run-caps-debug.js << 'EOF'
// Run Caps auto-debug steps from CLI
const path = require('path')

async function run() {
  try {
    // Import the debug suite
    // Adapt path based on actual project structure
    const suite = require(path.join(process.cwd(), 'lib/debug-suite'))
    const { AutoDebugRunner } = require(path.join(process.cwd(), 'lib/auto-debug'))
    
    const steps = suite.CAPS_DEBUG_STEPS || suite.CAPS_STEPS || suite.default || []
    console.log(`Found ${steps.length} debug steps`)
    
    if (steps.length === 0) {
      console.log('No steps found — checking exports:')
      console.log(Object.keys(suite))
      return
    }
    
    const runner = new AutoDebugRunner('Caps', '1.0.0', steps)
    const report = await runner.run()
    
    console.log('\n=== RESULTS ===')
    console.log(`Total: ${report.totalSteps}`)
    console.log(`Passed: ${report.passed}`)
    console.log(`Failed at: ${report.failedAt || 'none'}`)
    
    report.results.forEach(r => {
      const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '⚠️' : '❌'
      console.log(`  ${icon} Step ${r.stepId}: ${r.stepName} (${r.duration}ms)`)
      if (r.error) console.log(`     Error: ${r.error}`)
      if (r.stackTrace) console.log(`     Stack: ${r.stackTrace.split('\n')[0]}`)
    })
    
    if (report.autoFixPrompt) {
      console.log('\n=== AUTO-FIX PROMPT ===')
      console.log(report.autoFixPrompt)
    }
  } catch (e) {
    console.error('Runner failed:', e.message)
    console.error(e.stack)
  }
}

run()
EOF

# Try running (may need tsx/ts-node for TypeScript):
npx tsx /tmp/run-caps-debug.js 2>&1 || \
npx ts-node /tmp/run-caps-debug.js 2>&1 || \
node /tmp/run-caps-debug.js 2>&1
```

### STEP 3 — ANALYZE REAL GAME CODE FOR CRASH POINTS

Regardless of simulation, read the actual game code and find crash-prone areas:

```bash
echo "=== Game logic — deal, bet, fold ==="
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs grep -l "dealCards\|handleDeal\|handleBet\|handleFold\|gameState" 2>/dev/null | head -10
for f in $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs grep -l "dealCards\|handleDeal\|handleBet" 2>/dev/null | head -5); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Error-prone patterns: optional chaining missing ==="
grep -rn "\.\(cards\|hand\|player\|game\|deck\)\." . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "?." | grep -v "\/\/" | head -20

echo "=== Null/undefined access patterns ==="
grep -rn "\.length\b" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "?." | grep -v "\/\/" | head -20

echo "=== State that could be undefined ==="
grep -rn "useState<.*>()" . --include="*.tsx" | grep -v node_modules | head -15
grep -rn "useState(null)\|useState(undefined)" . --include="*.tsx" | grep -v node_modules | head -10

echo "=== Async operations without try/catch ==="
grep -rn "await " . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "try" | grep -v "catch" | grep -v "\/\/" | head -20

echo "=== Supabase calls without error handling ==="
grep -rn "supabase\." . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "error\|catch\|try" | head -15
```

### STEP 4 — FIX EVERY CRASH FOUND

For each crash found (from DB, simulation, or code analysis):

```bash
# Pattern: read the error → find the file → fix → build check

echo "=== Fix crash #1 ==="
# [Read the error from crash_reports or debug output]
# [Find the file:line]
# [Apply fix]

echo "=== Build check ==="
npx tsc --noEmit 2>&1 | tail -10
```

Common fixes for poker games:
1. `cards` is undefined → add `cards || []`
2. `player.hand` is null → add optional chaining `player?.hand`
3. `deck.length` on undefined → check `if (!deck)` before use
4. Supabase call fails silently → add try/catch
5. State accessed before initialization → add loading guard

### STEP 5 — ALSO RUN AUTO-DEBUG STEPS TO VERIFY FIXES

After fixing, re-run the debug suite:

```bash
npx tsx /tmp/run-caps-debug.js 2>&1
# All steps should pass now
```

### STEP 6 — COMMIT + PUSH

```bash
cd /c/Projects/Caps
npx tsc --noEmit 2>&1 | tail -10

git add -A
git commit -m "fix: crash fixes from simulation + code analysis — [list what was fixed]"
git push origin main

gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

### STEP 7 — UPDATE CRASH REPORTS STATUS IN DB

```bash
# Mark all fixed crashes as resolved
curl -s -X PATCH "${SUPABASE_URL}/rest/v1/crash_reports?status=eq.new" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"status": "fixed", "resolved_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
  2>/dev/null
```

---

## MEGA FINAL REPORT (MANDATORY)

```
CAPS CRASH FIX — Simulation + Code Analysis

CRASH REPORTS FROM DB:
  Total in DB: [X]
  Unresolved (status=new): [X]
  Errors found: [list each crash_code + error]

DEBUG SUITE RUN:
  Steps: [X] total
  Passed: [X]
  Failed: [X]
  Failed steps: [list]

CODE ANALYSIS:
  Crash-prone patterns found: [X]
  Missing optional chaining: [X] occurrences
  Unhandled async: [X] occurrences
  Null state access: [X] occurrences

FIXES APPLIED:
  1. [file:line] — [what was wrong] → [what changed]
  2. [file:line] — [what was wrong] → [what changed]
  3. ...

POST-FIX DEBUG RUN:
  Steps: [X] total
  Passed: [X] (should be all)
  
Commit: [hash]
Crash reports marked fixed: [X]

IF CRASHES REMAIN:
  [which ones and why they can't be fixed without more info]
```

---

Yes, allow all edits in components
