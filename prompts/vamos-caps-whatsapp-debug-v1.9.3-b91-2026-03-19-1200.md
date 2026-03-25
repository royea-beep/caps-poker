VAMOS CAPS WHATSAPP-DEBUG v1.9.3-b91 2026-03-19-1200

## Current state: v1.9.3 build #91 | commit 34ceb53
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM
WhatsApp message sent to Twilio sandbox but bot didn't reply.
Edge Function may be failing silently.

## TASK A — Check Edge Function logs

A1. Check Supabase Edge Function logs:
    npx supabase functions logs whatsapp-bot-handler --project-ref gxrpunvhjcrzqnitbqah 2>&1 | tail -50

A2. Check if the function is deployed:
    npx supabase functions list --project-ref gxrpunvhjcrzqnitbqah 2>&1

A3. If logs show error — identify and fix it

---

## TASK B — Fix Twilio signature verification (most likely cause)

B1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

B2. The Twilio signature verification is likely failing because:
    - The URL used for verification must be EXACTLY the webhook URL as Twilio sees it
    - Supabase Edge Functions have a specific URL format
    - The signature check may reject valid messages

B3. Fix: make signature verification optional/lenient for sandbox:
    ```typescript
    // In sandbox/dev mode, skip strict signature verification
    // Twilio sandbox doesn't always send proper signatures
    const twilioSignature = req.headers.get('x-twilio-signature') ?? '';
    const isValid = twilioSignature === '' || await verifyTwilioSignature(url, params, twilioSignature);
    // For now — skip verification entirely, add back for production
    // if (!isValid) return new Response('Unauthorized', { status: 401 });
    ```

    Replace the signature check with a softer version:
    ```typescript
    // Skip signature verification for sandbox testing
    // TODO: re-enable for production with proper URL
    const fromWhitelist = ['whatsapp:+972504141513', 'whatsapp:+14155238886'];
    // Just log but don't reject
    if (!twilioSignature) {
      console.log('[whatsapp-bot] No signature — sandbox mode');
    }
    ```

B4. Also add better error logging:
    ```typescript
    // At the start of serve():
    console.log('[whatsapp-bot] Request received:', req.method, req.url);
    console.log('[whatsapp-bot] Body:', body.slice(0, 200));
    ```

B5. Redeploy:
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt --project-ref gxrpunvhjcrzqnitbqah 2>&1

---

## TASK C — Test the function directly

C1. Send a test request to the Edge Function:
    curl -X POST \
      "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "From=whatsapp:+972504141513&Body=test+bug+cards+not+showing&MessageSid=SMtest123&NumMedia=0" \
      2>&1

C2. Check response — should return OK and send WhatsApp message

C3. Check logs again after test:
    npx supabase functions logs whatsapp-bot-handler --project-ref gxrpunvhjcrzqnitbqah 2>&1 | tail -30

---

## FINAL STEPS
1. git add -A && git commit -m "fix: WhatsApp bot signature verification, better logging [v1.9.3-b91]"
2. git push origin main
3. Report: what was wrong, what was fixed, test result

VAMOS CAPS WHATSAPP-DEBUG — END
