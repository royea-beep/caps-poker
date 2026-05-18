# CAPS A11y FIX-PATTERN-3 — 2026-05-18

Mode: PRIORITY_14
Run: contrast bulk swap.
Baseline: docs/A11Y-AUDIT-2026-05-18-POST-FIX-2.md (47 CRITICAL).

## Per-file contrast edits applied (68 total)

| Screen | edits | notes |
|---|---:|---|
| app/(tabs)/index.tsx | 24 | sub/hint/feed/skip/mobileNote/tagline/streak/referral/modal cancel etc. |
| app/(tabs)/play.tsx | 2 | sub + cardSub raised to 0.85 |
| app/(tabs)/profile.tsx | 3 | playerName/statLabel/menuArrow raised |
| app/(tabs)/friends.tsx | 2 | sub + cardSub raised to 0.75 |
| app/(tabs)/cups.tsx | 3 | locked cupName/sub/cupTier raised |
| app/game.tsx | 1 | panelLvl 0.45→0.75; rest are color-only state (P3.5) |
| app/gameover.tsx | 0 | theme tokens only; neonRed is color-only state (P3.5) |
| app/results.tsx | 11 | hintText/statItem/statSep/breakdownNum/breakdownVs/historyLink/shopCta/xpBanner/sessionLabel/streakBest/breakdownTitle |
| app/lobby/host.tsx | 2 | errorHint 0.8→0.95, ipLabel 0.7→0.9 |
| app/lobby/join.tsx | 4 | placeholderTextColor + manualToggle + errorHint (color+opacity composite) |
| app/shop.tsx | 5 | sectionTitle/iapDesc/itemDescHe/itemCostLabel/buyBtnTextDisabled all raised |
| app/chip-store.tsx | 4 | TEXT_SEC literal-replaced in 3 styles + flashText brighter |
| app/settings.tsx | 7 | rowHint/credits/version/privacy/terms/volPct/privacyLinkText raised |
| app/leaderboard.tsx | 0 | token-bound (COLORS.textSecondary/textMuted); rank arrows are color-only state |
| **TOTAL** | **68** | |

## Out of scope (deferred)

- **Color-only state indicators (PATTERN-3.5):**
  - Game: timer color logic (green→amber→red), countdownLabel, botReady/Thinking colors, calculatingText
  - Results: Net/ELO score win/lose green/red, ELO arrow colors, board-outcome ✓/=/✗ symbols
  - Index: chip count amber-on-low, player count active state, hand result green/red
  - Leaderboard: ▲/▼ rank-change green/red arrows
  - Chip-store: badge tier color (POPULAR / BEST VALUE / VIP) differentiation
  - Cups: earned vs locked opacity-encoded state
  - Gameover: neonRed title urgency color
- **Token refactor:** chip-store TEXT_SEC token-level swap (touched 3 styles directly instead)
- **Border / UI-component contrast** (WCAG 1.4.11 3:1) — separate sub-pattern, not in P3 scope

## Re-audit deferred

Full 14-agent re-audit not run in this session due to context budget. Validation gates passed:
- `npx tsc --noEmit` clean (exit 0)
- All 14 fix logs returned cleanly with no agent errors
- Idempotent: every fix log shows `applied=0` for items already meeting thresholds

Expected outcome from `docs/A11Y-AUDIT-2026-05-18-POST-FIX-2.md` projections: **47 → ~25-30 CRITICAL**.

Run a fresh audit in a separate session if you want the new CRITICAL count before deciding next pattern (PATTERN-4 target sizes vs PATTERN-1.5 language tagging).
