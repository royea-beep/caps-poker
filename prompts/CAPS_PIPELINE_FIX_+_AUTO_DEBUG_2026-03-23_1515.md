# CAPS — FIX PIPELINE + AUTO-DEBUG SYSTEM
**Date:** 2026-03-23 | **Time:** 15:15 IST
**Session:** Part 1: Fix Caps pipeline. Part 2: Build auto-debug with WhatsApp.
**Sent by:** Strategic AI → Claude Bot

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## CONTEXT

Caps pipeline was standardized to Wingman-style EAS on March 23. Need to verify
it's fully green before building the auto-debug system on top. Then: build the
numbered-steps auto-debug runner that sends crash reports to WhatsApp.

---

## PART 1 — VERIFY + FIX CAPS PIPELINE

### Step 1A — Check current state

```bash
cd /c/Projects/Caps

echo "=== Git status ==="
git log --oneline -5
git status

echo "=== GitHub Actions — last 5 runs ==="
gh run list --repo royea-beep/Caps --limit 5 2>/dev/null

echo "=== Workflow files ==="
ls .github/workflows/
for f in .github/workflows/*.yml; do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Secrets set ==="
gh secret list --repo royea-beep/Caps 2>/dev/null

echo "=== EAS config ==="
cat eas.json 2>/dev/null
cat app.json 2>/dev/null | head -30
cat app.config.ts 2>/dev/null | head -30

echo "=== Package.json — expo version ==="
cat package.json | grep -E "expo|eas" | head -10

echo "=== TypeScript check ==="
npx tsc --noEmit 2>&1 | tail -15

echo "=== Build test ==="
npx expo export --platform web 2>&1 | tail -10 || npm run build 2>&1 | tail -10
```

### Step 1B — If pipeline is broken, fix it

Check the LAST failed run:
```bash
LAST_FAILED=$(gh run list --repo royea-beep/Caps --status failure --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
if [ -n "$LAST_FAILED" ]; then
  echo "=== Last failed run logs ==="
  gh run view $LAST_FAILED --log-failed --repo royea-beep/Caps 2>/dev/null | tail -40
fi
```

Common fixes:
- Missing EXPO_TOKEN → check if set
- Missing APPLE_API_KEY_BASE64 / APPLE_API_KEY_ID / APPLE_API_ISSUER_ID → set from 9Soccer (same Apple account)
- eas.json wrong profile → fix
- TypeScript errors → fix

```bash
echo "=== Check if critical secrets exist ==="
gh secret list --repo royea-beep/Caps 2>/dev/null | grep -E "EXPO|APPLE|SUPABASE"

echo "=== If APPLE secrets missing, copy from 9Soccer ==="
# Same Apple account — same API key works for all apps
# Check 9Soccer secrets for reference:
gh secret list --repo royea-beep/9soccer 2>/dev/null | grep -E "APPLE"
```

If APPLE secrets are missing on Caps but exist on 9Soccer:
```bash
# The API key is the same for all apps (same Apple developer account)
# These should already be set from the standardization session
# If not — read from local files:
APPLE_KEY_BASE64=$(cat /c/Projects/90soccer/.github/apple-api-key.p8 2>/dev/null | base64 -w 0 2>/dev/null || echo "NOT_FOUND")
if [ "$APPLE_KEY_BASE64" != "NOT_FOUND" ]; then
  gh secret set APPLE_API_KEY_BASE64 --body "$APPLE_KEY_BASE64" --repo royea-beep/Caps
fi

# Known values (from project config):
gh secret set APPLE_API_KEY_ID --body "45FCPV43JD" --repo royea-beep/Caps 2>/dev/null
gh secret set APPLE_API_ISSUER_ID --body "686f97b8-3f8a-40b7-a6cd-5293a3168439" --repo royea-beep/Caps 2>/dev/null
```

### Step 1C — Trigger build and verify

