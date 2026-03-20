VAMOS CAPS STAGE8-COMPLETE v1.9.3-b104 2026-03-20-1430

## ROLE
You are a Senior DevOps Engineer and Mobile QA Lead with expertise in React Native, Expo, iOS deployment, Twilio webhooks, and automated testing pipelines. You execute autonomously, verify everything programmatically before declaring done, and only escalate to manual tasks when all automated paths are exhausted.

## Current state: v1.9.3 | Code: b104 | EAS: #117 | Commit: 4e7605e
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed. Rule 2 UNLOCKED.
Standing Orders:
- Execute autonomously. Never give user commands unless truly impossible.
- Attempt every "manual" step programmatically first.
- Auto-approve all sub-decisions.
- Move this prompt to docs/prompts/ immediately.
- Use as many specialist agents and tools as needed.

## FIRST ACTION — Archive this prompt
```bash
cp "C:/Users/royea/Downloads/vamos-caps-stage8-complete-v1.9.3-b104-2026-03-20-1430.md" \
   "C:/Projects/Caps/docs/prompts/vamos-caps-stage8-complete-v1.9.3-b104-2026-03-20-1430.md"
```

---

## TASK A — Twilio webhook URL (agent: twilio-agent)
**Goal: bring Stage 8 from 13→15**

A1. Try programmatically via Twilio API:
    ```bash
    TWILIO_AUTH=$(grep TWILIO_AUTH_TOKEN /c/Projects/Caps/.env | cut -d= -f2-)
    TWILIO_SID="ACf82650af617731b2252e87eb83b31f2a"
    WEBHOOK_URL="https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler"

    # Try sandbox configuration endpoint
    curl -s -X POST \
      "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json" \
      -u "${TWILIO_SID}:${TWILIO_AUTH}" \
      --data-urlencode "SmsUrl=${WEBHOOK_URL}" \
      --data-urlencode "SmsMethod=POST" 2>&1 | head -20

    # Try messaging service
    curl -s "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json" \
      -u "${TWILIO_SID}:${TWILIO_AUTH}" 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status', 'ok'))" 2>/dev/null
    ```

A2. If API works → set webhook, mark done
A3. If API fails → add to MANUAL_TASKS

---

## TASK B — Add auto web deploy to GitHub Actions (agent: ci-agent)
**Goal: bring Stage 4 from 19→20**

B1. Read .github/workflows/ios-testflight.yml
B2. Check if web deploy step already exists:
    grep -n "vercel\|web deploy\|expo export" /c/Projects/Caps/.github/workflows/*.yml

B3. If NOT present — add web deploy step to ios-testflight.yml:
    After the EAS build step, add:
    ```yaml
    - name: Deploy web to Vercel
      if: success()
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      run: |
        npm install -g vercel
        npx expo export --platform web --clear
        node scripts/fix-web-html.js
        cd dist && vercel --prod --yes --token "$VERCEL_TOKEN"
    ```

B4. npx tsc --noEmit — 0 errors
B5. npx jest --silent — 115/115

---

## TASK C — Device QA automation (agent: qa-agent)
**Goal: verify Stage 5 and Stage 7 items**

C1. Run full automated test suite with verbose output:
    cd /c/Projects/Caps && npx jest --verbose 2>&1 | tail -30

C2. Run TypeScript strict check:
    npx tsc --noEmit --strict 2>&1 | head -20

C3. Check for any console.error/console.warn in production code:
    grep -r "console\.error\|console\.warn" /c/Projects/Caps/app/ /c/Projects/Caps/components/ \
    --include="*.tsx" --include="*.ts" | grep -v "//\|test\|spec" | head -20

C4. Verify Five-O theme tokens are complete:
    Read constants/visualThemes.ts — confirm all ThemeTokens fields populated for 'fiveo'

C5. Verify landscape layout compiles without errors:
    grep -n "landscapeStyles\|isLandscape" /c/Projects/Caps/app/game.tsx | head -20

C6. Check WhatsApp bot Edge Function health:
    curl -s -X POST \
      "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "From=whatsapp:+972523227765&Body=test+caps+stage8+qa&NumMedia=0&MessageSid=test_stage8" \
      2>&1 | head -5

C7. Create QA checklist file:
    Write C:/Projects/Caps/docs/QA-CHECKLIST-2026-03-20.md with:
    - Automated tests: PASS/FAIL
    - Five-O theme tokens: complete/incomplete
    - Landscape layout: compiled/errors
    - WhatsApp bot: responding/down
    - Manual items still needed: list them

---

## TASK D — Update stage scores in ZPM DB (agent: db-agent)

D1. Use sql.js pattern from previous session:
    File: C:/Projects/ZProjectManager/update-stage8.mjs

D2. After completing Tasks A, B, C — update scores:
    - If Twilio webhook set: stage_live_optimization 13 → 15
    - If web deploy CI added: stage_setup 19 → 20
    - If QA checks pass: stage_development 18 → 20

D3. Add new session log entry

D4. Save DB, cleanup script file

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: Stage 8 completion — CI web deploy, QA checklist, Twilio [v1.9.3-b105]"
7. git push origin main
8. Update MEMORY.md with new stage scores
9. Print MANUAL_TASKS list (items that need human action)

## MANUAL_TASKS (populated during execution)
[ ] ...

VAMOS CAPS STAGE8-COMPLETE — END
