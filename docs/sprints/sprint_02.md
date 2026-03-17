# You are working on the CAPS POKER project.
# PARALLEL SPRINT — Full codebase audit across all sibling projects.
# GOAL: Find reusable code, utilities, and libraries from other projects that can strengthen Caps Poker.
# Launch all 6 agents at once.
# Read MEMORY.md and confirm Iron Rules before starting.

---

## Iron Rules Confirmation
- Rule 1: React Native + Expo only ✓
- Rule 2: iOS portrait only ✓
- Rule 3: All params runtime-configurable ✓
- Rule 4: Full Omaha evaluation ✓
- Rule 5: Bot is random only ✓
- Rule 6: No backend ✓

---

## TASK 1 — Audit shared-utils (CRITICAL)
Agent: shared-utils-auditor

A1. Read all files in `C:\Projects\shared-utils\` recursively (list all files first with: Get-ChildItem -Recurse)
A2. For each file found, read its contents and identify:
    - Any utility functions (formatters, validators, helpers)
    - Any TypeScript types or interfaces
    - Any React Native components
    - Any animation utilities
    - Any storage/persistence helpers
A3. For each useful item found, write a summary:
    - File path
    - What it does
    - How it can be used in Caps Poker
    - Copy-readiness: can it be copied as-is, or needs adaptation?
A4. List the top 5 most immediately useful items for Caps Poker.

---

## TASK 2 — Audit ftable + ftable-hands (CRITICAL — poker related)
Agent: poker-auditor

A1. Read all files in `C:\Projects\ftable\` recursively
A2. Read all files in `C:\Projects\ftable-hands\` recursively
A3. Identify:
    - Any card/hand evaluation logic
    - Any poker game state management
    - Any card UI components
    - Any board/table layout components
    - Any chip/betting logic
    - Any animation for cards
A4. Compare with current Caps Poker implementation:
    - Is there a better hand evaluator than ours?
    - Are there card components we should replace ours with?
    - Any game flow logic we can borrow?
A5. List everything worth importing into Caps Poker with clear recommendation: USE / ADAPT / SKIP

---

## TASK 3 — Audit royea-mobile-launch-kit (IMPORTANT)
Agent: mobile-kit-auditor

A1. Read all files in `C:\Projects\royea-mobile-launch-kit\` recursively
A2. Identify:
    - TestFlight / App Store submission scripts or configs
    - EAS build configuration files
    - Any expo.json / eas.json templates
    - Any CI/CD setup (GitHub Actions, etc.)
    - Any splash screen / icon generation tools
    - Any onboarding or first-launch flow components
A3. Extract anything directly applicable to getting Caps Poker to TestFlight faster
A4. Report: what's the fastest path to TestFlight build based on what's in this kit?

---

## TASK 4 — Audit FlushQueue + ZProjectManager + MegaPromptGPT (INTERESTING)
Agent: tools-auditor

A1. Read all files in `C:\Projects\FlushQueue\` recursively
A2. Read all files in `C:\Projects\ZProjectManager\` recursively
A3. Read `C:\Projects\CURSOR_MEGA_PROMPT.md` fully
A4. For FlushQueue: identify what it does — is it a queue/job system? Any async patterns useful for game reveal sequence?
A5. For ZProjectManager: identify if it has any project state management patterns we can learn from
A6. For CURSOR_MEGA_PROMPT.md: read the full file — extract any prompting techniques or workflow rules that should be added to our working style

---

## TASK 5 — Audit ExplainIt + PostPilot + Wingman (UI/UX patterns)
Agent: ui-patterns-auditor

A1. Read all files in `C:\Projects\ExplainIt\` recursively
A2. Read all files in `C:\Projects\PostPilot\` recursively
A3. Read all files in `C:\Projects\Wingman\` recursively
A4. For each project identify:
    - Any reusable UI components (modals, overlays, buttons, cards)
    - Any animation patterns (entrance animations, transitions)
    - Any design system / color tokens / theme setup
    - Any navigation patterns with expo-router
A5. List top components worth copying into Caps Poker

---

## TASK 6 — Audit crypto-arb-bot + TokenWise + cryptowhale (state & async patterns)
Agent: async-patterns-auditor

A1. Read all files in `C:\Projects\crypto-arb-bot\` recursively
A2. Read all files in `C:\Projects\TokenWise\` recursively  
A3. Identify:
    - Any Zustand store patterns more sophisticated than ours
    - Any async state machine patterns (useful for game reveal sequence)
    - Any timer/interval management patterns
    - Any real-time update patterns
A4. Compare Zustand usage with our gameStore.ts — suggest improvements
A5. Identify any TypeScript patterns or utility types worth adopting

---

## FINAL STEPS

1. Create file `C:\Projects\Caps\AUDIT_REPORT.md` with this structure:

```markdown
# Caps Poker — Cross-Project Audit Report

## Immediate Wins (copy as-is this sprint)
| Item | Source Project | File | What it does |
|------|---------------|------|-------------|

## Quick Adaptations (minor changes needed)
| Item | Source Project | File | Changes needed |
|------|---------------|------|---------------|

## Architecture Improvements
List any patterns or approaches from other projects that should change how we build Caps Poker

## TestFlight Path
Fastest path to TestFlight based on royea-mobile-launch-kit findings

## Skipped Items
Items found but not useful for Caps Poker (with reason)
```

2. Update `MEMORY.md`:
   - Add section "## Audit Findings" with summary of top items to integrate
   - Update Open Items with any new tasks identified

3. Do NOT copy any files yet — report only. User will decide what to integrate.

4. `git add AUDIT_REPORT.md MEMORY.md`
5. `git commit -m "sprint-02: cross-project audit complete"`

---

## DO NOT
- Copy or modify any files in sibling projects
- Change any Iron Rules
- Start integrating anything — report only
- Ask the user questions mid-execution
- Skip any project in the audit list
- Write vague summaries — be specific with file paths and function names
