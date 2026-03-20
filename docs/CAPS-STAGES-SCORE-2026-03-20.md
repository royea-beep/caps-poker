# Caps Poker — Stage Scoring Report
**Date:** 2026-03-20 | **Version:** v1.9.3 | **Code:** b104 | **EAS:** #117
**Scale:** 1–20 | **Auditor:** Claude Sonnet 4.6

> **Note:** ZProjectManager defines 8 stages (not 11). All scores below are out of 20.

---

## Stage System (from types.ts)
`concept → research → architecture → setup → development → content_assets → launch_prep → live_optimization`

---

## Stage 1 — Concept (20/20) ✅

**What's done:**
- Game fully defined: Omaha poker, 4 boards, iOS + web
- Target audience clear: casual poker fans, friend groups
- Monetization model defined: free app / viral growth
- Iron Rules locked (8 rules, Rule 2 unlocked with explicit process)
- Game rules fully specified in MEMORY.md and docs
- Brand identity: "Caps Poker", gold C icon, visual themes

**What's missing:** Nothing. Concept is locked and complete.

**To reach 20/20:** Already 20/20.

---

## Stage 2 — Research (18/20) ✅

**What's done:**
- React Native + Expo chosen over Flutter/bare RN — well-reasoned (SDK 55, expo-router)
- Supabase chosen over Firebase for realtime + auth + leaderboard
- Vercel chosen for web deploy (SPA mode confirmed)
- sql.js vs better-sqlite3 evaluated (sql.js chosen for WASM compat)
- Omaha hand evaluation library evaluated (custom implemented)
- react-native-tcp-socket chosen for local multiplayer

**What's missing:**
- No formal competitive analysis document
- No research doc on App Store market positioning

**To reach 20/20:** Write competitive analysis + ASO research doc.

---

## Stage 3 — Architecture (17/20) ✅

**What's done:**
- expo-router file-based navigation
- Zustand + AsyncStorage persist for all state
- rv() responsive value helper (deviceBreakpoints.ts) — clean abstraction
- getDevice() breakpoint factory
- Visual theme system (visualThemes.ts + ThemeTokens)
- Constants.expoConfig.extra pattern for secrets
- credentialsSource: remote in eas.json
- Platform.OS === 'web' detection pattern
- navigateRef pattern for stale closures
- All architectural decisions documented in MEMORY.md

**What's missing:**
- newArchEnabled: false forced off (lib incompatibility — tech debt)
- No architecture diagram
- No formal ADR (Architecture Decision Record) document

**To reach 20/20:** Enable New Architecture when libs catch up, add ADR doc.

---

## Stage 4 — Setup & CI/CD (19/20) ✅

**What's done:**
- EAS Build configured (development/preview/production profiles)
- eas.json with credentialsSource: remote
- GitHub Actions CI (build.yml) — triggers on push
- Vercel project linked (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP)
- Supabase CLI linked (v2.75.0), 9 migrations applied
- Bundle ID registered: com.capspoker.app
- Apple Team: 3K9KJNGL9U
- All 6 GitHub secrets set
- TypeScript strict mode configured
- Jest 29 + ts-jest configured

**What's missing:**
- No automated web deploy on push (manual `vercel --prod` required)
- No EAS submit automation (manual TestFlight upload)

**To reach 20/20:** Add `vercel --prod` step to GitHub Actions on merge to main.

---

## Stage 5 — Core Development (18/20) ✅

**What's done:**
- Single player vs bot: 2/3/4 player modes ✅
- Bot: random, exists for testing ✅
- Local WiFi multiplayer (TCP socket) ✅
- Internet multiplayer (Supabase Realtime, Sprint-42) ✅
- Global leaderboard (Supabase) ✅
- Omaha hand evaluation (exactly 2 player + 3 board cards) ✅
- 4-color suit system (toggle in Settings) ✅
- RevealSequence: full drama flow (flop/turn/river, probabilities, delta, winner) ✅
- Multi-select cards (up to 4), AUTO button ✅
- Orientation picker (portrait/landscape) ✅
- Visual themes Classic/Five-O ✅
- 10 home themes ✅
- WhatsApp bot (Hebrew, image, audio/Whisper) ✅
- Bug reporter (shake + FAB → Supabase) ✅
- Sound effects (7 WAV files wired) ✅
- Push notifications infrastructure ✅
- Google OAuth (web-ready, native pending Google provider) ✅
- 115/115 tests passing ✅

