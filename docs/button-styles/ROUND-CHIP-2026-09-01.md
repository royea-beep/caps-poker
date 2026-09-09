# ROUND-CHIP-BUTTONS — 2026-09-01 — E as a chip: round vs elongated, the 320 test

Roye chose **E** (the beveled poker-chip, ranked #1) and wants it **round, like a real chip.** He heard
the one risk and accepted it: a fully round button is narrow, and "Play Now · vs real players" has to fit
inside a circle — and **320px is where every layout defect in this project has landed.** So this sprint
proves the fit **before anything is committed.** No app change is committed — Roye picks the shape from the
picture first.

## What was rendered — and what it is
- `docs/button-styles/round-chip-sheet-393.png` and `-320.png` — each shows four tiles, the **full home
  screen**: ROUND·EN, ROUND·HE, ELONGATED·EN, ELONGATED·HE.
- Source: `docs/button-styles/round-chip-sheet.html`.
- **RENDERED CONCEPT MOCKUP** (real Chromium screenshots of a faithful home mockup — mint `#4FD6A8`
  fill, dark ink `#08130F`, brass `#C9A84C` chip edge, real masthead/subtitle/footer/tab-bar). **NOT the
  app bundle, NOT a device.** The masthead uses Chromium's serif, not the device's Georgia (device tap).
- Both shapes keep the **E identity**: mint chip fill, a **brass dashed edge** (the poker-chip rim), a
  bevel (inner top highlight + bottom shadow), and a **pressed state** that sinks 4px.
- **Refinement 1 held on every tile:** a dominant **Play Now** chip, a smaller quieter **Practice** chip.

## Round chip: built as scalable, no fixed literals
Diameters are **proportional to screen width** (the mockup's RN equivalent is `rf`/`rs`/`rv`, per Iron
Rule #3 — never hardcode a dimension): Play Now ≈ 230px at 393 / 190px at 320; Practice ≈ 150 / 128.
The real RN component (with `rf`/`rs`) is **not built this session** — it is gated on Roye's shape pick;
building the wrong shape is exactly what the 320 test exists to prevent.

## Gold semantics — restated and proven
- **mint `#4FD6A8`** = the action / the fill (every CTA).
- **brass `#C9A84C`** = the chip **edge** only (the dashed rim) — a different colour from the winner cue.
- **gold `#FFD700`** = **WON**, the winner cue (3px). **Never on the home screen, never a fill.**
- **Proof:** the instrument checked every chip's fill and border for `255,215,0` → **`goldHit=false`
  on all eight tiles.** No CTA borrows the winner gold.

## Instrument re-verified (canary) — before trusting a number
Contrast is label-vs-fill (never sampled inside glyphs). Each run:
- planted mint-on-mint **1.00:1 → flagged** (`badFlagged=true`);
- real ink-on-mint **10.37:1 → passes** (`goodPass=true`).
The instrument is sound (it also caught + fixed a gradient blind spot in the prior button sprint).

## THE 320 TEST — measured, not eyeballed
Contrast is **10.4:1** on every Play Now (ink on mint, bar 4.5:1); Practice 11.8:1. Touch size is far past
44pt (round 190–230px, elongated 66–74px). The differentiator is **fit** — does the full label sit inside
a **true circle**? The test: every corner of the label block must fall within the chip's radius (minus a
10px inset from the dashed edge).

| Tile | 393 | 320 | Verdict |
|---|---|---|---|
| **Round · EN** | reach 104 / R 105 — **just fits** (1px) | reach 94 / R 85 — **OVERFLOWS +9px** | fails at 320 |
| **Round · HE** | reach 122 / R 105 — **OVERFLOWS +17px** | reach 102 / R 85 — **OVERFLOWS +17px** | fails at both |
| **Elongated · EN** | fits | fits | **holds** |
| **Elongated · HE** | fits | fits | **holds** |

**The true circle cannot hold "Play Now · vs real players."** English overflows the circle at 320 (+9px)
and only *barely* fits at 393 (1px, the subtitle hugging the curve). **Hebrew** — "שחק עכשיו · מול שחקנים
אמיתיים" — is longer and **overflows at both widths (+17px)**. The **elongated stadium chip holds the full
label cleanly in EN and HE at both widths**, while keeping every part of the poker-chip look.

## Which I'd recommend from the pictures
**Elongated (stadium chip).** It is the honest answer to the risk Roye accepted: the round chip is
beautiful but **clips the subtitle**, and forcing text into a circle that clips it is the one thing the
brief says not to do — most sharply in Hebrew, which never fits a circle. The stadium keeps the beveled
brass-edged poker-chip identity and reads unmistakably as a chip, without sacrificing the label.

**If Roye still wants a true circle:** the *subtitle* is what overflows — a circle comfortably holds
**"Play Now" alone** (icon + title). So the round path is viable only by **shortening the primary label**
to "Play Now" and moving "vs real players" out of the chip. That is a real option, but it drops the
copy Roye's own refinement-1 CTA carries — his call, from the picture.

## Delivery (cmd.exe — git show to Downloads)
On the pushed branch `claude/vamos-caps-align-celebration-flppo0`:
```
git show HEAD:docs/button-styles/round-chip-sheet-393.png > %USERPROFILE%\Downloads\caps-roundchip-393.png
git show HEAD:docs/button-styles/round-chip-sheet-320.png > %USERPROFILE%\Downloads\caps-roundchip-320.png
```
Each tile is labelled (ROUND/ELONGATED · EN/HE). **Answer with a shape** — round (short label), or
elongated (full label).

## NOT committed until Roye confirms the shape — and what happens next
No app-code change was made or committed this session; the live button is untouched, **no version bump**.
Once Roye confirms the shape, a follow-up sprint **builds the RN chip component** (`rf`/`rs`, pressed
state), wires it into the home, and **re-runs the loop** — both engines, all widths, the **clip-aware
overlap sweep with a pre-change control**, the self-test planting its defects — and proves the new chip
does **not** collide with the D1 hero above or the pills below (the layout arc closed at zero overlap; a
new shape is exactly the kind of change that reopens it).

## Rendered vs code-read vs device-only
- **Rendered (mockup):** the shapes, the fit test, the contrast, the colours — real Chromium pixels of a
  faithful mockup, not the app bundle.
- **Code-read:** the real app values these are grounded in (mint/ink/brass, the current button styles).
- **Device-only:** the Georgia masthead and this chip on a real iOS screen at true DPI — never verifiable
  here.

## Production unchanged
No economy, faucet, rake, reset, security fix, D1 hero, nav, or flag touched; `KILL_Board` untouched; no
build, no version bump; renders only under `docs/`. main and the 512 tester candidate are unchanged.
