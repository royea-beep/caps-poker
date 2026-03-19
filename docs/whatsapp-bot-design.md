# WhatsApp Bug Bot — Design Document
## Caps Poker | v1.9.3 | 2026-03-18

---

## 1. Current BugReporter Audit

### What it does today
- **Trigger**: Shake phone (accelerometer delta > 3.5) OR tap 🐛 FAB
- **Screenshot**: Captures screen via `react-native-view-shot` BEFORE modal opens (JPG, quality 0.5)
- **Modal**: Title (required, 100 chars) + Description (optional, 500 chars)
- **Supabase insert** — `bug_reports` table, fields:
  ```
  project       "caps-poker"
  version       "1.9.3"
  title         user-entered title
  description   user-entered description (nullable)
  url           current screen path (e.g. "/game")
  user_agent    "ios 18.x"
  session_id    "caps-1a2b3c" (timestamp-based)
  metadata      { device, platform, expoVersion }
  status        "open"
  ```
- **Drive sync**: Fire-and-forget POST to `sync-bugs-to-drive` Edge Function with screenshot as base64
- **Ping on mount**: Sends `[ping] app opened v1.9.3` on every app open (confirms connection)

### What it does NOT capture
- No audio/video
- No stack traces or error logs
- No repro steps automatically
- No device stats (battery, memory, network)
- Screenshot: native only (expo-file-system read), web skips

### Existing infrastructure
- Supabase project: `gxrpunvhjcrzqnitbqah` (Frankfurt)
- `bug_reports` table: exists and wired ✓
- `sync-bugs-to-drive` Edge Function: deployed on Supabase cloud (not in local repo)
- No WhatsApp / Twilio packages or env vars anywhere

---

## 2. WhatsApp API Options Analysis

| Option | Type | Setup | Cost | Reliability | Verdict |
|--------|------|-------|------|-------------|---------|
| **Twilio WhatsApp** | Official | 30 min | $0.005/msg sent + $0.0075/msg received | ★★★★★ | **RECOMMENDED** |
| Meta Cloud API | Official | 3-7 days (business verification) | Free 1k conv/month | ★★★★★ | Good but slow to set up |
| whatsapp-web.js | Unofficial | 1 hour | Free | ★★☆☆☆ | Risk of phone ban |
| Baileys | Unofficial | 1 hour | Free | ★★☆☆☆ | Risk of phone ban |

### Recommendation: Twilio WhatsApp Business API

**Why Twilio:**
- Setup in 30 minutes (no business verification required for sandbox)
- Use Twilio Sandbox for development, upgrade to production later
- Webhook → Supabase Edge Function is a 1-line integration
- $0.01 per full bug report cycle (negligible at 1-person scale)
- Roye's number (972504141513) is already used for WhatsApp — just add it to sandbox

**Twilio Sandbox flow:**
1. Sign up at twilio.com → WhatsApp Sandbox
2. Send "join [word]" from your WhatsApp to the sandbox number
3. Set webhook URL → your Supabase Edge Function
4. Done — receives and sends messages immediately

---

## 3. Full Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER FLOW                               │
│                                                             │
│  📱 Roye shakes phone                                       │
│       │                                                     │
│       ▼                                                     │
│  BugReporter modal opens (screenshot captured)              │
│       │                                                     │
│       ▼                                                     │
│  [Option A] Submit via app → Supabase bug_reports           │
│  [Option B] Send WhatsApp voice/image/text directly         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  WHATSAPP → CLAUDE PIPELINE                 │
│                                                             │
│  1. Roye sends WhatsApp message to bot number               │
│     (text / image / audio / video)                          │
│       │                                                     │
│       ▼                                                     │
│  2. Twilio webhook → POST to Supabase Edge Function         │
│     "whatsapp-bot-handler"                                  │
│       │                                                     │
│       ▼                                                     │
│  3. Edge Function receives payload:                         │
│     - Text → pass directly                                  │
│     - Audio (.ogg) → fetch media URL → Whisper API          │
│       → transcript text                                     │
│     - Image → fetch media URL → Claude Vision API           │
│       → description text                                    │
│     - Video → extract thumbnail → Claude Vision             │
│       (full video transcription: future scope)              │
│       │                                                     │
│       ▼                                                     │
│  4. Claude API call with system prompt:                     │
│     "You are the Caps Poker dev assistant.                  │
│      Analyze this bug report/feature request.               │
│      Respond with:                                          │
│      - TYPE: BUG | FEATURE | QUESTION                       │
│      - SUMMARY: 1-line description                          │
│      - PLAN: numbered list of code changes needed           │
│      - FILES: list of files to modify                       │
│      - EFFORT: LOW | MEDIUM | HIGH"                         │
│       │                                                     │
│       ▼                                                     │
│  5. Edge Function sends WhatsApp reply to Roye:             │
│     "🔍 TYPE: BUG                                           │
│      SUMMARY: Cards not flipping on river                   │
│      PLAN:                                                  │
│      1. Fix riverRevealed state in RevealSequence.tsx       │
│      2. Update flip delay timing                            │
│      FILES: components/RevealSequence.tsx                   │
│      EFFORT: LOW                                            │
│                                                             │
│      Reply APPROVE to trigger fix, CANCEL to abort"         │
│       │                                                     │
│       ▼                                                     │
│  6. Roye replies "APPROVE" or "CANCEL"                      │
│       │                                                     │
│       ├── CANCEL → "Aborted. Nothing changed."              │
│       │                                                     │
│       └── APPROVE                                           │
│             │                                               │
│             ▼                                               │
│  7. Edge Function triggers GitHub Actions                   │
│     via repository_dispatch:                                │
│     POST /repos/royea-beep/caps-poker/dispatches            │
│     { event_type: "claude-fix",                             │
│       client_payload: { plan, files, summary } }            │
│       │                                                     │
│       ▼                                                     │
│  8. GitHub Action: claude-fix.yml                           │
│     - Checks out repo                                       │
│     - Runs Claude Code CLI with the plan as MEGA PROMPT     │
│     - Commits + pushes changes                              │
│     - Triggers EAS build (optional)                         │
│       │                                                     │
│       ▼                                                     │
│  9. Edge Function polls GitHub Action status                │
│     → Sends WhatsApp: "✅ Done! Commit abc1234              │
│       Build #89 triggered on TestFlight."                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Approval Flow Detail

