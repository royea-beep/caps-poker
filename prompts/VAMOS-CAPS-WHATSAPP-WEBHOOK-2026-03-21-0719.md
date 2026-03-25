# VAMOS CAPS WHATSAPP-WEBHOOK
**Date:** 2026-03-21 07:19 IST
**Priority:** Connect the WhatsApp bot to Twilio

## ROLE
DevOps engineer — connect Twilio webhook to Supabase Edge Function

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\.env
```

Also search for Twilio credentials in ALL projects:
```
grep -r "TWILIO" C:\Projects\Caps\.env 2>/dev/null
grep -r "TWILIO" C:\Projects\Caps\supabase\.env 2>/dev/null
grep -r "TWILIO" C:\Projects\Caps\supabase\functions\.env 2>/dev/null
grep -ri "twilio" C:\Projects\*.env 2>/dev/null
grep -ri "TWILIO_ACCOUNT_SID\|TWILIO_AUTH_TOKEN" C:\Projects\**\.env 2>/dev/null
```

Also check Supabase secrets:
```
cd C:\Projects\Caps
npx supabase secrets list 2>/dev/null || echo "supabase CLI not available"
```

## CONTEXT
- Supabase project: `gxrpunvhjcrzqnitbqah`
- Edge Function: `whatsapp-bot-handler` — deployed (v12), LIVE
- Webhook URL that Twilio needs to call:
  `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler`
- Problem: Twilio webhook URL is NOT SET — the bot can't receive messages

## MISSION

### OPTION A — If Twilio credentials found (ACCOUNT_SID + AUTH_TOKEN):

Set the webhook via Twilio API automatically:
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "SmsUrl=https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler"
```

Or if it's a WhatsApp Sandbox:
```bash
# List current sandbox config
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

Then update the webhook URL on the correct phone number / sandbox.

After setting — verify by calling:
```bash
curl -X GET "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -w "\n%{http_code}"
```
Should return 200 or 405 (method not allowed for GET = still means the function is alive).

### OPTION B — If Twilio credentials NOT found:

1. Check if there's a Twilio section in any MEMORY.md or docs:
```
grep -ri "twilio" C:\Projects\Caps\MEMORY.md
grep -ri "twilio" C:\Projects\Caps\docs\* 2>/dev/null
```

2. Check the Edge Function source for clues:
```
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

3. Report exactly what's missing and what credentials are needed:
```
═══════════════════════════════════════
WHATSAPP BOT — CREDENTIAL REPORT
═══════════════════════════════════════
Edge Function: [LIVE / DOWN]
Twilio Account SID: [FOUND / NOT FOUND]
Twilio Auth Token: [FOUND / NOT FOUND]
Twilio Phone Number: [FOUND / NOT FOUND]
Webhook URL needed: https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler

WHAT'S NEEDED:
[exact list of what's missing to complete the connection]
═══════════════════════════════════════
```

## VERIFY
If webhook was set successfully:
- Send a test message to the WhatsApp number
- Check Supabase Edge Function logs:
```
npx supabase functions logs whatsapp-bot-handler --limit 5 2>/dev/null
```
- Or check via dashboard URL:
  https://supabase.com/dashboard/project/gxrpunvhjcrzqnitbqah/functions/whatsapp-bot-handler/logs

## DO NOT
- Do NOT change the Edge Function code
- Do NOT redeploy the function
- Do NOT modify Supabase config
- ONLY connect Twilio → Edge Function

VAMOS CAPS WHATSAPP-WEBHOOK — END
