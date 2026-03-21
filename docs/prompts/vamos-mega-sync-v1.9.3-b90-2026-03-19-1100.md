VAMOS MEGA-SYNC-FROM-OTHER-PROJECTS v1.9.3-b90 2026-03-19-1100

## Current state: v1.9.3 build #90 | commit aee8d7e
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## GOAL
All manual steps (Railway, LemonSqueezy, Twilio) were already done in other projects.
Extract credentials/config from those projects and apply here automatically.

---

## TASK A — Railway DB fix (letsmakebillions)
Agent: railway-agent

A1. Find the actual DATABASE_URL in letsmakebillions:
    cat /c/Projects/letsmakebillions/.env 2>/dev/null | grep DATABASE_URL
    cat /c/Projects/letsmakebillions/.env.local 2>/dev/null | grep DATABASE_URL

A2. Check if there's a pooler URL already somewhere:
    grep -r "6543\|pooler\|pgbouncer" /c/Projects/letsmakebillions 2>/dev/null | grep -v __pycache__ | grep -v ".git" | head -10

A3. Check Wingman which already uses pooler (port 6543):
    cat /c/Projects/Wingman/apps/api/.env | grep DATABASE_URL

A4. Get the letsmakebillions Supabase project ref from DATABASE_URL
    Then construct the pooler URL:
    Old: postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres
    New: postgresql://postgres.REF:PASS@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true

A5. Update /c/Projects/letsmakebillions/.env with the new pooler URL
A6. git add .env && git commit in letsmakebillions if it's a git repo
A7. Report: old URL → new URL (mask password)

---

## TASK B — LemonSqueezy: sync variant IDs from existing products
Agent: lemon-agent

B1. Check all existing variant IDs across projects:
    grep -r "LEMONSQUEEZY_VARIANT\|LEMONSQUEEZY_PRO\|LEMONSQUEEZY_TEAM\|LEMONSQUEEZY_STARTER" \
      /c/Projects --include=".env" --include=".env.local" 2>/dev/null | grep -v node_modules | sort -u

B2. Query LemonSqueezy API to get ALL variants in store 309460:
    LEMON_KEY=$(grep LEMONSQUEEZY_API_KEY /c/Projects/analyzer-standalone/.env.local | cut -d= -f2-)
    curl -s "https://api.lemonsqueezy.com/v1/variants?filter[store_id]=309460" \
      -H "Authorization: Bearer $LEMON_KEY" \
      -H "Accept: application/vnd.api+json" | python3 -m json.tool 2>/dev/null | grep -E '"id"|"name"|"price"' | head -40

B3. Map variant IDs to correct products:
    - Find which variants belong to KeyDrop, ExplainIt, Analyzer
    - Update .env files if wrong variants are being used

B4. Report: full variant map

---

## TASK C — Twilio: extract credentials from existing setup
Agent: twilio-agent

C1. Search ALL projects for Twilio credentials:
    grep -r "TWILIO_ACCOUNT_SID\|TWILIO_AUTH_TOKEN\|TWILIO_WHATSAPP" \
      /c/Projects --include=".env" --include=".env.local" --include=".env.example" \
      2>/dev/null | grep -v node_modules | grep -v "ACxxx\|your_\|xxx" | head -20

C2. If Twilio credentials found:
    - Set them on Supabase Edge Function secrets:
      supabase secrets set TWILIO_ACCOUNT_SID=ACxxx --project-ref gxrpunvhjcrzqnitbqah
      supabase secrets set TWILIO_AUTH_TOKEN=xxx --project-ref gxrpunvhjcrzqnitbqah
      supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 --project-ref gxrpunvhjcrzqnitbqah

C3. Search for OpenAI API key (for Whisper transcription):
    grep -r "OPENAI_API_KEY" /c/Projects --include=".env" --include=".env.local" \
      2>/dev/null | grep -v node_modules | grep -v "sk-xxx\|your_" | head -5

C4. If found → set on Supabase:
    supabase secrets set OPENAI_API_KEY=sk-xxx --project-ref gxrpunvhjcrzqnitbqah

C5. Search for GitHub token:
    grep -r "GITHUB_TOKEN\|GH_TOKEN" /c/Projects --include=".env" --include=".env.local" \
      2>/dev/null | grep -v node_modules | grep -v "ghp_xxx\|your_" | head -5

C6. If found → set on Supabase:
    supabase secrets set GITHUB_TOKEN=ghp_xxx --project-ref gxrpunvhjcrzqnitbqah

C7. Report: which secrets were set, which are still missing

---

## FINAL STEPS
1. git add -A && git commit -m "sync: Railway pooler URL, LemonSqueezy variants, Twilio secrets [v1.9.3-b90]" (in relevant projects)
2. Report full status table

VAMOS MEGA-SYNC — END
