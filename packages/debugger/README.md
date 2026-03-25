# @caps/debugger

Reusable debug pipeline for React Native / Expo apps.

## Features

- **Dirty shutdown detector** — detects native crashes via AsyncStorage flag
- **Screen recorder** — captures screenshots at 2fps, survives crashes
- **Crash reporter** — inserts into Supabase `bug_reports` table
- **WhatsApp alerts** — sends crash notification with 7-option reply menu
- **Debug overlay** — floating 🐛 button with scrollable log panel

## Installation (path alias, no npm publish needed)

### In your project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@caps/debugger": ["./packages/debugger/index.ts"]
    }
  }
}
```

For external projects (Wingman, ClubGG):
```json
{
  "compilerOptions": {
    "paths": {
      "@caps/debugger": ["../../caps/packages/debugger/index.ts"]
    }
  }
}
```

## Usage

### 1. Initialize once at app startup (e.g. `_layout.tsx`):

```typescript
import { initDebugger } from '@caps/debugger';

initDebugger({
  appName: 'caps',                  // 'caps' | 'wingman' | 'clubgg'
  version: '1.9.4',
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
  whatsappEdgeFunctionUrl: 'https://xxx.supabase.co/functions/v1/whatsapp-bot-handler',
  alertPhone: '+972526173700',
  enabled: __DEV__,                 // false = disable in production
  screenshotFps: 2,
  maxScreenshots: 10,
});
```

### 2. Mark game active (start of critical section):

```typescript
import { markAppActive } from '@caps/debugger';
await markAppActive();
```

### 3. Clear on clean exit (on component UNMOUNT):

```typescript
import { clearAppActive } from '@caps/debugger';
// In useEffect cleanup:
return () => { clearAppActive(); };
```

### 4. Detect crash on app open:

```typescript
import { checkDirtyShutdown, getScreenshots, clearScreenshots, reportCrash } from '@caps/debugger';

const crashTs = await checkDirtyShutdown();
if (crashTs) {
  const age = Math.round((Date.now() - crashTs) / 1000);
  const screenshots = await getScreenshots();
  await reportCrash({
    app: 'caps',
    version: '1.9.4',
    build: '237',
    crashType: 'dirty-shutdown',
    message: `App was active ${age}s ago`,
    screenshots,
  });
  await clearScreenshots();
}
```

### 5. Add DebugOverlay to your root layout:

```tsx
import { DebugOverlay } from '@caps/debugger';

// Inside render:
{showDebug && <DebugOverlay visible={true} />}
```

### 6. Log from anywhere:

```typescript
import { debugLog } from '@caps/debugger';

debugLog('Player placed card on board 2');
debugLog('Bot finished placing', 'info');
debugLog('Network timeout', 'warn');
debugLog('Crash: evaluator threw', 'error');
```

## DebuggerConfig Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `appName` | string | — | App identifier ('caps', 'wingman', 'clubgg') |
| `version` | string | — | App version string |
| `supabaseUrl` | string | — | Supabase project URL |
| `supabaseAnonKey` | string | — | Supabase anon key |
| `whatsappEdgeFunctionUrl` | string | — | Full URL to whatsapp-bot-handler edge function |
| `alertPhone` | string | — | Phone number for WhatsApp alerts (+972...) |
| `enabled` | boolean | — | false = disable all (set false in production) |
| `screenshotFps` | number | 2 | Screenshots per second (recommend 2) |
| `maxScreenshots` | number | 10 | Max frames kept on disk (~5s at 2fps) |

## WhatsApp Reply Options

When a crash alert is received, reply with:

| Reply | Action |
|-------|--------|
| `1` | 🔧 Auto-fix now |
| `2` | 👀 Show analysis |
| `3` | ⏭️ Skip |
| `4` | 🔄 Run marathon again |
| `5` | 🟢 AUTO-FIX ON |
| `6` | 🔴 AUTO-FIX OFF |
| `7` | 📊 Crash dashboard |

## Usage in Projects

| Project | Status |
|---------|--------|
| **CAPS** (`C:\Projects\Caps`) | ✅ Wired via path alias |
| **Wingman** (`C:\Projects\Wingman`) | See `docs/wingman-integration.md` |
| **ClubGG** (`C:\Projects\clubgg`) | See `docs/wingman-integration.md` (same pattern) |
