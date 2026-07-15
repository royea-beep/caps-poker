VAMOS MEGA-SPRINT ALL-PROJECTS v1.9.3-b89 2026-03-19-1000

## Current state: Caps v1.9.3 build #89 | commit 42f8708
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## MANAGER AGENT — coordinate all sub-agents below in parallel

---

## TRACK 1: CAPS POKER
Sub-agents: icon-agent, sound-agent, oauth-agent

### TASK 1A — App Icon (icon-agent)
A1. Read app.json — find icon path (./assets/icon.png)
A2. Check current icon: ls -la assets/icon.png assets/adaptive-icon.png
A3. Generate a professional poker icon using SVG → PNG:
    - Black background #0a0a0a
    - Large gold "C" letter centered
    - 4 suit symbols (♠ ♥ ♦ ♣) around the C in small size
    - Gold color #c9a84c throughout
    - Size: 1024x1024px
    Use Python + Pillow or cairosvg to generate:
    ```python
    # Generate icon.png 1024x1024
    pip install Pillow cairosvg --break-system-packages
    ```
A4. Save to assets/icon.png AND assets/adaptive-icon.png
A5. git add assets/ && report done

### TASK 1B — Sound Audit (sound-agent)
B1. Read utils/sounds.ts in full
B2. List all sound files: ls assets/sounds/
B3. Check every place sounds are triggered in the app:
    grep -rn "playSound\|soundRef\|Audio\." app/ components/ hooks/ --include="*.tsx" --include="*.ts"
B4. Create a sound audit table:
    | Sound file | Trigger | Works on web? | Works on native? | Notes |
B5. Fix any missing sound triggers:
    - cardSelect: when player taps a card to select
    - cardPlace: when card is placed on board
    - cardFlip: during reveal sequence (already wired)
    - chipsWin: when YOU WIN
    - lose: when BOT WINS
    - complete: after all boards revealed
    - timerLow: when countdown < 10 seconds
B6. npx tsc --noEmit — 0 errors

### TASK 1C — Google OAuth iOS verify (oauth-agent)
C1. Read utils/auth.ts in full
C2. Read app.json — verify scheme is "caps-poker"
C3. Check _layout.tsx deep link handler
C4. Verify the redirect URI matches what's in Google Cloud Console:
    caps-poker://auth/callback
C5. If any issues found → fix them
C6. npx tsc --noEmit — 0 errors

---

## TRACK 2: DISTRIBUTION_P12 — 4 REPOS
Sub-agent: certs-agent

### TASK 2A — Set DISTRIBUTION_P12_PASSWORD on all repos
D1. Read C:/Projects/Caps/certs/private.key — verify it exists
D2. Check current p12 password (should be "caps2026" from cert_from_cer.py)
D3. Check which repos need the secret:
    - royea-beep/postpilot
    - royea-beep/analyzer  
    - royea-beep/keydrop
    - royea-beep/explainit
    gh repo list royea-beep --limit 20 2>&1
D4. For each repo that has iOS CI workflow:
    gh secret set DISTRIBUTION_P12_PASSWORD --repo royea-beep/[repo] --body "caps2026"
    gh secret set DISTRIBUTION_P12_BASE64 --repo royea-beep/[repo] --body "$(base64 -w0 C:/Projects/Caps/certs/distribution.p12)"
D5. Report: which repos got the secrets

---

## TRACK 3: LEMONSQUEEZY — PRODUCTS
Sub-agent: lemon-agent

### TASK 3A — Check existing LemonSqueezy setup
E1. Find LemonSqueezy API key:
    grep -r "LEMONSQUEEZY\|lemon_squeezy\|lemonsqueezy" C:/Projects --include=".env" --include=".env.local" --include=".env.example" 2>/dev/null | grep -v node_modules | head -10
E2. Check which projects already use LemonSqueezy:
    grep -rl "lemonsqueezy\|lemon" C:/Projects --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v node_modules | head -10
E3. Read the LemonSqueezy API docs pattern from existing code
E4. Create docs/lemonsqueezy-products.md with setup checklist:
    ```markdown
    # LemonSqueezy Products Setup
    
    ## KeyDrop
    - Pro: $19/month
    - Team: $49/month
    
    ## Analyzer  
    - Pro: ₪79/month
    - Team variant: separate product
    
    ## ExplainIt
    - Pro: $19/month
    - Team: $49/month
    
    ## Steps per product:
    1. dashboard.lemonsqueezy.com → Products → New Product
    2. Set price + billing period
    3. Copy product ID → add to .env as LEMONSQUEEZY_PRODUCT_ID_[NAME]
    4. Set webhook → per-app path (PostPilot/ExplainIt/analyzer: `/api/billing/webhook`; KeyDrop: `/api/webhooks/lemonsqueezy`) — NOT `/api/lemonsqueezy/webhook`
    ```
E5. Report: what's already set up, what needs to be done

---

## TRACK 4: RAILWAY DB CONNECTION
Sub-agent: railway-agent

### TASK 4A — Fix Railway DB hanging connection
F1. Find Railway connection strings:
    grep -r "railway\|RAILWAY\|postgres.*railway\|6543" C:/Projects --include=".env" --include=".env.local" 2>/dev/null | grep -v node_modules | head -10
F2. The fix: use pooler URL (port 6543) instead of direct connection (port 5432)
    Railway provides: postgres://user:pass@host:6543/db?pgbouncer=true
    vs direct:        postgres://user:pass@host:5432/db
F3. Find all database connection files:
    grep -rl "DATABASE_URL\|postgres://" C:/Projects --include="*.ts" --include="*.js" --include=".env" 2>/dev/null | grep -v node_modules | head -10
F4. For each project using Railway:
    - Check current connection string
    - If using port 5432 → update to port 6543 with ?pgbouncer=true&sslmode=require
F5. Report: which projects affected, what was changed

---

## FINAL STEPS (all tracks)
1. npx tsc --noEmit — 0 errors (Caps only)
2. npx jest --silent — 115/115 (Caps only)
3. npx expo export --platform web --clear (Caps)
4. node scripts/fix-web-html.js (Caps)
5. cd dist && vercel --prod --yes (Caps)
6. git add -A && git commit -m "feat: app icon, sound audit, OAuth fix, multi-project setup [v1.9.3-b90]"
7. git push origin main (Caps)
8. Update MEMORY.md
9. Report: summary table of all 4 tracks — what was done, what needs manual steps

VAMOS MEGA-SPRINT ALL-PROJECTS — END
