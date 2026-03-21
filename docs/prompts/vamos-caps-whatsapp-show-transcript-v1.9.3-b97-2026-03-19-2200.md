VAMOS CAPS WHATSAPP-SHOW-TRANSCRIPT v1.9.3-b97 2026-03-19-2200

## Current state: v1.9.3 build #97 | commit 79cecde
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK — Show transcription in WhatsApp reply

A1. Read supabase/functions/whatsapp-bot-handler/index.ts

A2. In the audio handling section, after transcription:
    Add the transcript to the reply message so user sees what was heard.
    
    Update formatPlanReply to accept optional transcript:
    ```typescript
    function formatPlanReply(plan: ClaudePlan, transcript?: string): string {
      const typeEmoji = plan.type === 'BUG' ? '🐛' : plan.type === 'FEATURE' ? '✨' : '❓';
      const typeHe = plan.type === 'BUG' ? 'באג' : plan.type === 'FEATURE' ? 'פיצ\'ר' : 'שאלה';
      const effortHe = plan.effort === 'LOW' ? 'נמוך' : plan.effort === 'HIGH' ? 'גבוה' : 'בינוני';
      const planText = plan.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
      const projectDisplay = plan.project ?? 'caps-poker';
      
      const transcriptSection = transcript 
        ? `🎤 שמעתי: "${transcript}"\n\n`
        : '';
      
      return `${transcriptSection}${typeEmoji} סוג: ${typeHe} | פרויקט: ${projectDisplay}

${plan.summary}

תכנית:
${planText}

קבצים: ${plan.files.join(', ')}
מאמץ: ${effortHe}

השב *1* לאישור ✅
השב *2* לביטול ❌
(מתבטל אוטומטית תוך 30 דקות)`;
    }
    ```

A3. Pass transcript to formatPlanReply:
    - For audio messages: pass the transcript text
    - For text/image: pass undefined (no transcript section shown)
    
    In the main handler, store transcript:
    ```typescript
    let transcript: string | undefined;
    
    if (mediaType.startsWith('audio/')) {
      // ...transcribe...
      transcript = inputText; // save the transcription
    }
    
    // Later when sending reply:
    await sendWhatsApp(from, formatPlanReply(plan, transcript));
    ```

A4. Deploy:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

A5. git add -A && git commit -m "feat: WhatsApp bot shows transcript in reply [v1.9.3-b97]"
A6. git push origin main
A7. Report done

VAMOS CAPS WHATSAPP-SHOW-TRANSCRIPT — END
