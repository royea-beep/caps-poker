# Reusable Skills, Gems & Patterns
**Source:** Caps Poker development sessions | **Last updated:** 2026-03-21

---

## 🔧 DevOps & Infrastructure

### Supabase Management API (via CLI token)
**Problem:** Need to change Supabase config programmatically (site_url, redirect URIs).
**Solution:** Extract token from Windows Credential Manager, use Management API.
```bash
# Extract Supabase CLI token from Windows Credential Manager
powershell.exe -NoProfile -Command "
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class CM {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CRED { public uint F,T; [MarshalAs(UnmanagedType.LPWStr)] public string TN,C;
  public System.Runtime.InteropServices.ComTypes.FILETIME LW; public uint CBS; public IntPtr CB;
  public uint P,AC; public IntPtr A; [MarshalAs(UnmanagedType.LPWStr)] public string TA,UN; }
  [DllImport(\"advapi32.dll\",CharSet=CharSet.Unicode,SetLastError=true)] public static extern
  bool CredRead(string t,uint tp,uint f,out IntPtr p);
  [DllImport(\"advapi32.dll\")] public static extern void CredFree(IntPtr p);
  public static byte[] Get(string t){IntPtr p;if(!CredRead(t,1,0,out p))return null;var
  c=(CRED)Marshal.PtrToStructure(p,typeof(CRED));byte[] b=new
  byte[c.CBS];Marshal.Copy(c.CB,b,0,(int)c.CBS);CredFree(p);return b;}
}
'@
\$b = [CM]::Get('Supabase CLI:supabase')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host ([System.Text.Encoding]::UTF8.GetString(\$b))
"

# Use token to read/update auth config
TOKEN="sbp_..."
curl -s "https://api.supabase.com/v1/projects/{ref}/config/auth" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Update site_url
curl -s -X PATCH "https://api.supabase.com/v1/projects/{ref}/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site_url": "https://your-site.com", "uri_allow_list": "https://your-site.com/**"}'
```
**Key fields:** `site_url`, `uri_allow_list` (not `additional_redirect_urls`)

### Google Cloud Project Lookup by Client ID
**Problem:** OAuth Client ID prefix = GCP project number. Find which project it belongs to.
```bash
# Client ID format: {project_number}-{hash}.apps.googleusercontent.com
# Project number 133353581092 → search all projects for this number
grep -r "133353581092" /path/to/projects --include="*.env" 2>/dev/null
```

### Supabase Edge Function with CORS
**Template for any Edge Function that needs web access:**
```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  try {
    const body = await req.json();
    // ... your logic
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
```
Deploy: `supabase functions deploy {name} --no-verify-jwt`

---

## 🎨 React Native + Web Theming

### Theme-Aware Components Pattern
```typescript
// In component:
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';

const visualTheme = useGameStore((s) => s.visualTheme);
const theme = getTheme(visualTheme);

// Apply: style={[styles.container, { backgroundColor: theme.background }]}
```

### Web-Only CSS (Safe for Cross-Platform)
```typescript
// Gradients — web only, solid color fallback for native
<View style={[
  { backgroundColor: theme.background },  // native fallback
  Platform.OS === 'web' && visualTheme === 'fiveo' && {
    background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)'
  } as any
]} />

// Box shadows — platform-specific
const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  android: { elevation: 10 },
  default: { boxShadow: '0 4px 16px rgba(0,0,0,0.5)' } as any,
});

// Cursor pointer — web only
...Platform.select({ web: { cursor: 'pointer' } as any })
```

### Color Perception Rule
**Hex colors that look good in a picker look PINK/WASHED on screen.**
- Always go 2-3x darker than you think you need
- Test on actual screen, not in code editor
- Use radial gradients for depth (brighter center, dark edges)
- Board surfaces must be BRIGHTER than background (contrast for "pop")

