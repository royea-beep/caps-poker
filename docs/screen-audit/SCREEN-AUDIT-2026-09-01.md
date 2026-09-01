# SCREEN-AUDIT — 2026-09-01 — every other screen to the luxury bar

Roye approved all five game upgrades and said "invest properly." This is the second half: the four
untouched screens — results, lobby, profile, shop — audited against the luxury home and given the
app-wide visual language. **One visual language across the app** — every screen now shares the same
`LuxuryBackdrop` (deep radial-green vignette + beam + felt), not a fifth style per screen. On the
branch, awaiting the next build — **not merged, no version bump.**

## What shipped (one screen per commit, jest green between the set)
| Screen | Commit | Change | Rendered |
|---|---|---|---|
| Results | 12ef9af | `LuxuryBackdrop` root (safe pass only — see the IA proposal below) | code-read (needs a finished hand to render) |
| Profile | e451e86 | `LuxuryBackdrop` + **gilded brass stat cards** (soft lift, mint value) | **fully rendered** — `profile-after-luxury.png` |
| Shop | ae19ebd | `LuxuryBackdrop` root | header + felt rendered; product list is Supabase-gated (loading offline) |
| Lobby | a3f77e2 | `LuxuryBackdrop` root | header + felt rendered; table list is Supabase-gated (loading offline) |

All are `pointerEvents:none` absolute-fill backdrops = **zero layout impact**. Reused component:
`LuxuryBackdrop` (all four) + the brass-hairline pill identity (profile cards). tsc clean, **2,649
tests green**. No `#FFD700` added; winner cue / card sizes / layout untouched.

## Audit — game or form (before this pass)
- **Profile — FORM.** Flat translucent stat cards + plain menu rows on bare obsidian. Now: luxury
  felt ground + gilded cards → reads premium. **Biggest clean win of the four.**
- **Shop — FORM, and it matters.** Four cosmetic families, three purchases ever. Flat cards on a bare
  background read cheap. The backdrop is step one; the real lift is per-product-card gilding + a
  chipped buy button (proposed follow-up).
- **Lobby — FORM.** Plain list on bare background. Backdrop applied; table rows want the gilded-pill /
  chip treatment next.
- **Results — FORM, worst offender (IA, not paint).** See below.

## ⚠ Results needs an IA rethink, not a visual pass — proposed separately (NOT done)
The first-session walk found **34 competing lines** on results — the screen a player sees after every
hand. That is an **information-architecture** problem: too many elements (hand tallies, badges, equity,
streak dots, XP banner, upgrade nudge, coaching/share/rematch/home, shop CTA, practice banner…) all
competing at one altitude. A paint pass cannot fix it, and the brief is explicit: *do not redesign IA
under cover of a visual pass.* So results got **only** the safe `LuxuryBackdrop` root; the rest is a
proposal:

**Proposed results IA rethink (separate sprint, needs Roye's sign-off):**
1. **One hero line** — the outcome (WIN / LOSE / the board tally), everything else demoted.
2. **Collapse the secondary rows** into a single expandable "hand detail" (equity, per-board, streak)
   so the default view is 3–4 lines, not 34.
3. **One primary CTA** (Rematch or Next) as a `ChipButton`; Home/Share/Coaching as quiet secondaries.
4. **Move the shop CTA + upgrade nudge** out of the after-every-hand flow (they belong on a natural
   break, not on the highest-frequency screen).
5. ⚠ **Pre-existing gold to fix in that pass, not this one:** `coachingBtn` uses
   `backgroundColor: 'rgba(255,215,0,0.08)'` — the winner gold `#FFD700` on a button background. It
   predates this work; flagged, not touched (a visual pass must not quietly touch the cue token).

This is a real layout+altitude redesign with its own before/after loop — it should not be smuggled in.

## Follow-ups (per screen, next visual sprint)
- **Shop:** gild each product card (brass hairline + lift), chip the buy button (`ChipButton`,
  non-gold), render with the live product list (needs the Supabase RPC reachable).
- **Lobby:** gild the table rows, chip the primary join CTA, render with the live table list.
- **Profile:** done (this pass).

## Delivery (git show)
```
git show HEAD:docs/screen-audit/profile-after-luxury.png > %USERPROFILE%\Downloads\caps-profile.png
git show HEAD:docs/screen-audit/lobby-after-luxury.png   > %USERPROFILE%\Downloads\caps-lobby.png
git show HEAD:docs/screen-audit/shop-after-luxury.png    > %USERPROFILE%\Downloads\caps-shop.png
```

## Not merged — production unchanged
Everything stacks on the branch until Roye has seen each screen's pixels. No merge, no version bump.
No economy, faucet, rake, reset, security fix, nav, or flag touched; `KILL_Board` untouched; winner
cue `#FFD700`, card sizes, and the 83px→0 arc untouched; no motion added.
