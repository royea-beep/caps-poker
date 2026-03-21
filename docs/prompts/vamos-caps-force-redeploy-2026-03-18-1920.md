VAMOS CAPS FORCE-REDEPLOY 2026-03-18-1920

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
Web shows v1.3.0 instead of v1.9.2. Cache issue on Vercel.

## TASK
A1. Check current live bundle:
    curl -sk https://caps.ftable.co.il/index.html | grep "index-"

A2. Check local dist bundle:
    cat C:/Projects/Caps/dist/index.html | grep "index-"

A3. Force fresh build + deploy:
    cd C:/Projects/Caps
    Add a comment to app/index.tsx: // force-redeploy-2026-03-18
    npx expo export --platform web
    node scripts/fix-web-html.js
    cd dist && vercel --prod --yes

A4. Verify new bundle is live:
    curl -sk https://caps.ftable.co.il/index.html | grep "index-"

A5. Report the new bundle hash

VAMOS CAPS FORCE-REDEPLOY — END
