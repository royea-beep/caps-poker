# ROYE ↔ CLAUDE — Communication Workflow Analysis
**Reverse-engineered from session 2026-03-20/21**

---

## The Three-Layer System

```
┌─────────────────────────────────────────────────────┐
│  ROYE (Human)                                        │
│  Hebrew speaker, fast decision maker, visual thinker │
│  Communicates via: text, screenshots, voice notes     │
└──────────────────────┬──────────────────────────────┘
                       │ Hebrew conversation
                       ▼
┌─────────────────────────────────────────────────────┐
│  CLAUDE (Strategist)                                  │
│  Analyzes, plans, writes VAMOS prompts in English     │
│  Produces: .md files with structured instructions     │
└──────────────────────┬──────────────────────────────┘
                       │ English .md file
                       ▼
┌─────────────────────────────────────────────────────┐
│  CLAUDE BOT (Executor)                                │
│  Reads files, executes autonomously, reports results  │
│  Produces: code changes, deploys, git commits         │
└─────────────────────────────────────────────────────┘
```

---

## Communication Patterns

### Pattern 1: Problem → Investigate → Fix
```
Roye: [screenshot] "זה לא עובד"
Claude: Analyzes screenshot → identifies likely cause
Claude: Generates VAMOS prompt file with investigation plan
Roye: Sends file to Claude Bot
Bot: Investigates, finds root cause, fixes, deploys
Roye: Pastes bot output back to Claude
Claude: Summarizes what happened, suggests next step
```

### Pattern 2: "תעשה אודיט" (Do an audit)
```
Roye: "תעשה אודיט מלא"
Claude: Examines all screenshots/context
Claude: Produces numbered list of findings (20-35 items)
Claude: Prioritizes into sprints (A/B/C/D)
Roye: Approves direction
Claude: Generates VAMOS prompt for sprint A
```

### Pattern 3: Iteration Loop
```
Roye: [screenshot] "עדיין לא נראה טוב"
Claude: Identifies what's still wrong
Claude: Generates focused fix prompt
Roye: Sends to bot → bot fixes → shows result
Roye: [new screenshot] — either approves or iterates
```
This loop ran 5 times for Five-O theme colors alone.

### Pattern 4: "פרומפט בקובץ" (Prompt as file)
```
Roye: Describes what he wants in Hebrew
Claude: MUST produce a .md file (not text in chat)
Roye: Downloads file → sends to Claude Bot
```
**Critical rule:** Roye asked for files 300 times. Never give instructions as chat text — always as downloadable .md file.

### Pattern 5: Bug Report via Screenshot
```
Roye: [screenshot with console open]
Claude: Reads BOTH the visual AND the console errors
Claude: Addresses visual issues + console errors in same prompt
```

---

## What Roye Likes

| Do | Don't |
|----|-------|
| Output as .md files ALWAYS | Chat-only instructions |
| Hebrew responses | English in conversation |
| Tables and summaries | Long paragraphs |
| "שלח לבוט" (send to bot) | "Try this command..." |
| Act immediately | Ask for confirmation on obvious things |
| Find bugs Roye didn't mention | Ignore console errors in screenshots |
| Quick iteration (fix → deploy → screenshot → fix) | Long planning sessions |
| Numbered findings with priorities | Vague "things to improve" |

---

## VAMOS Prompt Structure (What Works)

```markdown
# VAMOS MEGA PROMPT — [Task Name]
**Version:** v[X] | **Build:** b[N] | **Date:** [IL time]

## ROLE
[Specific expert role]

## FIRST ACTIONS
Read MEMORY.md, confirm Iron Rules, cp to docs/prompts/

## CONTEXT
[What happened, what's wrong, evidence from screenshots]

## MISSION / THE FIX
[Numbered agents OR sequential steps]
[Include grep commands to find relevant code]
[Include exact code changes when known]

## SUCCESS CRITERIA
[Checkboxes]

## ON COMPLETION
tsc → jest → export → deploy → commit → push → update MEMORY

## MANUAL_TASKS
[Only if bot truly can't do it]

## CONFLICTS LIST
[Empty unless there are conflicts]
```

---

## Speed & Efficiency Patterns

### What makes sessions fast:
1. **Screenshots with console open** — Claude sees both UI and errors
2. **Bot output pasted in full** — Claude has complete context
3. **Quick approve/reject cycle** — Roye says "כן" or sends new screenshot
4. **File-based prompts** — no copy-paste errors, bot reads the whole thing
5. **Build numbers track everything** — always know what version is deployed

### What slows sessions down:
1. **Wrong initial assumption** (OAuth URI was already there — wasted 1 hour)
2. **Not reading ALL screens** (missed reveal/results in premium overhaul)
3. **Asking Roye to do manual steps** when bot could investigate
4. **Giving options instead of decisions** ("Option A or B?" — just pick one)

---

## Language Rules

| Context | Language |
|---------|----------|
| Roye → Claude chat | Hebrew |
| Claude → Roye responses | Hebrew |
| VAMOS prompts (for bot) | English |
| Code comments | English |
| Git commits | English |
| File names | English with IL timestamps |

---

## The "300 Times" Rule

Roye explicitly said he asked for files "300 times." The rule:
- **NEVER** give Roye commands to run
- **NEVER** give instructions as chat text
- **ALWAYS** produce a downloadable .md file
- **ALWAYS** the file goes to Claude Bot who executes autonomously
- Roye's job: send file to bot, paste output back, approve/reject with screenshot
