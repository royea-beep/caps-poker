# WhatsApp Bot — Multi-Project Design

## Current State
Single bot hardcoded for Caps Poker (`royea-beep/caps-poker`).
Edge Function: `whatsapp-bot-handler` on Supabase project `gxrpunvhjcrzqnitbqah`.

---

## How It Works (future)
User sends message → Bot detects which project from context → Routes to correct repo → GitHub Action runs fix → WhatsApp notification back to user.

---

## Project Detection Keywords

| Keywords | Project | Repo |
|----------|---------|------|
| caps / poker / קלפים / קפס | Caps Poker | royea-beep/caps-poker |
| wingman / וינגמן / שידוך | Wingman | royea-beep/wingman |
| keydrop / key drop / מפתח | KeyDrop | royea-beep/keydrop |
| analyzer / אנלייזר / מנתח | Analyzer | royea-beep/analyzer-standalone |
| explainit / explain / הסבר | ExplainIt | royea-beep/explainit |
| postpilot / פוסט / סושיאל | PostPilot | royea-beep/postpilot |
| ftable / פטייבל / טבלה | ftable | royea-beep/ftable |
| *(no match)* | → Ask user | — |

---

## Implementation Options

### Option A: One number, smart routing (Recommended)
- One Twilio WhatsApp number
- One Edge Function that detects project + routes
- Pro: single webhook URL, one place to maintain
- Con: slightly more complex logic

### Option B: Separate webhook per project
- One Twilio number per project
- Separate Edge Function per project
- Pro: isolated, simple per-function logic
- Con: multiple numbers, multiple deployments

**Recommendation: Option A** — one number, smart routing via Claude detection.

---

## Routing System Prompt (addition to current prompt)

```
First identify which project this message relates to based on keywords.
Available projects: caps-poker, wingman, keydrop, analyzer, explainit, postpilot, ftable.
If unclear, set project to "unknown" and ask the user.
Then analyze the bug/feature for that specific project's tech stack.

Project stacks:
- caps-poker: React Native + Expo SDK 55, Omaha poker
- wingman: Next.js + Supabase, social matchmaking
- keydrop: Next.js + Prisma + Neon, encrypted one-time links
- analyzer: Next.js + Claude Vision + LemonSqueezy, product analyzer
- explainit: Next.js + Playwright, explainer video generator
- postpilot: Next.js + Prisma, social media scheduler
- ftable: Vanilla JS (no framework), fantasy football

Add PROJECT: <name> as first line of your response.
```

---

## GitHub Dispatch Map

```typescript
const REPO_MAP: Record<string, string> = {
  'caps-poker': 'royea-beep/caps-poker',
  'wingman': 'royea-beep/wingman',
  'keydrop': 'royea-beep/keydrop',
  'analyzer': 'royea-beep/analyzer-standalone',
  'explainit': 'royea-beep/explainit',
  'postpilot': 'royea-beep/postpilot',
  'ftable': 'royea-beep/ftable',
};
```

Each repo needs:
1. `.github/workflows/claude-fix.yml` (same as caps-poker, with `permissions: contents: write`)
2. `ANTHROPIC_API_KEY` secret set in GitHub

---

## Session Storage
Add `project` column to `whatsapp_sessions` table to track which project each session targets.

---

## Implementation Priority
1. ✅ Caps Poker bot working (current)
2. Next: Add project detection + routing to existing Edge Function
3. Then: Deploy `claude-fix.yml` to each repo
4. Finally: Set `ANTHROPIC_API_KEY` secret on each repo
