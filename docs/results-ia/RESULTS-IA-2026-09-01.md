# RESULTS-IA — 2026-09-01 — the after-every-hand screen, 34 lines → a hierarchy

The results screen — the one a player sees after **every** hand — had 34 elements competing at one
altitude (audit `docs/screen-audit/SCREEN-AUDIT-2026-09-01.md`). This is the approved IA rethink:
a single outcome hero, the board reveal, one primary CTA, and **everything else collapsed behind one
toggle** — nothing deleted, everything one tap away. On the branch, **not merged, no version bump.**

Rendered from a real production web export (fixture-driven `/results`, Supabase blocked at the
network layer), solo, at **320 and 393**, before and after. `git show`/PNG paths at the bottom.

## The one change set (app/results.tsx only)
| # | Change | Proof |
|---|---|---|
| 1 | **Hero = the outcome.** `YOU WIN` + `2 — 1` + the tie tally stay large and first; nothing competes above the board reveal. | headline `YOU WIN`, score `2 — 1` at both widths |
| 2 | **Progressive disclosure.** XP banner, placement efficiency, best hand, stats row, session stats, board-by-board breakdown, hand-history link → all behind ONE `Hand details ▾` toggle. Default collapsed. | collapsed: xp/breakdown/boardByBoard/history = **false**; after tap: all **true** |
| 3 | **One primary CTA = ChipButton.** The sticky `DEAL ME IN` was a `DealMeInButton` with a **solid `#FFD700`** fill (the winner cue used as a button colour). Replaced with the app's `ChipButton` — mint fill, dark label, brass edge. Home/Share/Rematch stay quiet. | `playAgainBg = rgb(79,214,168)` (mint), `goldButtonHits = 0` |
| 4 | **Shop CTA moved OFF the post-hand flow.** The "💰 +N chips earned \| Visit Shop" Pressable is gone from results — selling after every hand cheapens the game. Chips earned still read in Net Result + stats. | `shopCta = false` even on a non-practice win |
| 5 | **coachingBtn `#FFD700` fixed.** Was `rgba(255,215,0,0.08)` (winner gold on a button fill) → `rgba(79,214,168,0.08)` (mint wash, matching its mint border + label). | `coachingBg = rgba(79,214,168,0.08)` |

## Tie tally — re-proven (DO NOT touch was honoured)
The board-tally arithmetic (`utils/boardTally.ts` + the `testID="board-tally"` render) is **byte-identical** —
not one character changed. Fixture `[player, player, tie, bot]`:

    2 — 1
    2 WON · 1 TIED · 1 LOST      (2 + 1 + 1 = 4 = boardCount)

Rendered identical at 320 and 393. `tied` is still a remainder (`total − won − lost`), so the three sum
to the board count by construction.

## Nothing became unreachable — where each collapsed row went
| Row | Before | After |
|---|---|---|
| Battle Pass XP (+XP, tier bar) | always visible | `Hand details` → visible (probe: xpBanner true when expanded) |
| Placement efficiency | always visible | `Hand details` |
| Best hand highlight | always visible | `Hand details` |
| Stats row (Boards / Net / Games) | always visible | `Hand details` |
| Session stats (2+ games) | always visible | `Hand details` |
| **Board-by-board breakdown** (compact) | always visible | `Hand details` (probe: boardByBoard/breakdownHand true when expanded) |
| Hand-history link (solo) | always visible | `Hand details` |
| Shop "Visit Shop" CTA | always visible (non-practice win) | **removed from flow** — chips still in Net Result + stats |
| Net Result, Current Balance, streak badge, COMPLETE banners, ELO, MP header | visible | **still visible** (outcome, not clutter) |
| The big BoardResultCard reveal (winner cue, card sizes) | visible | **still visible, untouched** |

## Solo vs MP — checked separately (MP by code-read, per brief)
MP results diverges from solo; the edits are MP-safe:
- **Kept visible in MP:** `mpResultHeader` (You beat X / ELO outcome), `eloChangeBadge`. The board reveal
  and the outcome hero are shared.
- **Same toggle governs MP details** (XP, efficiency, stats, session, breakdown) — one consistent hierarchy.
- **Solo-only paths untouched by mode:** the sticky `DEAL ME IN`→ChipButton swap, `coachingBtn`,
  `shareBtn`, `ShareSection`, and the hand-history link are all under `!isMultiplayer` — MP never renders them,
  so the swap cannot affect MP.
- **Known gap (documented, not silently skipped):** MP's primary restart is still the `⚡ REMATCH` `Button`
  (secondary variant), NOT yet a ChipButton. The solo sticky was the single clearest primary and the one
  carrying the `#FFD700` fill; chipifying MP's rematch is a separate, MP-divergent follow-up.

## Load-bearing values — untouched (verified)
Winner cue (`#FFD700` 3px, Card.tsx), card sizes, the 83px arc, `KILL_Board`, the tie-tally arithmetic:
none touched. `goldButtonHits = 0` across the screen — no `#FFD700` used as a button fill anywhere now.
`tsc --noEmit` exit 0.

## Delivery (git show — run from Caps root in cmd.exe)
```
git show HEAD:docs/results-ia/results-before-393-collapsed.png > %USERPROFILE%\Downloads\results-before-393.png
git show HEAD:docs/results-ia/results-after-393-collapsed.png  > %USERPROFILE%\Downloads\results-after-393.png
git show HEAD:docs/results-ia/results-after-393-expanded.png   > %USERPROFILE%\Downloads\results-after-393-expanded.png
git show HEAD:docs/results-ia/results-before-320-collapsed.png > %USERPROFILE%\Downloads\results-before-320.png
git show HEAD:docs/results-ia/results-after-320-collapsed.png  > %USERPROFILE%\Downloads\results-after-320.png
```

## Not merged — production unchanged
Branch `claude/vamos-caps-align-celebration-flppo0`. No merge, no version bump. No economy, reset,
security, nav, or flag touched.
