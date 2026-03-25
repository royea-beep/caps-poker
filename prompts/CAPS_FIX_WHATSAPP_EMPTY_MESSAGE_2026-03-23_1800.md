# CAPS — FIX WHATSAPP: SEND FULL FIX PROMPT, NOT EMPTY ALERT
**Date:** 2026-03-23 | **Time:** 18:00 IST
**Session:** The WhatsApp message arrives but is EMPTY — bot can't fix anything
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** 8f4f6d8

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## THE ACTUAL PROBLEM

WhatsApp crash alert ARRIVES but the message is EMPTY or has no useful content.
When Roye tells Claude Bot "תתקן את הקריסה", the bot says "אין דוח קריסה"
because it never received the error details, screenshots, or step log.

The WhatsApp message needs to contain the COMPLETE fix prompt — ready to
copy-paste DIRECTLY into Claude Bot. Not just "it crashed".

---

## TASK

### STEP 0 — FIND WHY THE MESSAGE IS EMPTY

```bash
cd /c/Projects/Caps

echo "=== 1. Read crash-evidence.ts — what does generateCrashReport return? ==="
cat lib/crash-evidence.ts

echo "=== 2. Read WhatsApp sender — what does it actually send? ==="
cat lib/debug-whatsapp.ts 2>/dev/null
grep -rn "sendCrash\|sendDebug\|whatsapp.*message\|message.*whatsapp" lib/ --include="*.ts" | head -10

echo "=== 3. Read CrashBoundary — does it pass the report correctly? ==="
cat components/CrashBoundary.tsx

echo "=== 4. Read Edge Function — does it format the message? ==="
find supabase -name "*whatsapp*" 2>/dev/null | head -5
for f in $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== 5. Check: is the Edge Function only handling GET (webhook verify)? ==="
grep -n "GET\|POST\|method\|req.method" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10

echo "=== 6. Check Supabase project ID ==="
grep "SUPABASE_URL" .env.local 2>/dev/null | head -1

echo "=== 7. Check if crash_reports actually has data ==="
# We'll verify via code
```

### STEP 1 — IDENTIFY THE ROOT CAUSE

The message is empty because ONE of these:

**A)** `sendCrashToWhatsApp()` builds the message string but the Edge Function
ignores the `message` field in the POST body → sends nothing

**B)** The Edge Function only has a GET handler (for webhook verification)
and no POST handler → the POST request returns 200 but sends no WhatsApp

**C)** The crash report fields are `undefined`/`null` when building the message
(screenshots not uploaded yet, storageUrls empty, stepLog empty)

**D)** WhatsApp API has a character limit and the message is truncated to nothing

**E)** The Edge Function sends to WhatsApp but the message template is empty

**Read the code and identify WHICH one.**

### STEP 2 — THE FIX: 3-LAYER APPROACH

Don't rely on WhatsApp alone. Send the fix prompt through 3 channels:

#### Layer 1 — WhatsApp: Short summary + link to full report

```typescript
// lib/debug-whatsapp.ts — REWRITE

export async function sendCrashToWhatsApp(report: CrashReport) {
  // Build SHORT summary for WhatsApp (has character limits)
  const shortMessage = [
    `💥 *CRASH: ${report.project} v${report.version}*`,
    ``,
    `❌ ${report.error.message.slice(0, 100)}`,
    `📍 Screen: ${report.lastScreen}`,
    `🎯 Action: ${report.lastAction}`,
    `📸 ${report.storageUrls.length} screenshots saved`,
    `📋 ${report.stepLog.length} steps logged`,
    ``,
    `🔧 Fix prompt saved to DB — run this in Claude Bot:`,
    ``,
    `\`\`\``,
    `Read crash report from Supabase:`,
    `SELECT fix_prompt FROM crash_reports`,
    `WHERE project = '${report.project}'`,
    `ORDER BY created_at DESC LIMIT 1;`,
    `\`\`\``,
    ``,
    `Or copy from app: Settings → Debug → last crash`,
  ].join('\n')

  // Try multiple send methods:
  
  // Method 1: Edge Function
  const sent1 = await trySendViaEdgeFunction(shortMessage, report)
  
  // Method 2: Direct ntfy (backup — always works)
  const sent2 = await trySendViaNtfy(shortMessage, report)
  
  // Method 3: Save to DB with full fix prompt (bot can read this)
  await saveCrashReportToDB(report)
  
  return sent1 || sent2
}

