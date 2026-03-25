# VAMOS CAPS WHATSAPP-DEBUG
## Check why bot didn't respond to "Hi"

```
cd C:\Projects\Caps

echo "=== Edge Function logs ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=test&From=whatsapp:+972526173700&To=whatsapp:+14155238886" 2>&1

echo ""
echo "=== Check whatsapp_sessions for recent messages ==="
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/whatsapp_sessions?order=created_at.desc&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Edge Function recent logs ==="
supabase functions logs whatsapp-bot-handler --limit 10 2>&1 || \
  echo "Can't get logs via CLI — check Supabase dashboard"
```

If the handler returns TwiML but Twilio doesn't deliver — the issue is Twilio sandbox config.
If the handler crashes — check the error in logs.

VAMOS CAPS WHATSAPP-DEBUG — END
