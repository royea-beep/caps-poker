VAMOS CAPS ZPM-STAGES-AUDIT v1.9.3-b104 2026-03-20

## ROLE
You are a Senior Project Architect and Systems Analyst with 15+ years experience in mobile app development, project lifecycle management, and quality assurance. You have deep knowledge of React Native, Expo, and iOS deployment pipelines. You are meticulous, autonomous, and always find a way to complete tasks without asking the user to do manual work unless absolutely impossible.

## Current state: v1.9.3 | Code: b104 | EAS: #117 | Commit: 1ba8f6e
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed. Rule 2 UNLOCKED.
Standing Orders:
- Fix and execute autonomously. Never give user commands unless truly impossible.
- If a step requires manual action, attempt programmatically first. If that fails, add to MANUAL_TASKS list at the end.
- Auto-approve your own sub-decisions — do not ask the user for confirmation on implementation details.
- Always use as many specialist agents and tools as needed.

## FIRST ACTION — Move this prompt file to project docs
Move the prompt file from Downloads to the project prompts archive:
```
mkdir -p C:/Projects/Caps/docs/prompts
cp "C:/Users/royea/Downloads/vamos-caps-zpm-stages-audit-v1.9.3-b104-2026-03-20.md" "C:/Projects/Caps/docs/prompts/vamos-caps-zpm-stages-audit-v1.9.3-b104-2026-03-20.md"
```
This keeps a full history of all prompts between Claude and Claude Bot.

---

## TASK A — Extract ZProjectManager stage system (agent: zpm-analyst)

A1. Read all relevant source files to find the 11-stage system:
    find C:/Projects/ZProjectManager/src -name "*.ts" -o -name "*.tsx" | xargs grep -l "stage\|Stage\|concept\|research\|architecture" 2>/dev/null | head -20

A2. Read C:/Projects/ZProjectManager/src/shared/types.ts in full
A3. Read C:/Projects/ZProjectManager/DATABASE_SCHEMA.sql in full
A4. Read C:/Projects/ZProjectManager/EXECUTION_STRATEGY.md in full
A5. Read C:/Projects/ZProjectManager/PORTFOLIO_TRIAGE.md | head -100
A6. Check for any stage-specific prompt templates:
    find C:/Projects/ZProjectManager -name "*.md" | xargs grep -l "Stage\|phase\|step" 2>/dev/null | head -10

A7. Extract EXACT list of all stages with their definitions and criteria
A8. If stages are NOT 11, report how many there actually are

---

## TASK B — Check for existing stage prompt templates (agent: template-analyst)

B1. Search ZProjectManager for any pre-built prompts for each stage:
    find C:/Projects/ZProjectManager -name "PROMPT*" -o -name "*prompt*" -o -name "*STAGE*" 2>/dev/null | head -20
    ls C:/Projects/ZProjectManager/docs/ 2>/dev/null

B2. Read any found prompt templates in full

B3. Check BUILD_PROMPT.md:
    cat C:/Projects/ZProjectManager/BUILD_PROMPT.md

B4. Report: which stages have pre-built prompts, which don't

---

## TASK C — Score Caps Poker 1-20 on each stage (agent: scoring-agent)

C1. Based on findings from Task A, score Caps Poker on EACH stage from 1-20:
    - 20 = perfectly done, polished, verified on device
    - 15-19 = done and working, minor gaps
    - 10-14 = partially done
    - 5-9 = started but incomplete
    - 1-4 = not done or broken

C2. For each stage, cite SPECIFIC evidence:
    - What files/features prove it's done
    - What's missing or untested
    - What would bring it to 20/20

C3. Use known Caps Poker state:
    - v1.9.3 | b104 | EAS #117 | 115/115 tests
    - Stage currently set in DB: live_optimization
    - Health: 93/100
    - Known pending: device QA (Five-O theme, landscape, multiplayer, WhatsApp audio)

C4. Write detailed scoring report to:
    C:/Projects/Caps/docs/CAPS-STAGES-SCORE-2026-03-20.md

---

## TASK D — Update ZProjectManager DB with stage scores (agent: db-agent)

