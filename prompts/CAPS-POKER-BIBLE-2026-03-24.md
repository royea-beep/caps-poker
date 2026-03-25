# CAPS POKER — THE BIBLE
**Date:** 2026-03-24 | **Build:** 221 (v1.9.4) | **OTA:** b2dbf5ca
**Sessions:** 4 | **Sprints:** 48 | **Tests:** 2,234

---

## THE TRUTH — What's Actually Happening on the Phone

**User verdict: "גועל נפש של משחק"**

The evaluator works. The tests pass. But the GAME EXPERIENCE is broken.
This BIBLE exists because we kept shipping features without playing 20 hands first.

---

## SECTION 1: EVERY FEATURE — REQUESTED vs REALITY

### 🎮 CORE GAME MECHANICS

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 1 | Omaha evaluation (2+3) | Session 1 | ✅ DONE | 9/10 | Evaluator correct. 500-hand test proved it. |
| 2 | Tap-to-place (no drag) | Iron Rule | ✅ DONE | 7/10 | Works. WSOP sim rated 7.4. |
| 3 | Timer + auto-fill | Original | ✅ DONE | 7/10 | Timer bar works. Auto-fill on expiry. |
| 4 | Bot = random | Iron Rule | ✅ DONE | 10/10 | Correct — testing only. |
| 5 | COMPLETE bonus 50% | Original | ✅ DONE | 8/10 | Mechanic works. Celebration could be bigger. |
| 6 | Duplicate cards bug | Session 4 | ✅ FIXED S46 | 10/10 | Two-layer guard — pre-filter + updater. |
| 7 | Hand name display | Session 4 | ✅ FIXED S48 | 🔴 UNVERIFIED | Fix deployed via OTA. User hasn't confirmed. |

### 👁️ REVEAL SEQUENCE (the moment of truth)

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 8 | Solid dark background | Session 1 | ✅ DONE | 8/10 | #080d16 solid. |
| 9 | One board at a time | Session 1 | ✅ DONE | 8/10 | Sequential reveal. |
| 10 | All 5 community cards | Session 1 | ✅ DONE | 8/10 | Face up. |
| 11 | Player 4 cards shown | Session 1 | ✅ DONE | 8/10 | Labeled "YOUR HAND". |
| 12 | **Bot cards shown** | Session 1 | ✅ DONE S47 | 8/10 | Was missing — added. |
| 13 | **Hand names (both)** | Session 1 | ✅ DONE S47 | 🔴 BROKEN→FIXED S48 | Was showing "High Card" always. Pre-calc timing bug. |
| 14 | WIN/LOSE/TIE big text | Session 1 | ✅ DONE | 7/10 | Green/red, fontSize 28. |
| 15 | Chip delta (+150/-100) | Session 1 | ✅ DONE S47 | 8/10 | Green/red. |
| 16 | Auto-advance 2s | Session 1 | ✅ DONE | 8/10 | Was 1.5s, changed to 2s. |
| 17 | Tap to advance | Session 1 | ✅ DONE | 8/10 | Works. |
| 18 | SKIP button | Session 1 | ✅ DONE | 7/10 | Top right. |
| 19 | "Calculating..." hidden | Session 1 | ✅ DONE | 8/10 | Hidden during reveal. |

### 📊 RESULTS SCREEN

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 20 | Board stagger fade-in | Session 4 | ✅ DONE S47 | 🔴 UNVERIFIED | RN Animated, 200ms apart. |
| 21 | Chip count roll-up | Session 4 | ✅ DONE S47 | 🔴 UNVERIFIED | 800ms counting animation. |
| 22 | Win boards glow green | Session 4 | ✅ DONE S47 | 🔴 UNVERIFIED | Green border pulse. |
| 23 | COMPLETE banner spring | Session 4 | ✅ DONE S47 | 🔴 UNVERIFIED | Spring scale. |
| 24 | DEAL ME IN fade-in | Session 4 | ✅ DONE S47 | 🔴 UNVERIFIED | Fade + scale after delay. |
| 25 | Results redesign | Session 2 | ✅ DONE | 6/10 | Board-by-board with LOSS/WIN badges. |
| 26 | Bot cards on results | Session 2 screenshots show YES | ✅ DONE | 7/10 | Gold border on bot cards. |

