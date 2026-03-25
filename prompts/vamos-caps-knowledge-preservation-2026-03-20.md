VAMOS CAPS KNOWLEDGE-PRESERVATION 2026-03-20

## Mission: Preserve ALL knowledge, skills, patterns, and findings from this session
## Working dirs: C:/Projects/Caps + C:/Projects/ZProjectManager
## Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Master Knowledge Base (agent: knowledge-agent)

A1. Read ALL of the following files:
    - C:/Projects/Caps/docs/ (all .md files)
    - C:/Projects/ZProjectManager/MEMORY.md
    - C:/Projects/ZProjectManager/PROJECT_EMPIRE.md
    - C:/Projects/ZProjectManager/docs/CAPS-POKER-STAGES-AUDIT-2026-03-20.md
    - C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md

A2. Write C:/Projects/Caps/docs/CAPS-MASTER-KNOWLEDGE-v2.md:

    ```markdown
    # CAPS POKER — Master Knowledge Base v2
    **Date:** 2026-03-20 | **Version:** v1.9.3 b104 | **Tests:** 115/115

    ## 1. PROJECT IDENTITY
    - Name: Caps Poker
    - Type: React Native Omaha poker game (iOS + web)
    - Stack: React Native + Expo SDK 55 + TypeScript + Zustand + Supabase + Vercel
    - Repo: royea-beep/caps-poker
    - Web: caps.ftable.co.il
    - iOS: TestFlight via EAS + GitHub Actions CI

    ## 2. IRON RULES (LOCKED — never change without explicit UNLOCK)
    1. React Native + Expo only — no bare workflow, no Capacitor
    2. UNLOCKED: iOS supports portrait AND landscape. User picks on first launch.
    3. All game params runtime-configurable via Settings — never hardcoded
    4. Hand evaluation: full Omaha — exactly 2 player cards + 3 board cards
    5. Bot is random only — no strategy, testing purposes only
    6. No backend for single-player
    7. Local multiplayer via react-native-tcp-socket
    8. Internet multiplayer via Supabase Realtime

    ## 3. GAME RULES (LOCKED)
    - 2 players: 4 boards, 16 cards each
    - 3 players: 3 boards, 12 cards each
    - 4 players: 2 boards, 8 cards each
    - Community: 3 open (flop) + 2 closed (turn/river) per board
    - Best 2 of 4 hole cards selected during evaluation (not pre-assigned)
    - UX: tap-to-select → tap-to-place (no drag)

    ## 4. KEY CREDENTIALS
    - Expo: royea | Apple Team: 3K9KJNGL9U | Bundle: com.capspoker.app
    - Supabase: gxrpunvhjcrzqnitbqah.supabase.co (Frankfurt)
    - Vercel: prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP | team_ayrePMw5z8jSPhRe67RiBD0k
    - GitHub: royea-beep/caps-poker
    - Twilio SID: ACf82650af617731b2252e87eb83b31f2a | Sandbox: +14155238886
    - WhatsApp webhook: https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler

    ## 5. DEPLOY COMMANDS
    ### Web
    npx expo export --platform web --clear
    node scripts/fix-web-html.js
    cd dist && vercel --prod --yes

    ### iOS (CI — automatic on git push)
    git push origin main → GitHub Actions → EAS Build → TestFlight

    ## 6. KEY FILES
    app/_layout.tsx — splash, deep links, orientation lock, first-launch flow
    app/index.tsx — home screen, 10 themes, taglines
    app/game.tsx — main game, portrait+landscape layouts, pre-calc
    app/results.tsx — reveal, YOU WIN/LOSE score
    app/orientation-pick.tsx — first-launch orientation choice
    app/theme-pick.tsx — first-launch visual theme choice (Classic/Five-O)
    app/settings.tsx — all settings, orientation toggle, theme toggle
    components/Card.tsx — 5-0 poker style, 4-color suits, diamond lattice back
    components/Board.tsx — red felt, WIN/LOSE/TIE banners with hand name
    components/RevealSequence.tsx — Five-O vertical layout, confetti
    components/BugReporter.tsx — shake/FAB → Supabase bug_reports
    constants/visualThemes.ts — Classic/Five-O token system
    constants/gameConfig.ts — botSpeedMin:1500, botSpeedMax:4000
    constants/deviceBreakpoints.ts — rv() responsive helper
    store/gameStore.ts — all persisted state
    supabase/functions/whatsapp-bot-handler/index.ts — v15, multi-project routing
    .github/workflows/claude-fix.yml — WhatsApp bot → auto fix → TestFlight + web

    ## 7. ARCHITECTURE DECISIONS
    - rv(W, mobileWeb, tablet, desktop, native) — responsive helper, never module-level Dimensions
    - Platform.OS === 'web' NOT typeof window (Hermes trap)
    - pointerEvents as style prop NOT as JSX prop (New Arch compat)
    - No Animated.View entering= in Modals (Old Arch crash)
    - credentialsSource: remote in eas.json (no local .mobileprovision needed)
    - Pre-calculate results during countdown → zero-wait navigation

    ## 8. SUPABASE TABLES (all RLS enabled)
    leaderboard (17 rows), user_profiles, sit_and_go_sessions, sit_and_go_players,
    tournaments, learning_events, whatsapp_sessions (16+ rows), error_logs, bug_reports (62+ rows)

    ## 9. WHATSAPP BOT
    Edge Function v15, multi-project routing:
    caps-poker, wingman, keydrop, analyzer, explainit, postpilot, ftable, letsmakebillions
    Features: Hebrew AI responses, Claude Vision (images), OpenAI Whisper (audio), approval flow,
    auto GitHub dispatch, auto Vercel deploy, completion WhatsApp notification

    ## 10. PERFORMANCE
    500 hands × 2 players: ~2.1ms/hand (client-side, no server load)
    Pre-calculation during countdown: zero-wait navigation to results

    ## 11. CURRENT STATUS
    Stage: 8 (live_optimization) | Health: 92/100
    All 7 previous stages: DONE
    Pending: device testing (Five-O theme, landscape, multiplayer, WhatsApp audio)
    ```

