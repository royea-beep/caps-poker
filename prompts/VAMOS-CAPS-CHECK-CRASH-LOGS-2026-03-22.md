# VAMOS CAPS CHECK-CRASH-LOGS
**Date:** 2026-03-22 16:30 IST
## DO NOT change code. ONLY check logs and report.

```
cd C:\Projects\Caps

echo "=== SUPABASE CRASH LOGS ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?severity=eq.CRITICAL&order=created_at.desc&limit=10" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool

echo ""
echo "=== ALL RECENT BUG REPORTS ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=10" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool

echo ""
echo "=== DEPLOY LOG ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/deploy_log?order=deployed_at.desc&limit=5" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool

echo ""
echo "=== LATEST BUILD STATUS ==="
eas build:list --platform ios --limit 3

echo ""
echo "=== OTA UPDATE STATUS ==="
eas update:list --branch production --limit 5 2>&1
```

Report what you find. If crash logs exist — show the EXACT error message and stack trace.

VAMOS CAPS CHECK-CRASH-LOGS — END
