# CAPS POKER — Master Knowledge Base v2
**Date:** 2026-03-20 | **Version:** v1.9.3 b104 | **Tests:** 115/115

---

## 1. PROJECT IDENTITY
- **Name:** Caps Poker
- **Type:** React Native Omaha poker game (iOS + web)
- **Stack:** React Native + Expo SDK 55 + TypeScript + Zustand + Supabase + Vercel
- **Repo:** royea-beep/caps-poker (private)
- **Web:** https://caps.ftable.co.il
- **iOS:** TestFlight via EAS + GitHub Actions CI
- **Supabase:** gxrpunvhjcrzqnitbqah (Frankfurt eu-central-1)

---

## 2. IRON RULES (LOCKED — never change without explicit "UNLOCK [rule]")
1. React Native + Expo only — no bare workflow, no Capacitor
2. **UNLOCKED (2026-03-19):** iOS supports portrait AND landscape. User picks on first launch or via Settings.
3. All game params runtime-configurable via Settings — never hardcoded
4. Hand evaluation: full Omaha — exactly 2 player cards + 3 board cards
5. Bot is random only — no strategy, testing purposes only
6. No backend for single-player — local storage only
7. Local multiplayer via react-native-tcp-socket
8. Internet multiplayer via Supabase Realtime (implemented Sprint-42)

---

## 3. GAME RULES (LOCKED)
- 2 players: 4 boards, 16 cards each
- 3 players: 3 boards, 12 cards each
- 4 players: 2 boards, 8 cards each
- Community: 3 open (flop) + 2 closed (turn/river) per board
- Best 2 of 4 hole cards selected during evaluation (not pre-assigned)
- UX: tap-to-select → tap-to-place (no drag), multi-select up to 4 cards

---

## 4. KEY CREDENTIALS
- **Expo:** royea | **Apple Team:** 3K9KJNGL9U | **Bundle:** com.capspoker.app
- **Supabase:** gxrpunvhjcrzqnitbqah.supabase.co (Frankfurt) | **URL in:** app.json extra + .env + supabase.ts
- **Vercel:** prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP | team_ayrePMw5z8jSPhRe67RiBD0k
- **GitHub:** royea-beep/caps-poker
- **Twilio SID:** ACf82650af617731b2252e87eb83b31f2a | Sandbox: +14155238886
- **WhatsApp webhook:** https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler

---

## 5. DEPLOY COMMANDS

### Web
```bash
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
```

### iOS (CI — automatic on git push)
```
git push origin main → GitHub Actions → EAS Build → TestFlight
```

### Manual iOS
```bash
eas build --platform ios --profile production --non-interactive
```

### TypeScript check + tests (before every deploy)
```bash
npx tsc --noEmit       # must be 0 errors
npx jest --silent      # must be 115/115
```

---

## 6. KEY FILES

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Splash, deep links, orientation lock, first-launch flow (theme→orientation→home) |
| `app/index.tsx` | Home screen, 10 themes, taglines, FriendsBg |
| `app/game.tsx` | Main game, portrait+landscape layouts, pre-calc during countdown |
| `app/results.tsx` | YOU WIN/LOSE score, confetti on PERFECT! |
| `app/theme-pick.tsx` | First-launch visual theme choice (Classic/Five-O) |
| `app/orientation-pick.tsx` | First-launch orientation choice |
| `app/settings.tsx` | All settings, orientation/theme toggle, visual style section |
| `app/lobby/host.tsx` | TCP local multiplayer host |
| `app/lobby/internet-host.tsx` | Supabase Realtime internet host |
| `components/Card.tsx` | 5-0 poker style, 4-color suits, diamond lattice back, flip anim |
| `components/Board.tsx` | Red felt, WIN/LOSE/TIE banners with hand name, theme tokens |
| `components/RevealSequence.tsx` | Five-O vertical layout, probability, delta, BEST card glow |
| `components/BugReporter.tsx` | Shake/FAB → Supabase bug_reports, hidden on game screens |
| `constants/visualThemes.ts` | Classic/Five-O token system (boardBg, accent, cardFace, etc.) |
| `constants/gameConfig.ts` | botSpeedMin:1500, botSpeedMax:4000, all game params |
| `constants/deviceBreakpoints.ts` | `rv()` responsive helper, `getDevice()` factory |
| `store/gameStore.ts` | All persisted state (Zustand + AsyncStorage + partialize) |
| `supabase/functions/whatsapp-bot-handler/index.ts` | v15, multi-project routing, Claude+Whisper |
| `.github/workflows/claude-fix.yml` | WhatsApp bot → auto fix → TestFlight + web deploy |
| `scripts/fix-web-html.js` | Patches index.html: type="module", error handler, vercel.json |

---

## 7. ARCHITECTURE DECISIONS

