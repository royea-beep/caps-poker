# Caps Poker — QA Checklist
**Date:** 2026-03-20 | **Version:** v1.9.3 | **Code:** b104 | **EAS:** #117

---

## Automated Checks (run 2026-03-20)

| Check | Result | Details |
|-------|--------|---------|
| TypeScript strict | ✅ PASS | 0 errors — `npx tsc --noEmit` |
| Jest tests | ✅ PASS | 115/115 — all 7 suites passing |
| Five-O theme tokens | ✅ COMPLETE | All 17 ThemeTokens fields populated for both classic + fiveo |
| Landscape layout | ✅ COMPILED | `isLandscape` + `landscapeStyles` present in game.tsx (3 panels: left/center/right) |
| WhatsApp bot | ✅ RESPONDING | Edge Function returns `<Response></Response>` — live and healthy |
| console.error/warn | ✅ LEGITIMATE | 9 instances — all in try/catch error handlers, not debug logs |
| CI web deploy step | ✅ ADDED | ios-testflight.yml now deploys web after TestFlight submit |

---

## Manual Device QA (not yet done — requires physical iPhone)

| Item | Priority | Status | Notes |
|------|----------|--------|-------|
| Five-O theme visual check on device | High | ⏳ Pending | Dark navy + gold, board red/crimson |
| Classic theme visual check on device | Medium | ⏳ Pending | Black + gold felt |
| Portrait layout — single player | Medium | ⏳ Pending | Standard orientation |
| Landscape layout — single player | High | ⏳ Pending | 3-panel layout (hand/boards/hand) |
| Landscape layout — landscape mode locked | High | ⏳ Pending | expo-screen-orientation lock |
| Local multiplayer (HOST + JOIN) | High | ⏳ Pending | TCP socket on same WiFi |
| Internet multiplayer (Supabase Realtime) | High | ⏳ Pending | Host + join via lobby codes |
| WhatsApp audio message → Whisper transcription | High | ⏳ Pending | Send voice note to +14155238886 |
| WhatsApp image message → Claude Vision | Medium | ⏳ Pending | Send screenshot to bot |
| Bug reporter — shake trigger | Medium | ⏳ Pending | Shake iPhone → modal appears |
| Bug reporter — FAB tap | Low | ⏳ Pending | Tap yellow bug icon |
| Theme picker on first launch | Medium | ⏳ Pending | Clear app data → should show theme-pick |
| Orientation picker on first launch | Medium | ⏳ Pending | After theme → orientation-pick |
| Confetti on PERFECT! (win all boards) | Low | ⏳ Pending | Win all 4 boards in one game |
| Card flip animation | Low | ⏳ Pending | River auto-flip 2.5s smooth |
| Sound effects | Low | ⏳ Pending | All 7 sounds (card/chips/win/lose) |

---

## Twilio Webhook — MANUAL REQUIRED

**Status:** ❌ Not set (1 manual step remaining)
**What to do:**
1. Open https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. In "Sandbox Configuration" → "When a message comes in"
3. Set URL: `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler`
4. Method: POST
5. Save

**Why automated failed:** Twilio sandbox webhook is set via Console UI only — not available via REST API.

---

## Summary

| Category | Status |
|----------|--------|
| Code quality | ✅ 100% — TS 0 errors, 115 tests |
| Core features (automated) | ✅ All pass |
| Device QA | ⏳ 16 manual items pending |
| Twilio webhook | ⏳ 1 manual step (30 seconds) |
| CI web deploy | ✅ Added to ios-testflight.yml |
