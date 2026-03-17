# Audit — VAMOS CAPS 02.1: Web Containment Sizing Verification
**Date:** 2026-03-13

## Scope
Verify whether `useWindowDimensions()` sizing logic behaves correctly inside the new 480px WebContainer on wide desktop browsers.

## Key Finding
`useWindowDimensions()` on React Native Web reads from the browser **window** object, NOT from any parent container. On a 1920px browser, it still reports `width: 1920` even though WebContainer constrains visible layout to 480px.

## Per-Screen Analysis

### game.tsx — SAFE (no issue)
- Uses `useWindowDimensions().height` only (not width)
- Height-based board card sizing is unaffected by width containment
- Board/card layout is flex-based within `boardsColumn` which respects container width

### multiplayer-game.tsx — SAFE (no issue)
- Same formula as game.tsx — uses height only
- Identical safety profile

### results.tsx — SAFE (protected by cap)
- Uses `SCREEN_W` for card sizing: `availableW = SCREEN_W - 58`
- On 1920px browser: `availableW = 1862`, raw card = 338px
- **Math.min(42, ...)** caps card width to 42px regardless
- Visual: cards render correctly at 42px within the 480px column
- Latent risk: if cap is removed/raised, cards would be oversized

### PlayerHand.tsx (component) — SAFE (protected by cap)
- Uses `SCREEN_W` for card sizing: `availableW = SCREEN_W - 16`
- On 1920px browser: raw maxCardW = 235px
- **Math.min(40, ...)** caps card width to 40px regardless
- Visual: hand cards render correctly at 40px within the 480px column
- Latent risk: same as results.tsx

### gameover.tsx — SAFE (no dimensions used)
- Pure flex layout with centered content
- Inherits containment from WebContainer transparently

### lobby/host.tsx — SAFE (no dimensions used)
- Pure flex layout, no width-dependent calculations
- Inherits containment from WebContainer transparently

## Verdict
**No active bugs.** All width-dependent sizing has Math.min caps that prevent visual problems on wide screens. The 480px WebContainer correctly constrains all flex-based layout.

**Latent risk:** `useWindowDimensions()` reports full browser width (not container width) on web. Currently masked by Math.min caps in results.tsx and PlayerHand.tsx. If a future change removes or raises these caps, cards would size incorrectly on wide screens.

## Follow-up Needed?
**Not urgently.** The current implementation is visually correct. A hardening fix would replace the raw `useWindowDimensions().width` calls in results.tsx and PlayerHand.tsx with a container-aware width (e.g., `onLayout` measurement or a capped constant matching WebContainer's MAX_WIDTH). This is a "nice to have" defensive fix, not a required fix.

## Safest Fix Direction (if pursued)
Option A: Export MAX_WIDTH from WebContainer and use `Math.min(SCREEN_W, MAX_WIDTH)` in results.tsx and PlayerHand.tsx on web.
Option B: Use `onLayout` to measure actual container width at runtime.
Option A is simpler, deterministic, and sufficient since we control the max width.
