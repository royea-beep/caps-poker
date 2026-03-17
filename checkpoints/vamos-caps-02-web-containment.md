# Checkpoint — VAMOS CAPS 02: Web Widescreen Containment Fix
**Date:** 2026-03-13
**Version:** Post CAPS 02

## What Changed
- Created `components/WebContainer.tsx` — reusable layout wrapper
- Applied WebContainer at `app/_layout.tsx` (root level) so ALL screens get containment
- Removed ad-hoc per-screen web maxWidth hacks from `app/index.tsx` and `app/results.tsx`

## Files Changed
| File | Action |
|------|--------|
| `components/WebContainer.tsx` | **Created** — web containment wrapper (max 480px, centered, dark gutters) |
| `app/_layout.tsx` | **Edited** — wrapped Stack in WebContainer |
| `app/index.tsx` | **Edited** — removed 2 redundant Platform.select web maxWidth blocks |
| `app/results.tsx` | **Edited** — removed 1 redundant Platform.select web maxWidth block |

## Behavior After Fix
- **Web (wide browser):** Game renders in a centered 480px column with dark (#050f0a) gutters
- **Web (narrow/phone):** No change, column fills available width naturally
- **iOS/Android:** Zero impact — WebContainer is a transparent flex:1 pass-through on native

## Design Decisions
- 480px max-width chosen to match phone portrait feel (matches iPhone 14 viewport)
- Dark gutter color (#050f0a) is darker than felt green (#0a3d1f) for subtle depth separation
- Applied at root layout level (not per-screen) for single-point-of-control
- NO landscape mode added, NO user toggle, NO widescreen game mode
