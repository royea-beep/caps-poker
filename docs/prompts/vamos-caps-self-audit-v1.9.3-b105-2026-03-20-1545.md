VAMOS CAPS SELF-AUDIT v1.9.3-b105 2026-03-20-1545

## ROLE
You are a strict Quality Assurance Auditor and Communication Analyst. Your job is to perform a deep, honest audit of how Claude (the assistant) behaved throughout all conversations about Caps Poker. You must identify every case where Claude ignored, misunderstood, delayed, or partially executed instructions from Roye. Be brutally honest. Score each violation 1-10 by severity.

## Current state: v1.9.3 | Code: b105 | EAS: #117
Standing Orders: Be completely honest. Do not defend Claude's mistakes. Report everything found.

## FIRST ACTION — Archive this prompt
```bash
cp "C:/Users/royea/Downloads/vamos-caps-self-audit-v1.9.3-b105-2026-03-20-1545.md" \
   "/c/Projects/Caps/docs/prompts/vamos-caps-self-audit-v1.9.3-b105-2026-03-20-1545.md"
```

---

## TASK A — Read ALL available context (agent: context-reader)

A1. Read the transcript file:
    cat /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt | head -500

A2. Check for more transcript files:
    ls /mnt/transcripts/ 2>/dev/null

A3. Read session summaries:
    cat /c/Projects/Caps/docs/conversations/2026-03-18/session-summary.md
    cat /c/Projects/Caps/docs/conversations/2026-03-19/session-summary.md
    cat /c/Projects/Caps/docs/conversations/2026-03-20/session-summary.md

A4. Read key decisions:
    cat /c/Projects/Caps/docs/conversations/2026-03-18/key-decisions.md
    cat /c/Projects/Caps/docs/conversations/2026-03-19/key-decisions.md
    cat /c/Projects/Caps/docs/conversations/2026-03-20/key-decisions.md

A5. Read MEMORY.md feedback files:
    ls /c/Users/royea/.claude/projects/C--Projects-Caps/memory/
    cat /c/Users/royea/.claude/projects/C--Projects-Caps/memory/feedback_audio_transcription.md 2>/dev/null
    cat /c/Users/royea/.claude/projects/C--Projects-Caps/memory/project_whatsapp_voice_findings.md 2>/dev/null

A6. Read GOTCHAS-AND-LESSONS.md for patterns of repeated mistakes:
    cat /c/Projects/Caps/docs/GOTCHAS-AND-LESSONS.md

A7. Search transcript for key violation patterns:
    # Look for "App Store" mentions Claude made
    grep -i "app store\|appstore\|submit.*apple\|apple.*submit" /mnt/transcripts/*.txt 2>/dev/null | head -20

    # Look for build number mistakes
    grep -i "build #\|build number\|b9[0-9]\|b10[0-9]" /mnt/transcripts/*.txt 2>/dev/null | grep -i "wrong\|incorrect\|mistake\|לא נכון\|ממציא" | head -20

    # Look for Israel time mentions
    grep -i "israel\|UTC+2\|UTC+3\|שעון\|שעה" /mnt/transcripts/*.txt 2>/dev/null | head -20

    # Look for "ignored\|התעלמת\|לא ביצעת\|שכחת" patterns
    grep -i "התעלמת\|ignored\|שכחת\|לא ביצעת\|לא הבנת\|זלזול" /mnt/transcripts/*.txt 2>/dev/null | head -20

---

## TASK B — Deep transcript analysis (agent: transcript-analyst)

B1. Read the full transcript in chunks:
    # Read in 1000-line chunks
    sed -n '1,1000p' /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt
    sed -n '1000,2000p' /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt
    sed -n '2000,3000p' /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt
    sed -n '3000,4000p' /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt
    sed -n '4000,4660p' /mnt/transcripts/2026-03-19-18-06-09-caps-poker-dev-session.txt

B2. For each violation found, record:
    - What Roye said/asked
    - What Claude did (or didn't do)
    - How many times it was repeated before Claude fixed it
    - Severity 1-10

---

## TASK C — Write the audit report (agent: audit-reporter)

C1. Write C:/Projects/Caps/docs/CLAUDE-SELF-AUDIT-2026-03-20.md:

    ```markdown
    # Claude Self-Audit — Caps Poker Sessions
    **Date:** 2026-03-20 | **Auditor:** Claude Bot (honest self-assessment)
    **Sessions covered:** 2026-03-18 to 2026-03-20

    ## Scoring
    - 10 = Critical violation — directly blocked progress
    - 7-9 = Serious — wasted significant time or ignored explicit rule
    - 4-6 = Moderate — partial compliance or repeated mistake
    - 1-3 = Minor — small oversight, quickly corrected

    ## Violations Found

    | # | Violation | Severity | How many times | Fixed? | Evidence |
    |---|-----------|----------|----------------|--------|---------|
    | 1 | App Store suggestion after explicit "never mention it" | [X]/10 | [N] times | Yes/No | [quote] |
    | 2 | Wrong build numbers / inventing numbers | [X]/10 | [N] times | Yes/No | [quote] |
    | 3 | Israel timezone not used for timestamps | [X]/10 | [N] times | Yes/No | [quote] |
    | 4 | Prompt files not saved with hour+minute | [X]/10 | [N] times | Yes/No | [quote] |
    | 5 | Five-O graphics — only took orientation, ignored full redesign request | [X]/10 | ... | ... | ... |
    | 6 | ZProjectManager not added proactively | [X]/10 | ... | ... | ... |
    | 7 | WhatsApp audio — lied about capability ("I can't") | [X]/10 | ... | ... | ... |
    | [any others found] | ... |

    ## Patterns Found
    [What types of mistakes Claude makes most often]

    ## Root Causes
    [Why these mistakes happen]

    ## Commitments Going Forward
    [Specific rules Claude will follow to prevent each violation]
    ```

C2. Be completely honest. Quote exact text from transcripts as evidence.
C3. Do NOT minimize or defend. Be the harshest possible critic.

---

## FINAL STEPS
1. git add -A in C:/Projects/Caps
2. git commit -m "docs: Claude self-audit — violations found and scored [v1.9.3-b105]"
3. git push origin main
4. Print full audit report in terminal output

VAMOS CAPS SELF-AUDIT — END
