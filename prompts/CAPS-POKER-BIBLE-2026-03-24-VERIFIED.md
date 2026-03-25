# CAPS POKER — PROJECT BIBLE (VERIFIED)
**נבנה מתוך כל ההתכתבויות בפועל — לא מניחוש**
**תאריך: 24.3.2026**

---

## SECTION 1: CURRENT STATE (VERIFIED)

| Item | Value | Source |
|------|-------|--------|
| Version | v1.9.4 | Confirmed — multiple sessions |
| Build (TestFlight) | **221** | Bot report, March 24 |
| Last OTA | **b2dbf5ca** | S48 — hand name display fix |
| Tests | **2234** | Bot report post-S48 |
| TypeScript errors | **0** | Bot report post-S48 |
| Git commit | 32388a0 | Memory + bot report |
| Next sprint | **CAPS-S49** | Bible created Mar 24 |
| Web | caps.ftable.co.il | Vercel, auto-deploy on push to main |
| TestFlight link | testflight.apple.com/join/hD3KvZeC | Memory |
| Bug dashboard | caps.ftable.co.il/bugs/ | Confirmed live |

---

## SECTION 2: CREDENTIALS (VERIFIED)

### EAS / Apple
- Expo account: **royea** (royearguan@gmail.com)
- Apple Team: Roye Arguan (**3K9KJNGL9U**)
- Bundle ID: **com.capspoker.app**
- EAS Project ID: **114b97d5-5cb3-4798-9a97-8233a6a37c07**
- ASC App ID: **6760429619**

### Supabase
- Project ID: **gxrpunvhjcrzqnitbqah**
- URL: https://gxrpunvhjcrzqnitbqah.supabase.co
- Tables: leaderboard, bug_reports, whatsapp_sessions, deploy_tracker, app_config, shared_hands, deploy_log
- Credentials in: C:\Projects\Caps\.env

### Vercel
- Project ID: prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP
- Token in: C:\Projects\Caps\.env
- Auto-deploy: GitHub main branch → Vercel

### Twilio (WhatsApp Bot)
- Account: **FeatureTable** (PAID — NOT the Trial account)
- Sandbox: join **pull-total**, phone **+972526173700**
- Webhook: set manually in Twilio Console
- Edge Functions: whatsapp-bot-handler + crash-analyzer

### FTP
- User: ftableco | Pass: CPANEL_PASSWORD_REDACTED | Host: ftable.co.il / 195.225.46.105
- Caps path: /home/ftableco/public_html/caps/
- Credentials in: C:\Projects\ftable\.env

---

## SECTION 3: TECH STACK (VERIFIED)

- React Native + **Expo SDK 55** (React 19, RN 0.83)
- expo-router, Zustand persist middleware
- react-native-reanimated (with strict safety rules — see Section 5)
- react-native-gesture-handler, expo-haptics, expo-device
- react-native-tcp-socket (local MP)
- uuid, expo-dev-client
- react-dom, react-native-web (web export)
- Jest 29 + ts-jest
- EAS Build (iOS production profile)
- TypeScript strict
- expo-updates (OTA)
- Application.nativeBuildVersion (build number — NOT Constants.expoConfig)

---

## SECTION 4: IRON RULES (LOCKED FOREVER, 1-8)

1. React Native + Expo only — no bare workflow, no Capacitor
2. iOS portrait only
3. All params runtime-configurable via Settings — never hardcoded
4. Full Omaha evaluation — exactly 2 player cards + 3 board cards
5. Bot = random only (testing purposes)
6. No backend — AsyncStorage for persistence
7. Local MP via react-native-tcp-socket — LOCKED
8. Internet MP via Supabase Realtime — LOCKED

---

## SECTION 5: CRASH SAFETY RULES (LOCKED — from 14h investigation)

These were discovered after a 10+ attempt crash investigation session (March 22-23):

1. **results.tsx = ZERO react-native-reanimated** — no import, no Animated.View, nothing
2. **No withRepeat(-1) anywhere** — use finite counts (100, 20, etc.)
3. **Max 5 shared values per screen**
4. **Every animation has cleanup in useEffect return**
5. **No ConfettiCannon — EVER** (180 views unmounting mid-animation = Hermes kill)
6. **No entering= layout animation props**
7. **Cancel ALL game.tsx shared values BEFORE router.replace**

