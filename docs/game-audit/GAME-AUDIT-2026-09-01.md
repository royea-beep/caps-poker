# GAME-AUDIT — 2026-09-01 — the game screen against the luxury bar (report, not a build)

The luxury home shipped to `main`. This audits the GAME screen — the product's highest-stakes,
most-verified screen — against that new bar, and proposes upgrades. **Nothing was built on the game
screen.** Roye picks; a follow-up builds each one with the full loop.

## Merge — the home is on main
- Merged `claude/vamos-caps-align-celebration-flppo0` → **`main` @ f118a1e** (fast-forward, 4 commits).
- **Confirmed on the remote**, not a local line: `git ls-remote origin refs/heads/main` =
  `f118a1e50abec93d8f3d6452513dfd750f4e119d`.
- **Web verified by content delta** (not hash): the live bundle went `index-2cd59e5d…` →
  **`index-758a1973…`**, and the NEW bundle contains the luxury markers — `ROYAL FLUSH`×1, the
  radial-vignette string `radial-gradient(120% 78% at 50% 30%`×1, the beam `118deg, rgba(255,240,205`×1,
  all five fan card ids `royal_10s/Js/Qs/Ks/As`, felt token `#0C2C1D`×1. **Live on caps.ftable.co.il.**
- **No version built** — the home ships with the next build alongside whatever is queued; it is on
  `main` now.
- **Baselines: known-stale, not regenerated.** The BackstopJS `home` scenario reference predates
  LuxuryBackdrop + RoyalFlushFan, so it is stale by design. The gate is non-blocking, and three
  baseline sets in this series were wrong and only *looking* caught them — regenerating a non-blocking
  gate without a careful per-scenario review risks baking in a regression. Regenerate deliberately via
  `.github/workflows/backstop-baseline.yml` (Linux) and review every diff before committing.

## How the game screen was seen
- **Rendered (mirrored bytes):** the LIVE built screen — the deployed bundle served from localhost,
  driven into a practice game — at **320/375/393/430 × 2P/3P/4P**, the **placing** phase (dealt →
  placing, where felt / boards / slots / cards / chrome / header all show at once). Real Chromium
  pixels of the shipped bytes — **not a mockup, not a device.**
- **Code-read:** reveal & results (winner cue `#FFD700` 3px, the reveal spotlight that drops
  non-winners to 0.35 at t≈3700, `BoardSurface intensity='muted'`) — not driven to on screen here.
- **Device-only:** the reveal animation, native font rendering, true-DPI felt.

## Element scores — game or form?
| # | Element | Verdict | Why |
|---|---|---|---|
| ① | **Felt / play surface** | **FORM** | flat dark green; `BoardSurface`'s own doc measured the inset table at **~1.03:1** vs the page ground — the root paints the same `FELT_GRADIENT` and the panels over it are translucent, so no felt value alone makes it a table. Nothing like the home vignette. |
| ② | **Board panels** | MIXED | the per-board coloured border reads "game", but the fill is `#1C1F2640`/`#10121840` (~25% alpha) — faint translucent boxes with little depth. |
| ③ | **Empty slots** | MIXED | dashed white outlines at the fixed 3:1 contrast are legible but quiet — they read as faint boxes more than targets a new player aims at. |
| ④ | **Chrome** (Confirm / Cancel / Auto-Place / Auto-Place ALL) | **FORM** | flat translucent-mint pills (`rgba(79,214,168,0.10–0.12)` fill, `0.30–0.35` border) — exactly the flat old-home-button look Roye rejected. The most "form" thing on the screen. |
| ⑤ | **Header pills** | MIXED | functional translucent pills (balance, status, "Practice · no chips"); at **320** the "Practice · no chips" pill overlaps "PLACE 8 CARDS" — a real crowd. |
| ⑦ | **Cards** | **GAME** | the finished element — real `Card.tsx` faces, cyan ownership rim on the hand. Meets the bar. **Do not touch** (card sizes are frozen). |

## Proposed upgrades — ranked by impact ÷ risk
1. **Chrome → chips.** Make **Confirm / Cancel / Auto-Place ALL** the home's **`ChipButton`** (smooth
   brass edge, bevel, pressed sink). *Change:* swap the flat pills for the chip. *Risk:* **low** —
   chrome, not layout/cue/card-size; the footer Confirm/Cancel sit in a fixed row. *Reuses:*
   **`ChipButton`** directly. (Per-board "⚡ Auto-Place" sits inside the board header — chip it only
   after a layout check, since the header height is near the 83px arc.)
2. **Felt → LuxuryBackdrop.** Put the **radial-green vignette + faint beam** behind the boards so the
   play surface reads as a table, matching the home. *Change:* add the backdrop under the board area.
   *Risk:* **medium** — it must not fight the reveal spotlight (a brighter felt puts attention back on
   non-winning cards); re-measure card/slot contrast and use the **`muted`** intensity at reveal, as
   `BoardSurface` already does. *Reuses:* **LuxuryBackdrop tokens.**
3. **Board panels → depth (PAINT ONLY).** Deepen the panel fill and add an inner-shadow bevel so
   boards read as recessed wells rather than faint boxes. *Change:* fill + inset shadow only. *Risk:*
   **⚠ the board geometry (borderWidth, size) is the 83px→0 layout arc — PAINT ONLY, no dimension
   change.** *Reuses:* the **ChipButton bevel** idiom.
4. **Slots → stronger target read (fill/glow, not the outline).** A subtle inner glow or slightly
   richer resting fill so empty slots invite placement. *Change:* the resting fill/glow. *Risk:* **⚠
   the 3:1 dashed OUTLINE is load-bearing and was deliberately fixed — change the fill/glow, never the
   outline contrast.** *Reuses:* backdrop/mint tokens. Medium impact.
5. **Header → luxury pills + fix the 320 crowd.** Align the balance/status pills with the luxury look
   and stop the "Practice · no chips" / "PLACE N CARDS" overlap at 320. *Risk:* **low**, low impact.
   *Reuses:* backdrop/edge tokens.

## ⚠ Load-bearing — flagged, not touched
- **Winner cue** — gold `#FFD700` 3px on the winning board/card (Card.tsx / Board.tsx). No upgrade may
  recolour or restyle it. The felt/panel upgrades (2, 3) must leave the reveal cue and the spotlight
  intact — use `muted` intensity so the felt never competes with the cue.
- **Card sizes** — 68/58@390, 54/44@320, 10px symbol floor. Frozen. No upgrade resizes cards (⑦ stays).
- **83px→0 layout arc** — board geometry, slot sizes, borderWidths, header height. Frozen. The panel
  and slot upgrades (3, 4) are **paint only**; the per-board Auto-Place chip (1) needs a layout check
  before it touches the board header.

## Delivery
Sheet: `docs/game-audit/game-audit-annotated.png` — the live built screen (393·3P placing) with
numbered callouts, the element scores, the ranked upgrades, and the 320/375/430 thumbnails. It is the
**current built screen, not a mockup of the upgrades.**
```
git show HEAD:docs/game-audit/game-audit-annotated.png > %USERPROFILE%\Downloads\caps-game-audit.png
```

## Nothing built — production unchanged
No game-screen code changed this sprint. No economy, faucet, rake, reset, security fix, nav,
destination, or flag touched; `KILL_Board` untouched; the winner cue, card sizes and the 83px→0 layout
are untouched; no motion added. The only change on `main` is the luxury home (merged) + this audit doc.
