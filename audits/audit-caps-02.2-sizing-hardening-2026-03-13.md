# Audit — VAMOS CAPS 02.2: Defensive Sizing Hardening
**Date:** 2026-03-13

## Scope
Replace accidental-cap-based safety with explicit width clamping in 2 files that use `useWindowDimensions().width` for card sizing on web.

## Changes
1. `components/WebContainer.tsx` — `MAX_WIDTH` renamed to `WEB_MAX_WIDTH` and exported. Single source of truth for the web containment width.
2. `app/results.tsx` — `const { width: rawW } = useWindowDimensions(); const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;`
3. `components/PlayerHand.tsx` — Same pattern applied.

## Why This Is Safer
Before: `useWindowDimensions()` returned full browser width (e.g., 1920px) on web. Card sizing formulas computed absurd intermediate values (338px, 235px) that were only saved by downstream `Math.min(42/40)` caps. If anyone later adjusted or removed those caps, cards would render oversized.

After: The width input itself is clamped to 480px on web. The formulas now compute correct intermediate values (e.g., `availableW = 480 - 58 = 422`, `rawCardW = floor(422/5.5) = 76`, then `Math.min(42, 76) = 42`). The Math.min caps remain as a secondary safety net, but the primary protection is the correct input.

## Risk Assessment
- **Native impact:** Zero — `Platform.OS === 'web'` guard means native path is untouched
- **Web visual change:** None — final card sizes were already at the cap values; clamping the input doesn't change the output
- **Single source of truth:** `WEB_MAX_WIDTH` is defined once in WebContainer.tsx, used by both the container layout and the sizing logic
