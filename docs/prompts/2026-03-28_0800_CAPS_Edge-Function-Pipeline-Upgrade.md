# G-PROMPT: CAPS — Edge Function Pipeline Upgrade
## For Claude Code agent in C:\Projects\caps-poker
## AFTER EXECUTION: Move this file to C:\Projects\caps-poker\docs\prompts\2026-03-28_0800_CAPS_Edge-Function-Pipeline-Upgrade.md

---

## CONTEXT

The WhatsApp bug/crash pipeline has 4 new Supabase RPCs that the Edge Function needs to use. Currently the Edge Function has its own hardcoded logic for handling replies. We need it to call the RPCs instead.

**Supabase project:** gxrpunvhjcrzqnitbqah

---

## TASK 1: Include report_number in outgoing WhatsApp messages

Every WhatsApp message sent to the user about a bug/crash MUST include the report number.

**Current format:**
```
*BUG REPORT*
iPhone 17 Pro Max | iOS 26.3.1 | Build 266
[MED] Severity: MEDIUM
...
Reply: 1 = Fix now...
```

**New format:**
```
🐛 *באג #82*
iPhone 17 Pro Max | iOS 26.3.1 | Build 266
[MED] Severity: MEDIUM
...
Reply: 82:1 = Fix now (auto-fix)
82:2 = Add to sprint
82:3 = Low priority (backlog)
82:6 = Not a bug - dismiss
Or just reply 1-7 for the most recent report.
```

For crashes:
```
💥 *קריסה #83*
...
```

The `report_number` column exists on `whatsapp_sessions` and auto-increments on INSERT.

---

## TASK 2: Use handle_whatsapp_reply() RPC for incoming replies

When a user replies to the WhatsApp bot, call this RPC instead of custom logic:

```typescript
const { data } = await supabase.rpc('handle_whatsapp_reply', {
  p_from_number: fromNumber,  // e.g., "whatsapp:+972..."
  p_reply: userReply           // e.g., "1" or "82:1"
});

// data returns:
// { success: true, action: "auto_fix", report_number: 82, message_he: "✅ דוח #82 — נשלח לתיקון אוטומטי" }
// { success: false, error: "NO_PENDING_SESSION", message_he: "אין דוח ממתין..." }
```

**Reply formats supported:**
- `1` through `7` — action on most recent pending report
- `82:1` — action 1 on report #82 specifically
- `82:6` — dismiss report #82

**Send `data.message_he` back to the user as the WhatsApp reply.**

---

## TASK 3: Use escalate_no_changes() when Claude Code returns no changes

When the auto-fix GitHub Action completes and Claude Code made no changes:

```typescript
await supabase.rpc('escalate_no_changes', {
  p_session_id: sessionId,
  p_reason: 'Claude Code analyzed the code but determined no changes were needed. The issue may require manual investigation or more context.'
});
```

This queues a WhatsApp message to the user explaining WHY it wasn't fixed and what info would help.

---

## TASK 4: Auto-dismiss dirty-shutdown (already handled by DB trigger)

The DB now has a trigger that auto-sets `status = 'crash_skipped'` for any session with 'dirty-shutdown' in raw_input. The Edge Function should:
- Still INSERT the crash session (trigger handles the rest)
- NOT send a WhatsApp message for dirty-shutdown crashes
- Check: after INSERT, re-read the status. If it's already 'crash_skipped', skip WhatsApp notification

```typescript
// After inserting crash session:
const { data: session } = await supabase
  .from('whatsapp_sessions')
  .select('status, report_number')
  .eq('id', newSessionId)
  .single();

if (session.status === 'crash_skipped') {
  // Dirty shutdown — auto-dismissed, don't bother the user
  return;
}
```

---

## TASK 5: Daily digest (optional — if cron/scheduler exists)

If there's a cron job or scheduler in the Edge Function:

```typescript
// Call every morning at 8:00 AM Israel time
const { data } = await supabase.rpc('get_daily_digest');
// data.message contains the full Hebrew morning report
// Send it via WhatsApp to the admin number
```

If no scheduler exists, skip this — it can be triggered manually.

---

## VERIFICATION:
1. Edge Function deploys without errors
2. New bug report → WhatsApp shows "🐛 *באג #82*" with numbered reply options
3. Reply "1" → calls handle_whatsapp_reply → returns "✅ דוח #82 — נשלח לתיקון אוטומטי"
4. Reply "82:6" → dismisses report #82 specifically
5. Dirty-shutdown crash → auto-skipped, no WhatsApp message sent
6. Claude Code "no changes" → escalation message sent to user
7. All existing functionality (audio processing, screenshot capture, Claude analysis) still works
