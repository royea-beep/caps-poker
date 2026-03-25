# VAMOS CAPS MEGA-PIPELINE-AND-VISUAL
**Date:** 2026-03-21 09:59 IST
**Priority:** 🔴 Two parallel missions

## ROLE
5 agents working in parallel:
- Agent 1-2: Bug Pipeline Engineer — wire Supabase → Dashboard
- Agent 3-4: Visual Design Lead — make home screen look PRO
- Agent 5: QA + Deploy

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\constants\theme.ts
Read C:\Projects\Caps\constants\visualThemes.ts 2>/dev/null
Read C:\Projects\Caps\components\ProQuoteBanner.tsx
```

Also read the bug:
```
cd C:\Projects\Caps
npx supabase db execute "SELECT * FROM bug_reports ORDER BY created_at DESC LIMIT 5" 2>/dev/null
```
Or:
```
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=5" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null
```

═══════════════════════════════════════════════
AGENT 1 — CAPS Bug Dashboard Page
═══════════════════════════════════════════════

Create a simple bug dashboard for CAPS that reads from Supabase directly.
No Drive needed — Supabase IS the source of truth.

**A1. Create `C:\Projects\Caps\web-dashboard\index.html`:**

A single-page HTML dashboard (standalone, deployable to Vercel or FTP):

```
┌──────────────────────────────────────────────┐
│ 🐛 CAPS Bug Reports                          │
│ Filter: [All ▾] [Open ▾] [Today ▾]          │
├──────┬───────────┬────────────┬──────────────┤
│ Time │ Title     │ Screen     │ Status       │
├──────┼───────────┼────────────┼──────────────┤
│ 9:41 │ Doesn't   │ / (home)   │ 🟡 Open     │
│      │ look pro  │            │ [Mark Fixed] │
├──────┼───────────┼────────────┼──────────────┤
│ ...  │ ...       │ ...        │ ...          │
└──────┴───────────┴────────────┴──────────────┘
```

Features:
- Fetches from Supabase `bug_reports` table using anon key (read-only via RLS)
- Shows: created_at, title, description, screen, device, app_version, status
- Filter by: status (open/fixed/all), date
- "Mark Fixed" button → updates status in Supabase
- "Send to WhatsApp Bot" button → copies formatted text for paste into WhatsApp
- Auto-refresh every 30 seconds
- Dark theme matching CAPS style

Read Supabase credentials from:
```
grep "SUPABASE_URL\|SUPABASE_ANON_KEY" C:\Projects\Caps\.env
```

**A2. Add RLS policy for reading bug_reports:**
```sql
-- If not exists already
CREATE POLICY "anon_read_bugs" ON bug_reports
  FOR SELECT USING (true);
```

Apply via:
```
cd C:\Projects\Caps
npx supabase migration new bug_dashboard_rls
npx supabase db push
```

═══════════════════════════════════════════════
AGENT 2 — Deploy Bug Dashboard
═══════════════════════════════════════════════

**B1. Deploy to FTP as caps.ftable.co.il/bugs/**
```
mkdir -p C:\Projects\Caps\web-dashboard
# After creating index.html, upload via FTP:
# ftableco / CPANEL_PASSWORD_REDACTED / ftable.co.il
# Target: /home/ftableco/public_html/caps/bugs/
```

Or deploy to Vercel as sub-path.

**B2. Verify: `curl -s https://caps.ftable.co.il/bugs/`**

═══════════════════════════════════════════════
AGENT 3 — Visual Audit: "Doesn't Look Pro"
═══════════════════════════════════════════════

A real user reported: "Doesn't look pro" on the home screen.
Do a full visual audit of `app/index.tsx` and fix it.

**C1. Read the home screen code:**
```
cat C:\Projects\Caps\app\index.tsx
cat C:\Projects\Caps\constants\theme.ts
cat C:\Projects\Caps\constants\visualThemes.ts 2>/dev/null
```

**C2. Screenshot the current web version for reference:**
```
curl -s https://caps.ftable.co.il -o /dev/null -w "%{http_code}"
```

**C3. Identify and fix these common "not pro" issues:**

Home screen should feel like a premium poker app. Check for:

| Issue | What to look for | Fix |
|-------|-----------------|-----|
| Typography | Generic fonts, inconsistent sizes | Use system bold fonts, clear hierarchy: title 28px, subtitle 16px, buttons 18px |
| Spacing | Cramped or inconsistent gaps | Consistent 16px/24px spacing rhythm |
| Button design | Flat/boring buttons | Add subtle gradient, shadow, border radius 12, press animation |
| Color palette | Too many colors or washed out | Limit to 3-4 colors: dark bg, gold accent, white text, subtle green |
| Logo/Title | "CAPS POKER" looks plain | Add letterSpacing, subtle gold color, maybe a card suit icon ♠♦♣♥ |
| Pro Quote banner | Floating awkwardly | Give it a proper card/container with glass effect |
| Links row | Too small/cramped | Better spacing, touch targets |
| Version badge | Overlapping or ugly | Clean position, consistent opacity |
| Background | Plain solid color | Subtle gradient or texture (felt-like) |
| Overall feel | "Mobile game" not "Poker room" | Think Bellagio app, not casual game |

**C4. Apply fixes — make the home screen PREMIUM:**

Specific changes:
1. Background: subtle dark gradient (top: #0a0f1a → bottom: #1a1a2e)
2. Title "CAPS": letterSpacing 8, fontSize 36, color gold (#FFD700), fontWeight 900
3. Subtitle "POKER": letterSpacing 16, fontSize 14, rgba white 0.5
4. Buttons: gradient background (dark green → darker green), shadow, borderRadius 14, height 56
5. Primary button: gold border 1px
6. Button text: fontWeight 700, letterSpacing 1
7. ProQuoteBanner: glass container (rgba white 0.05, border rgba white 0.1, borderRadius 12)
8. Links: fontSize 12, spacing 16 between items, opacity 0.6
9. Add subtle card suit decorations: ♠♦♣♥ scattered very faintly in background (opacity 0.03)
10. Chip/balance display: gold accent, prominent

═══════════════════════════════════════════════
AGENT 4 — Polish Other Screens Too
═══════════════════════════════════════════════

If "doesn't look pro" is about the home, the game and summary screens should match.

**D1. Quick pass on game.tsx:**
- Board borders should feel premium (not thin hairlines)
- Timer bar: gradient, not flat color
- "Ready" button: same premium style as home buttons

**D2. Quick pass on results.tsx / summary:**
- Score display: bigger numbers, gold for wins
- Consistent spacing and typography with home

**D3. Quick pass on settings.tsx:**
- Clean section headers
- Consistent toggle styling

═══════════════════════════════════════════════
AGENT 5 — Tests + Deploy + Mark Bug Fixed
═══════════════════════════════════════════════

```
E1. npx tsc --noEmit — 0 errors
E2. npx jest --forceExit — 126+ pass
E3. npx expo export --platform web --output-dir web-dist
E4. node scripts/fix-web-html.js
E5. cd web-dist && vercel --prod --yes
E6. Upload bug dashboard to FTP (if not using Vercel)
E7. git add -A && git commit -m "feat: CAPS bug dashboard + premium visual redesign — fixes 'doesn't look pro'"
E8. git push origin main
E9. Update MEMORY.md
E10. Mark the bug as fixed in Supabase:
     UPDATE bug_reports SET status = 'fixed' WHERE title = 'Doesn''t look pro';
```

## SUCCESS CRITERIA
- ✅ Bug dashboard live at caps.ftable.co.il/bugs/ (or similar URL)
- ✅ Dashboard reads from Supabase bug_reports table
- ✅ Shows today's bug "Doesn't look pro" with timestamp + screen
- ✅ Home screen looks PREMIUM — dark gradient, gold accents, proper typography
- ✅ Buttons feel tactile — shadow, gradient, press animation
- ✅ ProQuoteBanner in glass container
- ✅ Game + Summary + Settings get quick polish pass
- ✅ Bug marked as "fixed" in Supabase
- ✅ All tests pass, 0 TS errors
- ✅ Web + git deployed

## DO NOT
- Do NOT change game logic or Iron Rules
- Do NOT change tap-to-place mechanic
- Do NOT remove any existing features
- Do NOT change sound files or voice clips

VAMOS CAPS MEGA-PIPELINE-AND-VISUAL — END