### 🃏 CARD VISUALS

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 27 | Card readability (P0) | Session 1 WSOP 5.6/10 | ✅ DONE | 6/10 | White bg, bold rank, suit glow. Better but WSOP target was 8.0. |
| 28 | Board color borders | Session 1 | ✅ DONE | 7/10 | Gold/blue/green/orange. |
| 29 | Hand cards 1.3x bigger | Session 1 | ✅ DONE | 6/10 | Bigger but still cramped on 4-board. |
| 30 | **Responsive card sizing** | Session 3 | ✅ DONE | 7/10 | Universal responsive system (rv/rh/rf). GEM. |
| 31 | Card flip animation | Handoff doc | ❌ NOT DONE | — | rotateY flip. Never started. |
| 32 | Deal animation | Memory says ✅ | ✅ DONE | 🔴 UNVERIFIED | Cards dealing out animation. |

### 🏠 HOME SCREEN

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 33 | Premium home screen | Session 2 | ✅ DONE | 7/10 | Redesigned. |
| 34 | Pro quotes rotating | Session 1 | ✅ DONE | 7/10 | With "🤖 AI Simulation" disclaimer. |
| 35 | HOW TO PLAY button | Session 1 | ✅ DONE | 7/10 | Opens tutorial. |
| 36 | HAND HISTORY link | Session 1 | ✅ DONE | 6/10 | Was "HISTORY" — fixed to "HAND HISTORY". |
| 37 | App icon + splash | Memory says ✅ | ✅ DONE | 🔴 UNVERIFIED | — |

### 📖 ONBOARDING

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 38 | 4-step tutorial | Session 1 WSOP 4.8/10 | ✅ DONE | 6/10 | First launch overlay. Target was 7.5. |
| 39 | In-game hints (3 games) | Session 1 | ✅ DONE | 6/10 | AsyncStorage counter, disappears after 3. |
| 40 | Settings: show tutorial | Session 1 | ✅ DONE | 7/10 | Reset button. |

### 🔊 SOUND & HAPTICS

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 41 | Sound system (7 sounds) | Session 1 | ✅ DONE | 7/10 | cardPlace, cardSelect, cardFlip, chipsWin, lose, complete, timerLow. |
| 42 | playsInSilentModeIOS | Session 1 | ✅ FIXED | 10/10 | Root cause was missing Audio.setAudioModeAsync. |
| 43 | Sound ON by default | Session 1 | ✅ DONE | 8/10 | gameConfig.ts soundEnabled=true. |
| 44 | Haptic on card place | Original | ✅ DONE | 7/10 | expo-haptics. |
| 45 | Haptic on COMPLETE | Session 1 | ✅ DONE | 6/10 | 3 haptic pulses synced with gold pulse. |
| 46 | 13/15 sound moments | Memory | ✅ DONE | 7/10 | 2 missing (timer warning escalation, deal shuffle). |
| 47 | ElevenLabs voice clones | Session 1 | ✅ DONE | 6/10 | 10 voices cloned, 20 clips generated. Kill switch via Supabase. |

### 🌐 MULTIPLAYER

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 48 | Local WiFi (tcp-socket) | Iron Rule 7 | ✅ DONE | 🔴 UNVERIFIED | Never tested on 2 real devices. |
| 49 | Internet (Supabase RT) | Iron Rule 8 | ✅ DONE | 🔴 UNVERIFIED | Room codes, Google OAuth. |
| 50 | Leaderboard | Memory | ✅ DONE | 🔴 UNVERIFIED | Supabase table. |
| 51 | Push notifications | Memory | ✅ DONE | 🔴 UNVERIFIED | — |

### 🛠️ INFRASTRUCTURE

