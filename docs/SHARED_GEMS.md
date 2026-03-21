# SHARED GEMS, UTILS & LIBRARIES
**Last updated:** 2026-03-21 15:49 IST
**Purpose:** Reusable patterns across ALL Roye's projects

---

## 🔧 INFRASTRUCTURE GEMS

### 1. WhatsApp Bot Pipeline (Caps)
**What:** Twilio → Supabase Edge Function → Claude Haiku analysis → GitHub Actions → Claude Code fix → auto-commit
**Files:** `supabase/functions/whatsapp-bot-handler/index.ts`
**Reuse:** Any project can receive bug reports via WhatsApp and auto-fix them
**Key learnings:**
- Twilio sandbox webhook = MANUAL ONLY (API returns 404)
- Shell variables must use `env:` block in GitHub Actions, NEVER inline (Hebrew breaks bash)
- Edge Functions are stateless — no setTimeout for auto-processing
- Image + caption = process immediately (no merge window needed)
- Claude Code needs focused prompts: "change line X in file Y" not "fix the display"

### 2. ElevenLabs Voice Cloning (Caps via 9soccer key)
**What:** Clone real voices from YouTube audio → generate TTS clips via API
**Key:** Found in `C:\Projects\9soccer\*\.env` as ELEVENLABS_API_KEY
**Script:** `C:\Projects\Caps\scripts\generate_voices.py`
**Model:** `eleven_multilingual_v2`
**Reuse:** Any project needing AI voice generation
**Safety layers:** Disclaimer text + audio disclaimer + Supabase kill switch + Settings toggle

### 3. GitHub Actions CI/CD (Caps + Wingman)
**Caps:** `.github/workflows/ios-testflight.yml` + `claude-fix.yml`
**Wingman:** `.github/workflows/ios-testflight.yml`
**Pattern:** `git push main` → EAS build → auto-submit to TestFlight
**Secrets needed:** EXPO_TOKEN, APPLE_APP_SPECIFIC_PASSWORD
**Key learning:** `claude-fix.yml` must use `env:` for ALL payload variables

### 4. Bug Dashboard (Caps)
**What:** Single HTML page reading from Supabase bug_reports table
**URL:** caps.ftable.co.il/bugs/
**Stack:** Vanilla HTML + Supabase JS client
**Reuse:** Copy HTML, change Supabase URL/key, deploy anywhere
**Features:** Filter by status/date, Mark Fixed, WhatsApp copy, auto-refresh 30s

### 5. Hand Share / Web Replay (Caps)
**What:** ViewShot → share image + web replay page
**Components:** ShareCard.tsx, StoryShareCard (1080×1920), web-replay/index.html
**Supabase:** shared_hands table (30-day expiry, view counter)
**URL:** caps.ftable.co.il/hand/?id=XXXXX
**Reuse:** Any app that wants shareable content with web preview

### 6. Google Drive Bug Pipeline (Wingman)
**What:** In-app BugReporter → screenshot + annotation → Drive upload → Dashboard timeline
**Service account:** C:\Projects\config\google-service-account.json
**Drive folder:** PROJECTS DEBUG (with subfolders per project)
**Dashboard:** wingman-dashboard-nine.vercel.app → Bug Timeline tab

---

## 📱 UI/UX PATTERNS

### 7. Responsive Card Sizing
**Problem:** Cards unreadable on small screens
**Solution:** `getCardDimensions(screenWidth, playerCount)` — percentage-based, not hardcoded
**Key rules:**
- Card width = function of screen width
- Min rank fontSize = 10px
- Min card width = 28px
- Test on ALL 8 iPhone widths: 375, 380, 390, 393, 402, 414, 428, 430, 440
- Height matters too: SE3 = 667pt (shortest)

### 8. Card Flip Animation
**Pattern:** `react-native-reanimated` rotateY with perspective
**Key code:**
```typescript
const flipProgress = useSharedValue(0);
// Front: rotateY 90→0, visible when >0.5
// Back: rotateY 0→-90, visible when ≤0.5
// Duration: 400ms, Easing.out(cubic)
```

### 9. ProQuoteBanner — Rotating Quotes with Voice
**Pattern:** Text quotes rotate every N seconds + optional voice playback
**Safety:** 5 layers (text disclaimer, audio disclaimer, first-time notice, kill switch, settings toggle)
**Reuse:** Any app wanting rotating testimonials/quotes with audio

### 10. Tutorial Overlay
**Pattern:** N-step fullscreen overlay, first launch only (AsyncStorage flag)
**Key:** Step dots, Next/Done buttons, smooth transitions
**Reset:** Settings → "Show Tutorial Again"

