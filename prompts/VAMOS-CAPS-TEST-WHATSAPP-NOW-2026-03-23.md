# VAMOS CAPS TEST-WHATSAPP-NOW
## ONLY send test message. No code changes.

```
cd C:\Projects\Caps
TWILIO_SID="ACfa81cdf2f1c262f00f88e8cb5f8c2e0d"
TWILIO_AUTH=$(grep TWILIO_AUTH_TOKEN .env 2>/dev/null | cut -d= -f2 || grep -r "TWILIO_AUTH" C:\Projects\*.env 2>/dev/null | head -1 | cut -d= -f2)

echo "=== Send test via Twilio API ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+972526173700" \
  -d "Body=🧪 CAPS Crash Control Panel — WORKING! Reply 7 for dashboard."

echo ""
echo "=== Also test via Edge Function ==="
curl -s -X POST \
  "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -d '{"crash_notification": true, "message": "🧪 TEST: Pipeline works!\n\nReply:\n1 = Fix\n2 = Analyze\n5 = AUTO-FIX ON\n7 = Dashboard"}'
```

Report if messages were sent successfully.

VAMOS CAPS TEST-WHATSAPP-NOW — END
