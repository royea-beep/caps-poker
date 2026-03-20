VAMOS CAPS PERFECT-SCORE v1.9.3-b105 2026-03-20-1600

## ROLE
You are a Senior Full-Stack Engineer, QA Lead, and Project Manager with expertise in React Native, Expo, iOS deployment, and system architecture. Your goal: bring every stage and feature to 10/10. You work autonomously, attempt everything programmatically before escalating to manual, and NEVER suggest App Store until explicitly told.

## Current state: v1.9.3 | Code: b105 | EAS: #117 | Commit: 1c0d130
## Israel time: UTC+2 (current) — use IL time for all timestamps
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed. Rule 2 UNLOCKED.
Standing Orders:
- Execute autonomously. Never give user commands unless truly impossible.
- If conflict with existing working system → STOP and add to CONFLICTS list. Do not fix silently.
- Auto-approve sub-decisions. Move blocked items to MANUAL_TASKS at end.
- Archive this prompt immediately to docs/prompts/

## FIRST ACTION
```bash
cp "C:/Users/royea/Downloads/vamos-caps-perfect-score-v1.9.3-b105-2026-03-20-1600.md" \
   "/c/Projects/Caps/docs/prompts/vamos-caps-perfect-score-v1.9.3-b105-2026-03-20-1600.md"
```

---

## KNOWN VIOLATIONS FROM SELF-AUDIT — FIX ALL

### TASK A — V1: Audio transcription false refusal (agent: memory-agent)
A1. The bot wrote a memory rule. Verify it's still correct:
    cat /c/Users/royea/.claude/projects/C--Projects-Caps/memory/feedback_audio_transcription.md
A2. Add CAPABILITY CHECK pattern to MEMORY.md:
    Before saying "I can't [X]", always attempt: `which X`, `py -3.11 -c "import X"`, or `ls tools/`
A3. Update the rule to be even stricter — add examples of tools to always check first

### TASK B — V5: 8-second delay — verify correct fix (agent: game-agent)
B1. Read app/game.tsx — find the READY → reveal flow for 2+ players
B2. The voice note said "after BOTH players are ready, takes 8 seconds to start"
    Check: is there a countdown timer that fires even when BOTH player + bot are ready?
B3. Find: when player presses READY and bot is already ready → how long until reveal starts?
    Look for: setTimeout, countdown, fallback timer
B4. If there's still a delay when both ready → fix it: navigate immediately (max 1.5s)
    CONFLICT CHECK: If this touches a working countdown system → add to CONFLICTS list
B5. npx tsc --noEmit — 0 errors

### TASK C — V6: App Store in memory file (agent: memory-cleanup-agent)
C1. Search ALL memory files for "App Store" mentions:
    grep -ri "app store\|appstore\|submit.*apple" \
      /c/Users/royea/.claude/projects/C--Projects-Caps/memory/ | head -20
C2. For each occurrence:
    - If it says "SKIP" or "PAUSED" → leave it
    - If it's a recommendation → remove it
C3. Also check docs/:
    grep -ri "app store\|appstore" /c/Projects/Caps/docs/ | grep -v "SKIP\|PAUSED\|never mention" | head -10

### TASK D — V8: READY→reveal timing for 2 players (agent: qa-agent)
D1. Read app/game.tsx — find the exact flow when player presses READY
D2. Scenario: 2 players, bot finishes placing cards first, player presses READY
    → What happens? Does reveal start immediately or after a timer?
D3. Look specifically for: allBotsReady + playerReady both true → what triggers navigateToReveal?
D4. If there's an unnecessary wait → reduce to max 500ms
    CONFLICT CHECK: If touching this breaks existing working timing → add to CONFLICTS

### TASK E — V10: Israel timezone enforcement (agent: docs-agent)
E1. Israel is currently UTC+2 (summer starts ~2026-03-29, so currently standard = UTC+2)
E2. Update TIMELINE.md — add note: "All times are Israel Standard Time (UTC+2)"
E3. Update NEW-SESSION-TEMPLATE.md — add: "**Time (IL UTC+2):** HH:MM"
E4. Update MEMORY.md to note: "Israel timezone = UTC+2 (UTC+3 from last Sunday of March)"

### TASK F — Feature completeness audit (agent: feature-auditor)
F1. Read docs/CAPS-STAGES-SCORE-2026-03-20.md
F2. Read docs/AUDIT-2026-03-19.md
F3. For each item NOT at 10/10 — check if fixable NOW without conflicts:

    **Stage 2 Research (18/20):**
    - Missing: competitive analysis doc
    - Action: Write docs/COMPETITIVE-ANALYSIS.md with Five-O Poker + similar apps comparison
    - This is documentation only — no conflicts possible

    **Stage 3 Architecture (17/20):**
    - Missing: Architecture Decision Records doc
    - Action: Write docs/ADR.md with all major decisions (already in key-decisions.md — just formalize)

    **Stage 6 Content/Assets (15/20):**
    - Missing: marketing video, ASO copy (App Store track PAUSED — skip these)
    - Action: Can we add anything else? Screenshot descriptions, app description for web?

    **Stage 7 Launch Prep (14/20):**
    - Missing: formal QA sign-off, beta tester group
    - Action: Create docs/BETA-TESTERS.md listing who should test and what

    **Stage 8 Live Optimization (13/20):**
    - Twilio webhook → MANUAL (add to MANUAL_TASKS)
    - Google OAuth → attempt programmatically, else MANUAL
    - Analytics: add Supabase query for bug_reports stats

F4. Write all documentation files

### TASK G — Google OAuth attempt (agent: oauth-agent)
G1. Try to enable Google OAuth programmatically via Supabase MCP:
    Check current auth providers status
G2. If API allows enabling Google provider → do it
G3. If not possible via API → add to MANUAL_TASKS with exact URL + steps

### TASK H — Update all scores after fixes (agent: db-agent)
H1. After all tasks complete, update ZPM DB with new scores:
    Use C:/Projects/ZProjectManager pattern (sql.js, array params)
H2. Update CAPS-STAGES-DASHBOARD.md with new scores
H3. Health score target: 97/100

---

## CONFLICTS LIST (populated during execution)
If any fix conflicts with existing working system, STOP and list here:
[ ] ...

---

## MANUAL_TASKS (populated during execution)
[ ] ...

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: perfect score sprint — V5/V8 fixes, ADR, competitive analysis, OAuth [v1.9.3-b106]"
7. git push origin main
8. Update MEMORY.md with new scores + IL timezone note
9. Print: CONFLICTS LIST + MANUAL_TASKS + updated stage scores

VAMOS CAPS PERFECT-SCORE — END