**What's missing:**
- Device QA not done on Five-O theme + landscape layout (new features)
- WhatsApp audio transcription not E2E tested on real device
- Sit & Go / Tournament modes exist in nav but untested

**To reach 20/20:** Full device QA pass on all new features.

---

## Stage 6 — Content & Assets (15/20) ✅

**What's done:**
- App icon 1024×1024 gold C (generated via Pillow) ✅
- Adaptive icon for Android ✅
- Splash screen ✅
- 7 sound effects (cardSelect/cardPlace/cardFlip/chipsWin/lose/complete/timerLow) ✅
- 6 App Store screenshots at 1290×2796 ✅
- Visual themes (Classic/Five-O) with full token system ✅
- FriendsBg watermark (web-only) ✅
- Privacy policy page ✅

**What's missing:**
- No marketing video / demo video
- No App Store description copywriting (held — user paused App Store track)
- No ASO keyword research
- No social media assets

**To reach 20/20:** App Store copy + marketing video + social assets (when App Store track resumes).

---

## Stage 7 — Launch Prep (14/20) 🔄

**What's done:**
- Web live at https://caps.ftable.co.il (Vercel) ✅
- TestFlight via EAS build #117 (preview profile) ✅
- Privacy policy accessible ✅
- Bug reporter live (shake+FAB) ✅
- EAS production profile configured ✅
- Bundle ID + provisioning registered ✅

**What's missing:**
- App Store submission NOT done (user explicitly paused — "SKIP until told otherwise")
- No formal device QA checklist sign-off
- No pre-launch checklist completed
- No beta tester group defined beyond Roye
- DISTRIBUTION_P12 set on CI but not tested end-to-end on Caps repo

**To reach 20/20:** App Store submission (when track resumes) + device QA sign-off.

---

## Stage 8 — Live Optimization (13/20) 🔄

**What's done:**
- Bug reporter → Supabase bug_reports (62 rows) ✅
- learning_events table wired ✅
- Supabase whatsapp_sessions (16 rows) ✅
- WhatsApp bot Edge Function live (v12) ✅
- VersionBadge showing build number ✅
- Health score tracking in ZPM ✅
- Audit trail in docs ✅

**What's missing:**
- Twilio webhook URL not set (1 manual step remaining)
- No real user metrics / DAU / retention data (not shipped to real users yet)
- No A/B testing infrastructure
- No crash reporting beyond bug_reports
- No analytics dashboard
- WhatsApp bot not receiving real messages yet (pending Twilio step)

**To reach 20/20:** Set Twilio webhook → ship to real users → instrument analytics → iterate on data.

---

## Summary Table

| Stage | Name | Score | Status |
|-------|------|-------|--------|
| 1 | Concept | 20/20 | ✅ Perfect |
| 2 | Research | 18/20 | ✅ Done |
| 3 | Architecture | 17/20 | ✅ Done |
| 4 | Setup & CI/CD | 19/20 | ✅ Done |
| 5 | Core Development | 18/20 | ✅ Done |
| 6 | Content & Assets | 15/20 | ✅ Done |
| 7 | Launch Prep | 14/20 | 🔄 In Progress |
| 8 | Live Optimization | 13/20 | 🔄 Active |
| **TOTAL** | | **134/160** | **83.75%** |

---

## Top 3 Actions to Raise Score

1. **Set Twilio webhook URL** (30 seconds, manual) → +2 on Stage 8 → 15/20
2. **Full device QA pass** (Five-O theme, landscape, multiplayer, WhatsApp audio) → +2 on Stage 5 → 20/20
3. **Add vercel --prod to GitHub Actions** → +1 on Stage 4 → 20/20
