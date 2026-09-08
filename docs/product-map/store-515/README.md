# The App Store screenshot set — build 515

**Re-shot 2026-09-08.** Nine screens × two sizes = 18 files, plus `manifest.json` (what was captured
and the measured pixel size of every file) and `verify.json` (the pixel-level language and content
check).

| Size | Pixels | Why |
|---|---|---|
| 6.9″ | **1320×2868** | Apple's current primary iPhone size |
| 6.7″ | **1290×2796** | still accepted; the only size the old set had |

`supportsTablet` is false, so no iPad set is required.

## The nine screens

| File | What it shows | Real or staged |
|---|---|---|
| `01-home` | the gold wordmark, the royal flush, the mint Play Online CTA, a real balance and win streak, the "virtual chips only · 18+" line | **real** |
| `02-play` | the five game modes | **real** |
| `03-shop` | the **ten live shop items** with their real chip prices, and the honest header "Chips come from playing" | **real catalogue**, replayed (see below) |
| `04-achievements` | 8 of 19 unlocked | **real definitions**, staged progress |
| `05-game-placement` | four boards, sixteen cards to place | **real** |
| `06-game-reveal` | one board revealing, live equity | **real** |
| `07-results` | YOU WIN, the board-by-board breakdown, the gold winner cue, a genuine tied board | **real** |
| `08-profile` | hands, win rate, streak, chips | **real** |
| `09-hand-history` | played hands with their ranks and chip deltas | **real** |

⚠️ **RECOMMENDED SEVEN**, if Roye wants Apple's usual count: 01, 05, 06, 07, 03, 09, 02. The
achievements and profile shots are the weakest of the nine and are supplied as spares.

## What was replayed, and why nothing was written to the database

The shop and achievements screens read from server RPCs. Calling them for real would **create a
leaderboard row for the capture device** — `get_poker_shop` inserts one on its first line. So the
rows were **read** from the database and **replayed** into the page:

- the shop's ten items come from `chip_config` (chips < 0, is_active), copied verbatim: same
  `event_type`, same chip price, same description, ordered by price as the RPC orders them;
- the achievements come from `achievement_definitions`, with a plausible earned subset.

The **balance** in the replayed shop payload is read out of the page's own store, so it is the
balance the rig actually earned by playing — never a number typed into the tool.

⚠️ **The hands are genuinely played**, through the app's own Auto-Place ALL and READY controls. The
home balance, the streak badge, the profile stats and every hand-history row are earned.

## Known limits of these captures, stated rather than discovered later

1. ⚠️ **These are web-export renders in headless Chromium, not iOS device captures.** Fonts, emoji
   and safe-area insets differ from a real iPhone.
2. ⚠️ **One glyph is wrong because of that.** "⚔️ Challenge a Friend" on the home screen renders as
   a thin monochrome cross here. U+2694 is a text-default character, so a text font wins even after
   VS16; iOS draws it in colour. Three fontconfig approaches failed to change Chromium's own
   fallback stack. If the home shot must be perfect, capture it on a device.
3. ⚠️ **Two layout defects the big captures exposed**, both in the product and both reported:
   the achievements category filter row clips "Collection" at the right edge, and the reveal's
   DANGER pill overflows the left edge and reads "ANGER".
4. ⚠️ **A results-screen defect, found by looking and worked around here:** the "You won 50 chips!"
   toast lands **on top of** the YOU WIN headline and covers part of the score. The capture now
   waits for it to clear. The overlap itself is unfixed.

## Re-run

```bash
node tools/store-shots.mjs                                  # both sizes, 18 files
npm i --no-save tesseract.js && node tests/store-shots-verify.mjs   # pixels, not filenames
```
