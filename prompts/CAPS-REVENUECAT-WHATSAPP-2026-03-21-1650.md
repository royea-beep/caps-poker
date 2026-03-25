# CAPS — RevenueCat + WhatsApp Webhook
**Date:** 2026-03-21 | **Time:** 16:50 IST

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

## WHAT CLAUDE ALREADY DID:
- ✅ push_tokens table created in Supabase

---

## FIRST ACTIONS
```bash
cd C:/Projects/Caps
cat MEMORY.md | head -15
git log --oneline -3

# Read existing docs
cat whatsapp-bot-design.md 2>/dev/null | head -50
find . -name "revenuecat*" -o -name "RevenueCat*" | grep -v node_modules | head -5 | xargs cat 2>/dev/null | head -50
find src -name "*push*" -o -name "*notification*" | grep -v node_modules | head -5 | xargs cat 2>/dev/null | head -50

# Check env vars
cat .env.local 2>/dev/null | grep -v "KEY\|SECRET\|TOKEN" | head -15

# Check current webhook setup
find src -name "*webhook*" | grep -v node_modules | head -5 | xargs cat 2>/dev/null | head -50
```

---

## AGENT 1 — RevenueCat

```bash
# Check what exists
grep -rn "revenuecat\|RevenueCat\|REVENUE_CAT\|Purchases" src --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20
cat package.json | grep -i "revenuecat\|purchase"
```

If RevenueCat SDK not installed:
```bash
npx expo install react-native-purchases
```

Create `src/lib/revenuecat.ts`:
```typescript
import Purchases, { PurchasesOffering } from 'react-native-purchases'
import { Platform } from 'react-native'

const RC_API_KEY = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!
  : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!

export async function initRevenueCat(userId?: string) {
  await Purchases.configure({ apiKey: RC_API_KEY })
  if (userId) await Purchases.logIn(userId)
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const { current } = await Purchases.getOfferings()
  return current
}

export async function purchasePackage(pkg: any) {
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

export async function restorePurchases() {
  return Purchases.restorePurchases()
}

export async function getCustomerInfo() {
  return Purchases.getCustomerInfo()
}
```

Add to .env.example:
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

Wire in app startup (App.tsx or _layout.tsx):
```typescript
import { initRevenueCat } from '@/lib/revenuecat'
import { useAuth } from '@/hooks/useAuth'

useEffect(() => {
  initRevenueCat(user?.id).catch(console.error)
}, [user?.id])
```

---

## AGENT 2 — WhatsApp Webhook

```bash
# Read the existing edge function
# Already deployed: whatsapp-bot-handler
# Need: wire webhook URL in the app

# Check what the bot expects
cat supabase/functions/whatsapp-bot-handler/index.ts 2>/dev/null | head -60

# Check env vars needed
grep -rn "WHATSAPP\|TWILIO\|META\|GREEN_API" supabase/functions/whatsapp-bot-handler/ 2>/dev/null | head -10
```

If using Twilio/Meta WhatsApp API:
```bash
# Add to .env.local + .env.example:
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=caps-whatsapp-verify-2026
```

Create `src/app/api/webhook/whatsapp/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Meta webhook verification
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge)
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Forward to Supabase Edge Function
  await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-bot-handler`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    }
  ).catch(console.error)

  return new NextResponse('OK')
}
```

---

## AGENT 3 — Push Tokens: Wire to Supabase

```bash
# Find where push tokens are registered
grep -rn "registerForPushNotifications\|Notifications.getExpoPushTokenAsync\|push_token" src --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
```

Wire token save to new push_tokens table:
```typescript
// In notification setup:
import { supabase } from '@/lib/supabase'

export async function registerPushToken(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const { data: token } = await Notifications.getExpoPushTokenAsync()

  await supabase.from('push_tokens').upsert({
    user_id: userId,
    token: token.data,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,token' })
}
```

---

## BUILD + COMMIT

```bash
cd C:/Projects/Caps
npx tsc --noEmit 2>&1 | tail -5 || true  # React Native uses different type check
npx expo export --platform web 2>&1 | tail -5 || npm run build 2>&1 | tail -5

git add -A
git commit -m "feat: RevenueCat integration, WhatsApp webhook wired, push_tokens table connected"
git push
```

---

## FINAL REPORT
```
Caps Pipeline Health:
  RevenueCat: ✅/❌
  Push tokens → Supabase: ✅/❌
  WhatsApp webhook URL: ✅/❌ (needs Meta dashboard config)
  Supabase realtime: ✅ (existing)
```

Yes, allow all edits in components
