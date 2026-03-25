# CAPS — WHATSAPP CRASH THREADING: REPLY = FIX THIS SPECIFIC CRASH
**Date:** 2026-03-23 | **Time:** 18:15 IST
**Session:** When Roye replies to a WhatsApp crash message, bot knows WHICH crash and fixes it
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** d5a0e76

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## PROBLEM

Multiple crashes can happen. Bot sends multiple WhatsApp messages. Roye replies
"תתקן" to one of them. The bot doesn't know WHICH crash Roye is replying to
→ picks the wrong one or says "no report".

Each crash message needs a UNIQUE ID. When Roye replies, the bot matches the
reply to the exact crash and pulls the fix prompt from DB.

---

## TASK

### STEP 0 — READ CURRENT WHATSAPP FLOW

```bash
cd /c/Projects/Caps

echo "=== WhatsApp sender ==="
cat lib/debug-whatsapp.ts 2>/dev/null || grep -rn "sendCrash\|whatsapp" lib/ --include="*.ts" | head -10
for f in $(grep -rln "sendCrash\|whatsapp" lib/ --include="*.ts" | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== Edge Function ==="
find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3
for f in $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== crash_reports table ==="
grep -rn "crash_reports" lib/ --include="*.ts" | head -10

echo "=== How crash ID is generated ==="
grep -rn "gen_random_uuid\|crash.*id\|report.*id" lib/ --include="*.ts" | head -10
```

### STEP 1 — ADD CRASH ID TO EVERY MESSAGE

Each WhatsApp crash message includes a short unique code:

```typescript
// In crash-evidence.ts or debug-whatsapp.ts:

function generateCrashCode(): string {
  // Short 6-char code: easy to read in WhatsApp
  // Example: "CR-A7X3"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 confusion
  const code = Array.from({ length: 4 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `CR-${code}`
}
```

Update the crash report to include this code:

```typescript
// In generateCrashReport():
const crashCode = generateCrashCode()

// Save to DB with the code:
const { data } = await supabase.from('crash_reports').insert({
  // ... existing fields
  crash_code: crashCode,  // NEW — short unique identifier
}).select('id, crash_code').single()
```

Add column to DB:
```sql
ALTER TABLE crash_reports ADD COLUMN IF NOT EXISTS crash_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_code ON crash_reports(crash_code);
```

### STEP 2 — INCLUDE CRASH CODE IN WHATSAPP MESSAGE

Update WhatsApp message format:

```typescript
// In sendCrashToWhatsApp:

const shortMessage = [
  `💥 *CRASH [${crashCode}]*`,
  `*${report.project} v${report.version}*`,
  ``,
  `❌ ${report.error.message.slice(0, 100)}`,
  `📍 ${report.lastScreen} → ${report.lastAction}`,
  `📸 ${report.storageUrls.length} screenshots`,
  ``,
  `↩️ *Reply "תתקן" to auto-fix this crash*`,
  `↩️ *Reply "פרטים" for full details*`,
  `↩️ *Reply "תתעלם" to dismiss*`,
].join('\n')
```

The crash code `[CR-A7X3]` is visible in the message. When Roye replies,
the Edge Function extracts the code and finds the right crash.

### STEP 3 — EDGE FUNCTION: HANDLE REPLIES

Update the WhatsApp Edge Function to handle incoming replies:

```bash
echo "=== Current Edge Function ==="
cat $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1)
```

Add reply handling:

```typescript
// In whatsapp-bot-handler Edge Function:

// When WhatsApp sends an incoming message (webhook POST from Meta):
if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
  const message = body.entry[0].changes[0].value.messages[0]
  const text = message.text?.body?.trim() || ''
  const quotedMessage = message.context?.id // WhatsApp reply reference
  
  // Extract crash code from the quoted message or from the reply text
  const crashCodeMatch = text.match(/CR-[A-Z0-9]{4}/) || 
                          // If replying to a message, check the original message
                          quotedMessage // WhatsApp provides context of quoted message
  
  // Also check: is this a reply with a command?
  const isFixCommand = /תתקן|fix|תקן/.test(text.toLowerCase())
  const isDetailsCommand = /פרטים|details|דוח/.test(text.toLowerCase())
  const isDismissCommand = /תתעלם|dismiss|skip/.test(text.toLowerCase())
  
  if (isFixCommand) {
    // Find the crash — try multiple methods:
    let crashReport = null
    
    // Method 1: Extract crash code from reply text
    const codeInText = text.match(/CR-[A-Z0-9]{4}/)
    if (codeInText) {
      const { data } = await supabase
        .from('crash_reports')
        .select('*')
        .eq('crash_code', codeInText[0])
        .single()
      crashReport = data
    }
    
    // Method 2: If no code in text, get the LATEST unresolved crash
    if (!crashReport) {
      const { data } = await supabase
        .from('crash_reports')
        .select('*')
        .eq('project', 'Caps')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      crashReport = data
    }
    
    if (crashReport) {
      // Mark as being fixed
      await supabase
        .from('crash_reports')
        .update({ status: 'fixing', resolved_at: new Date().toISOString() })
        .eq('id', crashReport.id)
      
      // Send back the fix prompt
      const replyMessage = [
        `🔧 *Fixing crash [${crashReport.crash_code}]*`,
        ``,
        `📋 Fix prompt (${crashReport.fix_prompt?.length || 0} chars):`,
        ``,
        crashReport.fix_prompt?.slice(0, 1500) || 'No fix prompt available',
        ``,
        `Copy this ☝️ and paste to Claude Bot`,
      ].join('\n')
      
      await sendWhatsAppReply(message.from, replyMessage)
    } else {
      await sendWhatsAppReply(message.from, '❓ No unresolved crash found. Check /debug in app.')
    }
  }
  
  if (isDetailsCommand) {
    // Find crash and send full details
    const { data: crash } = await supabase
      .from('crash_reports')
      .select('*')
      .eq('project', 'Caps')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (crash) {
      const details = [
        `📊 *Crash [${crash.crash_code}] Details:*`,
        ``,
        `Error: ${crash.error_message}`,
        `Screen: ${crash.last_screen}`,
        `Action: ${crash.last_action}`,
        `Time: ${crash.created_at}`,
        ``,
        `Screenshots: ${crash.screenshot_urls?.length || 0}`,
        ...(crash.screenshot_urls || []).slice(0, 3).map((url: string, i: number) => `  📸 ${i+1}: ${url}`),
        ``,
        `Steps: ${crash.step_log?.length || 0}`,
        ...(crash.step_log || []).slice(-5).map((s: any) => `  ${s.id}. ${s.description}`),
      ].join('\n')
      
      await sendWhatsAppReply(message.from, details)
    }
  }
  
  if (isDismissCommand) {
    // Find and dismiss latest crash
    await supabase
      .from('crash_reports')
      .update({ status: 'dismissed' })
      .eq('project', 'Caps')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    
    await sendWhatsAppReply(message.from, '✅ Crash dismissed.')
  }
}

// Helper:
async function sendWhatsAppReply(to: string, message: string) {
  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('WhatsApp credentials missing — falling back to ntfy')
    // Fallback: send via ntfy
    await fetch('https://ntfy.sh/caps-crash-roye', {
      method: 'POST',
      body: message.slice(0, 4000),
    })
    return
  }
  
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  })
}
```

### STEP 4 — ADD STATUS COLUMN TO crash_reports

```sql
ALTER TABLE crash_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new'
  CHECK (status IN ('new', 'fixing', 'fixed', 'dismissed'));
ALTER TABLE crash_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
```

### STEP 5 — ALSO UPDATE ntfy TO INCLUDE CRASH CODE

```typescript
// In ntfy backup sender:
await fetch('https://ntfy.sh/caps-crash-roye', {
  method: 'POST',
  headers: {
    'Title': `💥 [${crashCode}] ${report.project}: ${report.error.message.slice(0, 40)}`,
    'Tags': 'warning,skull',
    'Priority': '5',
    'Actions': `view, Fix Prompt, ${SUPABASE_URL}/rest/v1/crash_reports?crash_code=eq.${crashCode}&select=fix_prompt, clear=true`,
  },
  body: [
    `Crash [${crashCode}]`,
    `Error: ${report.error.message.slice(0, 150)}`,
    `Screen: ${report.lastScreen}`,
    `Action: ${report.lastAction}`,
    ``,
    `Reply "תתקן ${crashCode}" to WhatsApp for auto-fix`,
  ].join('\n'),
})
```

### STEP 6 — HANDLE MULTIPLE CRASHES GRACEFULLY

If 5 crashes happen in 1 minute, don't spam 5 WhatsApp messages.
Batch them:

```typescript
// In crash-evidence.ts:

let pendingCrashes: CrashReport[] = []
let batchTimeout: ReturnType<typeof setTimeout> | null = null
const BATCH_WINDOW = 10000 // 10 seconds

export async function queueCrashAlert(report: CrashReport) {
  pendingCrashes.push(report)
  
  if (batchTimeout) return // already waiting
  
  batchTimeout = setTimeout(async () => {
    const crashes = [...pendingCrashes]
    pendingCrashes = []
    batchTimeout = null
    
    if (crashes.length === 1) {
      // Single crash — send normally
      await sendCrashToWhatsApp(crashes[0])
    } else {
      // Multiple crashes — send summary
      const summary = [
        `💥 *${crashes.length} CRASHES in ${report.project}*`,
        ``,
        ...crashes.map((c, i) => 
          `${i+1}. [${c.crashCode}] ${c.lastScreen}: ${c.error.message.slice(0, 60)}`
        ),
        ``,
        `↩️ Reply "תתקן [CODE]" to fix a specific one`,
        `↩️ Reply "תתקן הכל" to fix all`,
      ].join('\n')
      
      await sendWhatsAppMessage(summary)
      
      // Also save all to DB (already done in generateCrashReport)
    }
  }, BATCH_WINDOW)
}
```

### STEP 7 — DEPLOY EDGE FUNCTION + APP

```bash
cd /c/Projects/Caps

echo "=== Deploy Edge Function ==="
# Check if we can deploy via CLI
npx supabase functions deploy whatsapp-bot-handler 2>/dev/null || echo "Deploy via Supabase dashboard"

echo "=== Build app ==="
npx tsc --noEmit 2>&1 | tail -10

echo "=== Commit + Push ==="
git add -A
git commit -m "feat: WhatsApp crash threading — crash codes, reply to fix, batch alerts, status tracking"
git push origin main

gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

---

## THE FULL FLOW NOW:

```
💥 Crash happens in Caps
  ↓
Crash code generated: CR-A7X3
  ↓
WhatsApp arrives:
  "💥 CRASH [CR-A7X3]
   Caps v1.0.0
   ❌ Cannot read property 'cards' of undefined
   📍 GameTable → bet_placed
   📸 3 screenshots
   ↩️ Reply "תתקן" to auto-fix"
  ↓
Roye replies: "תתקן"
  ↓
Edge Function:
  1. Finds CR-A7X3 in crash_reports
  2. Pulls fix_prompt
  3. Sends back fix prompt in WhatsApp
  4. Marks status = 'fixing'
  ↓
Roye copies fix prompt → pastes to Claude Bot
  ↓
Bot has EVERYTHING: error + stack + screenshots + steps → fixes the bug
```

**If 5 crashes in 10 seconds:**
```
WhatsApp arrives:
  "💥 5 CRASHES in Caps
   1. [CR-A7X3] GameTable: Cannot read 'cards'
   2. [CR-B2K9] Settings: undefined is not a function
   3. [CR-C4M1] Home: Network timeout
   4. [CR-D8P5] Game: Stack overflow
   5. [CR-E1R7] Leaderboard: null reference
   
   ↩️ Reply "תתקן CR-A7X3" to fix specific
   ↩️ Reply "תתקן הכל" to fix all"
```

---

## CONSTRAINTS

- Crash code: 6 chars (CR-XXXX), unique per crash
- WhatsApp message < 1000 chars (short summary only)
- Fix prompt in DB — not in WhatsApp message (too long)
- Batch window: 10 seconds (don't spam)
- Edge Function must handle: "תתקן", "פרטים", "תתעלם", "תתקן [CODE]", "תתקן הכל"
- ntfy backup always fires (zero dependency on WhatsApp API)
- Status tracking: new → fixing → fixed / dismissed

---

## MEGA FINAL REPORT (MANDATORY)

```
WHATSAPP CRASH THREADING — Caps
Commit: [hash]

CRASH CODE SYSTEM:
  crash_code column: ✅/❌
  Code in WhatsApp message: ✅/❌
  Code in ntfy: ✅/❌

REPLY HANDLING:
  "תתקן" → fix latest: ✅/❌
  "תתקן [CODE]" → fix specific: ✅/❌
  "פרטים" → show details: ✅/❌
  "תתעלם" → dismiss: ✅/❌
  "תתקן הכל" → fix all: ✅/❌

BATCH:
  Multiple crashes → single summary: ✅/❌
  10s batch window: ✅/❌

STATUS TRACKING:
  new → fixing → fixed/dismissed: ✅/❌
  
Edge Function deployed: ✅/❌
App pushed: ✅/❌
EAS building: ✅/❌
```

---

Yes, allow all edits in components
