VAMOS CAPS AUTO-DEPLOY-WEB v1.9.3-b93 2026-03-19-1700

## Current state: v1.9.3 build #93 | commit 68b5acb
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Add web deploy to claude-fix.yml
Agent: ci-agent

A1. Read .github/workflows/claude-fix.yml in full

A2. Add web deploy step after "Commit and push if changes":
    ```yaml
    - name: Deploy web to Vercel
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      run: |
        if [ -z "$VERCEL_TOKEN" ]; then
          echo "No VERCEL_TOKEN — skipping web deploy"
          exit 0
        fi
        npm install -g vercel
        npx expo export --platform web --clear
        node scripts/fix-web-html.js
        cd dist && vercel --prod --yes --token "$VERCEL_TOKEN"
    ```

A3. Check if VERCEL_TOKEN is set on GitHub:
    gh secret list --repo royea-beep/caps-poker 2>&1

A4. Find Vercel token from local environment:
    grep -r "VERCEL_TOKEN\|vercel.*token" /c/Projects --include=".env" --include=".env.local" 2>/dev/null | grep -v node_modules | head -5
    
    If not found — get it from Vercel CLI:
    vercel whoami 2>&1
    cat ~/.local/share/com.vercel.cli/auth.json 2>/dev/null || cat ~/AppData/Roaming/com.vercel.cli/auth.json 2>/dev/null | head -5

A5. Set VERCEL_TOKEN on GitHub:
    gh secret set VERCEL_TOKEN --repo royea-beep/caps-poker --body "TOKEN_HERE"

A6. Also add TWILIO secrets for WhatsApp notification:
    - TWILIO_ACCOUNT_SID = ACf82650af617731b2252e87eb83b31f2a
    - TWILIO_AUTH_TOKEN = find from /c/Projects/ftable or Caps .env

    gh secret set TWILIO_ACCOUNT_SID --repo royea-beep/caps-poker --body "ACf82650af617731b2252e87eb83b31f2a"
    
    Find auth token:
    grep -r "TWILIO_AUTH_TOKEN" /c/Projects --include=".env" --include=".env.local" 2>/dev/null | grep -v node_modules | grep -v "your_\|xxx\|ACxxx" | head -3

---

## TASK B — Add VERCEL_PROJECT_ID to workflow
Agent: vercel-agent

B1. Read scripts/fix-web-html.js to understand the deploy setup

B2. Check .vercel/project.json in dist/ folder:
    cat /c/Projects/Caps/dist/.vercel/project.json 2>/dev/null

B3. Add vercel project linking to the workflow:
    The workflow needs to know which Vercel project to deploy to.
    Add env vars: VERCEL_PROJECT_ID + VERCEL_ORG_ID

B4. Read the existing vercel.json that fix-web-html.js creates

---

## FINAL STEPS
1. git add -A && git commit -m "feat: auto web deploy to Vercel in claude-fix workflow [v1.9.3-b93]"
2. git push origin main
3. Update MEMORY.md
4. Report: VERCEL_TOKEN status, TWILIO secrets status, workflow updated

VAMOS CAPS AUTO-DEPLOY-WEB — END
