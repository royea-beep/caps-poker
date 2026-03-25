# VAMOS CAPS FIX-CONVERSATIONS-BINDING
**Date:** 2026-03-23 IST

## ROOT CAUSE (from Twilio docs)
Twilio Conversations has a WhatsApp address binding that INTERCEPTS messages
before they reach the sandbox webhook. The Twilio docs explicitly say:
"To remove the existing testing webhook URL... go to Sandbox Settings
and remove the webhook URL. Not doing so would result in a reply requesting
to update the configuration."

But the REVERSE is also true: if Conversations is configured for WhatsApp,
it intercepts messages BEFORE the sandbox webhook gets them.

## FIX — Delete ALL Conversations WhatsApp address bindings

```
cd C:\Projects\Caps
TWILIO_SID="ACfa81cdf2f1c262f00f88e8cb5f8c2e0d"
TWILIO_AUTH=$(grep TWILIO_AUTH_TOKEN .env 2>/dev/null | cut -d= -f2)

echo "=== 1. List ALL Conversations address configurations ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://conversations.twilio.com/v1/Configuration/Addresses" | python -m json.tool

echo ""
echo "=== 2. Delete EVERY WhatsApp address binding ==="
# Get all address SIDs:
ADDRESSES=$(curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://conversations.twilio.com/v1/Configuration/Addresses" \
  | python -c "import sys,json; [print(a['sid']) for a in json.load(sys.stdin).get('address_configurations',[])]" 2>/dev/null)

for SID in $ADDRESSES; do
  echo "Deleting address: $SID"
  curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
    -X DELETE "https://conversations.twilio.com/v1/Configuration/Addresses/$SID"
  echo " → deleted"
done

echo ""
echo "=== 3. Also disable Conversations default handling entirely ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://conversations.twilio.com/v1/Configuration" \
  -d "DefaultChatServiceSid=" \
  -d "DefaultMessagingServiceSid=" | python -m json.tool

echo ""
echo "=== 4. Verify — no more address bindings ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://conversations.twilio.com/v1/Configuration/Addresses" | python -m json.tool

echo ""
echo "=== 5. Verify sandbox webhook is still set ==="
# Re-read sandbox settings:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" | python -m json.tool

echo ""
echo "=== 6. Send test outbound message ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+972526173700" \
  -d "Body=🧪 Conversations binding deleted! Send Hi to test inbound."

echo ""
echo "=== 7. Check Monitor > Logs for any errors ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://monitor.twilio.com/v1/Alerts?PageSize=5" | python -m json.tool | head -40
```

## AFTER FIX — Test inbound
Tell user to send "Hi" from +972526173700 to +14155238886.
Check if whatsapp_sessions table gets an entry:
```
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/whatsapp_sessions?order=created_at.desc&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool
```

## IF STILL NOT WORKING — Check Twilio Monitor logs
```
echo "=== Check Monitor > Messaging logs ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json?PageSize=5&From=whatsapp:+972526173700" \
  | python -m json.tool
```

This shows if Twilio RECEIVED the message and what it did with it.
If status=received but no webhook fired → something else is intercepting.
If status=failed → there's an error code explaining why.

## REPORT
```
Conversations addresses found: [N]
Addresses deleted: [N]
Conversations default handling disabled: [YES/NO]
Outbound test: [sent/failed]
Inbound test after fix: [received by Edge Function / still not working]
whatsapp_sessions: [new entry / still empty]
```

VAMOS CAPS FIX-CONVERSATIONS-BINDING — END
