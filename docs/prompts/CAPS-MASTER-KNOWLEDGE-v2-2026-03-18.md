# CAPS POKER — Master Knowledge File v2
*Updated: 2026-03-18 | Full session summary*

---

## 1. PROJECT STATE

| Key | Value |
|-----|-------|
| Version | 1.9.3 |
| Build | #88 (TestFlight) |
| Tests | 115/115 |
| Web | caps.ftable.co.il (Vercel) |
| Repo | github.com/royea-beep/caps-poker |
| Stack | React Native + Expo SDK 55 |
| New Architecture | **DISABLED** (`newArchEnabled: false`) |
| Last commit | a9f90b1 — rotating tagline |

---

## 2. IRON RULES (LOCKED)

1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation (best 2 of 4, selected at evaluation)
5. Bot = random only
6. No backend for single-player
7. Local multiplayer via react-native-tcp-socket
8. Internet multiplayer via Supabase Realtime (Phase 2)

---

## 3. DEPLOY — CRITICAL

```bash
# Web (ALWAYS Vercel, NEVER FTP)
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes

# iOS (auto via CI)
git push origin main  # triggers GitHub Actions → EAS → TestFlight
```

**NEVER use FTP for caps.ftable.co.il** — DNS points to Vercel (76.76.21.21)

---

## 4. VAMOS METHODOLOGY

### Prompt file naming
```
vamos-caps-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md
Example: vamos-caps-ios-crash-fix-v1.9.3-b85-2026-03-18-1100.md
```

### Every prompt must start with
```
## Current state: v[X.X.X] build #[NN] | commit [hash]
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.
```

### Every prompt must end with
```
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "..."
7. git push origin main
8. Update MEMORY.md
9. Report table
```

### Agent naming pattern
```
Agent: crash-hunter / reveal-fixer / home-agent / auth-agent / etc.
```

### Communication pattern
- User speaks **Hebrew** to Claude (this assistant)
- Claude writes prompts in **English** for Claude Bot
- Claude Bot does all code changes autonomously
- User only copies prompt file to Claude Bot
- Minimum 3 agents per sprint for complex tasks

---

## 5. CARD DESIGN (5-0 Poker Clone — FINAL)

```
Face: #FFFFFF pure white
Border: 1px rgba(0,0,0,0.15), borderRadius 8
Layout:
  - Top-left corner: small rank (14%) + suit (11%)
  - CENTER: large rank (42%) + suit below (32%)
  - NO bottom-right corner
Hearts/Diamonds: #E8192C
Spades/Clubs: #000000
Back: #0f1a3e navy, 1.5px gold #c9a84c border, faint ♦ 30% opacity
Normal: 58×82, Small: 52×74
```

---

## 6. BOARD DESIGN

```
Background: #6B0000 (deep red felt)
Border: #8B0000
Active board: #c9a84c gold border
```

---

## 7. HOME SCREEN

- Title: "CAPS POKER" — responsive fontSize Math.min(42, screenW*0.105)
- 10 rotating taglines (cycle on each mount, fade-in 800ms)
- 10 color themes switchable in Settings
- 3 button styles: solid / glass / outline
- Friends TV show background (sofa/logo/fountain) — web only, opacity 5-8%
- Google Sign-In button (white, below NEW HAND)

---

## 8. REVEAL SEQUENCE

- One board at a time, full screen
- Layout: TOP 40% (BOT) / MIDDLE 20% (COMMUNITY) / BOTTOM 40% (YOU)
- Bot cards: always face-up from start
- Win probability: shown from start (50/50), updates after TURN and RIVER
- TURN: 3→2→1 countdown then flip
- RIVER: smooth auto-flip 2.5s after turn (no countdown)
- BEST card: gold glow highlight on optimal card in hand
- Auto-advance: 4s after winner shown
- TAP TO CONTINUE for immediate skip

---

## 9. GAME SCREEN

- Multi-select: tap up to 4 cards → tap board → all placed at once
- Gold numbered badges (1-4) on selected cards
- AUTO button per board — fills all 4 slots instantly
- Board shake animation when full

---

## 10. GOOGLE AUTH

```typescript
// Web
supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://caps.ftable.co.il' } })

// Native
redirectUrl = Linking.createURL('auth/callback')  // caps-poker://auth/callback
```

Supabase project: gxrpunvhjcrzqnitbqah
Google OAuth: enabled (Client ID: 133353581092-dgg78...)
user_profiles table: exists with RLS

---

## 11. iOS CRASH HISTORY (ALL FIXED)

