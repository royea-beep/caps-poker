# VAMOS CAPS DEPLOY-VERIFY
**Date:** 2026-03-21 15:57 IST
## DO NOT change code. ONLY verify all platforms are up to date.

## CHECK 1 — Git: what's the latest?
```
cd C:\Projects\Caps
git log --oneline -5
echo "HEAD: $(git rev-parse --short HEAD)"
```

## CHECK 2 — Web (Vercel)
```
curl -s https://caps.ftable.co.il -o /tmp/caps_web.html -w "%{http_code}"
grep -o "version.*build\|v[0-9].*b[0-9]" /tmp/caps_web.html 2>/dev/null | head -3
```
Is the web version current? Or does it need a redeploy?

If stale:
```
npx expo export --platform web --output-dir web-dist
node scripts/fix-web-html.js
cd web-dist && vercel --prod --yes
```

## CHECK 3 — Bug Dashboard
```
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/bugs/
```

## CHECK 4 — Hand Replay
```
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/hand/
```

## CHECK 5 — EAS / TestFlight
```
eas build:list --platform ios --limit 5
```

Is the LATEST build (with ALL fixes including 72e7b2f + 14bb990) on TestFlight?

If NOT — check if there's a build in progress. If no build at all:
```
eas build --platform ios --profile production --non-interactive
```

## CHECK 6 — WhatsApp Bot Edge Function
```
curl -s -o /dev/null -w "%{http_code}" https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
```
Should return 405 (alive).

## CHECK 7 — Supabase tables exist
```
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?limit=1" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -o /dev/null -w "%{http_code}"

curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/shared_hands?limit=1" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -o /dev/null -w "%{http_code}"

curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/app_config?limit=1" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -o /dev/null -w "%{http_code}"
```

## REPORT
```
═══════════════════════════════════════
DEPLOY VERIFICATION
═══════════════════════════════════════
Git HEAD: [hash] [message]

Web (caps.ftable.co.il):     [UP TO DATE / STALE — redeployed]
Bug dashboard (/bugs/):      [200 / DOWN]
Hand replay (/hand/):        [200 / DOWN]
TestFlight:                  [build # — LATEST / STALE — building now]
  Includes all fixes:        [YES / NO — what's missing]
WhatsApp bot:                [405 alive / DOWN]
Supabase tables:
  bug_reports:               [200 / ERROR]
  shared_hands:              [200 / ERROR]
  app_config:                [200 / ERROR]

TESTER READY: [YES — everything live / NO — list what's missing]
═══════════════════════════════════════
```

If anything is stale → fix it and redeploy.

VAMOS CAPS DEPLOY-VERIFY — END
