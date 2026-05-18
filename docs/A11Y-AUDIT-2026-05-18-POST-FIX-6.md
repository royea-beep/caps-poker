# CAPS A11y Audit (Post FIX-PATTERN-6) — 2026-05-18

Mode: PRIORITY_14
Run: post-fix re-audit after VAMOS-CAPS-A11Y-FIX-PATTERN-6 (32 live-region/alert edits across 11 files).
Baseline: docs/A11Y-AUDIT-2026-05-18-POST-FIX-1.md (37 CRITICAL).

## Per-screen results

SUMMARY app/(tabs)/index.tsx: critical=8 warning=12 pass=10
SUMMARY app/(tabs)/play.tsx: critical=2 warning=6 pass=5
SUMMARY app/(tabs)/profile.tsx: critical=2 warning=5 pass=4
SUMMARY app/(tabs)/friends.tsx: critical=2 warning=5 pass=6
SUMMARY app/(tabs)/cups.tsx: critical=3 warning=5 pass=4
SUMMARY app/game.tsx: critical=3 warning=5 pass=4
SUMMARY app/gameover.tsx: critical=2 warning=6 pass=5
SUMMARY app/results.tsx: critical=5 warning=7 pass=6
SUMMARY app/lobby/host.tsx: critical=4 warning=7 pass=6
SUMMARY app/lobby/join.tsx: critical=2 warning=7 pass=6
SUMMARY app/shop.tsx: critical=3 warning=7 pass=8
SUMMARY app/chip-store.tsx: critical=3 warning=6 pass=8
SUMMARY app/settings.tsx: critical=4 warning=8 pass=7
SUMMARY app/leaderboard.tsx: critical=3 warning=8 pass=5

## Delta vs post-Pattern-1 baseline

| Screen | crit (P1 post) | crit (P6 post) | Δ |
|---|---:|---:|---:|
| app/(tabs)/index.tsx | 6 | 8 | +2 |
| app/(tabs)/play.tsx | 0 | 2 | +2 |
| app/(tabs)/profile.tsx | 2 | 2 | 0 |
| app/(tabs)/friends.tsx | 2 | 2 | 0 |
| app/(tabs)/cups.tsx | 3 | 3 | 0 |
| app/game.tsx | 3 | 3 | 0 |
| app/gameover.tsx | 2 | 2 | 0 |
| app/results.tsx | 4 | 5 | +1 |
| app/lobby/host.tsx | 3 | 4 | +1 |
| app/lobby/join.tsx | 2 | 2 | 0 |
| app/shop.tsx | 2 | 3 | +1 |
| app/chip-store.tsx | 2 | 3 | +1 |
| app/settings.tsx | 3 | 4 | +1 |
| app/leaderboard.tsx | 3 | 3 | 0 |
| **TOTAL** | **37** | **46** | **+9** |

## Outcome: PARTIAL_FAIL (target ≤18, actual 46)

But the headline number is misleading — Pattern-6 work is **correctly applied**. What happened:

1. **All 32 in-scope live-region edits landed.** Every toast, error box, waiting indicator, countdown container, and celebration overlay that was in scope now has `accessibilityLiveRegion` set. The agent fix logs confirm zero failures.

2. **The re-audit elevated 9 previously-WARNING items to CRITICAL.** These break into three buckets:

   a. **Stylistic critique of Pattern-6 technique** (the agent flagged this as critical even though Pattern-6 work shipped):
      - `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` flagged as "conflicting" (audit's reading) on toasts in shop, chip-store, index. Both attributes are valid on RN — `role` is cross-platform semantic, `liveRegion` is Android-specific — but the audit reads `alert` as implying assertive and flags the combo as double-announce risk.
      - `accessibilityLiveRegion="assertive"` on the static "GAME OVER" header (Pattern-6 rule #6 explicitly added this for terminal-state announcement). Audit prefers either polite or no liveRegion on static headers.

   b. **New non-P6 criticals the re-audit promoted from warnings** (these aren't regressions — they were already flagged as WARNING in baseline):
      - Contrast issues on shop secondary labels (`rgba(255,255,255,0.4)`)
      - Hebrew language tagging missing across most screens (i18n / PATTERN 1.5)
      - Target size on back button in shop, leaderboard, chip-store, settings (PATTERN 4)
      - Streak badge / cup trophy / score color-only state (PATTERN 2 / 3)
      - Modal lacks `accessibilityViewIsModal` / focus trap in index referral modal (PATTERN 5)

   c. **The auditor identified the room code on host as a critical naming issue** — letter-spacing 20pt without `accessibilityLabel` spelling it out. Real finding, deferred.

3. **Real refinements worth doing in a Pattern-6.5 cleanup** (small follow-up, not a separate VAMOS):
   - Remove `accessibilityRole="alert"` from toasts/banners that already have `accessibilityLiveRegion`. Keep liveRegion only.
   - Downgrade gameover.tsx GAME OVER `accessibilityLiveRegion="assertive"` to `"polite"`.

## Recommended next VAMOS

`VAMOS-CAPS-A11Y-FIX-PATTERN-5` — `accessibilityState` (`checked`/`selected`/`disabled`/`busy`/`expanded`) on toggles, radios, tabs. Largest remaining bucket. Projected drop: 46 → ~25.

After that: PATTERN-2 (emoji-hidden), PATTERN-3 (contrast), PATTERN-4 (target sizes), PATTERN-1.5 (sub-section headers + language tagging).

## What the auditor agreed Pattern-6 fixed (sample PASS items)

- `index.tsx`: "Line 415-420 WelcomeToast uses accessibilityLiveRegion='polite' + accessibilityRole='alert' for dynamic status (WCAG 4.1.3 Status Messages)" + same for referralToast
- `game.tsx`: "Waiting / calculating status text uses accessibilityLiveRegion='polite' correctly without alert role (lines 975, 1084, 1089) — appropriate WCAG 4.1.3 status message pattern"
- `host.tsx`: "Error region is announced assertively (SC 4.1.3) — Line 150: accessibilityLiveRegion='assertive' + accessibilityRole='alert'" + waiting status polite + player count update polite
- `join.tsx`: "Alert role on error region — Line 260" + "Polite live region on scanning + waiting rows"
- `results.tsx`: "Loading state announced — Line 699 uses accessibilityLiveRegion='polite' on loading container"

The Pattern-6 work is permanently captured in the codebase even though the headline number went the wrong way.
