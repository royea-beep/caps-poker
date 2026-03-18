# VAMOS METHODOLOGY — Reusable Guide
*Extracted from Caps Poker development | 2026-03-18*

---

## What is VAMOS?

A multi-agent parallel development system using Claude Bot (Claude Code).
Instead of one agent doing tasks sequentially, multiple agents run in parallel.
Result: 5x faster development with better quality.

---

## Core Principles

1. **Autonomous execution** — Bot never asks user to run commands
2. **Parallel agents** — Minimum 3 agents per complex sprint
3. **Always deploy** — Every prompt ends with full deploy pipeline
4. **Always test** — TypeScript + Jest before every deploy
5. **Memory first** — Bot reads MEMORY.md before starting

---

## Prompt Template

```markdown
VAMOS [PROJECT] [TASK-NAME] v[X.X.X]-b[BUILD] YYYY-MM-DD-HHMM

## Current state: v[X.X.X] build #[NN] | commit [hash]
Read MEMORY.md. Iron Rules confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — [Task Name]
Agent: [agent-name]

A1. Read [file] in full
A2. Do [specific thing]
A3. Expected: [output]

## TASK B — [Task Name]  
Agent: [agent-name]

B1. ...

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. [deploy command]
4. git add -A && git commit -m "[message] [vX.X.X-bNN]"
5. git push origin main
6. Update MEMORY.md
7. Report table

VAMOS [PROJECT] [TASK-NAME] — END
```

---

## File Naming

```
vamos-[project]-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md

Examples:
vamos-caps-ios-crash-fix-v1.9.3-b85-2026-03-18-1100.md
vamos-soccer-auth-fix-v2.1.0-b12-2026-03-18-1400.md
```

---

## Agent Naming Conventions

| Type | Name |
|------|------|
| Crash hunting | crash-hunter / crash-finder |
| UI fixes | home-agent / reveal-fixer / card-sizer |
| Auth | auth-agent |
| Deploy | deploy-agent |
| Research | research-agent |
| Testing | test-agent / simulator |

---

## Communication Pattern

```
User (Hebrew) → Claude (English prompt) → Claude Bot (executes) → User (screenshot)
```

- User speaks Hebrew to Claude assistant
- Claude writes English prompts for Claude Bot
- Claude Bot executes autonomously, never asks user to run commands
- User only copies the .md file to Claude Bot

---

## Standing Orders (always include)

```
Standing Orders:
- Try ALL actions autonomously first
- Never give user commands to run
- Fix everything, ask nothing
- Check credentials in C:/Projects/ before asking
```

---

## Recovery Prompt

When terminal crashes or context is lost:

```markdown
VAMOS [PROJECT] RECOVERY YYYY-MM-DD-HHMM

## TASK — Assess current state

A1. git log --oneline -10
A2. git status --short
A3. cat app.json | grep version
A4. gh run list --repo [repo] --limit 3
A5. Check which recent prompts were applied vs pending
A6. Continue from where we left off
A7. Deploy and report full status

VAMOS [PROJECT] RECOVERY — END
```

---

## Status Check Prompt

```markdown
VAMOS [PROJECT] STATUS-CHECK YYYY-MM-DD-HHMM

A1. cat app.json | grep version
A2. gh run list --repo [repo] --limit 3
A3. git log --oneline -5
A4. curl -sk https://[domain]/index.html | grep "bundle-hash"
A5. eas build:list --platform ios --limit 1

Report: version, build number, last 5 commits, live bundle hash
```

---

## Audio Transcription (built-in)

Claude Bot has Whisper installed. To transcribe audio feedback:

```bash
python -m whisper "path/to/audio.ogg" --language Hebrew --model small \
  --output_format txt --output_dir /tmp/out
cat /tmp/out/*.txt
```

---

## Useful Patterns Discovered

### 1. Platform guards (React Native / iOS)
```typescript
// Always use Platform.OS, never typeof window
if (Platform.OS === 'web') { /* DOM stuff */ }
```

### 2. Navigation refs (avoid stale closures)
```typescript
const navigateRef = useRef(navigateFunction);
useEffect(() => { navigateRef.current = navigateFunction; });
useEffect(() => { if (ready) navigateRef.current(); }, [ready]);
```

### 3. Reanimated in Modal (Old Arch)
```typescript
// Never use entering={} prop in Modal
// Always use useSharedValue + withTiming
```

### 4. Vercel vs FTP
```
If DNS points to Vercel → deploy with: cd dist && vercel --prod --yes
FTP only works if hosting is directly on cPanel server
```

### 5. EAS build credentials
```
Distribution cert = team-wide (one cert for all apps on same Apple Team ID)
If cert was created with project A's CSR → use project A's private.key for project B too
```

---

## WhatsApp Bot Architecture

For any project that wants WhatsApp-based bug reporting + auto-fix:

```
User sends WhatsApp (text/image/audio)
  → Twilio webhook → Supabase Edge Function
  → Transcribe/analyze with Whisper/Claude Vision
  → Claude API → generate action plan
  → Reply: "I'll do X — APPROVE or CANCEL"
  → APPROVE → GitHub repository_dispatch → Claude Bot → commit
  → "✅ Done! Build triggered"

Cost: ~$0.01/report | Setup: ~3 hours
Services: Twilio + Supabase Edge Functions + Claude API + GitHub API
```

---

*VAMOS Methodology | Extracted 2026-03-18 | Reusable across projects*