| # | Crash | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Launch crash | expo-haptics static import | Lazy require() |
| 2 | New Arch crash | pointerEvents as JSX prop | style.pointerEvents |
| 3 | setState after unmount | setInterval tick after clearInterval | mountedRef.current guard |
| 4 | Reveal undefined | RevealBoardData fields not guarded | ?? [] everywhere |
| 5 | Launch crash | window.addEventListener on iOS | Platform.OS === 'web' guard |
| 6 | Stuck at READY | navigateToReveal in useEffect deps | navigateToRevealRef pattern |
| 7 | Reveal freeze | entering={FadeIn} in Modal | useSharedValue + withTiming |
| 8 | General crashes | New Architecture ON by default | newArchEnabled: false |

---

## 12. PLATFORM GOTCHAS

```typescript
// ❌ WRONG — Hermes defines window but not DOM methods
if (typeof window !== 'undefined') {
  window.addEventListener(...)  // CRASH on iOS
}

// ✅ CORRECT
if (Platform.OS === 'web') {
  window.addEventListener(...)
}

// ❌ WRONG — New Arch rejects JSX prop
<View pointerEvents="none">

// ✅ CORRECT
<View style={{ pointerEvents: 'none' }}>

// ❌ WRONG — entering prop in Modal crashes Old Arch
<Animated.View entering={FadeIn}>

// ✅ CORRECT
const opacity = useSharedValue(0);
useEffect(() => { opacity.value = withTiming(1); }, []);

// ❌ WRONG — function reference changes on re-render
useEffect(() => { navigateToReveal(); }, [navigateToReveal]);

// ✅ CORRECT — use ref
const navigateToRevealRef = useRef(navigateToReveal);
useEffect(() => { navigateToRevealRef.current = navigateToReveal; });
useEffect(() => { if (ready) navigateToRevealRef.current(); }, [ready]);
```

---

## 13. WHATSAPP BOT — DESIGN READY

Full design at: `C:/Projects/Caps/docs/whatsapp-bot-design.md`

**Architecture:**
```
User sends WhatsApp (text/image/audio)
  → Twilio webhook → Supabase Edge Function
  → Whisper (audio) / Claude Vision (image) / direct (text)
  → Claude API → generates plan
  → WhatsApp reply: "I'll do X,Y,Z — Reply APPROVE"
  → APPROVE → GitHub repository_dispatch → Claude Bot → commit + push
  → WhatsApp: "✅ Done! Build #89 triggered"
```

**Cost:** ~$0.25/month for 10 bug reports
**Setup time:** ~3 hours (Phase 1)
**Required:** Twilio account + ANTHROPIC_API_KEY on GitHub

---

## 14. BUGREPORTER (CURRENT STATE)

- Trigger: shake phone OR tap 🐛 FAB
- Captures: screenshot (JPG), title, description, screen path, device info
- Sends to: Supabase bug_reports table
- Ping on mount: every app open sends "[ping] app opened v1.9.3"
- FAB: hidden on game screens, shown on home/settings
- Does NOT capture: audio, video, stack traces

---

## 15. CREDENTIALS

```
Expo: royea / royearguan@gmail.com
Apple Team: 3K9KJNGL9U
Bundle: com.capspoker.app
Expo Project ID: 114b97d5-5cb3-4798-9a97-8233a6a37c07
Vercel: prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP
GitHub: royea-beep/caps-poker
Supabase: gxrpunvhjcrzqnitbqah.supabase.co
```

---

## 16. OPEN ITEMS

| Priority | Item |
|----------|------|
| 🔴 HIGH | WhatsApp bot — Phase 1 implementation |
| 🟡 MED | Google OAuth on iOS — test after build #88 |
| 🟡 MED | App icon — still placeholder |
| 🟡 MED | Friends bg on native (needs react-native-svg) |
| 🟢 LOW | Cancel Expo Additional Concurrency billing |
| 🟢 LOW | Supabase multiplayer (Phase 2) |

---

## 17. WORKFLOW — HOW WE COMMUNICATE

### The pattern we developed:
1. **You describe** what you want (Hebrew, text/audio/screenshot)
2. **I analyze** → identify bugs/features → write English prompt
3. **Prompt file** named with version+build+timestamp
4. **You send** to Claude Bot (copy-paste)
5. **Bot executes** autonomously — reads MEMORY.md, fixes, deploys
6. **You test** on TestFlight/web → send screenshot
7. **I analyze** screenshot → identify next issue → repeat

### Screenshot feedback loop:
- You send screenshot → I describe what's wrong → new prompt
- Images numbered (Image 1, 2, 3) for reference in discussion

### Audio feedback:
- Bot transcribes with Whisper (already installed)
- Hebrew audio → transcript → implement changes

### Build tracking:
- Every prompt includes current version + build number
- File name includes version + build for easy reference
- Status check prompt available: `vamos-caps-status-check-...md`

---

*End of Master Knowledge File v2 | 2026-03-18*
