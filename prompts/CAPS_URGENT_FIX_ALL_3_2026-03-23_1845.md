# CAPS — URGENT: 3 THINGS BROKEN. FIX ALL.
**Date:** 2026-03-23 | **Time:** 18:45 IST
**Session:** App crashes + WhatsApp empty + build not on TestFlight — FIX ALL 3
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** 1350cc5

## CRITICAL: AUTO-APPROVE EVERYTHING. THIS IS URGENT.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## 3 PROBLEMS — ALL BROKEN

1. **App crashes on open** — the app itself doesn't work
2. **WhatsApp crash alert arrives but EMPTY** — no useful content
3. **New build not on TestFlight** — EAS build not deploying

These may be CONNECTED: the crash evidence code we added today might be
CAUSING the crash (circular: crash system crashes the app).

---

## TASK

### PROBLEM 1 — APP CRASHES ON OPEN (MOST CRITICAL)

The most likely cause: one of today's changes (crash-evidence.ts, CrashBoundary.tsx,
debug-simulation.ts) has an import error or crashes on initialization.

```bash
cd /c/Projects/Caps

echo "============================================="
echo "  DIAGNOSE WHY APP CRASHES"
echo "============================================="

echo "=== 1. TypeScript errors ==="
npx tsc --noEmit 2>&1 | head -30

echo "=== 2. What changed today (possible culprits) ==="
git log --oneline -10
git diff HEAD~5 --stat

echo "=== 3. Read _layout.tsx — is crash-evidence imported at root? ==="
cat app/_layout.tsx

echo "=== 4. Does crash-evidence.ts import something that doesn't exist? ==="
cat lib/crash-evidence.ts 2>/dev/null | head -10
# Check: does it import captureScreen? Is react-native-view-shot installed?
grep "captureScreen\|view-shot" lib/crash-evidence.ts 2>/dev/null
grep "react-native-view-shot" package.json 2>/dev/null

echo "=== 5. Does CrashBoundary import something broken? ==="
cat components/CrashBoundary.tsx 2>/dev/null | head -20
grep "import" components/CrashBoundary.tsx 2>/dev/null

echo "=== 6. Does debug-simulation.ts import something broken? ==="
cat lib/debug-simulation.ts 2>/dev/null | head -20
grep "import" lib/debug-simulation.ts 2>/dev/null

echo "=== 7. Check if react-native-view-shot is installed ==="
cat package.json | grep "view-shot"
ls node_modules/react-native-view-shot 2>/dev/null && echo "EXISTS" || echo "NOT INSTALLED"

echo "=== 8. Check Expo compatibility ==="
npx expo doctor 2>&1 | tail -20

echo "=== 9. Try building ==="
npx expo export --platform web 2>&1 | tail -20 || npm run build 2>&1 | tail -20

echo "=== 10. Check the EAS build logs ==="
gh run list --repo royea-beep/Caps --limit 3 2>/dev/null
LAST_RUN=$(gh run list --repo royea-beep/Caps --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
gh run view $LAST_RUN --log-failed --repo royea-beep/Caps 2>&1 | tail -40
```

#### THE FIX — Based on what you find:

**If crash-evidence.ts imports captureScreen but react-native-view-shot is missing:**
```bash
npx expo install react-native-view-shot
```

**If crash-evidence.ts crashes on init (runs at startup):**
```typescript
// Wrap EVERYTHING in try/catch — crash evidence must NEVER crash the app
export function startCrashRecording() {
  try {
    // ... existing code
  } catch (e) {
    console.warn('[CrashEvidence] Failed to start — continuing without it:', e)
    // DON'T crash the app because debug tools failed
  }
}
```

**If CrashBoundary has broken imports:**
```typescript
// Make ALL imports lazy/dynamic:
let captureScreen: any = null
try {
  captureScreen = require('react-native-view-shot').captureScreen
} catch {
  console.warn('[CrashEvidence] view-shot not available — screenshots disabled')
}
```

**If the entire crash-evidence system is causing the crash — DISABLE IT:**
```bash
# Nuclear option: comment out crash-evidence from _layout.tsx
# The app MUST work first. Debug tools are secondary.
```