| # | Feature | Requested | Status | Real Score | Notes |
|---|---------|-----------|--------|------------|-------|
| 52 | WhatsApp crash alerts | Session 3 | ✅ DONE | 8/10 | FeatureTable Twilio, 7 reply options. |
| 53 | Bug dashboard | Session 2 | ✅ DONE | 7/10 | caps.ftable.co.il/bugs/ |
| 54 | Debug overlay | Session 3 | ✅ DONE | 8/10 | RAM, FPS, shared values counter. |
| 55 | Auto-sim (debug) | Session 3 | ✅ DONE | 8/10 | 3-10 hand marathon. |
| 56 | Dirty shutdown detector | Session 3 | ✅ DONE | 8/10 | Detects crash between launches. |
| 57 | Screen recorder (2fps) | Session 3 | ⚠️ PARTIAL | 5/10 | RAM only — disk persistence NOT done. |
| 58 | Vercel auto-deploy | Session 3 | ✅ DONE | 9/10 | Native GitHub integration, no tokens. |
| 59 | TestFlight public link | Session 3 | ✅ DONE | 9/10 | testflight.apple.com/join/hD3KvZeC |
| 60 | Web export | Original | ✅ DONE | 7/10 | caps.ftable.co.il — Vercel. |
| 61 | OTA updates (expo-updates) | Session 3 | ✅ DONE | 9/10 | 8 OTAs this session alone. |

### ❌ NOT STARTED — PENDING

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 62 | Screenshot disk persistence | HIGH | RAM screenshots → FileSystem.documentDirectory. Crash forensics need this. |
| 63 | Tournament mode | MEDIUM | Brackets, elimination, prizes. |
| 64 | Chat between players | MEDIUM | Emoji reactions + text. |
| 65 | Video tutorial | LOW | 30s animated explainer. |
| 66 | Card flip animation (rotateY) | LOW | Visual polish. |
| 67 | Floating "+chips" text | LOW | After reveal, chips fly to winner. |
| 68 | Matchmaking (ELO) | FUTURE | Random opponent matching. |
| 69 | Analytics dashboard (DAU) | FUTURE | Retention, hands per session. |

---

## SECTION 2: CRITICAL BUGS FOUND & FIXED

| # | Bug | Found | Session | Status | Root Cause |
|---|-----|-------|---------|--------|------------|
| 1 | App crashes on results | User | Session 3 | ✅ FIXED | 5 root causes: Reanimated on results, withRepeat(-1), entering= props, ConfettiCannon, shared value leak. 14-hour investigation. |
| 2 | Cards too small | WSOP sim 5.6/10 | Session 1 | ✅ FIXED | Responsive system added. Still not perfect on 4-board. |
| 3 | No sound at all | User | Session 1 | ✅ FIXED | Missing playsInSilentModeIOS: true. |
| 4 | Spades/clubs invisible | Sprint 11 | Session 1 | ✅ FIXED | COLORS.black was '#f0f0e8' (card background). |
| 5 | Duplicate cards on boards | User | Session 4 | ✅ FIXED S46 | Missing cross-board guard. |
| 6 | Hand names all "High Card" | User screenshots | Session 4 | ✅ FIXED S48 | Pre-calc fires before player places cards. |
| 7 | Build number mismatch | User | Session 3 | ✅ FIXED | EAS auto-increment in cloud only. Use Application.nativeBuildVersion. |
| 8 | HAND HISTORY replaced | Bot bug | Session 1 | ✅ FIXED | Bot replaced with HOW TO PLAY. Both restored. |

---

## SECTION 3: WHAT THE USER ACTUALLY SEES (HONEST ASSESSMENT)

**The user opens CAPS on their iPhone (Build 221, OTA b2dbf5ca):**

1. **Home screen** — looks decent. Pro quotes rotate. Buttons work. 7/10
2. **Starts game** — gets 16 cards, sees 4 boards. Cards are readable but cramped. 6/10
3. **Places cards** — tap works. But no flip animation, just appear. 5/10
4. **Presses READY** — bot places instantly. Timer stops. 7/10
5. **Reveal** — solid dark overlay, one board at a time, bot cards shown, hand names shown (AFTER S48 fix). 7/10
6. **Results** — boards stagger in, chips roll up, wins glow green (AFTER S47). 7/10
7. **Hand names** — WERE all "High Card" → SHOULD BE FIXED by S48 OTA. 🔴 NEEDS VERIFICATION
8. **Overall feel** — functional but **not polished enough for real users**. Missing: flip animations, deal animations visible, smooth transitions, "wow" moments beyond COMPLETE.