Root causes confirmed:
- InteractionManager.runAfterInteractions() deadlocking with infinite Reanimated animations
- CompleteOverlay: 40 particles × 4 shared values = 160 simultaneous worklets = Hermes watchdog kill
- ConfettiCannon 180 animated views unmounting mid-animation
- setTimeout triggering ConfettiCannon after 2350ms post-navigation

---

## SECTION 6: RESPONSIVE DESIGN RULES (LOCKED)

- Never hardcode pixel values
- Every fontSize, width, height, padding, margin, gap, borderRadius uses rv/rh/rf/rs/rb/ri
- Design for 320pt → 480pt
- GEM: utils/responsive.ts
- Test ALL widths: 320, 360, 375, 380, 384, 390, 393, 402, 412, 414, 428, 430, 432, 440, 480

---

## SECTION 7: COMPLETED FEATURES (VERIFIED FROM CONVERSATIONS)

✅ Single player vs bot
✅ Local WiFi multiplayer (react-native-tcp-socket)
✅ Internet multiplayer (Supabase Realtime)
✅ Leaderboard (Supabase)
✅ Push notifications
✅ App icon + splash
✅ Sound effects (13/15 moments)
✅ Full QA — 1,500 hands, stress test 1505/1505
✅ Hand name overlay (fixed in S48 — pre-calc timing bug)
✅ Floating chips
✅ Deal animation
✅ Timer bar
✅ Hand preview
✅ Tutorial + hints
✅ Pro Quotes + Voice clones
✅ Hand Share + Web Replay
✅ Bug dashboard (caps.ftable.co.il/bugs/)
✅ WhatsApp bot v15 (7 reply options)
✅ Responsive cards (all 15 screen widths)
✅ Premium home screen
✅ Results redesign (5 RN Animated animations, crash-safe)
✅ Debug Overlay + Auto-Sim + Dirty Shutdown Detector
✅ Screen recorder (captureScreen 2fps)
✅ VersionBadge (visible in Settings only)
✅ Duplicate cards fix (atomic state + guard)
✅ Reveal with bot cards
✅ AUTO button visible (card sizing fixed)
✅ COMPLETE overlay (SafeCompleteOverlay — static, no particles)

### ⚠️ DISCREPANCY — VERIFY ON DEVICE:
**Card flip animation (rotateY):**
- Memory says: ✅ done
- Last session Bible (March 24) said: "never started — biggest missing feel element"
- Earlier session (March 16) summary said: "flip animations" were part of MEGA-FINISH sprint
- **STATUS UNCLEAR** — bot may have regressed it or conflated it with deal animation
- **ACTION: Open app → play a hand → do cards flip (rotateY) when revealed?**

---

## SECTION 8: PENDING FEATURES (VERIFIED)

From Build 221 tracker and last Bible:

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 1 | Screenshot disk persistence | P1 | Mentioned in tracker |
| 2 | Tournament mode | P2 | Sit-and-Go |
| 3 | Chat between players | P3 | Taunting in MP |
| 4 | Video tutorial | P4 | 30 seconds onboarding |
| ? | Card flip animation | P1 | **See discrepancy above** |

---

## SECTION 9: OTA HISTORY (VERIFIED)

| # | OTA Hash | Sprint | Date | Changes |
|---|----------|--------|------|---------|
| 1-4 | various | — | Mar 22-23 | Responsive system, 10+ crash attempts, WhatsApp pipeline, tester-ready |
| 5 | 5d0d1706 | CAPS-S45 | Mar 24 | Hand evaluator verified + reveal overlay + card sizing |
| 6 | b45134ee | CAPS-S46 | Mar 24 | Duplicate cards fix (atomic state + guard) |
| 7 | 554a95ba | CAPS-S47 | Mar 24 | Results animations (5x RN Animated) + reveal with bot cards |
| **8** | **b2dbf5ca** | **CAPS-S48** | **Mar 24** | **Hand name display fix (pre-calc timing bug)** |

---

## SECTION 10: DEPLOY CHECKLIST (EVERY SPRINT)

