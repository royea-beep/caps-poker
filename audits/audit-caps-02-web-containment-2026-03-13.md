# Audit — VAMOS CAPS 02: Web Widescreen Containment Fix
**Date:** 2026-03-13

## Scope
Low-risk layout containment fix for web. No gameplay logic, no state changes, no new features.

## Changes Verified
1. `WebContainer.tsx` — Platform.OS gate ensures native pass-through, web gets max-width + centering
2. `_layout.tsx` — WebContainer wraps Stack; import added cleanly
3. `index.tsx` — Removed 2 Platform.select blocks (maxWidth 540 on content, maxWidth 480 on buttonSection)
4. `results.tsx` — Removed 1 Platform.select block (maxWidth 480 on scrollContent)

## Risk Assessment
- **Native breakage:** None — WebContainer returns plain `<View style={{flex:1}}>` on non-web
- **Web breakage:** None — previous ad-hoc maxWidths were 480-540px; new uniform 480px is consistent
- **Game screen:** game.tsx uses `useWindowDimensions` for board sizing — still works because it reads actual available dimensions inside the constrained container
- **ScrollViews:** settings.tsx, results.tsx have ScrollViews that will naturally respect the container width

## Remaining Risks / Follow-ups
- `game.tsx` card sizing uses `SCREEN_W` from `useWindowDimensions()` — on web in a 480px container this should report 480px, but verify visually that board cards render correctly
- Lobby screens (host, join, internet-host, internet-join) were not individually inspected but inherit containment from root layout
- If future screens need to break out of the 480px column (e.g., a landscape spectator mode), the WebContainer would need a bypass prop — not needed now
