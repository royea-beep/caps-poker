VAMOS CAPS WHATSAPP-FLOW-FIX v1.9.3-b92 2026-03-19-1600

## Current state: v1.9.3 build #92 | commit a077dfb
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM — Broken approval flow
1. Bot sends plan → user replies "APPROVE" → bot thinks it's a new bug
2. Multiple pending sessions — no way to choose between them
3. "OK" noise messages after every message
4. No clear numbered menu

## TASK — Redesign approval flow

A1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

A2. New approval commands — detect BEFORE anything else:
    ```typescript
    const upperBody = msgBody.trim().toUpperCase();
    const isApprove = ['1', 'APPROVE', 'כן', 'אשר'].includes(upperBody);
    const isCancel  = ['2', 'CANCEL',  'לא', 'בטל'].includes(upperBody);
    ```

A3. Auto-cancel old pending session when new bug arrives:
    Before inserting new session, cancel any existing pending ones for this user.

A4. Update formatPlanReply to end with:
    ```
    השב *1* לאישור ✅
    השב *2* לביטול ❌
    (מתבטל אוטומטית תוך 30 דקות)
    ```

A5. Remove all "OK" acknowledgment noise — bot only sends meaningful messages.

A6. Deploy + commit + push

VAMOS CAPS WHATSAPP-FLOW-FIX — END
