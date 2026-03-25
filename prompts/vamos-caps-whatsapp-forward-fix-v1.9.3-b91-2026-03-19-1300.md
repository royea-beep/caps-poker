VAMOS CAPS WHATSAPP-FORWARD-FIX v1.9.3-b91 2026-03-19-1300

## Current state: v1.9.3 build #91 | commit a47fd25
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM
Forwarded WhatsApp messages are being treated as empty.
When user forwards an image or voice note, Twilio sends it the same way as a direct message
but the Body field is empty and media is in MediaUrl0.
The bot is checking `if (!inputText)` BEFORE checking for media — rejecting forwarded voice/image.

## TASK — Fix Edge Function to handle forwarded messages

A1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

A2. The current flow is wrong:
    - Forwarded voice note: NumMedia=1, MediaUrl0=..., Body="" (empty)
    - Forwarded image: NumMedia=1, MediaUrl0=..., Body="" (empty)
    - Current code checks `if (!inputText)` → returns "Empty message" error
    
    Fix: check for media FIRST, then text, then reject empty

A3. Fix the flow order:
    ```typescript
    // CORRECT ORDER:
    // 1. Check media first (image/audio) — even if Body is empty
    // 2. If no media, use Body text
    // 3. Only reject if BOTH are empty
    
    let inputText = '';
    let detectedMediaType = 'text';

    if (numMedia > 0 && mediaUrl) {
      // Has media — process it regardless of Body
      if (mediaType.startsWith('audio/')) {
        detectedMediaType = 'audio';
        if (OPENAI_API_KEY) {
          try {
            inputText = await transcribeAudio(mediaUrl);
            if (msgBody) inputText = msgBody + '\n\n[Voice note]: ' + inputText;
          } catch (e) {
            console.error('[whatsapp-bot] Audio transcription failed:', e);
            // Fall back to body text or describe as audio
            inputText = msgBody || '[Voice note received — transcription unavailable]';
          }
        } else {
          // No OpenAI key — acknowledge the audio but can't transcribe
          inputText = msgBody || '[Voice note received — no transcription key configured]';
        }
      } else if (mediaType.startsWith('image/')) {
        detectedMediaType = 'image';
        try {
          const imageDesc = await describeImage(mediaUrl);
          inputText = msgBody ? `${msgBody}\n\nScreenshot: ${imageDesc}` : `Screenshot: ${imageDesc}`;
        } catch (e) {
          console.error('[whatsapp-bot] Image description failed:', e);
          inputText = msgBody || '[Image received — description unavailable]';
        }
      } else {
        inputText = msgBody || `[Media received: ${mediaType}]`;
      }
    } else {
      // No media — use text
      inputText = msgBody;
    }

    // Only reject if truly empty
    if (!inputText) {
      await sendWhatsApp(from, '⚠️ Empty message. Send a bug description, voice note, or screenshot.');
      return new Response('OK', { status: 200 });
    }
    ```

A4. Also fix: when audio transcription is unavailable (no OpenAI key), still process with Claude
    using whatever text we have as context

A5. Deploy:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

A6. Test:
    curl -s -X POST \
      "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "From=whatsapp:+972504141513&Body=&MessageSid=SMtest456&NumMedia=1&MediaUrl0=https://example.com/test.ogg&MediaContentType0=audio/ogg" \
      -w "\nHTTP %{http_code}"

A7. git add -A && git commit -m "fix: WhatsApp bot handles forwarded messages — media processed even when Body is empty [v1.9.3-b91]"
A8. git push origin main
A9. Report done

VAMOS CAPS WHATSAPP-FORWARD-FIX — END
