# VAMOS CAPS TWILIO-FULL-SETUP
**Date:** 2026-03-23 IST
**Priority:** 🟡 Set up WhatsApp alerts properly via Twilio API — zero manual

## SITUATION
- Twilio Account SID: ACfa81cdf2f1c262f00f88e8cb5f8c2e0d
- Twilio secrets already in Supabase Edge Functions
- ROYE_WHATSAPP_NUMBER set to +972526173700
- Need: sandbox configured, webhook set, test message working

## STEP 1 — Get sandbox info via API
```
cd C:\Projects\Caps

# Get Twilio credentials:
TWILIO_SID="ACfa81cdf2f1c262f00f88e8cb5f8c2e0d"
TWILIO_AUTH=$(grep TWILIO_AUTH .env 2>/dev/null | cut -d= -f2)

# If not in .env, check supabase secrets or other project files:
grep -r "TWILIO_AUTH" C:\Projects\Caps\.env C:\Projects\Caps\supabase\.env* 2>/dev/null
grep -r "TWILIO_AUTH" C:\Projects\config\* 2>/dev/null

echo "=== 1. Get sandbox configuration ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/IncomingPhoneNumbers.json" | python -m json.tool | head -30

echo ""
echo "=== 2. Get WhatsApp sandbox settings ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" 2>/dev/null | python -m json.tool

echo ""
echo "=== 3. Get messaging services ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://messaging.twilio.com/v1/Services" | python -m json.tool | head -30

echo ""
echo "=== 4. Check current WhatsApp senders ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://messaging.twilio.com/v1/Services?PageSize=20" | python -m json.tool | head -50
```

## STEP 2 — Set sandbox webhook via API

```bash
# The sandbox webhook URL:
WEBHOOK_URL="https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler"

# Try setting webhook via API:
echo "=== Setting sandbox webhook ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" \
  -d "StatusCallback=$WEBHOOK_URL" \
  -d "InboundRequestUrl=$WEBHOOK_URL" \
  -d "InboundMethod=POST" 2>/dev/null | python -m json.tool

# Alternative endpoint:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" | python -m json.tool
```

Note: Twilio sandbox webhook sometimes returns 404 via API (known issue).
If API fails, check if there's a way to set it via messaging service instead.

## STEP 3 — Find the sandbox join code

```bash
echo "=== Get sandbox details (includes join code) ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Sandbox.json" | python -m json.tool

# The response should contain something like:
# "sandbox_code": "join sandy-eagle"
# or similar
```

If the API returns the join code — great, report it.
If not — try the messaging service API:

```bash
# List all messaging services and their WhatsApp senders:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://messaging.twilio.com/v1/Services" | python -m json.tool

# Get WhatsApp channels:
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID.json" | python -m json.tool
```

## STEP 4 — Send test message directly via Twilio API

```bash
echo "=== Send test WhatsApp message ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+972526173700" \
  -d "Body=🧪 CAPS crash control test! If you see this — WhatsApp alerts work."

echo ""
echo "Status: check if message was queued"
```

If this returns an error like "not opted in" → the number must join the sandbox first.
Report the EXACT join code so user can do it in 10 seconds.

## STEP 5 — Check if we should upgrade beyond sandbox

Twilio sandbox has limitations:
- Numbers must opt-in every 72 hours
- Only works with sandbox number
- Limited throughput

Better options:
1. **Twilio WhatsApp Business Profile** — permanent, no opt-in needed
2. **Twilio Notify** — push notifications instead of WhatsApp
3. **Expo Push Notifications** — native push to iPhone (already have expo-notifications code)

```bash
echo "=== Check if WhatsApp business sender is available ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://messaging.twilio.com/v1/Channels/WhatsApp/Senders" 2>/dev/null | python -m json.tool

echo ""
echo "=== Account type ==="
curl -s -u "$TWILIO_SID:$TWILIO_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID.json" | python -m json.tool | grep -i "type\|status\|friendly"
```

## STEP 6 — Alternative: Use Expo Push Notifications instead

If Twilio sandbox is too fragile, set up Expo push notifications:
- No opt-in needed
- Works forever
- Native iOS notifications
- Already have expo-notifications code (stubbed)

```bash
# Check if expo-notifications is available:
grep "expo-notifications" package.json
# It was removed earlier for provisioning issues.
# But we can use expo-server-sdk to send pushes from Edge Functions.
```

## REPORT
```
═══════════════════════════════════════
TWILIO SETUP — REPORT
═══════════════════════════════════════
Sandbox join code: [found — "join XXX" / not found via API]
Sandbox webhook: [set via API / needs manual / was already set]
Test message to +972526173700: [sent / failed — reason]

If failed:
  Number opted in: [YES / NO — needs "join XXX"]
  Join code to send: [the exact phrase]
  Send to: +1 415 523 8886 via WhatsApp

Recommendation: [keep sandbox / upgrade to business / use expo push]
═══════════════════════════════════════
```

## DO NOT
- Do NOT expose Auth Token in logs
- Do NOT skip the test message — must verify it works
- If sandbox join code found — report it clearly so user can do it in 10 seconds

VAMOS CAPS TWILIO-FULL-SETUP — END
