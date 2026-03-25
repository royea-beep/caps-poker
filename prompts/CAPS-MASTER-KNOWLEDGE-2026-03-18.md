# CAPS POKER — Master Knowledge File
*Generated: 2026-03-18 | For Claude + Claude Bot continuity*

---

## 1. PROJECT STATE

| Key | Value |
|-----|-------|
| Version | 1.9.2 |
| Build | #71 (TestFlight) |
| Tests | 115/115 |
| Web | caps.ftable.co.il (Vercel) |
| Repo | github.com/royea-beep/caps-poker |
| Stack | React Native + Expo SDK 55 |
| New Architecture | **DISABLED** (`newArchEnabled: false`) |

---

## 2. IRON RULES (LOCKED — NEVER CHANGE)

1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation (best 2 of 4 cards, selected at evaluation not pre-assigned)
5. Bot = random only
6. No backend for single-player
7. Local multiplayer via react-native-tcp-socket
8. Internet multiplayer via Supabase Realtime (Phase 2)

---

## 3. GAME RULES

- 2 players = 4 boards, 16 cards each
- 3 players = 3 boards, 12 cards each
- 4 players = 2 boards, 8 cards each
- Each board: 3 flop (open) + 2 turn/river (closed, auto-dealt)
- Player places exactly 4 cards per board
- All 4 used in Omaha evaluation
- UI: tap-to-select → tap-to-place (no drag)

---

## 4. CREDENTIALS & INFRASTRUCTURE

```
Expo account: royea / royearguan@gmail.com
Apple Team ID: 3K9KJNGL9U
Bundle ID: com.capspoker.app
Expo Project ID: 114b97d5-5cb3-4798-9a97-8233a6a37c07
Vercel Project: prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP
GitHub: royea-beep/caps-poker
Supabase: see .env in C:/Projects/Caps/
cPanel: ftable.co.il:2083 (NOT used for caps — see deploy section)
```

---

## 5. DEPLOY — CRITICAL

### Web (caps.ftable.co.il)
```bash
npx expo export --platform web          # outputs to dist/
node scripts/fix-web-html.js            # patches dist/
cd dist && vercel --prod --yes          # deploys to Vercel
```
**⚠️ NEVER use FTP for caps.ftable.co.il**
DNS points to Vercel (76.76.21.21), not cPanel. FTP goes to wrong server.

### iOS (TestFlight)
```bash
git push origin main   # GitHub Actions CI auto-builds + submits
```

### Scripts
- `scripts/cert_from_cer.py` — build p12 from .cer + update GitHub Secrets
- `scripts/update_profile_secret.py` — encode .mobileprovision + update GitHub Secret
- `scripts/fix-web-html.js` — patch dist/index.html for Vercel

---

## 6. CARD DESIGN (5-0 Poker Clone — FINAL)

```
Face: #FFFFFF (pure white)
Border: 1px rgba(0,0,0,0.15), borderRadius 8
Layout:
  - Top-left corner: small rank (14%) + suit (11%)
  - CENTER: large rank (42%) + suit below (32%) ← MAIN DISPLAY
  - NO bottom-right corner
Hearts/Diamonds: #E8192C (bright red)
Spades/Clubs: #000000 (pure black)
Back: #0f1a3e navy, 1.5px gold border, faint ♦ 30% opacity
Shadow iOS: offset{2,3} opacity 0.4 radius 6
Shadow web: boxShadow 2px 3px 10px rgba(0,0,0,0.45)
Highlight: gold border 2.5px + glow + translateY -6
Sizes: normal 58×82, small 52×74
```

---

## 7. BOARD DESIGN

```
Background: #6B0000 (deep red felt)
Border: #8B0000
Active board border: #c9a84c (gold)
Board card height: 82px web / 56-82 native
```

---

## 8. CRASH HISTORY — ALL iOS CRASHES FOUND & FIXED

| # | Crash | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | App crashes on launch | BugReporter.tsx static import expo-haptics | Lazy require() |
| 2 | Crash on iOS New Arch | pointerEvents as JSX prop | Move to style.pointerEvents |
| 3 | setState after unmount | setInterval tick after clearInterval | mountedRef.current guard |
| 4 | Reveal undefined arrays | RevealBoardData fields not guarded | ?? [] on all fields |
| 5 | Crash on open | window.addEventListener on iOS | Platform.OS === 'web' guard |
| 6 | Stuck at BOTS READY | navigateToReveal in useEffect deps | navigateToRevealRef pattern |
| 7 | Reveal freeze | entering={FadeIn} in Modal | Replace with useSharedValue |
| 8 | New Architecture | SDK55 defaults to New Arch ON | newArchEnabled: false |

---

## 9. PLATFORM GOTCHAS — iOS / React Native

```typescript
// ❌ WRONG — window is defined in Hermes but has no DOM methods
if (typeof window !== 'undefined') {
  window.addEventListener('error', handler); // CRASH: undefined is not a function
}

// ✅ CORRECT
if (Platform.OS === 'web') {
  window.addEventListener('error', handler);
}

// ❌ WRONG — New Architecture rejects this
<View pointerEvents="none">

// ✅ CORRECT
<View style={{ pointerEvents: 'none' }}>

// ❌ WRONG — Reanimated entering prop in Modal crashes Old Arch
<Animated.View entering={FadeIn}>

// ✅ CORRECT — use useSharedValue + withTiming
const opacity = useSharedValue(0);
useEffect(() => { opacity.value = withTiming(1); }, []);
```