### 11. Timer Bar
**Pattern:** Horizontal progress bar with color transitions
**Colors:** green (100-60%) → yellow (60-30%) → orange (30-10%) → red+pulse (10-0%)
**Sound:** Tick at 10s, faster at 5s, haptic at 3s/0s

### 12. Floating Value Animation
**Pattern:** "+150" or "-100" floats up from element, fades out
**Code:** translateY 0→-40, opacity 1→0, duration 1200ms
**Colors:** Gold for positive, red for negative

### 13. Version Badge
**Pattern:** Small badge on every screen showing `v{version} ({build})`
**Visibility:** Only in __DEV__ or when `isBeta=true` in app.json extra
**Purpose:** Every screenshot from testers shows exact version

### 14. Premium Button Style
**Pattern:**
```
height: 60px, borderRadius: 16
background: dark gradient
border: 1.5px gold hint
shadow: 0 4px 16px rgba(0,0,0,0.4)
press: scale(0.97)
idle: subtle gold glow pulse
```

### 15. Glass Container
**Pattern:** `rgba(255,255,255,0.05)` bg + `rgba(255,255,255,0.08)` border + borderRadius 12
**Use:** For floating content like quotes, tips, overlays

---

## 🗄️ SUPABASE PATTERNS

### 16. Remote Kill Switch
**Table:** `app_config` — key/value store
**Pattern:** `{ key: 'feature_name_enabled', value: true/false }`
**Client:** Check on mount, cache 5 minutes, safe default = OFF if unreachable
**Reuse:** Any feature that needs instant remote disable without app update

### 17. Deploy Tracker
**Table:** `deploy_tracker` — tracks pending fixes between deploys
**Fields:** project, fix_summary, severity, committed_at, deployed_at
**Pattern:** Fix committed → deployed_at=NULL. Build deployed → mark all pending as deployed.

### 18. Shared Content with Expiry
**Table:** `shared_hands` (or generalize as `shared_content`)
**Fields:** id (short), data (jsonb), created_at, expires_at (30 days), views (counter)
**Pattern:** Generate short ID → store → public read → auto-expire

---

## 🔊 SOUND DESIGN PATTERN

### 19. Emotion-Mapped Sound System
**File:** `utils/sounds.ts`
**Key setting:** `playsInSilentModeIOS: true` — WITHOUT THIS, NO SOUND ON IPHONE
**Pattern:** Map every game moment to an emotion → assign sound
**15 moments:** deal, place, remove, ready, reveal start, card flip, board win, board loss, COMPLETE, timer 10s, timer 5s, timer 0s, chip gain, chip loss, transition

---

## 📐 DEVICE TESTING MATRIX

### 20. All iPhone Viewport Sizes (2026)
**Must test every project on ALL of these:**

| Width | Height | Devices | Group |
|-------|--------|---------|-------|
| 375 | 667 | SE 3 | XS — HARDEST |
| 375 | 812 | 12/13 mini, X, XS, 11 Pro | XS |
| 380 | 824 | 16e | S — NEW BUDGET |
| 390 | 844 | 12, 12 Pro, 13, 13 Pro, 14 | M |
| 393 | 852 | 14 Pro, 15, 15 Pro, 16, 16 Pro, 17e | M — MOST COMMON |
| 402 | 874 | 17, 17 Pro, 17 Air | M — NEWEST |
| 414 | 896 | XR, 11, XS Max, 11 Pro Max | L |
| 428 | 926 | 12 Pro Max, 13 Pro Max, 14 Plus | L |
| 430 | 932 | 14-16 Plus/Pro Max | L |
| 440 | 956 | 17 Pro Max | XL — BIGGEST |

**Rule:** If it works on 375×667 (SE3), it works everywhere.

---

## 🔄 WORKFLOW PATTERNS

### 21. VAMOS Prompt → Bot → Audit Loop
```
Claude (Strategist) writes VAMOS .md file
  → Roye sends to Claude Bot
  → Bot executes and reports
  → Claude cross-checks EVERY item vs original request
  → Gaps found → new fix prompt
  → Repeat until 10/10
```

### 22. Simulation → Implementation Pattern
```
Claude creates fictional simulation (experts test/rate the product)
  → Ratings reveal strengths and weaknesses
  → Top findings become VAMOS prompts
  → Bot implements the fixes
  → Audit verifies
```

### 23. WhatsApp Bug → Auto-Fix Pipeline
```
User sends screenshot+text to WhatsApp
  → Edge Function: Claude Vision analyzes image
  → Edge Function: Claude Haiku generates plan (reads actual code via GitHub API)
  → User approves (1=fix only, 2=fix+build, 3=cancel)
  → GitHub Actions: Claude Code executes fix
  → Auto-commit + push
  → If option 2: EAS build → TestFlight
```
