# Checkpoint — VAMOS CAPS 02.2: Defensive Sizing Hardening
**Date:** 2026-03-13

## What Changed
- Exported `WEB_MAX_WIDTH` from `WebContainer.tsx` (renamed internal `MAX_WIDTH`)
- `results.tsx`: clamp `useWindowDimensions().width` to `WEB_MAX_WIDTH` on web before card sizing
- `PlayerHand.tsx`: same clamp applied

## Files Changed
| File | Action |
|------|--------|
| `components/WebContainer.tsx` | Renamed `MAX_WIDTH` → `WEB_MAX_WIDTH`, exported it |
| `app/results.tsx` | Import `WEB_MAX_WIDTH`, clamp raw width on web |
| `components/PlayerHand.tsx` | Import `WEB_MAX_WIDTH`, clamp raw width on web |

## Behavior
Visually unchanged — Math.min caps already prevented oversized cards. Now the input width itself is correct, so the caps serve as a secondary safety net rather than the only protection.