---

## 10. VAMOS METHODOLOGY

### What is VAMOS
Multi-agent parallel development system. Multiple Claude Bot agents run simultaneously on different tasks, finishing in the same time as one agent on one task.

### Prompt File Naming
```
vamos-caps-[task-name]-YYYY-MM-DD-HHMM.md
Example: vamos-caps-ios-crash-fix-2026-03-18-1100.md
```

### Standing Orders (always include)
```
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.
```

### Minimum 5 agents for sprint, each with:
- Clear TASK label
- Specific files to read
- Specific output expected
- No ambiguity

### Communication Pattern
- User speaks Hebrew with Claude (this assistant)
- Claude writes prompts in English for Claude Bot
- Claude Bot does all code changes autonomously
- User only copies prompt file to Claude Bot

### Sprint Structure
```
VAMOS CAPS [SPRINT-NAME]
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## TASK A — [name]
Agent: [agent-name]
A1. Read [files]
A2. Do [specific thing]
A3. Expected output

## TASK B — [name]
...

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "..."
7. git push origin main
8. Update MEMORY.md
9. Report table

VAMOS CAPS [SPRINT-NAME] — END
```

---

## 11. USEFUL SCRIPTS & UTILITIES

### cert_from_cer.py
Builds p12 from downloaded .cer + updates GitHub Secrets
```bash
py -3.11 scripts/cert_from_cer.py C:/Users/royea/Downloads/distribution.cer
```

### update_profile_secret.py
Encodes .mobileprovision + updates GitHub Secret
```bash
py -3.11 scripts/update_profile_secret.py path/to/profile.mobileprovision
```

### fix-web-html.js
Patches dist/index.html for Vercel:
- Adds type="module" to script tag
- Writes vercel.json with SPA rewrites
- Writes .vercel/project.json

### PowerShell DNS fix (if DNS not resolving)
```powershell
# Run as Administrator — hidden Unicode chars in interface names
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Set-DnsClientServerAddress -ServerAddresses 8.8.8.8
```

### Force fresh Vercel deploy (cache bust)
Add a comment change to any component, then redeploy.

---

## 12. KEY LEARNINGS

1. **Hermes ≠ Browser** — `typeof window !== 'undefined'` is NOT a safe Platform check in RN
2. **New Architecture** — SDK 55 defaults ON but breaks many libs — disable with `newArchEnabled: false`
3. **Vercel vs FTP** — caps.ftable.co.il → Vercel, other ftable.co.il subdomains → cPanel FTP
4. **useEffect deps** — functions from store/props in dep array = re-fire on reference change → use refs
5. **Reanimated in Modal** — `entering={}` prop crashes Old Arch — use `useSharedValue` instead
6. **Certificate is team-wide** — one Distribution cert covers all apps in the same Apple Team ID
7. **p12 private key** — if cert was created with 9Soccer's CSR, use 9Soccer's private.key for Caps too

---

## 13. FILE STRUCTURE

```
C:/Projects/Caps/
├── app/
│   ├── _layout.tsx          ← ErrorBoundary, global error handler (web only!)
│   ├── index.tsx            ← Home screen (red/gold theme)
│   ├── game.tsx             ← Main game (boards, cards, READY flow)
│   ├── results.tsx          ← Reveal sequence container
│   └── gameover.tsx, settings.tsx, leaderboard.tsx, tournament.tsx...
├── components/
│   ├── Card.tsx             ← 5-0 Poker style cards
│   ├── Board.tsx            ← Red felt boards (#6B0000)
│   ├── PlayerHand.tsx       ← Hand cards (web: 64-80px, native: 46-58px)
│   └── RevealSequence.tsx   ← Full-screen reveal per board
├── hooks/
│   ├── useGameTimer.ts
│   └── useRevealSequence.ts
├── utils/
│   ├── gameLogic.ts
│   ├── handEvaluator.ts
│   └── __tests__/crash_audit.test.ts  ← 8000-game stress test
├── constants/
│   ├── theme.ts             ← COLORS (boardBg: #6B0000, felt: #6B0000)
│   └── gameConfig.ts
├── scripts/
│   ├── cert_from_cer.py
│   ├── update_profile_secret.py
│   └── fix-web-html.js
├── certs/
│   ├── private.key          ← From 9Soccer project
│   └── distribution.p12
└── app.json                 ← newArchEnabled: false ← CRITICAL
```

---

## 14. OPEN ITEMS

| Priority | Item | Status |
|----------|------|--------|
| 🔴 HIGH | iOS reveal flow — test build #71 | Awaiting TestFlight |
| 🟡 MED | Web 2x2 grid layout | Fixed in code, verify |
| 🟡 MED | App icon | Still placeholder |
| 🟢 LOW | Cancel Expo Additional Concurrency | expo.dev/accounts/royea/settings/billing |
| 🟢 LOW | Supabase multiplayer (Phase 2) | Not started |

---

*End of Master Knowledge File*
