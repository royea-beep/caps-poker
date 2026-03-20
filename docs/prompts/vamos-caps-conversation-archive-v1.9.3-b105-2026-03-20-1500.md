VAMOS CAPS CONVERSATION-ARCHIVE v1.9.3-b105 2026-03-20-1500

## ROLE
You are a Senior Knowledge Engineer and Documentation Architect. Your job is to build a complete, navigable archive of ALL communication in this project — not just bot prompts, but the full conversation between Roye (user) and Claude (assistant). This enables full reconstruction of any decision, context, or moment in the project's history.

## Current state: v1.9.3 | Code: b105 | EAS: #117 | Commit: 1966560
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Standing Orders: Execute autonomously. Never give user commands unless truly impossible.

## FIRST ACTION — Archive this prompt
```bash
cp "C:/Users/royea/Downloads/vamos-caps-conversation-archive-v1.9.3-b105-2026-03-20-1500.md" \
   "/c/Projects/Caps/docs/prompts/vamos-caps-conversation-archive-v1.9.3-b105-2026-03-20-1500.md"
```

---

## TASK A — Build conversation archive structure (agent: archive-architect)

A1. Create the archive folder structure:
    ```
    C:/Projects/Caps/docs/conversations/
    ├── README.md              — how to navigate the archive
    ├── TIMELINE.md            — chronological index of all conversations
    ├── 2026-03-18/
    │   ├── session-summary.md — what was discussed, decisions made
    │   └── key-decisions.md   — decisions that affected the project
    ├── 2026-03-19/
    │   ├── session-summary.md
    │   └── key-decisions.md
    └── 2026-03-20/
        ├── session-summary.md
        └── key-decisions.md
    ```

A2. Write README.md:
    ```markdown
    # Caps Poker — Conversation Archive

    This folder contains summaries of all conversations between Roye and Claude
    about Caps Poker development.

    ## What's here
    - **TIMELINE.md** — full chronological index
    - **YYYY-MM-DD/session-summary.md** — what was discussed each session
    - **YYYY-MM-DD/key-decisions.md** — decisions that changed the project
    - **../prompts/** — all VAMOS prompts sent to Claude Bot

    ## Why this exists
    Full context reconstruction. Any future session can read these files
    and understand exactly what was built, why, and how.

    ## Convention
    - User (Roye) speaks Hebrew
    - Claude responds in Hebrew
    - Bot prompts are in English (in ../prompts/)
    - Timestamps are Israel time (UTC+2, UTC+3 in summer)
    ```

---

## TASK B — Reconstruct session summaries from available sources (agent: historian-agent)

B1. Read these source files to reconstruct conversation history:
    - C:/Projects/Caps/docs/SESSION-LOG-2026-03-19-20.md
    - C:/Projects/Caps/docs/GOTCHAS-AND-LESSONS.md
    - C:/Projects/Caps/docs/AUDIT-2026-03-19.md
    - C:/Projects/Caps/docs/GRAPHICS-REVIEW-2026-03-19.md
    - C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
    - C:/Projects/ZProjectManager/docs/CAPS-POKER-STAGES-AUDIT-2026-03-20.md
    - git log: cd /c/Projects/Caps && git log --oneline --format="%ad %s" --date=short | head -50

B2. Write 2026-03-18/session-summary.md:
    Reconstruct from SESSION-LOG what was discussed this day:
    - What bugs were reported (how — screenshots/voice/text)
    - What Claude analyzed
    - What was decided
    - What was built
    - Key moments in the conversation

B3. Write 2026-03-19/session-summary.md — same format

B4. Write 2026-03-20/session-summary.md — same format

---

## TASK C — Key decisions log (agent: decisions-agent)

C1. For each session, extract KEY DECISIONS — moments where a choice was made that affected direction:

    Format:
    ```markdown
    ## Decision: [name]
    **Date:** YYYY-MM-DD HH:MM (Israel time)
    **Context:** What was being discussed
    **Options considered:** A, B, C
    **Choice made:** X
    **Reason:** Why X was chosen
    **Impact:** How this changed the project
    **Related commits:** [hash]
    ```

    Include decisions like:
    - "Use Five-O style graphics"
    - "Unlock Iron Rule 2 for landscape"
    - "WhatsApp bot for all projects"
    - "Visual theme system token-based"
    - "credentialsSource: remote"
    - "Never suggest App Store until told"

C2. Write to each session's key-decisions.md

---

## TASK D — Build TIMELINE.md (agent: timeline-agent)

D1. Create master chronological index:

    ```markdown
    # Caps Poker — Full Conversation Timeline

    ## How to read this
    Each entry: [Date Time (IL)] [Type] [Summary] → [File]

    ## 2026-03-18
    | Time (IL) | Type | Summary | File |
    |-----------|------|---------|------|
    | ~14:00 | 🗣️ Chat | First session start, build audit... | 2026-03-18/session-summary.md |
    | ~14:30 | 📄 Prompt | vamos-caps-ios-crash-fix... | prompts/vamos-caps-... |
    ...

    ## 2026-03-19
    ...

    ## 2026-03-20
    ...
    ```

D2. Cross-reference with git log dates and prompt file timestamps

---

## TASK E — Create future conversation template (agent: template-agent)

E1. Write C:/Projects/Caps/docs/conversations/NEW-SESSION-TEMPLATE.md:

    ```markdown
    # Session Log — [DATE] [TIME IL]
    **Build at start:** v[X.X.X] | Code b[NNN] | EAS #[NNN]
    **Commit at start:** [hash]

    ## What Roye reported
    - [bug/request 1]
    - [bug/request 2]

    ## What was analyzed
    - [analysis]

    ## Decisions made
    - [decision 1] → see key-decisions.md

    ## What was built
    - [feature/fix 1] → commit [hash]

    ## Prompts sent to Claude Bot
    - [filename]

    ## Bot output summary
    - [what bot did]

    ## Still open
    - [item 1]
    ```

E2. Write instructions in README.md for how to update this after each session

---

## TASK F — Update .gitignore to not commit sensitive conversation data

F1. Check if any conversations contain credentials or personal info
F2. Add appropriate gitignore rules if needed
F3. Ensure all conversation files are safe to commit

---

## FINAL STEPS
1. git add -A in C:/Projects/Caps
2. git commit -m "docs: full conversation archive structure + session summaries [v1.9.3-b105]"
3. git push origin main
4. Update MEMORY.md — note conversation archive location
5. Report: what was created, how to use it

VAMOS CAPS CONVERSATION-ARCHIVE — END