**Overall game experience: 6/10** — functional but not delightful.

---

## SECTION 4: THE PLAN — WHAT TO DO NEXT

### PHASE 1: VERIFY & POLISH (This week — before ANY testers)

**Step 1: User plays 20 hands RIGHT NOW and reports what they see.**
The S48 OTA (hand name fix) is live. Need confirmation it works.

**Step 2: CAPS-S49 — Visual polish sprint based on user feedback:**
- Whatever bugs/issues user finds in those 20 hands
- Card flip animation (rotateY) — the biggest missing "feel" element
- Deal animation (cards spreading to boards)
- Smoother transitions between phases

**Step 3: CAPS-S50 — Sound completeness:**
- Timer warning sound escalation (missing)
- Deal shuffle sound (missing)
- Verify all 15 sound moments play correctly on real device

### PHASE 2: TESTER-READY (Next week)

**Step 4: Share with 5-10 friends via TestFlight**
- TestFlight link already public: testflight.apple.com/join/hD3KvZeC
- Collect feedback for 3-5 days
- Bug dashboard already live at caps.ftable.co.il/bugs/

**Step 5: Fix tester feedback — probably 2-3 sprints**

### PHASE 3: GROWTH (After testers approve)

**Step 6: Tournament mode**
**Step 7: Chat between players**
**Step 8: Matchmaking (ELO)**
**Step 9: App Store submission**

---

## SECTION 5: IRON RULES (NEVER CHANGE)

1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable via Settings
4. Full Omaha evaluation (2 player + 3 board cards)
5. Bot = random only
6. No backend — AsyncStorage
7. Local MP via react-native-tcp-socket
8. Internet MP via Supabase Realtime

### CRASH SAFETY RULES (from 14-hour investigation):
1. results.tsx = ZERO react-native-reanimated
2. No withRepeat(-1) anywhere
3. Max 5 shared values per screen
4. Every animation has cleanup in useEffect return
5. No ConfettiCannon — EVER
6. No entering= layout animation props
7. Cancel ALL game.tsx shared values BEFORE router.replace

### RESPONSIVE DESIGN:
- Never hardcode pixel values
- Every dimension uses rv/rh/rf/rs/rb/ri
- Design for 320pt → 480pt
- GEM: utils/responsive.ts

---

## SECTION 6: OTA HISTORY

| # | OTA Hash | Sprint | Date | Changes |
|---|----------|--------|------|---------|
| 1 | (binary) | — | Mar 22 | Universal responsive system |
| 2 | (multiple) | — | Mar 22-23 | 10+ crash fix attempts |
| 3 | (OTA) | — | Mar 23 | WhatsApp crash pipeline |
| 4 | (OTA) | — | Mar 23 | Tester-ready build |
| 5 | 5d0d1706 | CAPS-S45 | Mar 24 | Evaluator verified + reveal + card sizing |
| 6 | b45134ee | CAPS-S46 | Mar 24 | Duplicate cards fix |
| 7 | 554a95ba | CAPS-S47 | Mar 24 | Results animations + reveal with bot cards |
| 8 | b2dbf5ca | CAPS-S48 | Mar 24 | Hand name display fix |

---

## SECTION 7: SPRINT COUNTER

Next sprint: **CAPS-S49**

Every VAMOS prompt MUST include:
1. BEFORE AUDIT (read-only state report)
2. Changes
3. AFTER AUDIT (what changed)
4. OTA changelog entry
5. Build number from `eas build:list`

---

## BOTTOM LINE

**50 features done. 7 pending. 8 critical bugs fixed.**

The game WORKS. But "works" ≠ "feels good to play."

**The gap is POLISH — not features.** Card animations, transition smoothness, visual feedback, sound completeness. These small things are the difference between "גועל נפש" and "כיף לשחק."

**Next step: User plays 20 hands → reports → we fix exactly what's broken.**
