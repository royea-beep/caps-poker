# CAPS POKER — New Session Handoff
**Date:** 2026-03-20 | **IL Time:** ~18:00

---

## WHO YOU ARE TALKING TO
**Roye** — Israeli developer, builds fast, thinks big, wants things done properly.
- Speaks Hebrew in chat, wants responses in Hebrew
- Prompts to Claude Bot always in English
- Does NOT waste time on ceremony — wants results, not explanations
- Says "כן" to approve, moves fast
- Gets annoyed when Claude repeats mistakes or acts dumb
- NEVER mention App Store unless Roye says "prepare for App Store"

---

## PROJECT STATE
**Caps Poker** — React Native Omaha poker app
- Path: `C:/Projects/Caps`
- Version: v1.9.3 | Code build: b106 | EAS build: #117 (TestFlight)
- Latest commit: `6a1677a`
- Web: https://caps.ftable.co.il (Vercel, live)
- iOS: TestFlight via GitHub Actions CI (auto on push)
- Tests: 115/115 | TypeScript: 0 errors
- Stage score: **144/160 = 90%** | Health: **98/100**

**Read for full context:**
- `C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md`
- `C:/Projects/Caps/docs/conversations/TIMELINE.md`
- `C:/Projects/Caps/docs/CAPS-STAGES-DASHBOARD.md`

---

## HOW WE WORK — VAMOS METHODOLOGY

### The flow:
1. Roye reports bugs/requests → Hebrew, voice notes, screenshots
2. Claude analyzes → writes VAMOS MEGA PROMPT in English → saves as .md file
3. Roye sends file to Claude Bot → Bot executes autonomously
4. Bot output pasted back → Claude confirms/escalates

### MEGA PROMPT rules (NON-NEGOTIABLE):
- File name: `vamos-caps-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md` (IL time, UTC+2)
- Always start: `## ROLE` — who the bot is pretending to be (Senior [X] Engineer)
- Always: `Read MEMORY.md. Iron Rules confirmed.`
- Always: `Fix autonomously. Never give user commands unless truly impossible.`
- Always: `cp [file] to docs/prompts/` as first action (archives prompt history)
- Always ends with: tsc → jest → deploy → commit → push → update MEMORY.md → report
- If conflict with working system → STOP, add to CONFLICTS LIST
- If manual only → add to MANUAL_TASKS at end
- Auto-approve sub-decisions — don't ask Roye for confirmation on details
- Minimum 5 parallel agents for any sprint

### What Roye loves:
✅ Parallel agents (5+) running simultaneously
✅ Bot that does everything autonomously without asking
✅ Clear summary tables at the end (what changed, scores)
✅ ASCII dashboards for stage scores
✅ Everything saved/archived automatically
✅ Fast — no ceremony, just results
✅ When bot finds a bug Roye didn't mention and fixes it anyway
✅ Hebrew responses from Claude, English prompts for bot

### What Roye hates:
❌ "I can't" without trying first — always attempt before refusing
❌ Suggesting App Store (NEVER, ever)
❌ Inventing build numbers without checking EAS
❌ Timestamps without IL time (UTC+2)
❌ Asking for confirmation on obvious sub-decisions
❌ Partial execution — if you start something, finish it
❌ Repeating the same mistake twice
❌ Long explanations when a table would do

---

## IRON RULES (LOCKED — never change without explicit "UNLOCK [rule]")
1. React Native + Expo only — no bare workflow, no Capacitor
2. **UNLOCKED:** iOS supports portrait AND landscape. User picks on first launch.
3. All game params runtime-configurable via Settings — never hardcoded
4. Hand evaluation: full Omaha — exactly 2 player cards + 3 board cards
5. Bot is random only — no strategy
6. No backend for single-player
7. Local multiplayer via react-native-tcp-socket
8. Internet multiplayer via Supabase Realtime

---

## LAST 10 ACTIONS

| # | Action | Result |
|---|--------|--------|
| 1 | Added visual theme system Classic/Five-O | b104 — theme picker on first launch |
| 2 | Orientation picker (portrait/landscape) first launch | Iron Rule 2 unlocked |
| 3 | WhatsApp bot: audio transcription via OpenAI Whisper | OPENAI_API_KEY set, working |
| 4 | ZProjectManager sync — added Caps Poker (id:14) | Health 93, stage scores set |
| 5 | Knowledge preservation sprint | VAMOS guide, reusable skills, session logs all saved |
| 6 | Stage audit: 8 stages scored 1-20 | 134/160 = 83.75% |
| 7 | Stage 8 completion sprint | CI web deploy added, QA checklist, b105 |
| 8 | Conversation archive built | docs/conversations/ with TIMELINE + session summaries |
| 9 | Claude self-audit | 10 violations found, V1 (audio lie) = 9/10 severity |
| 10 | Perfect score sprint + OAuth verify | 144/160 = 90%, health 98/100 |

---

## OPEN ITEMS (do these next)

| Priority | Item | How |
|----------|------|-----|
| 🔴 HIGH | Google Cloud Console — add Supabase redirect URI | Manual: console.cloud.google.com → credentials → add `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback` |
| 🔴 HIGH | Twilio webhook URL | Manual: console.twilio.com → WhatsApp sandbox → set webhook URL |
| 🟡 MED | Device QA — 16 items | See docs/QA-CHECKLIST-2026-03-20.md |
| 🟡 MED | Test Five-O theme on iPhone | TestFlight build #117 |
| 🟡 MED | Test landscape layout on iPhone | TestFlight build #117 |

**After these: potential 149/160 = 93.1%**

---

## KEY CREDENTIALS (for bot use)
- Supabase: `gxrpunvhjcrzqnitbqah.supabase.co`
- Vercel deploy: `cd dist && vercel --prod --yes`
- Web export: `npx expo export --platform web --clear` → `node scripts/fix-web-html.js`
- EAS build: `eas build --platform ios --profile production --non-interactive`
- Twilio sandbox: +14155238886
- WhatsApp webhook: `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler`

---

## TWO BUILD NUMBERS (always reference both)
- **Code build (b106)** = `extra.buildNumber` in app.json = our git commit counter
- **EAS build (#117)** = what TestFlight shows = EAS auto-increment (counts failures too)

---

*Read docs/conversations/TIMELINE.md for full history. Read docs/CAPS-STAGES-DASHBOARD.md for current scores. Ask Roye in Hebrew.*
