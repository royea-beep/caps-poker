VAMOS CAPS WHATSAPP-BOT-PHASE1 v1.9.3-b89 2026-03-19-0930

## Current state: v1.9.3 build #89 | commit ebba3a0
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## GOAL
Build the WhatsApp bot pipeline — Phase 1.
Full design at: docs/whatsapp-bot-design.md — READ IT FIRST.

---

## TASK A — Supabase migration: whatsapp_sessions table
Agent: db-agent

A1. Read docs/whatsapp-bot-design.md in full

A2. Create supabase/migrations/20260319000000_whatsapp_sessions.sql:
    ```sql
    create table if not exists whatsapp_sessions (
      id uuid primary key default gen_random_uuid(),
      message_sid text unique not null,
      from_number text not null,
      raw_input text,
      media_type text,
      claude_plan jsonb,
      status text default 'pending_approval',
      github_run_id bigint,
      created_at timestamptz default now(),
      expires_at timestamptz default (now() + interval '30 minutes')
    );

    alter table whatsapp_sessions enable row level security;

    -- Only service role can read/write (Edge Function uses service key)
    create policy "service only" on whatsapp_sessions
      using (false) with check (false);
    ```

A3. Apply via Supabase MCP or REST API

---

## TASK B — Supabase Edge Function: whatsapp-bot-handler
Agent: edge-fn-agent

B1. Read docs/whatsapp-bot-design.md — architecture section

B2. Create supabase/functions/whatsapp-bot-handler/index.ts:

    The function must:
    1. Parse Twilio webhook (x-www-form-urlencoded)
    2. Verify Twilio signature (use TWILIO_AUTH_TOKEN env var)
    3. Determine message type: text / audio / image
    4. For audio: fetch Twilio media URL → call OpenAI Whisper API → get transcript
    5. For image: fetch Twilio media URL → call Claude API with vision → get description
    6. For text: use Body field directly
    7. Call Claude API (claude-haiku-4-5) with system prompt:
       ```
       You are the Caps Poker dev assistant. Analyze this bug report or feature request.
       Respond in this exact format:
       TYPE: BUG|FEATURE|QUESTION
       SUMMARY: (1 line, max 100 chars)
       PLAN:
       1. (change 1)
       2. (change 2)
       FILES: file1.tsx, file2.ts
       EFFORT: LOW|MEDIUM|HIGH
       ```
    8. Store session in whatsapp_sessions table
    9. Send WhatsApp reply via Twilio API:
       ```
       🔍 TYPE: {type}
       
       {summary}
       
       Plan:
       {plan}
       
       Files: {files}
       Effort: {effort}
       
       Reply APPROVE to proceed
       Reply CANCEL to abort
       (Auto-cancels in 30 min)
       ```
    10. Handle APPROVE reply:
        - Find pending session by from_number
        - Trigger GitHub repository_dispatch:
          POST https://api.github.com/repos/royea-beep/caps-poker/dispatches
          { event_type: "claude-fix", client_payload: { plan, files, summary } }
        - Update session status to 'approved'
        - Reply: "⚙️ Running fix... I'll notify you when done."
    11. Handle CANCEL reply:
        - Update session status to 'cancelled'
        - Reply: "❌ Aborted. No changes made."

    Required env vars in Edge Function:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)
    - ANTHROPIC_API_KEY
    - OPENAI_API_KEY (for Whisper)
    - GITHUB_TOKEN (repo scope)
    - SUPABASE_SERVICE_ROLE_KEY (already available as Deno.env)

B3. Deploy function:
    supabase functions deploy whatsapp-bot-handler --no-verify-jwt

---

## TASK C — GitHub Action: claude-fix.yml
Agent: ci-agent

C1. Create .github/workflows/claude-fix.yml:
    ```yaml
    name: Claude Auto-Fix
    on:
      repository_dispatch:
        types: [claude-fix]

    jobs:
      fix:
        runs-on: ubuntu-latest
        timeout-minutes: 30
        steps:
          - uses: actions/checkout@v4
          
          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '20'
              
          - name: Install dependencies
            run: npm ci
            
          - name: Run Claude Code fix
            env:
              ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
            run: |
              npm install -g @anthropic-ai/claude-code
              PLAN="${{ github.event.client_payload.plan }}"
              SUMMARY="${{ github.event.client_payload.summary }}"
              claude --print "Read MEMORY.md. Iron Rules 1-8 confirmed. Standing Orders: Fix autonomously. Never give user commands. TASK: $PLAN" --dangerously-skip-permissions
              
          - name: Commit and push if changes
            run: |
              git config user.email "claude-bot@caps-poker.app"
              git config user.name "Claude Bot"
              git add -A
              git diff --staged --quiet || git commit -m "fix: ${{ github.event.client_payload.summary }} [auto-fix]"
              git push
              
          - name: Notify completion
            run: |
              COMMIT=$(git rev-parse --short HEAD)
              echo "COMMIT=$COMMIT" >> $GITHUB_ENV
    ```

C2. Add ANTHROPIC_API_KEY to GitHub secrets:
    gh secret set ANTHROPIC_API_KEY --repo royea-beep/caps-poker --body "$ANTHROPIC_API_KEY"
    (read from .env or environment)

---

## TASK D — Instructions doc for Twilio setup
Agent: docs-agent

D1. Create docs/whatsapp-bot-setup.md with step-by-step:
    ```markdown
    # WhatsApp Bot Setup — Manual Steps
    
    ## Step 1: Twilio Sandbox (5 min)
    1. Go to twilio.com → sign up (free)
    2. Console → Messaging → Try it out → WhatsApp
    3. Send "join [sandbox-word]" from WhatsApp to +1 415 523 8886
    4. Copy Account SID + Auth Token
    
    ## Step 2: Set Edge Function env vars
    supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
    supabase secrets set TWILIO_AUTH_TOKEN=xxx
    supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
    supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
    supabase secrets set OPENAI_API_KEY=sk-xxx
    supabase secrets set GITHUB_TOKEN=ghp_xxx
    
    ## Step 3: Set Twilio webhook URL
    Twilio Console → WhatsApp Sandbox → When a message comes in:
    https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
    HTTP POST
    
    ## Step 4: Test
    Send "test bug: cards not showing" to the Twilio WhatsApp number
    ```

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. git add -A && git commit -m "feat: WhatsApp bot Phase 1 — Edge Function + GitHub Action [v1.9.3-b89]"
4. git push origin main
5. Update MEMORY.md
6. Report: what was created, what manual steps remain

VAMOS CAPS WHATSAPP-BOT-PHASE1 — END