D1. Use sql.js pattern (array params):
    ```javascript
    // File: C:/Projects/ZProjectManager/update-stages.mjs
    import { createRequire } from 'module';
    import { readFileSync, writeFileSync } from 'fs';
    const require = createRequire(import.meta.url);
    const initSqlJs = require('./node_modules/sql.js/dist/sql-asm.js');
    const SQL = await initSqlJs();
    const dbPath = 'C:/Users/royea/AppData/Roaming/zprojectmanager/data.db';
    const db = new SQL.Database(readFileSync(dbPath));
    ```

D2. Check if project_metrics table exists:
    db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='project_metrics'")

D3. If exists — insert stage scores as metrics:
    ```javascript
    // For each stage, insert: metric_name = 'stage_[name]', metric_value = score
    db.run(`INSERT INTO project_metrics (project_id, metric_name, metric_value, metric_unit, source, notes)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [14, 'stage_concept', 20, 'score_20', 'manual_audit', 'Fully defined game concept']);
    ```

D4. Save DB

---

## TASK E — Generate visual stage dashboard (agent: dashboard-agent)

E1. Read C:/Projects/Caps/docs/CAPS-STAGES-SCORE-2026-03-20.md (after Task C writes it)

E2. Create C:/Projects/Caps/docs/CAPS-STAGES-DASHBOARD.md with ASCII visualization:

    ```
    CAPS POKER — Stage Progress Dashboard
    v1.9.3 | Code b104 | EAS #117 | 2026-03-20
    ═══════════════════════════════════════════

    Stage 1: Concept          ████████████████████ 20/20 ✅
    Stage 2: Research         ████████████████████ 19/20 ✅
    Stage 3: Architecture     ███████████████████░ 18/20 ✅
    Stage 4: Setup & CI/CD    ████████████████████ 20/20 ✅
    Stage 5: Core Dev         ██████████████████░░ 18/20 ✅
    Stage 6: Content/Assets   ████████████████░░░░ 16/20 ✅
    Stage 7: Testing/QA       ██████████████░░░░░░ 14/20 🔄
    Stage 8: Launch Prep      █████████████░░░░░░░ 13/20 🔄
    Stage 9: Live Deploy      ████████████████████ 20/20 ✅
    Stage 10: Optimization    █████████████░░░░░░░ 13/20 🔄
    Stage 11: Growth/Scale    ████░░░░░░░░░░░░░░░░  4/20 ⏳

    Overall: [score]/220 = [%]%
    ═══════════════════════════════════════════
    ```
    (fill in actual scores from Task C)

---

## TASK F — Check for and adapt existing ZPM stage prompts (agent: prompt-curator)

F1. After finding existing prompts in Task B:
    - If prompts exist for stages Caps hasn't completed → adapt them for Caps context
    - Add Caps-specific context (Iron Rules, VAMOS methodology, tech stack)
    - Save adapted prompts to C:/Projects/Caps/docs/prompts/stage-[N]-[name].md

F2. For stages with NO existing prompts → note them for future creation

F3. Report which stage prompts are now available for Caps

---

## MANUAL_TASKS (populated during execution if needed)
If any task cannot be completed automatically, add here:
[ ] ...

---

## FINAL STEPS
1. cp "C:/Users/royea/Downloads/vamos-caps-zpm-stages-audit-v1.9.3-b104-2026-03-20.md" "C:/Projects/Caps/docs/prompts/vamos-caps-zpm-stages-audit-v1.9.3-b104-2026-03-20.md"
2. git add -A in C:/Projects/Caps
3. git commit -m "docs: ZPM stages audit, score dashboard, prompt archive [v1.9.3-b104]"
4. git push origin main
5. git add -A in C:/Projects/ZProjectManager
6. git commit -m "docs: Caps Poker stage scores added to ZPM"
7. git push origin master
8. Update C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md with stage scores
9. Print final report:
   - Stage system: how many stages, what they are
   - Caps Poker scores per stage
   - Which stage prompts exist in ZPM
   - MANUAL_TASKS list

VAMOS CAPS ZPM-STAGES-AUDIT — END
