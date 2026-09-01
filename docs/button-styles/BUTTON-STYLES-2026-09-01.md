# BUTTON-STYLES — 2026-09-01 — 8 treatments, rendered, ranked

Roye looked at 512 and said the home buttons are not attractive — the two green ones most. He's right,
and it's the series' own finding one layer down: the hero got art, the buttons stayed flat defaults.
"The fix is art" applied to the buttons. This is the felt/panel/hero playbook again — render options,
measure them, let him choose by eye. **Build nothing; Roye picks, a separate sprint builds the winner.**

## The sheet — where it is, and what it is
- `docs/button-styles/contact-sheet-393.png` — 8 treatments, each the full home screen at **393px**.
- `docs/button-styles/contact-sheet-320.png` — the same eight at **320px**.
- Source: `docs/button-styles/contact-sheet.html` (self-contained; re-renderable).

**Rendered vs mockup — plainly:** all eight tiles are **RENDERED CONCEPT MOCKUPS** — real Chromium
screenshots of a hand-built HTML home screen that is **faithful to the real app values** (mint #4FD6A8
fill, dark ink #08130F on mint, subtitle #cfd8d2, the real masthead/subtitle/footer/tab-bar), but they
are **NOT the app bundle and NOT a device.** None is a paper mockup — every tile is rendered pixels; none
is the shipped screen. The masthead here uses Chromium's serif, not the device's Georgia (that face is a
device-only tap).

## Refinement 1 — folded into every tile
Roye already chose the hierarchy, so it is **fixed across all eight**: one dominant **Play Now**
(multiplayer) with **Practice vs bots** quieter beneath. Only the *style* varies; the hierarchy does not.

## The instrument — re-verified before trusting a number (the canary)
Contrast is measured **label colour vs the button's effective fill** (compositing translucent fills and
**averaging gradient stops**), never by sampling inside the glyphs. The canary each run:
- planted-bad **mint-on-mint = 1.00:1 → flagged** (`badFlagged=true`);
- real **ink #08130F on mint #4FD6A8 = 10.37:1 → passes** (`goodPass=true`).
- **A caught a real blind spot mid-run:** the depth treatment's *gradient* fill first mis-read as 1:1
  (backgroundColor is transparent for a gradient) — implausible for a bright mint button, so it was a
  measurement error, not a real fail. Fixed by averaging the gradient's colour stops; A now reads
  **10.1:1**. The instrument is honest *because* it caught and corrected itself.

## Per-treatment — game-not-form? · CTA dominates? · floor (contrast label:fill / 44pt / pressed)
Every treatment **passes the floor** at both 393 and 320: contrast ≥ 8.6:1 on both buttons (bar 4.5:1),
heights 68–74px (Play) / 46–52px (Practice) — all past the 44pt minimum — and each defines a `pressed`
state (a sink/darken; A literally drops 6px). Floor is not the differentiator; **art** is.

| Code | Treatment | Looks like a game? | CTA dominates? | contrast play/prac | h play/prac |
|---|---|---|---|---|---|
| A | Depth | **Yes** — a real pressable block that sinks | **Strongest** | 10.1 / 11.8 | 70/52 |
| B | Felt inlay | Partly — idea reads on Practice, not the CTA | Weakened (felt Practice competes) | 10.4 / 9.8 | 70/52 |
| C | Gold-edged | **Yes** — premium "real casino" | Moderate (dark fill) | 10.2 / 9.9 | 72/52 |
| D | Glass | Less — reads app/SaaS | Moderate (translucent) | 12.1 / 14.7 | 72/52 |
| E | Beveled chip | **Yes, most** — the chip edge says *poker* | Strong | 10.4 / 12.2 | 70/52 |
| F | Outline + glow | Somewhat — neon/arcade more than table | Good (glow leads the eye) | 15.3 / 11.6 | 74/52 |
| G | Icon-solid | **Yes** — oversized controller = "play" | **Strong/bold** | 10.4 / 11.6 | 68/52 |
| H | Split | Least — it's the improved *default* | Clean but flat | 10.4 / 8.6 | 70/46 |

## Gold semantics — proven, values restated
- **mint `#4FD6A8`** = the field / the primary action colour → every CTA fill.
- **gold `#FFD700` (rgb 255,215,0)** = **WON**, the winner cue (3px). **Never a CTA.**
- **brass `#C9A84C` (rgb 201,168,76)** = the *gold-edged* treatment's rule only (edge, never a fill),
  and it is a different colour from the winner gold.
- **Proof:** the instrument checked every treatment's CTA fill and border for the winner gold
  `255,215,0` → **`wonCTA=false` for all eight** (A–H). No CTA sits at the winner-cue gold; the gold-edge
  treatment uses brass, which does not collide.

## RANKED 1–8 (game-not-form weighted first, then CTA dominance; floor is pass/fail and all pass)
1. **E · Beveled chip** — the chip edge is the single clearest "this is a poker game" cue, and the mint
   CTA still dominates. On-theme without gimmick.
2. **A · Depth** — the most tactile "object you press"; the hardest-dominating CTA and a real sink. Reads
   as a game you play, not a form you fill.
3. **G · Icon-solid** — the oversized controller says *play* instantly and gives the boldest CTA; playful
   (mild juvenile risk is its only cost).
4. **C · Gold-edged** — the most premium, most "real casino" of the set; loses only on CTA punch because
   the fill is dark, not mint.
5. **F · Outline + glow** — lively and modern with clean hierarchy, but the glow reads arcade-neon rather
   than poker table, and an outline CTA is less solid than a fill.
6. **D · Glass** — sleek, but the most generic/"app," the least "game," and the translucent CTA is the
   softest of the strong-contrast set.
7. **B · Felt inlay** — best *idea*, weakest *execution* here: the felt texture is nearly invisible on the
   CTA while the felt-filled Practice competes with it, softening the very hierarchy refinement 1 fixes.
8. **H · Split** — passes everything and has the cleanest primary/secondary, but it is the closest to the
   flat default Roye rejected. It fixes the hierarchy, not the "reads as a form" problem — and that problem
   is the whole reason for the sprint, so it ranks last on purpose.

**MY TOP THREE: 1) E Beveled chip · 2) A Depth · 3) G Icon-solid.** All three read unmistakably as a game,
dominate the CTA, and clear the floor. If forced to one: **E** — it earns its "game" the poker way, from
the chip, not from a generic 3D or icon flourish. **H is a real fail against this sprint's question;**
B and D underperform.

## Delivery (cmd.exe — the git-show-to-Downloads route that works)
After `git fetch origin claude/vamos-caps-align-celebration-flppo0` and checkout (or on the pushed branch):
```
git show HEAD:docs/button-styles/contact-sheet-393.png > %USERPROFILE%\Downloads\caps-buttons-393.png
git show HEAD:docs/button-styles/contact-sheet-320.png > %USERPROFILE%\Downloads\caps-buttons-320.png
```
Open the two PNGs; each tile is labelled with its **code (A–H)**. Answer with a code (or a code + a tweak).

## Nothing built, production unchanged
No button change shipped, nothing installed in the app — renders only, under `docs/`. No economy, faucet,
rake, reset, security fix, D1 hero, nav, or flag touched; `KILL_Board` untouched; baselines not regenerated.
