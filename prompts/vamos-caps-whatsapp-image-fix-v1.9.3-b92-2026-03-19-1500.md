VAMOS CAPS WHATSAPP-IMAGE-FIX v1.9.3-b92 2026-03-19-1500

## Current state: v1.9.3 build #92 | commit 4a71898
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM 1: Screenshots not working
Bot replies "לא ניתן להציג את התמונה" when user sends a screenshot.
Root cause: Twilio media URLs require authentication to fetch.
The current describeImage() fetches the image URL with Twilio auth — but may be failing
because the image URL format changed or the base64 encoding is wrong.

## TASK A — Fix image handling
Agent: image-agent

A1. Read supabase/functions/whatsapp-bot-handler/index.ts — find describeImage()

A2. The issue: Twilio media URLs need Basic auth (SID:TOKEN).
    Current code fetches with auth headers — verify the fetch is correct.
    
A3. Fix describeImage to handle errors gracefully and log them:
    ```typescript
    async function describeImage(mediaUrl: string): Promise<string> {
      console.log('[whatsapp-bot] Fetching image from:', mediaUrl);
      const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      
      const imgRes = await fetch(mediaUrl, {
        headers: { 
          'Authorization': `Basic ${creds}`,
        },
      });
      
      console.log('[whatsapp-bot] Image fetch status:', imgRes.status, imgRes.headers.get('content-type'));
      
      if (!imgRes.ok) {
        throw new Error(`Image fetch failed: ${imgRes.status}`);
      }
      
      const imgBuf = await imgRes.arrayBuffer();
      const uint8 = new Uint8Array(imgBuf);
      
      // Convert to base64 in chunks to avoid stack overflow
      let base64 = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        const chunk = uint8.slice(i, i + chunkSize);
        base64 += String.fromCharCode(...chunk);
      }
      base64 = btoa(base64);
      
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      console.log('[whatsapp-bot] Image size:', imgBuf.byteLength, 'bytes, type:', contentType);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: contentType, data: base64 },
                },
                {
                  type: 'text',
                  text: 'תאר את צילום המסך הזה לדיווח באג. התמקד במה שגלוי על המסך, שגיאות, בעיות UI, או התנהגות לא צפויה. היה תמציתי בעברית.',
                },
              ],
            },
          ],
        }),
      });
      
      const data = await res.json();
      console.log('[whatsapp-bot] Vision response:', JSON.stringify(data).slice(0, 200));
      return data.content?.[0]?.text ?? '';
    }
    ```

A4. Also fix: when image description fails, send the image context to Claude anyway:
    ```typescript
    } else if (mediaType.startsWith('image/')) {
      detectedMediaType = 'image';
      try {
        const imageDesc = await describeImage(mediaUrl);
        inputText = msgBody ? `${msgBody}\n\nצילום מסך: ${imageDesc}` : `צילום מסך: ${imageDesc}`;
      } catch (e) {
        console.error('[whatsapp-bot] Image description failed:', e);
        // Still process — user may have added text description
        inputText = msgBody || 'קיבלתי צילום מסך אך לא הצלחתי לנתח אותו. אנא תאר את הבעיה בטקסט.';
      }
    }
    ```

A5. Deploy:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

---

## PROBLEM 2: One bot for all projects
## TASK B — Design multi-project bot
Agent: architect-agent

B1. Create docs/whatsapp-bot-multiproject.md:

    The current bot is hardcoded for Caps Poker.
    Design for a universal bot that handles all projects:

    ```markdown
    # WhatsApp Bot — Multi-Project Design

    ## How it works
    User sends message → Bot detects which project from context → Routes to correct repo

    ## Project detection (from message content or explicit tag)
    - "caps" / "poker" / "קלפים" → caps-poker repo
    - "wingman" → wingman repo  
    - "keydrop" → keydrop repo
    - "analyzer" / "אנלייזר" → analyzer repo
    - "explainit" → explainit repo
    - "postpilot" / "פוסט" → postpilot repo
    - Default → ask user which project

    ## Implementation options
    Option A: One Twilio number, one Edge Function that routes
    Option B: Separate webhook per project (current approach)
    
    Recommendation: Option A — one number, smart routing
    
    ## Routing system prompt addition:
    First detect project, then analyze:
    "First identify which project this relates to based on keywords.
    Projects: caps-poker, wingman, keydrop, analyzer, explainit, postpilot.
    Then analyze the bug/feature for that specific project."

    ## GitHub dispatch per project
    Map project name → repo → repository_dispatch
    ```

B2. Save the doc and report

---

## FINAL STEPS
1. git add -A && git commit -m "fix: WhatsApp bot image handling + multi-project design doc [v1.9.3-b92]"
2. git push origin main
3. Report done

VAMOS CAPS WHATSAPP-IMAGE-FIX — END
