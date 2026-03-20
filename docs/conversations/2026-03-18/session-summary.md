# Session Log — 2026-03-18
**Build at start:** v1.9.3 | Code b81 | EAS #108
**Build at end:** b88 | EAS #110
**Commits:** ~20 | **Focus:** iOS crash fixes → UI overhaul → WhatsApp bot Phase 1

---

## What Roye reported
- App crashing on iOS after pressing READY
- Cards too small on web, layout broken on different screen sizes
- "The logo should be on one line, remove the circle"
- Bug reporter FAB position wrong
- Hand cards sizing off
- Reveal sequence freezing on iOS
- `window.addEventListener` TypeError on iOS (Hermes trap)
- Wanted Friends TV show watermark in background
- Wanted the BEST card to glow inline (not a separate floating badge)
- Requested WhatsApp bot for sending bug reports and getting auto-fixes

## What was analyzed
- Root cause of iOS crash: `pointerEvents` as JSX prop instead of style prop
- New Architecture (newArchEnabled) breaking Modal animations — disabled
- `typeof window !== 'undefined'` check firing on iOS due to Hermes's global `window`
- Reveal sequence freeze: `entering={FadeIn}` inside Modal freezes Old Arch
- BugReporter: `process.env.EXPO_PUBLIC_SUPABASE_URL` undefined at runtime → must use `Constants.expoConfig.extra`

## What was built

### Critical Crash Fixes (b81→b85)
- Fixed iOS crash: moved `pointerEvents` from JSX to style
- Disabled New Architecture (`newArchEnabled: false`) — breaks Modal animations on SDK 55
- Fixed `window.addEventListener` crash: `Platform.OS === 'web'` instead of `typeof window`
- Added error boundary + safe navigation throughout
- Fixed reveal sequence freeze (removed `entering=` inside Modal)

### Home Screen Redesign (b85→b86)
- CAPS POKER title on one line, removed circle logo
- 10 home themes (dark_gold/navy_silver/purple_neon/casino_red/emerald/rose_gold/ocean/sunset/arctic/matrix)
- ButtonStyle system (solid/glass/outline)
- Responsive layout with `rv()` helper
- Multi-select cards (up to 4), quick board fill (AUTO button)
- Reveal drama: countdown 3-2-1 + win probability bar + delta indicators
- Google Sign-In button, BugReporter FAB moved to right side

### Polish (b86→b88)
- Friends TV show subtle background watermark (web only, opacity 5–8%)
- BEST card: replaced floating mini-badge → inline gold glow border on matching card
- 10 rotating taglines on home screen (cycle in order, 800ms fade-in)
- `rv()` responsive values for all breakpoints (mobileWeb/tablet/desktop/native)
- App icon: 1024×1024 gold C poker chip (generated via Python Pillow)
- Sound audit: all 7 sounds wired (cardSelect/cardPlace/cardFlip/chipsWin/lose/complete/timerLow)
- Google OAuth verified: PKCE flow, deep link handler, correct scheme

### WhatsApp Bot Phase 1 (b89 — built end of session)
- Supabase Edge Function `whatsapp-bot-handler` deployed
- GitHub Action `claude-fix.yml` — receives WhatsApp trigger, calls Claude API, commits fix
- `whatsapp_sessions` table created in Supabase
- ANTHROPIC_API_KEY set on GitHub secrets

## Key moments in conversation
- Roye: "the logo is on two lines and has a circle, fix it"
- Roye: "I want a WhatsApp bot that I can send a voice message to and it fixes the bug"
- Decision: build full WhatsApp→Claude→GitHub→EAS pipeline
- Discovery: Twilio sandbox webhook can only be set via Console UI (API returns 404)

## Tests at end of session
- TypeScript: 0 errors
- Jest: 115/115
- Web: deployed to caps.ftable.co.il

## Still open at end of session
- WhatsApp bot: need to set Twilio webhook URL in Console (manual)
- WhatsApp bot: Hebrew responses not yet implemented (English only at Phase 1)
- Bot speed: 5–30s (too slow, not yet fixed)