async function trySendViaEdgeFunction(message: string, report: CrashReport): Promise<boolean> {
  try {
    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!SUPABASE_URL) {
      console.warn('[WhatsApp] No SUPABASE_URL')
      return false
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-bot-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        type: 'crash_report',
        message: message,
        // Also send structured data in case Edge Function can use it:
        crash: {
          project: report.project,
          version: report.version,
          error: report.error.message,
          screen: report.lastScreen,
          action: report.lastAction,
          screenshots: report.storageUrls,
          stepsCount: report.stepLog.length,
        },
      }),
    })
    
    const result = await response.text()
    console.log('[WhatsApp] Edge Function response:', response.status, result)
    return response.ok
  } catch (e) {
    console.warn('[WhatsApp] Edge Function failed:', e)
    return false
  }
}

async function trySendViaNtfy(message: string, report: CrashReport): Promise<boolean> {
  try {
    // ntfy ALWAYS works — no Edge Function needed
    const ntfyMessage = [
      `💥 CRASH: ${report.project} v${report.version}`,
      `Error: ${report.error.message.slice(0, 200)}`,
      `Screen: ${report.lastScreen}`,
      `Action: ${report.lastAction}`,
      `Screenshots: ${report.storageUrls.length}`,
      report.storageUrls.length > 0 ? `\nFirst screenshot: ${report.storageUrls[0]}` : '',
      `\nFix prompt in DB: SELECT fix_prompt FROM crash_reports WHERE project='${report.project}' ORDER BY created_at DESC LIMIT 1`,
    ].filter(Boolean).join('\n')
    
    await fetch('https://ntfy.sh/caps-crash-roye', {
      method: 'POST',
      headers: {
        'Title': `💥 ${report.project} CRASH: ${report.error.message.slice(0, 50)}`,
        'Tags': 'warning,skull',
        'Priority': '5', // urgent
      },
      body: ntfyMessage,
    })
    
    return true
  } catch (e) {
    console.warn('[ntfy] Failed:', e)
    return false
  }
}

async function saveCrashReportToDB(report: CrashReport): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    
    await supabase.from('crash_reports').insert({
      project: report.project,
      version: report.version,
      error_message: report.error.message,
      error_stack: report.error.stack || '',
      last_screen: report.lastScreen,
      last_action: report.lastAction,
      step_log: report.stepLog,
      screenshot_urls: report.storageUrls,
      console_errors: report.consoleErrors,
      fix_prompt: report.fixPrompt,
      device: report.device,
    })
    
    console.log('[DB] Crash report saved ✅')
  } catch (e) {
    console.warn('[DB] Save failed:', e)
  }
}
```

#### Layer 2 — Fix the Edge Function to ACTUALLY send WhatsApp

```bash
echo "=== Read the Edge Function completely ==="
cat $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1)
```

The Edge Function needs to handle POST with `type: 'crash_report'`:

```typescript
// In the Edge Function — add POST handler:
if (req.method === 'POST') {
  const body = await req.json()
  
  if (body.type === 'crash_report' || body.type === 'debug_alert') {
    // Send WhatsApp message via WhatsApp Business API / Twilio / whatever is configured
    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
    const WHATSAPP_PHONE = Deno.env.get('WHATSAPP_PHONE') // Roye's number
    
    if (WHATSAPP_TOKEN && WHATSAPP_PHONE) {
      // Send via WhatsApp Cloud API:
      await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: WHATSAPP_PHONE,
          type: 'text',
          text: { body: body.message },
        }),
      })
    }
    
    return new Response(JSON.stringify({ sent: true, message: body.message?.slice(0, 50) }))
  }
}
```

**CHECK: Does the Edge Function have WhatsApp API credentials (WHATSAPP_TOKEN, phone ID)?
If NOT — that's why the message is empty. The Edge Function has no way to send.**

If no WhatsApp API is configured:

```bash
echo "=== Check Edge Function env vars ==="
grep -rn "WHATSAPP\|whatsapp.*token\|PHONE\|phone.*id\|TWILIO\|twilio" supabase/ --include="*.ts" | head -10

echo "=== Check Supabase secrets ==="
# Can't read secrets directly, but check what the code expects
grep -rn "Deno.env.get\|env.get\|process.env" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10
```

**If WhatsApp API is NOT configured → the ntfy backup (Layer 2) is the real solution.
ntfy works with ZERO configuration — just POST to a URL.**

#### Layer 3 — Make the fix prompt SELF-CONTAINED

The fix prompt in crash_reports must contain EVERYTHING Claude Bot needs:

```typescript
// In crash-evidence.ts — improve buildFixPrompt:

