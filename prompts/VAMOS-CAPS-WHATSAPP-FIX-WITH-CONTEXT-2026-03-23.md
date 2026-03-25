# VAMOS CAPS WHATSAPP-FIX-WITH-CONTEXT
**Date:** 2026-03-23 IST

## CONTEXT — ALREADY DONE (do NOT repeat these):
- ✅ Twilio sandbox ACTIVATED at console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
- ✅ Join code = "join pull-total" — ALREADY SENT from +972526173700, got "You are all set!" response
- ✅ Webhook URL set in Sandbox Settings: https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler — Method POST — SAVED
- ✅ ROYE_WHATSAPP_NUMBER secret set to whatsapp:+972526173700
- ✅ Participant showing in sandbox: whatsapp:+972526173700 (1 sandbox participant)
- ✅ Twilio credentials (SID, AUTH, PHONE) all set in Supabase Edge Function secrets
- ✅ Edge Function deployed and returns 200 when called directly via curl

## THE PROBLEM
User sent "Hi" from +972526173700 to +14155238886 via WhatsApp.
NO response received. whatsapp_sessions table is EMPTY — message never reached Edge Function.
This means: Twilio received the message but did NOT forward it to our webhook URL.

## DIAGNOSE — Why isn't Twilio forwarding to webhook?

```
cd C:\Projects\Caps

echo "=== 1. Verify webhook URL is actually saved ==="
# Call Twilio API to read sandbox config:
TWILIO_SID="ACfa81cdf2f1c262f00f88e8cb5f8c2e0d"
# Find auth token:
grep -r "TWILIO_AUTH" .env C:\Projects\*.env C:\Projects\config\* 2>/dev/null | head -3
TWILIO_AUTH=$(grep TWILIO_AUTH_TOKEN .env 2>/dev/null | cut -d= -f2)

# Read sandbox configuration:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" | python -m json.tool

echo ""
echo "=== 2. Check Twilio Debugger for errors ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Notifications.json?PageSize=10" | python -m json.tool

echo ""
echo "=== 3. Check message logs in Twilio ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json?PageSize=10&From=whatsapp:+972526173700" | python -m json.tool

echo ""
echo "=== 4. Try setting webhook via API (in case Console save didn't work) ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" \
  -d "InboundRequestUrl=https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -d "InboundMethod=POST" | python -m json.tool

echo ""
echo "=== 5. Send test message from Twilio to verify connection ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+972526173700" \
  -d "Body=🧪 CAPS Bot is alive! Reply 7 for dashboard."

echo ""
echo "=== 6. Check if there's a Conversations configuration overriding ==="
# Twilio Conversations can intercept WhatsApp messages before they reach the webhook
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://conversations.twilio.com/v1/Configuration" | python -m json.tool

echo ""
echo "=== 7. Check if there's a messaging service overriding ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://messaging.twilio.com/v1/Services?PageSize=5" | python -m json.tool
```

## POSSIBLE CAUSES:
1. **Webhook URL not actually saved** — Console might have shown it but didn't persist
2. **Conversations service intercepting** — Twilio Conversations can grab WhatsApp messages before the sandbox webhook
3. **Messaging Service overriding** — If a messaging service is configured, it takes priority
4. **Trial account limitation** — Trial accounts have restrictions on international sandbox messaging
5. **Sandbox expired** — Sandbox participants expire after 72 hours

## FIX based on findings:

### If Conversations is intercepting:
```bash
# Disable Conversations default handling:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://conversations.twilio.com/v1/Configuration" \
  -d "DefaultChatServiceSid=" \
  -d "DefaultMessagingServiceSid=" | python -m json.tool
```

### If webhook URL not persisted:
```bash
# Force set via API:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" \
  -d "InboundRequestUrl=https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -d "InboundMethod=POST"
```

### If messaging service overriding:
```bash
# Remove conflicting messaging services or update their webhook
```

## REPORT — must include:
```
Sandbox API response: [webhook URL shown / 404 / error]
Twilio Debugger errors: [list any]
Message logs for +972526173700: [found / empty]
Conversations config: [active / not active]
Messaging services: [list any]
Test outbound message: [sent / failed]
Root cause: [exactly why webhook not forwarding]
Fix applied: [what was done]
Working now: [YES — tested / NO]
```

VAMOS CAPS WHATSAPP-FIX-WITH-CONTEXT — END