---

## TASK B — VAMOS Methodology Guide (agent: methodology-agent)

B1. Read C:/Projects/Caps/docs/VAMOS-METHODOLOGY-GUIDE.md (if exists)
B2. Write/update C:/Projects/ZProjectManager/docs/VAMOS-METHODOLOGY-GUIDE.md:

    ```markdown
    # VAMOS Methodology — Complete Guide
    **Version:** 2.0 | **Date:** 2026-03-20

    ## What is VAMOS?
    VAMOS = Vertical Autonomous Multi-agent Orchestration System
    A prompt methodology for running Claude Bot (claude.ai code) with 5+ parallel agents.

    ## Core Principles
    1. PARALLEL AGENTS — always 5+ agents minimum for any sprint
    2. AUTONOMOUS — "Fix autonomously. Never give user commands."
    3. STANDING ORDERS — read at top of every prompt
    4. MEMORY FIRST — always "Read MEMORY.md" as first step
    5. VALIDATE ALWAYS — tsc + jest before every deploy

    ## Prompt Structure
    ```
    VAMOS [PROJECT] [TASK] v[VERSION]-b[BUILD] [YYYY-MM-DD-HHMM]

    ## Current state: v[X.X.X] build #[NN] | commit [hash]
    Read MEMORY.md. Iron Rules confirmed.
    Standing Orders: Fix autonomously. Never give user commands.

    ---

    ## TASK A — [Name] (agent: [name]-agent)
    [steps]

    ## TASK B — [Name] (agent: [name]-agent)
    [steps]

    ## FINAL STEPS
    1. npx tsc --noEmit — 0 errors
    2. npx jest --silent — all pass
    3. deploy + commit + push
    4. Update MEMORY.md
    5. Report table
    ```

    ## File Naming Convention
    vamos-[project]-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md
    Example: vamos-caps-mega-bug-fix-v1.9.3-b93-2026-03-19-1800.md

    ## Communication Pattern
    - User speaks Hebrew
    - Claude (me) responds in Hebrew
    - Prompts sent to Claude Bot are in English
    - Screenshots sent after device testing
    - Bot output pasted back as document

    ## Agent Naming Patterns
    [feature]-agent, [domain]-agent, [role]-agent
    Examples: crash-agent, suits-agent, layout-agent, whatsapp-agent, audit-agent

    ## Typical Sprint Flow
    1. User reports bugs/requests (voice notes, screenshots, WhatsApp bot)
    2. Claude transcribes (Whisper) + analyzes
    3. Claude writes VAMOS prompt with parallel agents
    4. User sends to Claude Bot
    5. Bot runs 5+ agents → tsc → jest → deploy → commit
    6. User sends bot output back
    7. Claude confirms or escalates

    ## When to Use Single vs Mega Prompt
    - Single prompt: 1-3 focused bugs, clear scope
    - Mega prompt: 5+ bugs, new feature system, sprint work
    - Status refresh: after 10+ commits, use status-refresh prompt

    ## Standing Orders (always include)
    "Fix autonomously. Never give user commands."
    "Read MEMORY.md. Iron Rules confirmed."

    ## Anti-patterns to Avoid
    - Never ask user to run commands (bot does it)
    - Never suggest App Store unless user says "prepare for App Store"
    - Never break Iron Rules without explicit UNLOCK
    - Never hardcode screen dimensions (use rv() helper)
    - Never use module-level Dimensions.get() (crashes web)
    ```

