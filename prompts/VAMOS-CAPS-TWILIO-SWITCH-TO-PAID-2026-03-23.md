# VAMOS CAPS TWILIO-SWITCH-TO-PAID
**Date:** 2026-03-23 IST
**Priority:** 🔴 Switch from Trial Twilio to FeatureTable (paid) account

## CONTEXT
- Current: Trial account (ACfa81cdf2f1c...) — sandbox broken, Trial limitations
- Target: FeatureTable account — PAID, no limitations
- User has TWO Twilio accounts, FeatureTable is the paid one

## STEP 1 — Get FeatureTable account credentials

```
cd C:\Projects\Caps

echo "=== Find FeatureTable credentials ==="
# Check all project .env files:
grep -r "TWILIO\|twilio" C:\Projects\*.env C:\Projects\*\.env C:\Projects\config\* 2>/dev/null | grep -v node_modules
grep -r "TWILIO\|twilio" C:\Projects\ftable\.env C:\Projects\9soccer\.env C:\Projects\clubgg\.env 2>/dev/null
grep -r "FeatureTable\|featuretable\|FEATURE_TABLE" C:\Projects\*.env C:\Projects\*\.env 2>/dev/null

# Check if credentials are in any config file:
grep -r "AC[a-f0-9]\{32\}" C:\Projects\ftable\ C:\Projects\9soccer\ C:\Projects\clubgg\ 2>/dev/null | head -10
```

## STEP 2 — Once you have the FeatureTable SID and Auth Token:

```bash
# Set new credentials as variables:
FT_SID="AC..."  # FeatureTable Account SID
FT_AUTH="..."    # FeatureTable Auth Token

echo "=== 1. Verify account ==="
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$FT_SID.json" | python -m json.tool | grep -E "friendly|status|type"

echo ""
echo "=== 2. Check if WhatsApp sandbox exists ==="
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$FT_SID/Sandbox.json" | python -m json.tool

echo ""
echo "=== 3. Check phone numbers on this account ==="
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$FT_SID/IncomingPhoneNumbers.json" | python -m json.tool | head -30

echo ""
echo "=== 4. Check WhatsApp senders ==="
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://messaging.twilio.com/v1/Services" | python -m json.tool | head -30
```

## STEP 3 — Set up WhatsApp sandbox on FeatureTable account

```bash
# Set webhook URL on FeatureTable sandbox:
curl -s -u "$FT_SID:$FT_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$FT_SID/Sandbox.json" \
  -d "InboundRequestUrl=https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -d "InboundMethod=POST" | python -m json.tool
```

## STEP 4 — Update Supabase Edge Function secrets

```bash
# Replace Trial credentials with FeatureTable:
supabase secrets set TWILIO_ACCOUNT_SID="$FT_SID"
supabase secrets set TWILIO_AUTH_TOKEN="$FT_AUTH"
# Keep the phone number:
supabase secrets set ROYE_WHATSAPP_NUMBER="whatsapp:+972526173700"
# Sandbox number stays the same:
supabase secrets set TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```

## STEP 5 — Join sandbox from FeatureTable account

The join code will be DIFFERENT for the FeatureTable account.

```bash
# Get the join code:
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://api.twilio.com/2010-04-01/Accounts/$FT_SID/Sandbox.json" | python -m json.tool

# Look for the sandbox keyword in the response
```

If join code found — report it. User sends `join XXXX` from +972526173700 to +14155238886.

## STEP 6 — Test

```bash
# Send test message:
curl -s -u "$FT_SID:$FT_AUTH" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$FT_SID/Messages.json" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+972526173700" \
  -d "Body=🧪 FeatureTable account working! Send Hi to test."

echo ""
echo "=== Check if outbound queued ==="
```

## STEP 7 — Also check Conversations on FeatureTable

Make sure Conversations isn't intercepting here too:
```bash
curl -s -u "$FT_SID:$FT_AUTH" \
  "https://conversations.twilio.com/v1/Configuration/Addresses" | python -m json.tool

# If any addresses found — delete them:
# curl -s -u "$FT_SID:$FT_AUTH" -X DELETE "https://conversations.twilio.com/v1/Configuration/Addresses/IGXXXX"
```

## STEP 8 — Redeploy Edge Function

The Edge Function needs to use the new credentials. They're in secrets,
so just redeploy:
```bash
supabase functions deploy whatsapp-bot-handler --no-verify-jwt
supabase functions deploy crash-analyzer --no-verify-jwt
```

## REPORT
```
FeatureTable Account:
  SID: [found/not found]
  Type: [paid/trial]
  Status: [active/suspended]

WhatsApp Sandbox:
  Activated: [YES/NO]
  Join code: [word]
  Webhook URL set: [YES/NO]

Secrets updated: [YES/NO]
Edge Functions redeployed: [YES/NO]
Conversations bindings: [none/deleted]

Test outbound: [sent/failed]
Test inbound: [received/not received]
```

VAMOS CAPS TWILIO-SWITCH-TO-PAID — END
