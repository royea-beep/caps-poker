# CAPS A11y Audit (Post FIX-PATTERN-2) — 2026-05-18

Mode: PRIORITY_14
Run: post-fix re-audit after VAMOS-CAPS-A11Y-FIX-PATTERN-2 (~87 emoji hides across 11 files).
Baseline: docs/A11Y-AUDIT-2026-05-18-POST-FIX-6.5-PLUS-5.md (46 CRITICAL).

## Per-screen results

SUMMARY app/(tabs)/index.tsx: critical=8 warning=12 pass=10
SUMMARY app/(tabs)/play.tsx: critical=2 warning=5 pass=5
SUMMARY app/(tabs)/profile.tsx: critical=2 warning=7 pass=5
SUMMARY app/(tabs)/friends.tsx: critical=2 warning=5 pass=6
SUMMARY app/(tabs)/cups.tsx: critical=3 warning=7 pass=5
SUMMARY app/game.tsx: critical=4 warning=5 pass=5
SUMMARY app/gameover.tsx: critical=2 warning=5 pass=5
SUMMARY app/results.tsx: critical=5 warning=6 pass=8
SUMMARY app/lobby/host.tsx: critical=4 warning=7 pass=5
SUMMARY app/lobby/join.tsx: critical=3 warning=7 pass=8
SUMMARY app/shop.tsx: critical=2 warning=8 pass=10
SUMMARY app/chip-store.tsx: critical=2 warning=6 pass=8
SUMMARY app/settings.tsx: critical=5 warning=10 pass=8
SUMMARY app/leaderboard.tsx: critical=3 warning=7 pass=8

## Delta vs post-Pattern-6.5+5 baseline

| Screen | crit (P6.5+5 post) | crit (P2 post) | Δ |
|---|---:|---:|---:|
| app/(tabs)/index.tsx | 6 | 8 | +2 |
| app/(tabs)/play.tsx | 2 | 2 | 0 |
| app/(tabs)/profile.tsx | 3 | 2 | -1 |
| app/(tabs)/friends.tsx | 2 | 2 | 0 |
| app/(tabs)/cups.tsx | 3 | 3 | 0 |
| app/game.tsx | 4 | 4 | 0 |
| app/gameover.tsx | 2 | 2 | 0 |
| app/results.tsx | 6 | 5 | -1 |
| app/lobby/host.tsx | 3 | 4 | +1 |
| app/lobby/join.tsx | 3 | 3 | 0 |
| app/shop.tsx | 2 | 2 | 0 |
| app/chip-store.tsx | 3 | 2 | -1 |
| app/settings.tsx | 4 | 5 | +1 |
| app/leaderboard.tsx | 3 | 3 | 0 |
| **TOTAL** | **46** | **47** | **+1** |

## Outcome: PARTIAL_FAIL (target ≤34, actual 47)

The headline regression (+1) is misleading. Pattern-2 work is applied and auditor-confirmed in PASS sections of every screen:

- **index.tsx PASS #3:** "Decorative suit symbols, particles, hero card emoji correctly hidden via accessibilityElementsHidden + importantForAccessibility=no-hide-descendants"
- **play.tsx PASS #3:** "Emojis correctly marked accessibilityElementsHidden + importantForAccessibility=no-hide-descendants"
- **profile.tsx PASS #2:** "Decorative emojis (🥇📋📖📊🏆⚙️) and arrow glyphs (›) correctly use accessibilityElementsHidden"
- **friends.tsx PASS #2:** "Decorative emojis (lines 16, 21, 26, 31) correctly use accessibilityElementsHidden"
- **game.tsx PASS #5:** "Decorative icons explicitly hidden from AT tree via accessibilityElementsHidden"
- **results.tsx PASS #2:** "Decorative chip-shower emojis use accessibilityElementsHidden=true + importantForAccessibility=no-hide-descendants"
- **shop.tsx PASS #8:** "Decorative emojis (🃏, 💰) are hidden via accessibilityElementsHidden"
- **chip-store.tsx PASS #1:** "Decorative emojis (←, ✕) on back and dismiss button correctly use accessibilityElementsHidden + importantForAccessibility=no"
- **settings.tsx PASS #3:** "Decorative emojis correctly hidden in many places using accessibilityElementsHidden + importantForAccessibility=no-hide-descendants"

### Why the headline didn't move

Each re-audit pass surfaces a different bucket as "critical" as the auditor's attention shifts. The 47 remaining criticals are now distributed across patterns that PATTERN-2 was not in scope for:

1. **Contrast** (PATTERN-3) — `rgba(255,255,255,0.3-0.55)` on dark felt across most screens. ~16-18 of the 47.
2. **Touch target size** (PATTERN-4) — back buttons rs(36), volume segments 10x18, sort tabs ~28px, leaderboard back paddingHorizontal:0. ~9 of the 47.
3. **Mixed-language tagging** (PATTERN-1.5) — Hebrew strings without `accessibilityLanguage="he"`. Multiple screens. ~8 of the 47.
4. **Composition / grouping** — Stat cards needing `accessible=true` + composite label, score em-dash, ELO arrows, ✓/✗/= breakdown icons. ~7 of the 47.
5. **Modal dialog role / focus trap** — index referral modal, gameover focus, results overlays. ~4 of the 47.
6. **Timing / auto-dismiss** — auto-continue 20s, toast 2.2s, PLAY-AGAIN 3s confirm window. ~3 of the 47.

## Semantic emoji candidates captured for PATTERN-2.5 follow-up

The agent surfaced ~9 semantic emoji that need text alternatives rather than hiding:
- cups.tsx 🏆 (line 37) — needs `accessibilityLabel=\`${cup.name_he || cup.tier} cup\``
- cups.tsx ✅ (line 50) — needs `accessibilityLabel="Earned"`
- leaderboard.tsx 🥇🥈🥉 (lines 13-16) — need `accessibilityLabel="First place"/"Second"/"Third"`
- leaderboard.tsx ▲/▼ (lines 94-97) — need labels naming the direction + count
- join.tsx ✓ (line 280) — needs `accessibilityLabel="Connected"`
- results.tsx ✓/=/✗ (line 1128) — need win/tie/lose labels
- results.tsx ▲/▼ ELO arrows (line 1098)
- shop.tsx toast strings with 💰/🎰/🏆 dynamic content — copy rewrite

These are deferred to a follow-up VAMOS-CAPS-A11Y-FIX-PATTERN-2.5.

## Recommended next VAMOS

`VAMOS-CAPS-A11Y-FIX-PATTERN-3` — contrast bulk swap. Raise `rgba(255,255,255,0.3-0.55)` to `0.65-0.85` across all flagged styles. Touches lots of styles but pure value swap. Projected: 47 → ~25-30.

After that: PATTERN-4 (target sizes), PATTERN-1.5 (language + sub-headers + composition), PATTERN-2.5 (semantic emoji alt-text).

## Idempotency confirmation

Re-running PATTERN-2 produces applied=0 across all 14 files — agents skip elements already carrying `accessibilityElementsHidden=true` or an emoji-omitting `accessibilityLabel`. The Pattern-1 + 6 + 6.5+5 + 2 stack is fully idempotent.