```
D1. npx tsc --noEmit
D2. npx jest
D3. npx expo export --platform web --output-dir web-dist
D4. node scripts/fix-web-html.js
D5. cd web-dist && vercel --prod --yes
D6. eas build --platform ios --profile production --non-interactive
D7. eas submit --platform ios --profile preview --id BUILD_ID
D8. git add -A && git commit
D9. Update MEMORY.md
```

---

## SECTION 11: VAMOS WORKFLOW

```
VAMOS CAPS [NAME-S##]
...tasks...
VAMOS CAPS [NAME-S##] — END
```

Every VAMOS prompt MUST include:
1. BEFORE AUDIT (read-only state report — git log, eas build:list, test count)
2. Task list
3. AFTER AUDIT (what changed, OTA hash if deployed)
4. Build number from: `eas build:list --platform ios --limit 1`

**Standing Orders (always in prompt):**
- Try ALL actions autonomously first
- Check C:/Projects/ for any credentials needed
- Only escalate ONE specific question if truly blocked
- Never give the user a list of commands to run
- Yes, allow all edits in components/ during this session

---

## SECTION 12: BUILD TRACKING RULE

**Every session opens with:**
📍 Build [N] (v[X]) | OTA: [hash] | Tests: [N] | Last: [what was done]

**EAS auto-increment** updates buildNumber in cloud only — local app.json stays stale.
- NEVER read buildNumber from Constants.expoConfig (reads OTA/local app.json)
- ALWAYS use Application.nativeBuildVersion (reads native binary)

---

## SECTION 13: GAME RULES (VERIFIED)

- **2 players:** 4 boards, 16 cards each
- **3 players:** 3 boards, 12 cards each
- **4 players:** 2 boards, 8 cards each
- Each board: 3 community cards OPEN (flop) + 2 CLOSED (turn+river) — dealt automatically
- Each player places 4 cards per board — all in use
- Evaluation: Omaha — choose 2 of 4 player cards + 3 of 5 community cards
- COMPLETE bonus: win all boards → +50% of total pot from opponent
- UI: tap-to-select + tap-to-place — NO drag

---

## SECTION 14: FILE STRUCTURE (VERIFIED)

```
C:\Projects\Caps\
├── app/
│   ├── _layout.tsx, index.tsx, game.tsx, summary.tsx
│   ├── settings.tsx, simulate.tsx
│   └── lobby/ (_layout.tsx, host.tsx, join.tsx)
│   └── multiplayer-game.tsx
├── components/
│   ├── Card.tsx, Board.tsx, PlayerHand.tsx
│   ├── ChipsDisplay.tsx, CompleteOverlay.tsx
├── hooks/
│   ├── useGameTimer.ts, useRevealSequence.ts
├── types/gameTypes.ts
├── utils/
│   ├── deck.ts, handEvaluator.ts, gameLogic.ts
│   ├── simulate.ts, gameServer.ts, gameClient.ts
│   ├── roomCode.ts, responsive.ts
│   └── __tests__/ (handEvaluator, simulate, gameLogic)
├── constants/gameConfig.ts, theme.ts, networkConfig.ts
├── store/gameStore.ts
├── scripts/fix-web-html.js
├── MEMORY.md
└── web-dist/ (Expo Web export → Vercel)
```

---

## SECTION 15: WORKFLOW RULES (CLAUDE → BOT TRIANGLE)

- Roye speaks Hebrew → Claude writes VAMOS prompts in English → Bot executes
- AUDIT AFTER EVERY BOT DELIVERY: cross-check every item vs what was requested
- If bot says "DONE" or "pre-existing" — verify, don't trust
- Never give Roye a to-do list or ask him to run commands
- Sequences: numbered list, each step on its own line (NO arrows or inline)
- Everything automated — no expiring tokens, no manual steps
- Sprint counter: CAPS-S47, CAPS-S48, **next: CAPS-S49**

---

## ⚠️ ONE THING TO VERIFY BEFORE NEXT SPRINT

**שחק יד אחת על האייפון ותבדוק:**
1. כשהקלפים נחשפים — יש אנימציית flip (rotateY)? כן/לא
2. שמות הידיים מופיעים נכון? (Two Pair, Flush, Three of a Kind — לא "High Card" על הכל)

זה קובע מה S49 יהיה.