In `app/_layout.tsx`, wrap crash recording in a safe block:
```typescript
useEffect(() => {
  if (__DEV__) {
    try {
      const { startCrashRecording } = require('@/lib/crash-evidence')
      startCrashRecording()
    } catch (e) {
      console.warn('Crash recording disabled:', e)
    }
  }
}, [])
```

**THE RULE: The debug system must NEVER break the app. If it can't load — skip it silently.**

#### After fixing — verify app starts:

```bash
# Local test
npx expo start --clear 2>&1 | tail -20

# Or just build check
npx tsc --noEmit 2>&1 | tail -10
npx expo export --platform web 2>&1 | tail -10
```

---

### PROBLEM 2 — WHATSAPP ARRIVES EMPTY

```bash
echo "============================================="
echo "  DIAGNOSE EMPTY WHATSAPP"
echo "============================================="

echo "=== 1. Read WhatsApp sender — what gets built into the message? ==="
cat lib/debug-whatsapp.ts 2>/dev/null
grep -rn "sendCrash\|sendWhatsApp\|whatsapp.*message" lib/ --include="*.ts" | head -10

echo "=== 2. Read Edge Function — does it use the message field? ==="
find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3
for f in $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== 3. Does the Edge Function actually call WhatsApp API? ==="
grep -n "graph.facebook\|WHATSAPP_TOKEN\|PHONE_NUMBER_ID\|sendMessage" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10

echo "=== 4. Check: does Edge Function have env vars for WhatsApp? ==="
grep -n "Deno.env.get\|env.get" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10

echo "=== 5. Test Edge Function directly ==="
SUPABASE_URL=$(grep "EXPO_PUBLIC_SUPABASE_URL\|NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
SUPABASE_KEY=$(grep "EXPO_PUBLIC_SUPABASE_ANON_KEY\|SUPABASE_ANON_KEY" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')

echo "Testing Edge Function with message..."
curl -v "${SUPABASE_URL}/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -d '{
    "type": "crash_report",
    "crash_notification": true,
    "message": "🧪 TEST MESSAGE WITH CONTENT\n\nError: TestError\nScreen: TestScreen\nAction: TestAction\n\nThis should NOT be empty!",
    "crash": {
      "project": "Caps",
      "error": "TestError",
      "screen": "TestScreen"
    }
  }' 2>&1

echo "=== 6. Check Supabase Edge Function logs ==="
# If possible via CLI:
npx supabase functions logs whatsapp-bot-handler 2>/dev/null | tail -20
```

#### THE FIX:

**If Edge Function ignores the `message` field:**
The Edge Function probably has a `crash_notification: true` handler that
builds its OWN message instead of using `body.message`. Fix:

```typescript
// In Edge Function — use the message from the request:
if (body.crash_notification || body.type === 'crash_report') {
  const messageToSend = body.message || 'Crash reported — no details'
  // Send THIS message, don't build a new one
  await sendWhatsApp(messageToSend)
}
```

**If Edge Function has no WhatsApp API credentials:**
The Edge Function can receive the POST but can't SEND to WhatsApp.
Check: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO` env vars.

```bash
echo "=== What env vars does the Edge Function expect? ==="
grep "Deno.env" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10
```

If WhatsApp API creds are missing → the ntfy backup MUST work.
Verify ntfy sends with content:

```bash
echo "Testing ntfy directly..."
curl -X POST "https://ntfy.sh/caps-crash-roye" \
  -H "Title: 🧪 TEST with content" \
  -H "Priority: 5" \
  -d "Error: TestError
Screen: TestScreen  
Action: TestAction
This should have content!

Fix: SELECT fix_prompt FROM crash_reports ORDER BY created_at DESC LIMIT 1"
```

**Deploy fixed Edge Function:**
```bash
npx supabase functions deploy whatsapp-bot-handler 2>/dev/null || \
echo "Deploy Edge Function via Supabase dashboard: https://supabase.com/dashboard/project/gxrpunvhjcrzqnitbqah/functions"
```

---

### PROBLEM 3 — BUILD NOT ON TESTFLIGHT

```bash
echo "============================================="
echo "  DIAGNOSE TESTFLIGHT BUILD"
echo "============================================="

