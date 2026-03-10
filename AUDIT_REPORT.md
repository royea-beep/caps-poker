# Caps Poker — Cross-Project Audit Report

## Immediate Wins (copy as-is this sprint)

| Item | Source Project | File | What it does |
|------|---------------|------|-------------|
| Theme spacing/radius/shadows | Wingman | `apps/mobile/src/theme/spacing.ts` | Complete spacing scale (xs→xxxl), radius, fontSize, shadow presets including glow — production-ready design tokens |
| Color system | Wingman | `apps/mobile/src/theme/colors.ts` | Full color palette with semantic colors, gradients, dark mode — adapt brand colors for poker |
| Typography weights | Wingman | `apps/mobile/src/theme/typography.ts` | Font weight scale (regular→black) for consistent text hierarchy |
| Loading skeleton | Wingman | `apps/mobile/src/components/LoadingSkeleton.tsx` | Composable pulse-animated skeleton shapes (rect, circle, line) — much better than spinners |
| Spring animation configs | Wingman | `apps/mobile/src/components/Button.tsx` | Proven spring physics configs for press feedback (friction/tension/bounciness tuned) |

## Quick Adaptations (minor changes needed)

| Item | Source Project | File | Changes needed |
|------|---------------|------|---------------|
| Button component | Wingman | `apps/mobile/src/components/Button.tsx` | 5 variants with spring press animation, loading state, gradient support — adapt variants for poker actions (Ready, Place Card) |
| Card container component | Wingman | `apps/mobile/src/components/Card.tsx` | Pressable card with shadow presets, gradient header — adapt for player info cards and summary cards |
| Badge component | Wingman | `apps/mobile/src/components/Badge.tsx` | Status badges with spring entrance animation — adapt for hand rankings, win/loss indicators |
| DailyRewardModal pattern | Wingman | `apps/mobile/src/components/DailyRewardModal.tsx` | Full-screen celebration with coin animation, sparkle particles, sequence animations — adapt for COMPLETE bonus overlay |
| Zustand persist middleware | crypto-arb-bot (pattern) | N/A (Zustand built-in) | Replace manual AsyncStorage calls in gameStore.ts with `zustand/middleware/persist` + `partialize` for selective persistence |
| Rate limiter | shared-utils | `src/rate-limit/index.ts` | In-memory sliding window rate limiter — use for throttling rapid card placements. Zero deps, copy as-is |
| FlushQueue event buffer | FlushQueue | `src/index.ts` | Client-side event batching with retry + persistent storage adapter — adapt for game analytics/event logging |
| EAS build config | royea-mobile-launch-kit | `scripts/init-project.js` | Run init-project.js to generate eas.json + docs for Caps. Needs Apple credentials filled in |

## Architecture Improvements

### 1. State Machine for Game Phases (from crypto-arb-bot patterns)
Current game.tsx uses multiple boolean flags (playerReady, botReady, phase string). Replace with discriminated union:
```typescript
type GamePhase =
  | { type: 'arrangement'; timeRemaining: number; playerReady: boolean; botReady: boolean }
  | { type: 'reveal'; currentBoardIndex: number }
  | { type: 'summary'; netChips: number; isComplete: boolean };
```
Makes invalid states impossible, transitions explicit and testable.

### 2. Extract Custom Hooks (from crypto-arb-bot async loop patterns)
- `useGameTimer(initialSeconds, onTick)` — reusable countdown with pause/reset
- `useRevealSequence(boards, results, config)` — encapsulated reveal state machine with cancel support
- Simplifies game.tsx significantly, moves complex logic out of component

### 3. Zustand Persist Middleware
Replace manual `persistChips()` / `loadPersistedData()` with:
```typescript
create()(persist((set, get) => ({ ... }), {
  name: 'caps_poker_store',
  storage: AsyncStorage,
  partialize: (state) => ({ chips: state.chips }),
}))
```

### 4. Design System from Wingman
Copy Wingman's complete theme folder (`colors.ts`, `spacing.ts`, `typography.ts`) and adapt colors for dark casino aesthetic. Gives consistent spacing, shadows, and typography across all components.

## TestFlight Path

**Fastest path: ~45 minutes using royea-mobile-launch-kit + EAS Build**

1. Create `capspoker.values.json` with app name, bundle ID, Apple credentials (2 min)
2. Run `node scripts/init-project.js --values capspoker.values.json --target /c/Projects/Caps` — generates eas.json + docs (1 min)
3. Run preflight validator: `node packages/mobile-preflight/bin/preflight.js --root /c/Projects/Caps` (1 min)
4. Apple Developer Portal: register bundle ID `com.capspoker.app`, create App Store Connect app, generate API key (15 min)
5. Fill Apple credentials in eas.json (1 min)
6. `eas build --platform ios --profile production` (15 min build + 10 min Apple processing)
7. TestFlight → Add internal testers → Install

**Key files from kit:**
- `/c/Projects/royea-mobile-launch-kit/scripts/init-project.js` — project templating
- `/c/Projects/royea-mobile-launch-kit/packages/mobile-preflight/bin/preflight.js` — 23-point pre-build validator
- `/c/Projects/royea-mobile-launch-kit/templates/docs/FIRST_BUILD_CHECKLIST.template.md` — step-by-step Apple portal guide
- `/c/Projects/royea-mobile-launch-kit/templates/docs/FAILURE_MODES.md` — 10 common issues + fixes
- `/c/Projects/royea-mobile-launch-kit/examples/wingman.values.json` — Expo project example values

## Skipped Items

| Item | Source | Reason |
|------|--------|--------|
| ftable poker logic | ftable | Tournament management platform, no game simulation code. No hand evaluator, no card components, no game state |
| ftable-hands evaluator | ftable-hands | Video OCR/processing pipeline for tournament footage, no poker game logic |
| Content filter | shared-utils | Hebrew/English profanity filter — not needed for single-player vs bot |
| Error handler | shared-utils | Browser-specific (window events, sendBeacon) — needs heavy adaptation for React Native |
| Analytics tracker | shared-utils | Web-specific auto-tracking (scroll, visibility) — would need full rewrite for RN |
| Auth/JWT | shared-utils | No backend, no user accounts (Iron Rule 6) |
| Crypto (AES-256) | shared-utils | No sensitive data to encrypt in local-only game |
| Circuit breaker | shared-utils | No API calls to protect (Iron Rule 6: no backend) |
| i18n | shared-utils | Single language for now, not in scope |
| ZProjectManager patterns | ZProjectManager | Electron desktop app — audit trail and session memory are interesting but overkill for a card game |
| CURSOR_MEGA_PROMPT techniques | CURSOR_MEGA_PROMPT.md | Already implemented: Iron Rules in MEMORY.md, structured task breakdown, status embedding, subagent delegation |
| PostPilot UI | PostPilot | Next.js web app — toast/status patterns not directly portable to React Native |
| ExplainIt UI | ExplainIt | Next.js web app — glassmorphism effect (backdrop-filter) not available in React Native |
| Wingman bottom-sheet modal | Wingman | `@gorhom/bottom-sheet` — adds dependency, not needed for current screens |