### zIndex Stacking for Overlays
```
zIndex: 10 — Interactive elements (topBar, buttons, floating actions)
zIndex:  1 — Decorative overlays (watermark, FriendsBg)
zIndex:  0 — Default flow elements
```
Always set explicit zIndex on interactive elements when absolute overlays exist.

---

## 🃏 Poker Game Engine

### Omaha Hand Evaluation Pre-Calculation Bug
**Problem:** Pre-calculating results during countdown, before bots finish placing cards.
**Fix pattern:**
```typescript
useEffect(() => {
  if (!countdownActive) return;
  const t = setTimeout(() => {
    // GUARD: ensure all bots have placed cards
    const botsDone = boardsRef.current.every((b) =>
      b.allBotCards.every((bc) => bc.length >= CARDS_PER_BOARD)
    );
    if (!botsDone) {
      console.log('pre-calc skipped — bot cards not ready');
      return;
    }
    precalculatedResultsRef.current = calculateResults(boardsRef.current);
  }, 0);
  return () => clearTimeout(t);
}, [countdownActive]);
```

### Poker Table Layout Metaphor
```
Bot (opponent) — TOP    → cards face down initially
Community      — CENTER → shared cards, revealed sequentially
Player (you)   — BOTTOM → your cards, always visible
```
This applies to: reveal screen, results screen, and any per-board display.

---

## 📱 Expo / React Native / Web

### Alert.alert Doesn't Work on Web
```typescript
// Alert.alert uses window.confirm on web — unreliable
if (Platform.OS === 'web') {
  doAction(); // skip confirmation on web
  return;
}
Alert.alert('Title', 'Message', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', onPress: doAction },
]);
```

### Force Portrait on Web
```typescript
// Web should always use portrait layout (even on wide screens)
const isLandscape = storeOrientation === 'landscape' && Platform.OS !== 'web';
```

### Web Deploy Pipeline (Expo + Vercel)
```bash
npx expo export --platform web --clear
node scripts/fix-web-html.js    # patches type="module", vercel.json, etc.
cd dist && vercel --prod --yes
```

### EAS Build + TestFlight (CI)
```yaml
# .github/workflows/ios-testflight.yml
on:
  push:
    branches: [main]
# Triggers: push to main → EAS build → auto-submit to TestFlight
```
Two build numbers:
- `extra.buildNumber` in app.json = code build (what we track)
- EAS build number = auto-increment (counts failures too)

---

## 🔍 Debugging Patterns

### OAuth Flow Debugging
```bash
# Trace full redirect chain
curl -v -L "https://your-supabase.co/auth/v1/authorize?provider=google&redirect_to=https://your-site.com" 2>&1 | head -100

# Check just the redirect URL
curl -s -o /dev/null -w "%{redirect_url}" "https://your-supabase.co/auth/v1/authorize?..."
```

### Find Hardcoded Values in Codebase
```bash
# Find all files using hardcoded COLORS instead of theme
grep -rn "COLORS\." app/ components/ --include="*.tsx" | grep -v "//\|import" | wc -l

# Find all web-only CSS
grep -rn "boxShadow\|cursor:\|background:.*gradient" app/ components/ --include="*.tsx"
```

---

## 📋 VAMOS Methodology — Quick Reference

### File naming:
`vamos-caps-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md`

### Must-have sections:
1. ROLE — who the bot pretends to be
2. FIRST ACTIONS — read MEMORY, confirm Iron Rules, cp to docs/prompts
3. CONTEXT — what happened, evidence
4. MISSION — numbered agents or steps with grep/cat commands
5. SUCCESS CRITERIA — checkboxes
6. ON COMPLETION — tsc → jest → export → deploy → commit → push → update MEMORY
7. MANUAL_TASKS — only if truly impossible for bot
8. CONFLICTS LIST

### Minimum 5 parallel agents for sprints
### Auto-approve sub-decisions
### Fix autonomously — never give user commands unless truly impossible