echo "=== 1. Latest GitHub Actions runs ==="
gh run list --repo royea-beep/Caps --limit 5 2>/dev/null

echo "=== 2. Last run status ==="
LAST_RUN=$(gh run list --repo royea-beep/Caps --limit 1 --json databaseId,status,conclusion --jq '.[0]' 2>/dev/null)
echo "$LAST_RUN"

echo "=== 3. If failed — get logs ==="
LAST_ID=$(gh run list --repo royea-beep/Caps --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
gh run view $LAST_ID --repo royea-beep/Caps 2>/dev/null
gh run view $LAST_ID --log-failed --repo royea-beep/Caps 2>&1 | tail -50

echo "=== 4. Check EAS config ==="
cat eas.json 2>/dev/null
cat app.json 2>/dev/null | head -20

echo "=== 5. Check secrets ==="
gh secret list --repo royea-beep/Caps 2>/dev/null

echo "=== 6. Check workflow file ==="
cat .github/workflows/*.yml 2>/dev/null
```

#### Common causes:
- **EAS build fails** → TypeScript error from today's changes
- **EAS build succeeds but submit fails** → missing Apple API key
- **Build queued but not started** → EAS free tier queue
- **Build succeeded but Apple processing** → wait 15-30 min

#### Fix based on what's found:
```bash
# If TypeScript error → fix it (Problem 1 fix should handle this)
# If Apple key missing → set it:
gh secret set APPLE_API_KEY_ID --body "WTWALQMG5N" --repo royea-beep/Caps 2>/dev/null
gh secret set APPLE_API_ISSUER_ID --body "686f97b8-3f8a-40b7-a6cd-5293a3168439" --repo royea-beep/Caps 2>/dev/null

# After fixes — re-trigger:
gh workflow run $(ls .github/workflows/*.yml | head -1 | xargs basename) --repo royea-beep/Caps 2>/dev/null

# Or empty commit to trigger:
git commit --allow-empty -m "ci: re-trigger EAS after fixes"
git push origin main
```

---

### FINAL — COMMIT ALL FIXES + VERIFY

```bash
cd /c/Projects/Caps

echo "=== TypeScript clean? ==="
npx tsc --noEmit 2>&1 | tail -10

echo "=== Build works? ==="
npx expo export --platform web 2>&1 | tail -10 || echo "web export not needed"

echo "=== Commit ==="
git add -A
git commit -m "fix: app crash on open + WhatsApp empty message + build pipeline — all 3 fixed"
git push origin main

echo "=== Verify build triggered ==="
sleep 15
gh run list --repo royea-beep/Caps --limit 3 2>/dev/null
```

---

## CONSTRAINTS

- **App MUST start first** — if crash-evidence breaks the app, disable it
- Debug tools must NEVER crash the app — always try/catch, always fallback
- WhatsApp message must have CONTENT — test with curl before declaring fixed
- ntfy is the backup — must always work even if WhatsApp fails
- Build must reach TestFlight — check EAS + Apple submission

---

## MEGA FINAL REPORT (MANDATORY)

```
CAPS — 3 FIXES

PROBLEM 1 — APP CRASH:
  Root cause: [what caused it]
  Fix: [what changed]
  App starts now: ✅/❌

PROBLEM 2 — WHATSAPP EMPTY:
  Root cause: [Edge Function ignores message / no API creds / other]
  Fix: [what changed]
  Test curl result: [response]
  ntfy backup works: ✅/❌

PROBLEM 3 — TESTFLIGHT BUILD:
  Root cause: [TS error / EAS fail / Apple key / queue]
  Fix: [what changed]  
  Build triggered: ✅/❌
  Run ID: [X]
  Status: [queued/in_progress/success]

ALL 3 FIXED: ✅/❌

Commit: [hash]
```

---

Yes, allow all edits in components
