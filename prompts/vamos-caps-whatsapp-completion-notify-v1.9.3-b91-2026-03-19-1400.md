VAMOS CAPS WHATSAPP-COMPLETION-NOTIFY v1.9.3-b91 2026-03-19-1400

## Current state: v1.9.3 build #91 | commit 168dd17
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM
User sent WhatsApp bug report → approved → bot said "Running fix... I'll notify you when commit lands."
25+ minutes later: no WhatsApp notification, no new commit visible.
Two issues to fix:
1. Check why the GitHub Action didn't complete or notify
2. Add completion webhook back to WhatsApp bot (notify user when done)
3. Add Hebrew responses to bot

---

## TASK A — Diagnose GitHub Action
Agent: ci-agent

A1. Check recent GitHub Actions runs:
    gh run list --repo royea-beep/caps-poker --limit 10 2>&1

A2. If claude-fix run exists — check its logs:
    gh run view [RUN_ID] --log 2>&1 | tail -50

A3. Check if ANTHROPIC_API_KEY is set on GitHub:
    gh secret list --repo royea-beep/caps-poker 2>&1

A4. Read .github/workflows/claude-fix.yml in full

A5. Fix any issues found in the workflow

---

## TASK B — Add completion notification to GitHub Action
Agent: ci-notify-agent

B1. Update .github/workflows/claude-fix.yml to send WhatsApp when done:
    Add a final step after commit+push:

    ```yaml
    - name: Notify via WhatsApp
      if: always()
      env:
        TWILIO_ACCOUNT_SID: ${{ secrets.TWILIO_ACCOUNT_SID }}
        TWILIO_AUTH_TOKEN: ${{ secrets.TWILIO_AUTH_TOKEN }}
        TWILIO_FROM: whatsapp:+14155238886
        TWILIO_TO: whatsapp:+972504141513
      run: |
        COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        STATUS="${{ job.status }}"
        if [ "$STATUS" = "success" ]; then
          MSG="✅ תיקון הושלם! commit: $COMMIT — ${{ github.event.client_payload.summary }}"
        else
          MSG="❌ תיקון נכשל. בדוק GitHub Actions לפרטים."
        fi
        curl -s -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
          -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
          --data-urlencode "From=$TWILIO_FROM" \
          --data-urlencode "To=$TWILIO_TO" \
          --data-urlencode "Body=$MSG"
    ```

B2. Add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to GitHub secrets (read from local .env or Caps project):
    - Check if already set: gh secret list --repo royea-beep/caps-poker
    - If missing: find them from other projects and set them

---

## TASK C — Hebrew responses in WhatsApp bot
Agent: hebrew-agent

C1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

C2. Update Claude system prompt to respond in Hebrew:
    Replace system prompt with:
    ```
    You are the Caps Poker dev assistant. Caps Poker is a React Native + Expo app (SDK 55) for Omaha poker.
    Analyze this bug report or feature request.
    CRITICAL: Respond ONLY in Hebrew (עברית). All text in your response must be in Hebrew.
    Respond in this EXACT format (no extra text):
    TYPE: BUG|FEATURE|QUESTION
    SUMMARY: (תיאור קצר בעברית, עד 100 תווים)
    PLAN:
    1. (שינוי 1 בעברית)
    2. (שינוי 2 בעברית)
    FILES: file1.tsx, file2.ts
    EFFORT: LOW|MEDIUM|HIGH
    ```

C3. Update ALL reply messages to Hebrew:
    - Empty message reply: "⚠️ הודעה ריקה. שלח תיאור באג, הודעה קולית, או צילום מסך."
    - No pending session: "לא נמצאה בקשה ממתינה. שלח דיווח באג קודם."
    - Cancel reply: "❌ בוטל. לא בוצעו שינויים."  
    - Approve reply: "⚙️ מריץ תיקון... אעדכן אותך כשהcommit יעלה."
    - Audio no key: "🎤 קיבלתי הודעה קולית אך שירות התמלול אינו מוגדר. שלח טקסט במקום."
    - Audio error: "❌ שגיאה בתמלול. שלח טקסט במקום."

C4. Update formatPlanReply to Hebrew:
    ```typescript
    function formatPlanReply(plan: ClaudePlan): string {
      const typeEmoji = plan.type === 'BUG' ? '🐛' : plan.type === 'FEATURE' ? '✨' : '❓';
      const typeHe = plan.type === 'BUG' ? 'באג' : plan.type === 'FEATURE' ? 'פיצ\'ר' : 'שאלה';
      const effortHe = plan.effort === 'LOW' ? 'נמוך' : plan.effort === 'HIGH' ? 'גבוה' : 'בינוני';
      const planText = plan.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return `${typeEmoji} סוג: ${typeHe}

    ${plan.summary}

    תכנית:
    ${planText}

    קבצים: ${plan.files.join(', ')}
    מאמץ: ${effortHe}

    השב APPROVE לאישור
    השב CANCEL לביטול
    (מתבטל אוטומטית תוך 30 דקות)`;
    }
    ```

C5. Deploy Edge Function:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

---

## FINAL STEPS
1. git add -A && git commit -m "feat: WhatsApp bot Hebrew + completion notification [v1.9.3-b92]"
2. git push origin main
3. Update MEMORY.md
4. Report:
   - What was wrong with the GitHub Action
   - What secrets are missing
   - Confirmation Hebrew is deployed

VAMOS CAPS WHATSAPP-COMPLETION-NOTIFY — END
