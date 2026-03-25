# VAMOS CAPS WA-BOT-PIPELINE-FIX
**Date:** 2026-03-21 13:50 IST
**Priority:** 🔴 Bot says "fixing" but doesn't actually fix — broken pipeline

## ROLE
DevOps engineer — fix the execution pipeline end-to-end

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\.github\workflows\claude-fix.yml
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

## TWO BUGS TO FIX

═══════════════════════════════════════════════════════════
BUG 1 — claude-fix.yml: Hebrew quotes break shell (CRITICAL)
═══════════════════════════════════════════════════════════

**Root cause:** `${{ github.event.client_payload.summary }}` is injected inline into a bash script. When the summary contains double quotes (like `"ARRANGE 16 CARDS"` in Hebrew), bash interprets them as shell syntax → `command not found` exit 127.

**Fix:** Move ALL client_payload fields to `env:` block. Never inline them in `run:`.

```yaml
    - name: Run Claude Code fix
      env:
        SUMMARY: ${{ github.event.client_payload.summary }}
        PLAN: ${{ github.event.client_payload.plan }}
        FILES: ${{ github.event.client_payload.files }}
        SEVERITY: ${{ github.event.client_payload.severity }}
        SESSION_ID: ${{ github.event.client_payload.session_id }}
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      run: |
        echo "=== CAPS POKER — WhatsApp Bot Auto-Fix ==="
        echo "Summary: $SUMMARY"
        echo "Severity: $SEVERITY"
        echo "Files: $FILES"
        
        claude --print "
        Read C:/Projects/Caps/MEMORY.md
        
        BUG REPORT FROM WHATSAPP:
        Summary: $SUMMARY
        Plan: $PLAN  
        Files: $FILES
        Severity: $SEVERITY
        
        Fix this bug. Then:
        1. npx tsc --noEmit
        2. npx jest --forceExit
        3. git add -A && git commit -m 'fix: [WhatsApp] $SUMMARY'
        " --dangerously-skip-permissions
```

**ALSO fix the notification step the same way** — any step that references `client_payload` must use `env:` not inline.

**ALSO check:** Does the workflow handle BOTH event types?
- `claude-fix-no-build` → fix + commit with `[skip ci]`
- `claude-fix-and-deploy` → fix + commit + build

Verify both paths exist and both use `env:` for payload.

═══════════════════════════════════════════════════════════
BUG 2 — Merge window: image+caption should process immediately
═══════════════════════════════════════════════════════════

**Root cause:** When user sends an image WITH caption text (Twilio sends both in one webhook: `Body` + `MediaUrl0`), the bot creates a `pending_merge` session and says "שלח עוד תוך 60 שניות". But the user already sent everything they need.

**Worse:** Edge Functions are stateless — there's no setTimeout to auto-process after 60 seconds. The session stays as `pending_merge` forever until user sends another message.

**Fix in `whatsapp-bot-handler/index.ts`:**

```typescript
// When processing incoming message:
const hasImage = !!mediaUrl;
const hasText = !!body && body.trim().length > 0;
const hasAudio = mediaContentType?.startsWith('audio/');

// IMMEDIATE processing (no merge window needed):
if (hasImage && hasText) {
  // Image + caption = COMPLETE report. Process NOW.
  const imageDescription = await describeImage(mediaUrl);
  const combinedText = `${body}\n\nScreenshot analysis: ${imageDescription}`;
  // Skip pending_merge → go straight to plan generation + pending_approval
  const plan = await generatePlan(combinedText, project);
  // ... send reply with 1/2/3 options
}

// MERGE WINDOW (only when image arrives WITHOUT text):
if (hasImage && !hasText && !hasAudio) {
  // Image only, no caption → MAYBE user will send voice/text next
  // Store as pending_merge
  // Reply: "📸 Got image. Send description within 60s for combined plan, or I'll analyze the image alone."
  // BUT: also set a flag so NEXT message from this user triggers processing
}

// If user sends text/voice and there's a pending_merge:
if (!hasImage && (hasText || hasAudio) && pendingMerge) {
  // Merge with pending image → process combined
}

// REMOVE the "שלח שוב ואעבד לבד" text — it's confusing
// Instead: "📸 קיבלתי תמונה. שולח תיאור? (או שאנתח את התמונה לבד)"
```

**Key changes:**
1. Image + caption → **process immediately** (no merge window)
2. Image only → merge window, but with clear Hebrew message
3. Remove "שלח שוב ואעבד לבד" — replace with clear instruction
4. After 60s with no follow-up → next message from user auto-triggers processing of the pending image

═══════════════════════════════════════════════════════════
DEPLOY + TEST
═══════════════════════════════════════════════════════════

```
F1. Fix claude-fix.yml → commit + push
F2. Fix whatsapp-bot-handler → deploy edge function:
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt
F3. Verify edge function alive:
    curl -s -o /dev/null -w "%{http_code}" https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
F4. Trigger a TEST repository_dispatch to verify the workflow:
    gh api repos/royea-beep/caps-poker/dispatches \
      --method POST \
      -f event_type="claude-fix-no-build" \
      -f 'client_payload[summary]=Test fix with "quotes" and Hebrew אבדיקה' \
      -f 'client_payload[plan]=1. Check this works' \
      -f 'client_payload[files]=test.ts' \
      -f 'client_payload[severity]=LOW' \
      -f 'client_payload[session_id]=test-123'
F5. Check if the test run succeeds:
    sleep 30 && gh run list --repo royea-beep/caps-poker --limit 3
F6. npx tsc --noEmit — 0 errors
F7. npx jest --forceExit — 126+ pass
F8. git add -A && git commit -m "fix: WA bot pipeline — shell quoting + merge window UX"
F9. git push origin main
F10. Update MEMORY.md
```

## PROOF REQUIRED
```
═══════════════════════════════════════
WA BOT PIPELINE FIX — VERIFIED
═══════════════════════════════════════
Bug 1 — Shell quoting:
  env: block used for all payload vars: [YES + lines / NO]
  Test dispatch with quotes: [PASSED / FAILED]
  Test dispatch run ID: [ID]

Bug 2 — Merge window:
  Image + caption → immediate process: [YES + lines / NO]
  Image only → merge message (clear Hebrew): [YES / NO]
  "שלח שוב ואעבד לבד" removed: [YES / NO]

Edge Function: [alive / down]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change game code
- Do NOT trigger a real EAS build during testing
- Do NOT break existing 1/2/3 approval flow

VAMOS CAPS WA-BOT-PIPELINE-FIX — END