function buildFixPrompt(report: CrashReport): string {
  const stepHistory = report.stepLog
    .slice(-20)
    .map(s => `  [${s.id}] ${s.timestamp.slice(11, 19)} ${s.type}: ${s.description}`)
    .join('\n')

  const screenshots = report.storageUrls.length > 0
    ? report.storageUrls.map((url, i) => `  📸 Frame ${i + 1}: ${url}`).join('\n')
    : '  (no screenshots available)'

  const consoleErrs = report.consoleErrors.length > 0
    ? report.consoleErrors.slice(-10).join('\n  ')
    : '  none'

  return `## CRASH FIX: ${report.project} v${report.version}
## Time: ${report.timestamp}

Yes, allow all edits in components
Project: /c/Projects/${report.project}

## ERROR
\`\`\`
${report.error.message}
\`\`\`

## STACK TRACE
\`\`\`
${report.error.stack || 'N/A'}
\`\`\`

## WHERE IT CRASHED
Screen: ${report.lastScreen}
Last action: ${report.lastAction}
Platform: ${report.device.platform} ${report.device.os || ''}

## STEP-BY-STEP LOG (last 20 actions before crash):
${stepHistory}

## SCREENSHOTS (before crash):
${screenshots}

## CONSOLE ERRORS:
  ${consoleErrs}

## TASK
1. Read the error and stack trace above
2. Look at the screenshots — they show what was on screen
3. The crash happened on screen "${report.lastScreen}" after action "${report.lastAction}"
4. Read the step log — the last step before crash tells you EXACTLY what triggered it
5. Find the bug in the code
6. Fix it
7. npx tsc --noEmit — must pass clean
8. git add -A && git commit -m "fix: crash on ${report.lastScreen} — ${report.error.message.slice(0, 50)}"
9. git push origin main

## DEFINITION OF DONE
- Same action sequence does not crash
- Build clean
- Push triggers EAS auto-build`
}
```

### STEP 3 — ADD "COPY FIX PROMPT" THAT ACTUALLY WORKS

In CrashBoundary.tsx — make the copy button copy the FULL prompt:

```bash
cat components/CrashBoundary.tsx
```

Verify the "Copy Fix Prompt" button calls:
```typescript
Clipboard.setStringAsync(report.fixPrompt)
```

And that `report.fixPrompt` is the FULL prompt string (not undefined, not empty).

**Add a visual confirmation:**
```tsx
const [copied, setCopied] = useState(false)

<TouchableOpacity 
  onPress={async () => {
    await Clipboard.setStringAsync(report.fixPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }}
>
  <Text>{copied ? '✅ הועתק!' : '📋 Copy Fix Prompt'}</Text>
</TouchableOpacity>

{/* Also show the prompt content so Roye can see it's not empty */}
<ScrollView style={{ maxHeight: 200, marginTop: 8, backgroundColor: '#111', padding: 8, borderRadius: 6 }}>
  <Text style={{ color: '#aaa', fontSize: 9, fontFamily: 'monospace' }}>
    {report.fixPrompt?.slice(0, 500) || '⚠️ NO FIX PROMPT GENERATED'}
    {report.fixPrompt?.length > 500 ? '\n...(truncated in display, full version copied)' : ''}
  </Text>
</ScrollView>
```

### STEP 4 — BUILD + PUSH

```bash
cd /c/Projects/Caps
npx tsc --noEmit 2>&1 | tail -10
git add -A
git commit -m "fix: WhatsApp crash message was empty — added ntfy backup, full fix prompt in DB, improved evidence formatting"
git push origin main
gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

---

## CONSTRAINTS

- WhatsApp may not have API credentials → ntfy is the reliable backup
- ntfy requires ZERO configuration — just POST to URL
- Fix prompt must be SELF-CONTAINED — bot doesn't need to search for anything
- crash_reports DB is the permanent record — WhatsApp/ntfy are just alerts
- Copy button must show confirmation + preview the content

---

## MEGA FINAL REPORT (MANDATORY)

```
WHATSAPP FIX — Caps

ROOT CAUSE: [A/B/C/D/E — which one was it?]

FIX:
  WhatsApp Edge Function: [fixed / was missing POST handler / no API creds]
  ntfy backup: ✅/❌ (caps-crash-roye)
  DB save: ✅/❌ (crash_reports with fix_prompt)
  Fix prompt content: ✅/❌ (error + stack + screenshots + steps)
  Copy button works: ✅/❌ (with preview)

ALERT FLOW NOW:
  Crash → 3 channels:
    1. WhatsApp: ✅/❌ [with content / still empty / no API]
    2. ntfy: ✅/❌ [always works]
    3. DB: ✅/❌ [fix_prompt saved, bot can query]

HOW ROYE USES IT:
  1. Gets ntfy/WhatsApp alert with crash summary
  2. Opens app → crash screen → sees fix prompt preview
  3. Taps "Copy Fix Prompt" → pastes to Claude Bot
  4. Bot has: error, stack, screenshots, steps → fixes the bug

Commit: [hash]
```

---

Yes, allow all edits in components