---

## TASK C — Reusable Skills & Utils Library (agent: skills-agent)

C1. Read all utility files in C:/Projects/Caps:
    - constants/deviceBreakpoints.ts
    - constants/visualThemes.ts
    - utils/gameLogic.ts
    - utils/pokerEvaluator.ts
    - store/gameStore.ts (Zustand + persist pattern)
    - supabase/functions/whatsapp-bot-handler/index.ts

C2. Write C:/Projects/ZProjectManager/docs/REUSABLE-SKILLS-CAPS-POKER.md:

    Document each reusable skill with:
    - What it does
    - File location
    - How to copy/adapt for other projects
    - Code snippet

    Include:
    ### rv() Responsive Value Helper
    ### Visual Theme Token System
    ### Zustand + AsyncStorage Persist Pattern
    ### WhatsApp Bot (Twilio + Claude + Whisper)
    ### EAS Build + GitHub Actions CI
    ### Supabase bug_reports + BugReporter component
    ### Pre-calculation pattern (background computation during UX delay)
    ### expo-screen-orientation lock pattern

C3. Add to PROJECT_EMPIRE.md section 2 (REUSABLE LIBRARIES):
    Add "2K. Mobile Game Infrastructure (Caps Poker)" section

---

## TASK D — Session Log & Findings (agent: session-agent)

D1. Write C:/Projects/Caps/docs/SESSION-LOG-2026-03-19-20.md:

    Document the full session chronologically:
    - What was built (b88 → b104)
    - Key bugs found and fixed
    - Key decisions made
    - Surprises/gotchas discovered
    - Performance findings
    - Architecture insights

    Read git log for reference:
    cd C:/Projects/Caps && git log --oneline | head -30

D2. Write C:/Projects/Caps/docs/GOTCHAS-AND-LESSONS.md:

    Key lessons learned:
    - Hermes trap: Platform.OS !== typeof window
    - Old Arch Modal crash: no entering= prop in Animated.View inside Modal
    - expo-splash-screen: web is no-op, need custom overlay
    - EAS credentialsSource: remote → no local .mobileprovision needed
    - sql.js run() needs array not spread args
    - WhatsApp Sandbox: SandboxChannels API doesn't exist, use Console UI
    - Apple upload rate limit: max N builds/day per version train
    - buildNumber in app.json ignored when versionSource=remote (use extra.buildNumber)
    - bot speed was 5000-30000ms → 1500-4000ms fixed massive UX issue
    - COLORS.black was #f0f0e8 (matching card BG) → invisible spades/clubs

---

## TASK E — Claude Bot MEMORY.md for Caps (agent: claude-memory-agent)

E1. Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md

E2. Update it with full current state:
    - Build #104
    - All Iron Rules (Rule 2 UNLOCKED)
    - Visual theme system (Classic/Five-O)
    - Orientation choice system
    - WhatsApp bot v15
    - All architecture decisions
    - Deploy commands
    - Pending items

---

## FINAL STEPS
1. git add -A in C:/Projects/Caps
2. git commit -m "docs: master knowledge base v2, VAMOS guide, skills library, session log [v1.9.3-b104]"
3. git push origin main
4. git add -A in C:/Projects/ZProjectManager
5. git commit -m "docs: VAMOS methodology guide, reusable skills from Caps Poker"
6. git push origin master
7. Report: all files written, summary of key findings

VAMOS CAPS KNOWLEDGE-PRESERVATION — END
