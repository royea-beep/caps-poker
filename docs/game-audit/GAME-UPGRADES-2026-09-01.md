# GAME-UPGRADES — 2026-09-01 — the five, safest first, loop between each

Roye picked all five game-screen upgrades from the audit and left the sequencing to the panel. The
order here is **by risk, lowest first** — each safe win banked before anything near the load-bearing
work, and the two flagged items (4 & 5) **rendered and shown, not shipped**. One step per commit, a
full loop (real local-export render + tsc + 2,649 tests) between each. On the branch, awaiting the
next build — **not merged, no version bump**.

Every step was watched running in the **real app**: a local `expo export -p web`, its `<script defer>`
patched to `type="module"` (the documented `import.meta` fix), served from localhost and driven into a
practice game at 320/375/393/430 × 2P/3P/4P. Real Chromium pixels of the actual built change — not a
mockup, not a device.

## Step 1 — Chrome → chips ✅ shipped (1db6ef4)
Cancel + Confirm/✓READY are now the home's **ChipButton** (reused, not forked). ChipButton gained
backward-compatible props (`fillOverride`, `edgeOverride`, `disabled`, `flex`, `compact`, `testID`,
`accessibilityState`); the home path is unchanged. Green ready state via `fillOverride #28A745` — not
the winner gold `#FFD700`. testID + a11y role/name/state preserved (the one control that advances the
hand stays exposed).
- **83px arc:** SAFE — `floatingActions` is an absolute bottom overlay, not part of the flex column
  that feeds board height. Boards rendered geometrically unchanged; no overflow at any width.
- **⚠ per-board Auto-Place NOT chipped — reported, not done:** `Board.tsx` `autoBtn`'s own
  `NATIVE-LAYOUT-FIX` says its measured height IS the arc (`HEADER_H → innerH`); a chip-height button
  "would grow every board's header by ~25–30pt." Chipifying it would reopen the 83px arc, so it is
  left as-is. Same for the hand-header Auto-Place ALL.
- Contrast: Confirm ink-on-mint 10.37:1, Cancel mint-on-dark 9.15:1 (bar 4.5); canary sound.

## Step 2 — Header luxury pills + the 320 crowd ✅ shipped (c41363d)
- **320 crowd fixed:** the absolute "Practice · no chips" pill crossed "PLACE N CARDS" at ≤340pt.
  Hidden at ≤340 (a `screenW` guard) — the PLACE string is the actual placement instruction and wins
  the narrow band (per that pill's own history note). Unchanged ≥375.
- **Luxury pills:** the PLACE pill and the balance pill get the home's chip identity — mint fill +
  **brass** gilded hairline `rgba(201,168,76,0.55)` + a soft lift. Colours/dimensions unchanged; the
  brass edge is not the winner gold. The load-bearing `botStatusPill` (the "primary action is 10px"
  chip) is untouched.

## Step 3 — Felt → muted LuxuryBackdrop ✅ shipped (d837408)
A **muted** `LuxuryBackdrop` (`muted` = glow 0.22 vs 0.55, beam halved; `overlayOnly` = keep the
theme felt) layered over the game root. `pointerEvents:none` absolute fill — zero layout impact.
- **Reveal re-measured on a REAL driven hand** (Auto-Place ALL → ✓READY → reveal): the gold winner
  cue `#FFD700` still renders and dominates (**6** gold borders), the mint field frames hold (**30**),
  the spotlight still dims non-winners to ~0.35 (greyscale width separation intact).
- **Card-vs-felt contrast measured 12.62:1** — above the **10.28** floor. Depth from a dimmer felt
  can only darken the ground, so the floor rises, not falls.

## Step 4 — Slots: mint inner GLOW ⏸ RENDERED + SHOWN, not shipped
Empty slots get a soft mint **inner glow** so a new player's eye lands on them.
- **⚠ Neither the 3:1 dashed OUTLINE nor the resting FILL is changed.** The slot's own token note
  says the outline's contrast is *calibrated against that fill* (the 0.6 dead-pulse multiplier), so
  **raising the fill would move the outline ratio** — fill is off the table too. Glow only.
- Preview reverted (`git restore`), not committed.

## Step 5 — Board-panel depth ⏸ RENDERED + SHOWN, not shipped
An **inset shadow + a hair of top-edge light** make each board read as a recessed well.
- **⚠ Paint only — geometry byte-identical.** The diff added only `boxShadow` (no width/height/border/
  padding/margin), so the 83px→0 arc is not reopened. The panel FILL alpha is **untouched** — it is a
  documented card/back legibility fix (0.55 made face-down cards 1.08:1), so depth comes from shadow,
  never fill.
- Preview reverted, not committed.

## The flagged pair — sheet (git show)
`docs/game-audit/game-upgrades-4-5-proposed.png` — CURRENT (steps 1–3) vs PROPOSED (+4 & +5) at 393
and 320, with the constraints annotated. **The current built screen with the proposals rendered — not
a shipped change.**
```
git show HEAD:docs/game-audit/game-upgrades-4-5-proposed.png > %USERPROFILE%\Downloads\caps-game-4-5.png
```
Roye confirms the look, then a follow-up ships 4 & 5 with the full loop (and native overlays for the
web-only glow/bevel — a device tap).

## The discipline
One step per commit; a loop (real render + tsc + 2,649 tests) between each, so any regression is
attributable to one change. The **winner cue `#FFD700`, card sizes, and the 83px→0 arc were
re-checked after every step**, not just at the end — `Board.tsx`/`Card.tsx` were untouched by steps
1–3, and steps 4–5 are paint-only and reverted.

## Baselines
Known-stale (the home changed and now the game chrome will), non-blocking gate — regenerate
deliberately via `.github/workflows/backstop-baseline.yml` on Linux and review each diff. Not
regenerated here.

## Not merged — production unchanged
Steps 1–3 on the branch awaiting the next build; 4–5 shown, not shipped. No merge, no version bump. No
economy, faucet, rake, reset, security fix, nav, destination, or flag touched; `KILL_Board` untouched;
winner cue, card sizes and the 83px→0 arc untouched; no motion added.
