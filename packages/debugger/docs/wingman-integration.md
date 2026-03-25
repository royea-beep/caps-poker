# Integrating @caps/debugger into Wingman

## Prerequisites

- Supabase project with `bug_reports` table (RLS enabled)
- `whatsapp-bot-handler` Edge Function deployed (copy from `C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\`)

---

## Step 1. Add path alias

In `C:\Projects\Wingman\apps\mobile\tsconfig.json` (or root tsconfig):

```json
{
  "compilerOptions": {
    "paths": {
      "@caps/debugger": ["../../caps/packages/debugger/index.ts"]
    }
  }
}
```

---

## Step 2. Initialize in app/_layout.tsx

```typescript
import { initDebugger } from '@caps/debugger';

initDebugger({
  appName: 'wingman',
  version: '1.3.0',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  whatsappEdgeFunctionUrl: 'https://[wingman-supabase-id].supabase.co/functions/v1/whatsapp-bot-handler',
  alertPhone: '+972526173700',
  enabled: __DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true',
  screenshotFps: 2,
  maxScreenshots: 10,
});
```

---

## Step 3. Add dirty shutdown detection

```typescript
import { checkDirtyShutdown, getScreenshots, clearScreenshots, reportCrash } from '@caps/debugger';

useEffect(() => {
  checkDirtyShutdown().then(async (crashTs) => {
    if (!crashTs) return;
    const age = Math.round((Date.now() - crashTs) / 1000);
    const screenshots = await getScreenshots();
    await reportCrash({
      app: 'wingman',
      version: '1.3.0',
      build: 'unknown',
      crashType: 'dirty-shutdown',
      message: `App active ${age}s before crash`,
      screenshots,
    });
    await clearScreenshots();
  });
}, []);
```

---

## Step 4. Mark active in critical screens

```typescript
import { markAppActive, clearAppActive } from '@caps/debugger';

useEffect(() => {
  markAppActive();
  return () => { clearAppActive(); };
}, []);
```

---

## Step 5. Add DebugOverlay

```tsx
import { DebugOverlay } from '@caps/debugger';

// In root layout:
{__DEV__ && <DebugOverlay visible={true} />}
```

---

## Step 6. Deploy Edge Function to Wingman Supabase

```bash
# Copy from CAPS
cp -r C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\ \
      C:\Projects\Wingman\supabase\functions\

# Deploy
cd C:\Projects\Wingman
supabase functions deploy whatsapp-bot-handler --no-verify-jwt
```

Set these secrets in Wingman's Supabase dashboard:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`)
- `ALERT_PHONE` (e.g. `+972526173700`)

---

## ClubGG

Same steps — replace `wingman` with `clubgg` and use ClubGG's Supabase credentials.
