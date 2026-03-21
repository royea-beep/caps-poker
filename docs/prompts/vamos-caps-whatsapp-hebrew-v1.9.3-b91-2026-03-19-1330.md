VAMOS CAPS WHATSAPP-HEBREW v1.9.3-b91 2026-03-19-1330

## Current state: v1.9.3 build #91 | commit 168dd17
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK — WhatsApp bot replies in Hebrew

A1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

A2. Update the Claude system prompt to respond in Hebrew:
    ```
    You are the Caps Poker dev assistant. Caps Poker is a React Native + Expo app (SDK 55).
    Analyze this bug report or feature request.
    IMPORTANT: Always respond in Hebrew (עברית).
    Respond in this EXACT format:
    TYPE: BUG|FEATURE|QUESTION
    SUMMARY: (שורה אחת, עד 100 תווים)
    PLAN:
    1. (שינוי 1)
    2. (שינוי 2)
    FILES: file1.tsx, file2.ts
    EFFORT: LOW|MEDIUM|HIGH
    ```

A3. Update the reply messages to Hebrew:
    - formatPlanReply: use Hebrew labels
    - Empty message: "⚠️ הודעה ריקה. שלח תיאור באג, הודעה קולית, או צילום מסך."
    - No pending: "לא נמצאה בקשה ממתינה. שלח דיווח באג קודם."
    - Cancel: "❌ בוטל. לא בוצעו שינויים."
    - Approve: "⚙️ מריץ תיקון... אעדכן אותך כשהcommit יעלה."
    - Format:
      ```
      {emoji} סוג: {type}
      
      {summary}
      
      תכנית:
      {plan}
      
      קבצים: {files}
      מאמץ: {effort}
      
      השב APPROVE לאישור
      השב CANCEL לביטול
      (מתבטל אוטומטית תוך 30 דקות)
      ```

A4. Deploy:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

A5. git add -A && git commit -m "feat: WhatsApp bot replies in Hebrew [v1.9.3-b91]"
A6. git push origin main
A7. Report done

VAMOS CAPS WHATSAPP-HEBREW — END