| Decision | Rule |
|----------|------|
| `rv(W, mobileWeb, tablet, desktop, native)` | Responsive helper — W from `useWindowDimensions()`, NEVER module-level |
| `Platform.OS === 'web'` | NOT `typeof window !== 'undefined'` — Hermes trap on iOS/Android |
| `pointerEvents` | As style prop NOT JSX prop (New Arch compat) |
| No `entering=` in Modal | Old Arch crash: `Animated.View` with `entering={FadeIn}` inside Modal freezes iOS |
| `credentialsSource: remote` | In eas.json — no local .mobileprovision needed on CI |
| Pre-calculate during countdown | `setTimeout` in game.tsx computes results in background → zero-wait navigation |
| `newArchEnabled: false` | SDK 55 compat — New Architecture breaks too many libs |
| `getSupabase()` | NOT `import { supabase }` — lazy singleton getter in utils/supabase.ts |
| `output: "single"` | In app.json web config — SPA mode for Vercel, never "static" |
| `extra.buildNumber` | VersionBadge reads from here (works on web), fallback to ios.buildNumber |
| `Constants.expoConfig.extra` | Source for Supabase URL/key in Expo managed workflow (not process.env) |

---

## 8. SUPABASE TABLES (all RLS enabled)

| Table | Rows (approx) | Purpose |
|-------|--------------|---------|
| leaderboard | 17 | Global scores |
| user_profiles | — | OAuth user data |
| sit_and_go_sessions | — | SNG game state |
| sit_and_go_players | — | SNG participants |
| tournaments | — | Tournament data |
| learning_events | — | SecretSauce analytics |
| whatsapp_sessions | 16+ | Bot conversation state |
| error_logs | — | JS errors from client |
| bug_reports | 62+ | BugReporter submissions |

---

## 9. WHATSAPP BOT

**Edge Function:** whatsapp-bot-handler (v15, verify_jwt=false)

**Multi-project routing (8 repos):**
caps-poker, wingman, keydrop, analyzer, explainit, postpilot, ftable, letsmakebillions

**Features:**
- Hebrew AI responses (Claude Sonnet)
- Image analysis (Claude Vision)
- Audio transcription (OpenAI Whisper)
- Approval flow (אישור/ביטול)
- Auto GitHub dispatch → EAS build → TestFlight
- Auto Vercel deploy after fix
- Completion WhatsApp notification

**Secrets set on Supabase:**
ANTHROPIC_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, GITHUB_TOKEN, OPENAI_API_KEY ✅

**Secrets set on GitHub:**
ANTHROPIC_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID ✅

**ONLY MISSING:** Twilio Console webhook URL (manual 30s step):
→ Twilio Console → Sandbox → "WHEN A MESSAGE COMES IN" → paste webhook URL

---

## 10. VISUAL THEME SYSTEM (b104)

**Type:** `VisualTheme = 'classic' | 'fiveo'`

**Usage:**
```typescript
import { getTheme } from '../constants/visualThemes';
const visualTheme = useGameStore((s) => s.visualTheme);
const theme = getTheme(visualTheme); // null-safe, falls back to classic
```

**Token categories:** background, surface, boardBg, boardBorder, textPrimary/Secondary/Muted, accent, accentText, cardFace, cardBorder, cardShadow, primaryBtn, primaryBtnText, primaryBtnRadius, winColor, loseColor

**Classic:** dark black bg, deep brown felt, gold accent, white cards
**Five-O:** navy bg, dark red felt, yellow accent, off-white cards, less-rounded buttons

**First-launch flow:** theme-pick → orientation-pick → home (both null-gated in _layout.tsx)

---

## 11. PERFORMANCE

| Metric | Value |
|--------|-------|
| Hand evaluation speed | ~2.1ms/hand (500 hands × 2 players) |
| Pre-calc timing | During 3s countdown — zero-wait navigation to results |
| Web bundle | 2.6MB main + 207KB chunk + 2×14KB chunks |
| Tests | 115/115, ~32s total |
| TypeScript | 0 errors strict mode |

---

## 12. CURRENT STATUS

| Stage | Status |
|-------|--------|
| 1. Concept | ✅ Done |
| 2. Research | ✅ Done |
| 3. Architecture | ✅ Done |
| 4. Setup | ✅ Done |
| 5. Development | ✅ Done |
| 6. Content & Assets | ✅ Done |
| 7. Launch Prep | ✅ Done |
| 8. Live & Optimization | 🔄 In Progress |

**Health:** 92/100 | **Build:** #104 | **Tests:** 115/115

**Pending (all non-blocking):**
1. Set Twilio webhook URL in Console (30s manual step)
2. Enable Google OAuth in Supabase dashboard
3. Device QA: Five-O theme, landscape layout, multiplayer, WhatsApp audio
4. LemonSqueezy variants — publish in dashboard
5. EAS iOS build b104
