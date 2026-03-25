# VAMOS CAPS FIX-WHATSAPP-AND-CRASH
**Date:** 2026-03-23 IST
**TWO BUGS:**

## BUG 1 — WhatsApp test message not received

```
cd C:\Projects\Caps

echo "=== Check Twilio sandbox config ==="
# The webhook must be set in Twilio Console manually.
# But we can verify the Edge Function is working:

echo ""
echo "=== Test Edge Function directly ==="
curl -v -X POST \
  "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -d '{"crash_notification": true, "message": "TEST 2", "metadata": {"build": "test"}}' 2>&1

echo ""
echo "=== Check Edge Function logs ==="
supabase functions logs whatsapp-bot-handler --limit 20 2>&1

echo ""
echo "=== Check if Twilio credentials are set ==="
supabase secrets list 2>&1 | grep -i "TWILIO"

echo ""
echo "=== Check sendWhatsApp function in handler ==="
cat supabase/functions/whatsapp-bot-handler/index.ts | grep -A 20 "sendWhatsApp\|TWILIO_SID\|TWILIO_AUTH\|twilio.*api"
```

Common issues:
1. Twilio SID/AUTH not in Edge Function secrets
2. Twilio sandbox expired — needs re-join ("join XXX YYY")
3. sendWhatsApp function has a bug
4. Webhook URL not set in Twilio Console

Fix whatever is found. If sandbox expired:
```
# User must send "join <word> <word>" to +1 415 523 8886 on WhatsApp
# Report this as MANUAL step
```

## BUG 2 — App still crashes at COMPLETE

The user MUST tell us the last debug number.
But we can also proactively check Supabase:

```
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "=== Today's bug reports ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&order=created_at.desc&limit=30" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Any CRASH entries today ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&description=ilike.*crash*&order=created_at.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""  
echo "=== Any numbered step entries ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&description=ilike.*step*&order=created_at.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Dirty shutdown detection ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&description=ilike.*dirty*&order=created_at.desc&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== crash-recordings storage ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/list/crash-recordings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool
```

Report EVERYTHING found. The dirty shutdown detector should have caught the crash from the previous session.

VAMOS CAPS FIX-WHATSAPP-AND-CRASH — END
