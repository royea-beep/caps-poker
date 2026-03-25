# VAMOS CAPS VERCEL-AUTO-DEPLOY
**Date:** 2026-03-22 09:35 IST
**Priority:** 🔴 Remove manual token dependency — make deploys 100% automatic forever

## PROBLEM
Current: GitHub Actions uses VERCEL_TOKEN to deploy web. Token EXPIRES. When it expires = manual renewal = bad.
Solution: Vercel's native GitHub integration. Auto-deploys on every push. No tokens. No expiry. No maintenance. Forever.

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\.github\workflows\ios-testflight.yml
cat C:\Projects\Caps\vercel.json 2>/dev/null
```

## STEP 1 — Check if Vercel is already connected to GitHub
```
cd C:\Projects\Caps
npx vercel ls 2>&1 | head -10
npx vercel project ls 2>&1 | head -10
```

## STEP 2 — Connect Vercel to GitHub repo (native integration)

Option A — via CLI:
```
npx vercel link --yes
npx vercel git connect royea-beep/caps-poker --yes 2>&1
```

Option B — if CLI doesn't support `git connect`:
The native integration is set up on vercel.com:
1. Go to: https://vercel.com/dashboard
2. Select the caps-poker project (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP)
3. Settings → Git → Connect Git Repository → royea-beep/caps-poker
4. Production Branch: main
5. Auto-deploy: ON

If Option B is needed, report it as MANUAL step.

## STEP 3 — Configure Vercel for Expo Web

Create or update `vercel.json` in project root:
```json
{
  "buildCommand": "npx expo export --platform web --output-dir web-dist && node scripts/fix-web-html.js",
  "outputDirectory": "web-dist",
  "framework": null,
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/hand/(.*)", "destination": "/hand/index.html" },
    { "source": "/bugs/(.*)", "destination": "/bugs/index.html" }
  ]
}
```

This tells Vercel:
- Build: run expo export + fix script
- Output: web-dist folder
- Rewrites: hand replay and bug dashboard routes

## STEP 4 — Remove Vercel deploy from GitHub Actions

In `.github/workflows/ios-testflight.yml`, find and REMOVE the Vercel deploy step:
```yaml
# REMOVE this entire step:
- name: Deploy web to Vercel
  run: ...
  env:
    VERCEL_TOKEN: ...
    VERCEL_ORG_ID: ...
    VERCEL_PROJECT_ID: ...
```

Vercel's native integration handles deploys automatically. 
GitHub Actions should ONLY handle: EAS build + TestFlight submit.

Also remove VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID from GitHub secrets (they're no longer needed).

## STEP 5 — Also connect Expo GitHub integration
```
# Check if eas supports GitHub linking:
eas project:info 2>&1
```

If the Expo ↔ GitHub connection also requires dashboard:
Report as MANUAL step:
```
MANUAL: https://expo.dev/accounts/royea/projects/caps-poker → Connect GitHub → royea-beep/caps-poker
```

## STEP 6 — Verify auto-deploy works
```
# Make a tiny change and push:
echo "/* auto-deploy test $(date) */" >> web-dist/.vercel-test 2>/dev/null
git add -A && git commit --allow-empty -m "chore: test Vercel auto-deploy"
git push origin main
```

Then check: does Vercel auto-detect the push and start building?
```
sleep 30
npx vercel ls --limit 3 2>&1
```

## STEP 7 — Deploy checklist update

**OLD deploy (with tokens — REMOVED):**
```
D3. npx expo export --platform web
D4. node scripts/fix-web-html.js  
D5. cd web-dist && vercel --prod --yes  ← MANUAL, TOKEN-BASED
```

**NEW deploy (automatic — FOREVER):**
```
git push origin main
  → Vercel auto-detects push
  → Runs: expo export + fix-web-html.js
  → Deploys to caps.ftable.co.il
  → ZERO manual steps. ZERO tokens. ZERO expiry.
```

## REPORT
```
═══════════════════════════════════════
VERCEL AUTO-DEPLOY — REPORT  
═══════════════════════════════════════
GitHub ↔ Vercel connected: [YES — auto / YES — MANUAL NEEDED / NO]
vercel.json created: [YES/NO]
GitHub Actions Vercel step removed: [YES/NO]
Auto-deploy on push: [TESTED + WORKING / NOT TESTED / FAILED]
Tokens removed from GH secrets: [YES/NO]
Manual steps needed: [NONE / list]
═══════════════════════════════════════
```

## DO NOT
- Do NOT keep the VERCEL_TOKEN deploy step in GitHub Actions
- Do NOT use any solution that requires token renewal
- Do NOT break the web deploy (caps.ftable.co.il must stay live)
- Do NOT change the iOS build/submit pipeline

VAMOS CAPS VERCEL-AUTO-DEPLOY — END
