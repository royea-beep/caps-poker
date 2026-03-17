# Full Audit — Caps Poker — 2026-03-13 (VAMOS CAPS 01)

## Project Overview
- **Name:** Caps Poker
- **Version:** 1.1.0 (build 15)
- **Stack:** React Native + Expo SDK 55 (React 19, RN 0.83), TypeScript strict
- **Platforms:** iOS (portrait-locked), Web (SPA via Vercel)
- **Status:** Sprint 44 complete, production build ready, App Store not yet submitted

## What Is Strong

### Core Game Logic
- Full Omaha hand evaluator — 60 combinations per hand, all edge cases covered
- 104+ passing tests (hand evaluation, simulation, game logic, stress)
- Multi-player support (2/3/4 players) with dynamic board/card scaling
- Zero-sum chip calculation with proper tie-split and remainder handling
- All game parameters runtime-configurable (Iron Rule 3)

### Architecture
- Clean file structure with clear separation of concerns
- Zustand with persist middleware — proper partialize for transient vs persisted state
- expo-router file-based navigation with proper back-stack handling
- Centralized config (gameConfig.ts), theme (theme.ts), types (gameTypes.ts)

### UI/UX
- Polished dark poker-felt theme with neon accents
- Animated card flips, chip count-ups, board-complete pulses
- Dynamic card sizing via useWindowDimensions (height-driven)
- Sound effects, haptics, timer color coding
- Hand hint indicator on full boards

### Multiplayer (Local/WiFi)
- Comprehensive TCP protocol with heartbeat, reconnection, validation
- Device-ID-based seat restoration
- Room code + manual IP discovery

## What Is Weak / Risky

### Internet Multiplayer — CRITICAL
- RealtimeServer/RealtimeClient lack methods that multiplayer-game.tsx calls
  (updateCallbacks, runRevealSequence, getDealtCards, etc.)
- Will crash at runtime when internet game starts
- This is the single biggest bug in the codebase

### Web Widescreen — NO containment on game screens
- index.tsx and results.tsx have maxWidth (480-540px)
- game.tsx, multiplayer-game.tsx, settings.tsx, leaderboard.tsx, gameover.tsx, all lobby screens: NO maxWidth
- On wide browsers, these screens stretch to full width — boards and cards spread across 1920px+
- Board.tsx uses `flex: 1` with no maxWidth — expands to fill any container

### Testing Gaps
- Zero component/UI tests (no RNTL, no snapshots)
- Zero integration or E2E tests
- Networking code (gameServer, gameClient, realtimeMultiplayer) untested
- Sound system untested

### Type Safety
- mpServer/mpClient typed as `any` in Zustand store
- Route paths cast with `as any` throughout (suppresses expo-router type checking)

### Deployment
- No CI/CD pipeline (all builds manual)
- No Android build profiles or Play Store config
- EAS build credits exhausted for March
- App Store screenshots are placeholder mockups, not real device captures
- .env file present in working directory (gitignored but risky)
- AuthKey .p8 file in project root

## What Is Missing

1. Landscape/widescreen support (by design — Iron Rule 2)
2. CI/CD pipeline
3. Android build/submit config
4. Real App Store screenshots
5. Custom fonts
6. React error boundaries
7. Analytics/crash reporting (no Sentry, no Firebase)
8. Accessibility beyond basic button labels
9. Real-device testing (noted as "Known Unknowns" in MEMORY.md)

## What Is Partially Built

1. **Internet multiplayer** — lobby works, game flow will crash (API mismatch)
2. **Leaderboard** — code complete, Supabase table exists, 0 real users
3. **Push notifications** — utils exist, settings toggle exists, no infrastructure
4. **App Store submission** — build ready, metadata/screenshots pending

## Widescreen Analysis

### Current Behavior
- iOS: Hard-locked portrait (app.json orientation + infoPlist)
- Web: No orientation enforcement. Game screens have no maxWidth constraint.
- Card sizing: Height-driven only (boardSpace calculation in game.tsx lines 50-55)
- Board component: `flex: 1` with no width cap
- PlayerHand: Width-driven via useWindowDimensions, fits 8 cards per row

### What Breaks on Wide Web
1. Boards stretch horizontally — cards spread far apart with huge gaps
2. Card rows (community, player, bot) center in a very wide space
3. PlayerHand calculates card width from full SCREEN_W — cards get oversized
4. No visual containment — poker table feeling is lost
5. Header/status elements stretch to edges

### Technical Implications
- **Minimal fix:** Add `maxWidth: 480` + `alignSelf: 'center'` to game.tsx, multiplayer-game.tsx, settings, leaderboard, gameover, lobby screens (same pattern as index.tsx). ~10 lines per file.
- **Proper fix:** Create a shared GameContainer wrapper component with maxWidth, use everywhere.
- **Landscape on mobile:** Would require rethinking the entire board stack layout (currently vertical: boards stacked → hand at bottom). Landscape would need side-by-side or scrollable boards. Major effort.
- **Tablet support:** Would need `supportsTablet: true` in app.json, iPad-specific layouts, potentially different card/board sizing tiers. Medium-large effort.

### UX/Gameplay Implications
- Portrait phone is the natural form factor for this game (stacked boards + hand at bottom)
- Widescreen web could look polished with simple maxWidth containment
- True landscape mobile would fundamentally change the arrangement UX — boards side-by-side changes how players scan and place cards
- Fairness: No competitive impact (single player or same-screen multiplayer)

### Recommendation
- **Do NOT add landscape/tablet support** — the vertical board stack is core to the game feel and the engineering cost is high
- **DO fix web containment** — add maxWidth to all game screens (low effort, high impact for web users)
- **No settings toggle needed** — web containment is pure improvement, not a mode choice
