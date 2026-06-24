# VAMOS CAPS GAME-MODES-OVERHAUL — Phase 1 (Unify game graphics)

**Date:** 2026-06-24 · **Branch:** `feat/play-overhaul`
**Scope:** Phase 1 only. Phase 2 (lobby) and Phase 3 (removals) NOT started — reporting first per owner.

## Profile (quoted) — two render paths confirmed
- **Solo = `app/game.tsx`** (`GameScreen`, ~2019 lines): reads `config.numberOfPlayers` (2/3/4 → 4/3/2
  boards), renders the polished screen: topBar → bot-status bar → `<TimerBar>` → **`<BoardArrangement>`**
  (rich arrange UI: auto-fill, undo, time-bank, tutorial) → `<BoardReveal>`. Launched everywhere via
  `router.push('/game')` (home ×3, stats, rank, heatmap…). Launch mechanism = `updateConfig({numberOfPlayers})`
  then push `/game`.
- **Sit&Go = `app/sit-and-go.tsx`** (1161 lines): its OWN entry → lobby ("Filling bots…" + a *fake*
  "Coming Soon" room-code preview) → playing phase rendered with a direct `<Board>` + bespoke score-strip,
  NOT `<BoardArrangement>`. A different, simpler in-game screen.

## Owner decisions (this session)
1. **Unify by routing** all modes → `/game` with per-mode config; retire Sit&Go's bespoke render; NO
   refactor of the 2000-line core.
2. **The 3 game types = player-count configs:** 2P (4 boards) / 3P (3) / 4P (2). Lobby = 3 types × 2 open
   tables = 6, each launching `/game`.

## Phase 1 change (done)
`app/sit-and-go.tsx` → **thin redirect**: `updateConfig({numberOfPlayers:4})` + `router.replace('/game')`.
The bespoke entry/lobby/playing render is retired; tapping Sit&Go now lands on the SAME unified `game.tsx`
screen as Single Player. No source file imported Sit&Go's internals (route-only), so the swap is contained.

**Verify:** `tsc` 0 · `jest` 2505/2505. Solo and Sit&Go now render identically (both ARE `/game`).
Rendered proof of the unified screen = the existing `/game` screen (unchanged).

## Phase 2 mockup (for approval BEFORE code)
`docs/mockups/play-lobby-mockup.html` (+ rendered `play-lobby-mockup.png`): Play surface with the TWO
options (Single Player · Multiplayer Lobby) and the Lobby — 3 type sections (2P/3P/4P) × 2 open tables
(seats filled/total, Join/Full, "+ Create table", per-table invite code, auto-start-when-full note).

## Not done (await approval / next sessions)
- **Phase 2:** build the real lobby on the internet-MP realtime layer (`app/multiplayer-game.tsx`),
  open-tables list, create-table, invite-by-code; fold in the placement-timer auto-place-on-timeout fix.
- **Phase 3:** remove Quick Poker / Tournament / local WiFi Host+Join from the Play surface; clean dead
  routes (incl. retiring this Sit&Go redirect once the lobby covers it).

## Constraints
No deploy/OTA/build/submit. Branch `feat/play-overhaul`. Owner authorizes any deploy.
