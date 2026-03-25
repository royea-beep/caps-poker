VAMOS CAPS WHATSAPP-BOT-RESEARCH v1.9.3-b87 2026-03-18-2345

## Current state: v1.9.3 build #87 | commit e8ceb35
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## RESEARCH TASK — WhatsApp Bot integration plan

### STEP 1 — Audit current BugReporter

A1. Read components/BugReporter.tsx in full
A2. What does it currently do?
    - How does it capture bugs?
    - What does it send to Supabase?
    - What fields does the bug_reports table have?
    - Does it capture screenshots? Audio? Video?

A3. Query Supabase bug_reports table — show last 10 entries:
    curl -s "${SUPABASE_URL}/rest/v1/bug_reports?order=created_at.desc&limit=10" \
      -H "apikey: $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env | cut -d= -f2)" \
      -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env | cut -d= -f2)"

A4. Check if there's a Supabase Edge Function or webhook configured:
    ls supabase/functions/ 2>/dev/null
    cat supabase/functions/*/index.ts 2>/dev/null | head -50

### STEP 2 — Research WhatsApp Bot options

A5. Check what WhatsApp API options exist for Claude Code (Claude Bot):
    - Option 1: Twilio WhatsApp API (paid, official)
    - Option 2: whatsapp-web.js (unofficial, free, uses browser session)
    - Option 3: Meta Cloud API (official, free tier exists)
    - Option 4: Baileys (unofficial Node.js library)

A6. Check if any of these are already installed:
    cat package.json | grep -E "twilio|whatsapp|baileys|wwebjs"
    cat C:/Projects/90soccer/package.json 2>/dev/null | grep -E "twilio|whatsapp|baileys"

A7. Check if there's a phone number or Twilio account already set up:
    grep -r "TWILIO\|WHATSAPP\|twilio" C:/Projects/Caps/.env C:/Projects/90soccer/.env 2>/dev/null

### STEP 3 — Design the system

A8. Write a DESIGN DOCUMENT (not code yet) for the WhatsApp bot system:

    Save to: C:/Projects/Caps/docs/whatsapp-bot-design.md

    The document should cover:
    
    ## Architecture
    - WhatsApp number receives message (text/image/audio/video)
    - Webhook triggers Supabase Edge Function
    - Edge Function:
      1. Receives WhatsApp message
      2. If audio → transcribe with Whisper API
      3. If image → analyze with Claude Vision
      4. If video → extract frames + transcribe audio
      5. Sends to Claude API with context: "You are the Caps Poker dev assistant. Analyze this bug report/feature request and create an action plan."
      6. Claude responds with: summary of what it will do + awaits approval
      7. User replies "APPROVE" → Edge Function triggers GitHub Action via repository_dispatch
      8. GitHub Action → Claude Bot runs the fix
      9. WhatsApp confirmation: "Done! Build #XX triggered"
    
    ## Message Flow
    User sends to WhatsApp → Edge Function → Claude analyzes → Summary sent back → User approves → GitHub Action → Claude Bot fixes → Confirmation
    
    ## Approval Flow
    - Bot sends: "I'll make these changes: [list]. Reply APPROVE to proceed or CANCEL to abort."
    - User replies APPROVE → proceed
    - User replies CANCEL → abort
    - No reply in 30min → auto-cancel
    
    ## Required Services
    - WhatsApp API (recommend: Twilio or Meta Cloud API)
    - Supabase Edge Function (webhook handler)
    - Claude API (analysis + planning)
    - GitHub API (trigger repository_dispatch)
    
    ## Cost estimate
    - Twilio WhatsApp: ~$0.005/message
    - Claude API: ~$0.003/request
    - Supabase Edge Functions: free tier (500k invocations/month)
    - Total: ~$0.01 per bug report cycle

A9. Report: 
    - What BugReporter currently does
    - Best WhatsApp API option for this use case
    - Full architecture diagram in text
    - Next steps to implement

VAMOS CAPS WHATSAPP-BOT-RESEARCH — END
