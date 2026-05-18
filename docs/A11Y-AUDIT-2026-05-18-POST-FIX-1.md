# CAPS A11y Audit (Post FIX-PATTERN-1) — 2026-05-18

Mode: PRIORITY_14
Run: post-fix re-audit after VAMOS-CAPS-A11Y-FIX-PATTERN-1 (120 edits across 14 files).
Baseline: docs/A11Y-AUDIT-2026-05-18.md (94 CRITICAL).

## Per-screen results

SUMMARY app/(tabs)/index.tsx: critical=6 warning=14 pass=12
SUMMARY app/(tabs)/play.tsx: critical=0 warning=4 pass=6
SUMMARY app/(tabs)/profile.tsx: critical=2 warning=6 pass=5
SUMMARY app/(tabs)/friends.tsx: critical=2 warning=5 pass=5
SUMMARY app/(tabs)/cups.tsx: critical=3 warning=8 pass=4
SUMMARY app/game.tsx: critical=3 warning=6 pass=5
SUMMARY app/gameover.tsx: critical=2 warning=5 pass=4
SUMMARY app/results.tsx: critical=4 warning=12 pass=8
SUMMARY app/lobby/host.tsx: critical=3 warning=6 pass=4
SUMMARY app/lobby/join.tsx: critical=2 warning=8 pass=5
SUMMARY app/shop.tsx: critical=2 warning=7 pass=6
SUMMARY app/chip-store.tsx: critical=2 warning=7 pass=10
SUMMARY app/settings.tsx: critical=3 warning=8 pass=7
SUMMARY app/leaderboard.tsx: critical=3 warning=7 pass=4

## Delta vs baseline

| Screen | crit before | crit after | Δ |
|---|---:|---:|---:|
| app/(tabs)/index.tsx | 14 | 6 | -8 |
| app/(tabs)/play.tsx | 5 | 0 | -5 |
| app/(tabs)/profile.tsx | 6 | 2 | -4 |
| app/(tabs)/friends.tsx | 5 | 2 | -3 |
| app/(tabs)/cups.tsx | 3 | 3 | 0 |
| app/game.tsx | 7 | 3 | -4 |
| app/gameover.tsx | 2 | 2 | 0 |
| app/results.tsx | 12 | 4 | -8 |
| app/lobby/host.tsx | 5 | 3 | -2 |
| app/lobby/join.tsx | 6 | 2 | -4 |
| app/shop.tsx | 8 | 2 | -6 |
| app/chip-store.tsx | 7 | 2 | -5 |
| app/settings.tsx | 10 | 3 | -7 |
| app/leaderboard.tsx | 4 | 3 | -1 |
| **TOTAL** | **94** | **37** | **-57** |

## Outcome

- Target ≤24 — **not quite met (37)**. Verdict: **PARTIAL_OK**.
- All in-scope FIX-PATTERN-1 items (Pressable role+label, title header role) shipped.
- The 37 remaining CRITICAL items are entirely from out-of-scope patterns the re-audit re-classified as critical:
  - Live regions on toasts/errors/countdowns (→ FIX-PATTERN-6)
  - `accessibilityState` (checked/selected/disabled/busy) on toggles, radios, tabs (→ FIX-PATTERN-5)
  - Section headers (h2-level subtitles) without role="header" (→ extend PATTERN-1 in a follow-up pass)
  - Color-only state indicators on score/streak/badge (→ FIX-PATTERN-3)
  - Decorative emoji not hidden from AT (→ FIX-PATTERN-2)

The first-pass audit listed some of these as WARNING; the second pass treated them as CRITICAL given mobile platform conventions. Net signal: Pattern-1 cleanly removed every issue it targeted, exposing the next-priority work.

## Recommended next VAMOS

`VAMOS-CAPS-A11Y-FIX-PATTERN-6` — accessibilityLiveRegion + role="alert" on dynamic status messages. Touches toasts, errors, countdowns, status text. Estimated CRITICAL drop: 37 → ~18.

After that, FIX-PATTERN-5 (state) → ~8 remaining, FIX-PATTERN-2 (emoji) → ~3 remaining, FIX-PATTERN-3 (contrast/color-only) closes the rest.
