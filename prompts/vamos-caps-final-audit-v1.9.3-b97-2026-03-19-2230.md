VAMOS CAPS FINAL-AUDIT v1.9.3-b97 2026-03-19-2230

## Current state: v1.9.3 build #97 | commit 79cecde
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## GOAL
Full audit of responsive sizing + connectivity. Fix everything found.

---

## TASK A — WhatsApp transcript (agent: whatsapp-agent)

A1. Read supabase/functions/whatsapp-bot-handler/index.ts — find formatPlanReply

A2. Add transcription line at top of reply for audio messages:
    ```typescript
    function formatPlanReply(plan: ClaudePlan, rawInput?: string, mediaType?: string): string {
      const typeEmoji = plan.type === 'BUG' ? '🐛' : plan.type === 'FEATURE' ? '✨' : '❓';
      const typeHe = plan.type === 'BUG' ? 'באג' : plan.type === 'FEATURE' ? 'פיצ\'ר' : 'שאלה';
      const effortHe = plan.effort === 'LOW' ? 'נמוך' : plan.effort === 'HIGH' ? 'גבוה' : 'בינוני';
      const planText = plan.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
      const projectDisplay = plan.project ?? 'caps-poker';
      
      let transcriptLine = '';
      if (mediaType === 'audio' && rawInput) {
        transcriptLine = `🎤 תמלול: "${rawInput}"\n\n`;
      }
      
      return `${transcriptLine}${typeEmoji} סוג: ${typeHe} | פרויקט: ${projectDisplay}\n\n${plan.summary}\n\nתכנית:\n${planText}\n\nקבצים: ${plan.files.join(', ')}\nמאמץ: ${effortHe}\n\nהשב *1* לאישור ✅\nהשב *2* לביטול ❌\n(מתבטל אוטומטית תוך 30 דקות)`;
    }
    ```

A3. Pass rawInput + detectedMediaType to formatPlanReply:
    Change: await sendWhatsApp(from, formatPlanReply(plan));
    To:     await sendWhatsApp(from, formatPlanReply(plan, inputText, detectedMediaType));

A4. Deploy Edge Function:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

---

## TASK B — Responsive audit across all screens (agent: responsive-agent)

B1. Read constants/deviceBreakpoints.ts — verify rv() helper

B2. Test all breakpoints by checking each screen:
    Read app/game.tsx — verify BOARD_CARD_H uses rv()
    Read components/PlayerHand.tsx — verify card widths use breakpoints  
    Read components/RevealSequence.tsx — verify card sizes use rv()
    Read app/index.tsx — verify title/button sizes use Math.min()
    Read components/Board.tsx — verify board heights

B3. Device targets to verify:
    - iPhone SE (375×667) — smallest
    - iPhone 14 (390×844) — standard
    - iPhone 16 Pro Max (430×932) — largest
    - Mobile web (375px wide Safari)
    - Tablet web (768px)
    - Desktop web (1280px+)

B4. For each file — check if hardcoded sizes exist that should be dynamic:
    grep -n "width: [0-9]\|height: [0-9]\|fontSize: [0-9]" components/Board.tsx | head -20
    grep -n "width: [0-9]\|height: [0-9]\|fontSize: [0-9]" components/PlayerHand.tsx | head -20
    grep -n "width: [0-9]\|height: [0-9]\|fontSize: [0-9]" components/RevealSequence.tsx | head -20

B5. Fix any hardcoded sizes that cause issues on iPhone 16 Pro Max or SE

B6. Specifically check: is the board area cut off on iPhone 16?
    In game.tsx: verify the board section uses flex properly

---

## TASK C — Full connectivity check (agent: infra-agent)

C1. Verify Supabase tables all live:
    Use MCP to list tables + row counts

C2. Verify Edge Functions deployed:
    npx supabase functions list 2>&1

C3. Verify Vercel deployment is live:
    curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il

C4. Verify GitHub Actions CI is working:
    gh run list --repo royea-beep/caps-poker --limit 5 2>&1

C5. Verify all secrets set on Supabase:
    npx supabase secrets list --project-ref gxrpunvhjcrzqnitbqah 2>&1

C6. Verify all secrets set on GitHub:
    gh secret list --repo royea-beep/caps-poker 2>&1

C7. Check WhatsApp bot last activity:
    Use MCP: SELECT from_number, status, created_at FROM whatsapp_sessions ORDER BY created_at DESC LIMIT 5

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: WhatsApp transcript in reply, responsive final audit [v1.9.3-b98]"
7. git push origin main
8. Update MEMORY.md
9. Report: full status table of everything

VAMOS CAPS FINAL-AUDIT — END
