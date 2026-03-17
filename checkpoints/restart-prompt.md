# Restart Prompt — CAPS Poker

Use this to get up to speed fast in a new session.

## Current State
- **Project:** C:\Projects\Caps
- **Stack:** Expo (React Native) + TypeScript, expo-router, Zustand, Supabase
- **Platform:** iOS, Android, Web
- **Latest VAMOS:** CAPS TEST 02 (2026-03-13)
- **Total VAMOS completed:** 19 (CAPS 01-12, ECONOMY 01-07, TEST 01-02)

## What This App Is
Card game (poker variant) with single-player and multiplayer modes. Players arrange dealt cards across boards, hands are evaluated, chips change hands.

## Key Directories
- `app/` — Expo Router screens
- `components/` — Reusable UI components
- `constants/` — Config files (gameConfig, theme, networkConfig, economyConfig)
- `store/` — Zustand store (gameStore.ts)
- `utils/` — Game logic, multiplayer, economy, deck, sounds
- `audits/` — 22 audit reports
- `checkpoints/` — 22 checkpoint files + this restart prompt

## Multiplayer Status
- **WiFi (TCP):** Working — GameServer + GameClient
- **Internet (Supabase):** Repaired + hardened through CAPS 12
  - ACK/retry for CARDS_DEALT and HAND_COMPLETE
  - Server-authoritative seats, numeric room codes
  - Host-alive detection (5s grace)
  - Guest auto-ready on disconnect
  - 60s waiting timeouts
  - Manual rejoin with GAME_STATE_SNAPSHOT
  - **NOT yet E2E tested on real devices**

## Economy Status
- All scaffolding complete (ECONOMY 01-07)
- 5 feature flags in economyConfig.ts — **ALL FALSE**
- Zero behavior change while flags are off
- Wired in: SP game, MP game, home screen UI, lobby hosts
- Currency name: "chips" (do NOT rename until decided)

## What Is Ready
- Test execution sheet: `audits/audit-caps-test-02-execution-sheet-2026-03-13.md`
- Full test plan (35 scenarios): `audits/audit-caps-test-01-e2e-plan-2026-03-13.md`

## What To Do Next
1. **Run E2E tests** — 8 fast-confidence tests on 2 real devices
2. Fix any failures found
3. Enable economy flags one at a time
4. Wire trackChipsEarned for winnings (ECONOMY 08)

## Memory Files
- `memory/project_caps_state.md` — Full VAMOS progression + architecture
- `memory/caps-architecture-current.md` — File structure + module map
- `memory/caps-next-steps.md` — Prioritized action list
- `memory/caps-known-risks.md` — Open gaps + risk areas

## Key Decisions (Do NOT Reverse)
- No widescreen mode, no landscape, no orientation toggle
- WebContainer at root layout: 480px max, dark gutters on web
- Internet multiplayer: patched, NOT rewritten
- Economy flags default false — zero change until enabled
- Do NOT lock currency name yet