```bash
# Trigger
gh workflow run ios-testflight.yml --repo royea-beep/Caps 2>/dev/null || \
gh workflow run $(ls .github/workflows/*.yml | head -1 | xargs basename) --repo royea-beep/Caps 2>/dev/null

sleep 30
gh run list --repo royea-beep/Caps --limit 3 2>/dev/null
```

### Step 1D — If build still fails, try these approaches

**Approach 1 — TypeScript fix:**
```bash
npx tsc --noEmit 2>&1 | head -30
# Fix all errors
```

**Approach 2 — EAS credentials reset:**
```bash
npx eas-cli credentials --platform ios 2>/dev/null
```

**Approach 3 — Empty commit to re-trigger:**
```bash
git commit --allow-empty -m "ci: re-trigger EAS build"
git push origin main
```

---

## PART 2 — AUTO-DEBUG SYSTEM WITH WHATSAPP

Only proceed here if Part 1 pipeline is GREEN or at least building.

### Step 2A — Read existing WhatsApp integration

```bash
cd /c/Projects/Caps

echo "=== WhatsApp webhook ==="
find . -name "*whatsapp*" -o -name "*WhatsApp*" | grep -v node_modules | head -10
for f in $(find . -name "*whatsapp*" | grep -v node_modules | grep -E "\.ts$|\.tsx$" | head -5); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Edge Functions ==="
find supabase -name "*whatsapp*" 2>/dev/null | head -5
for f in $(find supabase -name "*whatsapp*" 2>/dev/null | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== How messages are sent ==="
grep -rn "whatsapp\|sendMessage\|WHATSAPP\|wa_phone\|wa_token\|wa_send\|twilio\|infobip" . --include="*.ts" --include="*.tsx" --include="*.env*" | grep -v node_modules | head -20

echo "=== Existing debug code ==="
find . -name "*debug*" -o -name "*Debug*" -o -name "*simulate*" | grep -v node_modules | head -10
for f in $(find . -name "*DebugOverlay*" -o -name "*simulate*" -o -name "*testers*" | grep -v node_modules | head -5); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Wingman debugLogger (extract this) ==="
cd /c/Projects/Wingman
find . -name "debugLogger*" | grep -v node_modules | head -1 | xargs cat 2>/dev/null
cd /c/Projects/Caps

echo "=== BIBLE / design doc ==="
cat MEMORY.md 2>/dev/null | head -80
cat IRON_RULES.md 2>/dev/null | head -80

echo "=== All screens / routes ==="
find app -name "*.tsx" 2>/dev/null | sort | head -20
ls components/ 2>/dev/null | head -20
```

### Step 2B — Build auto-debug engine

Create `lib/auto-debug.ts`:

```typescript
export interface DebugStep {
  id: number
  name: string
  action: () => Promise<void>
  expectedElements?: string[]
  timeout?: number
}

export interface StepResult {
  stepId: number
  stepName: string
  status: 'pass' | 'fail' | 'crash' | 'timeout'
  duration: number
  error?: string
  stackTrace?: string
  consoleErrors?: string[]
}

export interface DebugReport {
  project: string
  version: string
  totalSteps: number
  passed: number
  failedAt?: number
  failedStep?: string
  results: StepResult[]
  autoFixPrompt?: string
  timestamp: string
}

export class AutoDebugRunner {
  private steps: DebugStep[]
  private results: StepResult[] = []
  private errors: string[] = []
  private project: string
  private version: string

  constructor(project: string, version: string, steps: DebugStep[]) {
    this.project = project
    this.version = version
    this.steps = steps
  }

  private setupErrorCapture() {
    const orig = console.error
    console.error = (...args: any[]) => {
      this.errors.push(args.map(String).join(' '))
      orig.apply(console, args)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) =>
        this.errors.push(`[UNCAUGHT] ${e.message} at ${e.filename}:${e.lineno}`)
      )
      window.addEventListener('unhandledrejection', (e) =>
        this.errors.push(`[PROMISE] ${e.reason}`)
      )
    }
  }

  private async runStep(step: DebugStep): Promise<StepResult> {
    const start = Date.now()
    const errorsBefore = [...this.errors]
    console.log(`[AutoDebug] ▶ Step ${step.id}: ${step.name}`)

    try {
      await Promise.race([
        step.action(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('TIMEOUT')), step.timeout || 5000)
        ),
      ])
      await new Promise(r => setTimeout(r, 300))

      const newErrors = this.errors.slice(errorsBefore.length)
      return {
        stepId: step.id,
        stepName: step.name,
        status: newErrors.length === 0 ? 'pass' : 'fail',
        duration: Date.now() - start,
        error: newErrors.length > 0 ? newErrors.join('; ') : undefined,
        consoleErrors: newErrors,
      }
    } catch (e) {
      const err = e as Error
      return {
        stepId: step.id,
        stepName: step.name,
        status: err.message === 'TIMEOUT' ? 'timeout' : 'crash',
        duration: Date.now() - start,
        error: err.message,
        stackTrace: err.stack,
        consoleErrors: this.errors.slice(errorsBefore.length),
      }
    }
  }

  async run(): Promise<DebugReport> {
    this.setupErrorCapture()
    let failedAt: number | undefined
    let failedStep: string | undefined

    for (const step of this.steps) {
      const result = await this.runStep(step)
      this.results.push(result)
      if (result.status === 'crash' || result.status === 'timeout') {
        failedAt = step.id
        failedStep = step.name
        break
      }
    }

    const report: DebugReport = {
      project: this.project,
      version: this.version,
      totalSteps: this.steps.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failedAt,
      failedStep,
      results: this.results,
      timestamp: new Date().toISOString(),
    }

    if (failedAt) {
      report.autoFixPrompt = this.generateFixPrompt(report)
    }

    return report
  }

  private generateFixPrompt(report: DebugReport): string {
    const failed = report.results.find(r => r.stepId === report.failedAt)
    if (!failed) return ''

    const passed = report.results
      .filter(r => r.stepId < report.failedAt!)
      .map(r => `  ✅ Step ${r.stepId}: ${r.stepName} (${r.duration}ms)`)
      .join('\n')

    return `## AUTO-FIX: ${this.project} v${this.version} crashed at Step ${report.failedAt}

Yes, allow all edits in components
Project: /c/Projects/${this.project}

## Steps that PASSED:
${passed}

## CRASHED HERE:
  ❌ Step ${failed.stepId}: ${failed.stepName}
  Status: ${failed.status}
  Error: ${failed.error}
  Stack: ${failed.stackTrace || 'N/A'}
  Console: ${failed.consoleErrors?.join('\\n') || 'none'}

## TASK
1. Read the code related to "${failed.stepName}"
2. Find the exact line causing the ${failed.status}
3. Fix it
4. Build: npx tsc --noEmit && npm run build
5. Commit + push

## DEFINITION OF DONE
- Step ${report.failedAt} passes
- All previous steps still pass
- Build clean`
  }
}
```

### Step 2C — Build Caps test suite

Read MEMORY.md / app structure first, then define steps based on REAL screens:

```typescript
// lib/debug-suite.ts
import { DebugStep } from './auto-debug'
import { APP_VERSION } from './constants' // or read from app.json

// Define steps based on what ACTUALLY exists in Caps
// Read app/ directory first — use real routes
export const CAPS_STEPS: DebugStep[] = [
  // STEP 1-N will be defined AFTER reading the codebase
  // Don't guess — read the routes and components first
]
```

**IMPORTANT:** Read the app structure first, THEN write the steps. Don't guess routes.

### Step 2D — WhatsApp crash alerts

Find and use the EXISTING WhatsApp send function:

```typescript
// lib/debug-whatsapp.ts
import { DebugReport } from './auto-debug'

export async function sendDebugToWhatsApp(report: DebugReport) {
  if (!report.failedAt) return

  const failed = report.results.find(r => r.stepId === report.failedAt)
  const message = [
    `🔴 *AUTO-DEBUG: ${report.project} v${report.version}*`,
    `❌ Step ${report.failedAt}/${report.totalSteps}: "${report.failedStep}"`,
    `✅ Passed: ${report.passed}/${report.totalSteps}`,
    ``,
    `*Error:*`,
    `\`${failed?.error || 'unknown'}\``,
    ``,
    `*Fix prompt ready* — open /debug in app`,
    `⏱️ ${new Date(report.timestamp).toLocaleString('he-IL')}`,
  ].join('\n')

  // USE THE EXISTING WhatsApp function from Caps
  // Read whatsapp-bot-handler or sendWhatsApp or whatever exists
  // DON'T build a new one
  
  // If the Edge Function is the sender:
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
  
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-bot-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        type: 'debug_alert',
        message,
        project: report.project,
        step: report.failedAt,
      }),
    })
  } catch (e) {
    console.warn('[Debug] WhatsApp alert failed:', e)
  }
}
```

**If the WhatsApp Edge Function only handles incoming webhooks (GET verification),
you'll need to add a POST handler for outgoing messages. Read the code first.**

### Step 2E — Debug screen

Create `app/debug.tsx` (or appropriate route for Expo):

```typescript
// React Native screen with:
// 1. "▶ Run Debug" button
// 2. Results list (step by step, green/red)
// 3. "📋 Copy Fix Prompt" button
// 4. Auto-send to WhatsApp on failure
```

Add `testID` to all critical elements in Caps while building the suite.

### Step 2F — Extract debugLogger from Wingman

```bash
cp /c/Projects/Wingman/src/lib/debugLogger.ts /c/Projects/Caps/lib/debugLogger.ts
# Adapt imports for React Native (remove Next.js specific)
```

Wire to Caps root layout:
```typescript
// app/_layout.tsx
import { initDebugLogger } from '@/lib/debugLogger'
useEffect(() => { if (__DEV__) initDebugLogger() }, [])
```

### Step 2G — App name + version on every screen (debug rule)

```bash
echo "=== Check if version is displayed ==="
grep -rn "version\|appVersion\|APP_VERSION" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -10
cat app.json 2>/dev/null | grep version
```

Add to every screen (footer or header):
```tsx
<Text style={{ fontSize: 10, opacity: 0.3, position: 'absolute', bottom: 4, right: 4 }}>
  Caps v{APP_VERSION}
</Text>
```

---

## FINAL — BUILD + DEPLOY

```bash
cd /c/Projects/Caps

npx tsc --noEmit 2>&1 | tail -10

git add -A
git commit -m "feat: auto-debug system — numbered steps, WhatsApp alerts, debugLogger, version badges"
git push origin main

# Check build
sleep 15
gh run list --repo royea-beep/Caps --limit 3 2>/dev/null
```

---

## MEGA FINAL REPORT (MANDATORY)

```
MEGA FINAL REPORT — Caps Pipeline + Auto-Debug

PART 1 — PIPELINE:
  Current status: ✅ GREEN / ❌ [what's wrong]
  Last successful build: [run ID]
  Secrets: EXPO_TOKEN ✅/❌ | APPLE_API_KEY ✅/❌ | SUPABASE ✅/❌
  TypeScript: clean ✅/❌
  If fixed: [what was wrong + what changed]

PART 2 — AUTO-DEBUG:
  auto-debug.ts: ✅/❌
  debug-suite.ts: [X] steps defined
  testIDs added: [X] elements
  debug screen: ✅/❌ (at /debug or app/debug.tsx)
  WhatsApp alerts: ✅/❌ (how: [Edge Function / direct API / other])
  debugLogger (from Wingman): ✅/❌
  Version badge on screens: ✅/❌

TEST RUN (if possible):
  Steps: [X] total
  Passed: [X]
  Failed: [X]
  WhatsApp sent: ✅/❌

Commit: [hash]
Next: replicate to 9Soccer + Wingman
```

---

Yes, allow all edits in components
