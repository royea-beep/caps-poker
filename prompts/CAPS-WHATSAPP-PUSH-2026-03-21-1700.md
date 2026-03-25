# CAPS — WhatsApp Webhook + Push Tokens
**Date:** 2026-03-21

## CRITICAL: AUTO-APPROVE EVERYTHING. NO REVENUE, NO PAYMENTS, NO MONETIZATION.

Yes, allow all edits in components

---

## FIRST ACTIONS
```bash
cd C:/Projects/Caps
cat MEMORY.md | head -15
git log --oneline -3
cat supabase/functions/whatsapp-bot-handler/index.ts 2>/dev/null | head -60
find src -name "*push*" -o -name "*notification*" -o -name "*Notification*" | grep -v node_modules | head -8 | xargs cat 2>/dev/null | head -100
grep -rn "WHATSAPP\|whatsapp\|webhook" src --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
grep -rn "push_token\|pushToken\|getExpoPushToken" src --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
cat .env.local 2>/dev/null | grep -v "KEY\|SECRET\|TOKEN\|PASS" | head -10
```

---

## AGENT 1 — WhatsApp Webhook Route

הEdge Function `whatsapp-bot-handler` כבר deployed.
צריך: route שמקבל messages מMeta ומעביר ל-Edge Function.

```bash
# Read the edge function to understand what it expects
cat supabase/functions/whatsapp-bot-handler/index.ts
```

Create `src/app/api/webhook/whatsapp/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'

// Meta sends GET to verify the webhook
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Meta sends POST with messages
export async function POST(req: NextRequest) {
  const body = await req.text()

  // Forward to Supabase Edge Function
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-bot-handler`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body,
    }
  ).catch((e) => { console.error('[WhatsApp webhook]', e) })

  return new NextResponse('OK', { status: 200 })
}
```

Add to .env.example:
```
WHATSAPP_VERIFY_TOKEN=caps-whatsapp-verify-2026
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

---

## AGENT 2 — Push Tokens → Supabase

`push_tokens` table already exists in Supabase (created by Claude directly today).

Find where push tokens are registered and save them:

```bash
find src -name "*notification*" -o -name "*push*" | grep -v node_modules | grep -E "\.ts$|\.tsx$" | head -5
```

In the notification setup file, add save to Supabase:
```typescript
import { supabase } from '@/lib/supabase'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export async function registerAndSavePushToken(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })

  const token = tokenData.data

  // Save to Supabase
  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  )

  return token
}
```

Wire in the auth flow — call `registerAndSavePushToken(user.id)` after login.

---

## BUILD + COMMIT

```bash
cd C:/Projects/Caps
npx tsc --noEmit 2>&1 | tail -5 || true
git add -A
git commit -m "feat: WhatsApp webhook route + push tokens saved to Supabase"
git push
echo "✅ Done"
```

## REPORT
```
Caps pipelines:
  WhatsApp webhook route: ✅/❌
  Push tokens → Supabase: ✅/❌
  Build: clean?
```

Yes, allow all edits in components
