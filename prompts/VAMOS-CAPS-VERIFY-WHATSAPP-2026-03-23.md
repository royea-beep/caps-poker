# VAMOS CAPS VERIFY-WHATSAPP
**Date:** 2026-03-23 IST
## Quick verification — no code changes

```
cd C:\Projects\Caps

echo "=== 1. Check if webhook is responding ==="
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "=== 2. Check if ROYE_WHATSAPP_NUMBER is set ==="
supabase secrets list 2>&1 | grep -i "ROYE\|WHATSAPP\|PHONE\|TWILIO"

echo ""
echo "=== 3. Set ROYE_WHATSAPP_NUMBER if missing ==="
# Check if it exists first:
supabase secrets list 2>&1 | grep ROYE_WHATSAPP_NUMBER || \
  supabase secrets set ROYE_WHATSAPP_NUMBER="+972XXXXXXXXX"
# NOTE: Replace with actual number if bot doesn't know it.
# Check MEMORY.md or .env for the number.

echo ""
echo "=== 4. Test crash alert ==="
curl -s -X POST \
  "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -d '{"crash_notification": true, "message": "🧪 TEST: Crash control panel working!", "metadata": {"build": "test"}}'
echo ""
echo "Check WhatsApp — should receive test message"
```

Report: webhook status + secret set + test message received.

VAMOS CAPS VERIFY-WHATSAPP — END