```
Bot sends:
  "🔍 BUG REPORT RECEIVED

   Summary: [1-line description]

   Proposed changes:
   1. [change 1]
   2. [change 2]

   Files: RevealSequence.tsx, gameStore.ts
   Effort: LOW (~15 min)

   Reply APPROVE to proceed
   Reply CANCEL to abort
   (Auto-cancels in 30 minutes)"

User replies: APPROVE
  → Edge Function marks session approved
  → Triggers repository_dispatch
  → Sends: "⚙️ Running fix..."

User replies: CANCEL
  → Sends: "❌ Aborted. No changes made."

No reply in 30 min:
  → Edge Function auto-cancels pending session
```

---

## 5. Supabase Edge Function Schema

### New function: `whatsapp-bot-handler`

```typescript
// Request: POST from Twilio webhook
// Body: application/x-www-form-urlencoded
// Fields: From, Body, MediaUrl0, MediaContentType0, NumMedia, MessageSid

// State storage: new table `whatsapp_sessions`
// {
//   id, message_sid, from_number, status (pending_approval|approved|cancelled|done),
//   plan_json, created_at, expires_at
// }
```

### New Supabase table: `whatsapp_sessions`
```sql
create table whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  message_sid text unique not null,
  from_number text not null,
  raw_input text,
  claude_plan jsonb,
  status text default 'pending_approval',
  github_run_id bigint,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 minutes')
);
```

---

## 6. GitHub Action: `claude-fix.yml`

```yaml
name: Claude Auto-Fix
on:
  repository_dispatch:
    types: [claude-fix]

jobs:
  fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Claude Code
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npm install -g @anthropic-ai/claude-code
          claude-code --prompt "${{ github.event.client_payload.plan }}" --auto-commit
```

---

## 7. Required Services & Costs

| Service | Setup | Monthly cost (10 bug reports) |
|---------|-------|-------------------------------|
| Twilio WhatsApp Sandbox | Free | Free (sandbox) |
| Twilio WhatsApp Production | $5 one-time | ~$0.15 |
| Supabase Edge Functions | Already deployed | Free (500k invocations/month) |
| Claude API (claude-haiku-4-5) | Already have key | ~$0.03 (10 × $0.003) |
| GitHub Actions | Already configured | Free (2000 min/month) |
| OpenAI Whisper API | Need key | ~$0.06 (10 × $0.006/min) |
| **Total** | | **~$0.25/month** |

---

## 8. Required New Env Vars

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # sandbox number

# Claude API (already have in analyzer, reuse)
ANTHROPIC_API_KEY=sk-ant-...

# GitHub (for repository_dispatch)
GITHUB_TOKEN=ghp_...  # needs repo scope

# OpenAI (for Whisper transcription)
OPENAI_API_KEY=sk-...
```

---

## 9. Next Steps to Implement

### Phase 1 — Core pipeline (2-3 hours)
1. Sign up for Twilio → enable WhatsApp Sandbox → add 972504141513
2. Create Supabase migration: `whatsapp_sessions` table
3. Write `whatsapp-bot-handler` Edge Function (Deno):
   - Parse Twilio webhook
   - Handle text/audio/image
   - Call Claude API → generate plan
   - Send WhatsApp reply with APPROVE/CANCEL prompt
   - Handle APPROVE → trigger `repository_dispatch`
4. Set Supabase function URL as Twilio webhook
5. Test end-to-end with a voice message

### Phase 2 — GitHub Action automation (1 hour)
6. Create `.github/workflows/claude-fix.yml`
7. Set `ANTHROPIC_API_KEY` secret on GitHub repo
8. Test: send WA message → approve → watch Claude commit

### Phase 3 — Polish (1 hour)
9. Add 30-minute auto-cancel for pending sessions
10. Add WhatsApp confirmation with commit SHA + build number
11. Add `whatsapp_sessions` history to a simple admin view

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Claude makes wrong changes | APPROVE gate — human always reviews the plan |
| Twilio sandbox number changes | Upgrade to production number ($5 one-time) |
| Edge Function timeout (>10s for Whisper) | Use background job or async response |
| GitHub token expires | Use GitHub App instead of PAT for long-term |
| OpenAI Whisper cost spike | Cap at 2 min audio max, reject longer |

---

*Generated: 2026-03-18 | Caps Poker v1.9.3*
