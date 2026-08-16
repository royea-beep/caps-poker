# 2026-08-16 — The typecheck is restored

`tsc` **exit code 0**, zero errors, locally and on CI. Shipped `ddb7250`, deployed, rendering
verified on both engines at both widths across all three player counts.

It was a one-line fix.

## What the expression actually was

`components/Card.tsx:458`, inside the three-branch border map:

```js
const v2Border = highlighted
  ? { borderWidth: 3, borderColor: '#c9a84c' as const }         // WON — gold
  : isCommunityCard
  ? { borderWidth: 2, borderColor: OBSIDIAN.mint as const }     // the field — mint   <-- TS1355
  : { borderWidth: 1, borderColor: 'rgba(0,0,0,0.22)' as const }; // neutral
```

The two sibling branches assert on **string literals**, which is legal. The middle one asserts on
`OBSIDIAN.mint` — a **property reference**, which is exactly what TS1355 forbids. The assertion was
copied from its neighbours for symmetry and never compiled: it has failed `tsc` from the day it
landed.

`OBSIDIAN` is itself `activePaint.obsidian` (`constants/obsidianTheme.ts:31`), so `OBSIDIAN.mint` is
a member expression however the theme is declared. No arrangement of that import makes the
assertion legal.

## What `694565f` was for, and how the fix preserves it

Commit message: *"fix(cards): the settled colour map was written into a branch that never renders."*
The comment block above the map (`:426-454`) spells out the intent — a three-state border encoding
where **gold means won and only won**, mint marks the community field, and neutral carries no state,
encoded in **width as well as hue** so it survives desaturation, with 3px chosen because Chromium
rounds border-width to whole device pixels and 2.5px collapsed into the 2px mint at DPR 3.

That intent is about **values and widths**. `as const` is a type-level assertion, erased before
emit; it contributes nothing to either. Removing it changes the colour, the width, and the rendered
pixel not at all — which the live measurement below confirms.

## Which branch it sits in — the live one

`isV2` is hardcoded `true` (`:484`) and `v2Border` is applied to the face-up card at `:526`. So
`:458` is in the **V2 Minimalist branch, which is live** — not the dead Classic branch. This line
genuinely paints, which is why the fix had to be type-only rather than a restructure.

## `StaticCard.tsx` — checked, and it does not carry the pattern

Its `v2Border` is `{ borderWidth: 2.5, borderColor: '#c9a84c' as const }` with **no mint branch at
all**, and its other assertions are on string literals (`'700' as const`). Legal, no error, no edit.
Unlike the white-bar fix — which had to be applied to both renderers — this one is single-sited.

## Verification

**`tsc` exit code 0** locally (not "no output" — the exit code; a crashed compiler prints nothing,
and that already produced a false "PASSED clean" in this project earlier this week).

**CI agrees**: the `tsc-output` artifact from run `31944303617` on `ddb7250` is **0 bytes**. Clean
on hardware whose memory is not in question.

### Rendering unchanged — both engines, 390 and 320, 2P/3P/4P

Board counts re-derived from the rule rather than copied: 2P = 4, 3P = 3, 4P = 2.

| engine | width | 2P | 3P | 4P |
|---|---|---|---|---|
| chromium | 390 | 4 boards, cards 40×56 | 3 boards, 45×59 | 2 boards, 62×82 |
| chromium | 320 | 4 boards, 33×46 | 3 boards, 43×54 | 2 boards, 53×68 |
| webkit | 390 | 4 boards, 40×56 | 3 boards, 45×58 | 2 boards, 62×81 |
| webkit | 320 | 4 boards, 33×46 | 3 boards, 43×54 | 2 boards, 53×68 |

Every board count correct; the two engines agree to within a pixel of line-height rounding.

**The edited line still paints.** `2px rgb(79, 214, 168)` — that is `#4FD6A8`, mint — is present in
all twelve configurations, alongside the `1px rgba(0, 0, 0, 0.22)` neutral. Gold appears only on won
cards, which do not exist during placement, consistent with "gold means won and only won". The
border encoding the commit was built for is intact.

### Two corrections to the brief's stated locks

**The glyph floor is 9 and 7, not 10.** `utils/prdTokens.ts:26-27`:

```js
cornerRank: (cardW) => Math.max(9, Math.round(cardW * 0.30)),
cornerSuit: (cardW) => Math.max(7, Math.round(cardW * 0.22)),
```

I measured 7px suit glyphs at 320/2P (33px cards) and 9px at 390/2P (40px cards). Both are the
designed floors hitting exactly — `max(7, round(33 × 0.22)) = 7`. My probe initially flagged these
as a violation because it tested against the brief's "10px"; the code says otherwise. Nothing here
is a regression, and nothing here was touched.

**The 68/58 and 54/44 figures do not correspond to what I measured.** The game screen's card boxes
are 40×56 / 33×46 at 2P and 62×82 / 53×68 at 4P. Those locked numbers presumably refer to a
different surface or measurement basis. I did not confirm them, because I did not measure them — I
measured the rendered card boxes on the game screen and they are consistent across engines and
configurations.

Neither point changes the conclusion: a type assertion cannot alter a font size or a box, the
emitted JavaScript for that line is identical, and the border it names still renders at its exact
colour and width.

## Cleanup

No probe rows were created this run — page loads only, no hands completed. Verified: probe rows in
`leaderboard` 0 and `chip_transactions` 0, `econ_score_gain_daily` 0, `hand_history` 151 (unchanged;
the Aug 13-15 rows are real user activity, not mine), `bug_reports` 250, rooms 11/11 clean,
`room_players` 0. No `game_rooms` / `room_players` rows touched.

## MACHINE

`tsc` completed cleanly this run (exit 0, no crash), but the memory test is still not run, so local
results remain PROVISIONAL — which is why CI's 0-byte artifact is the verdict quoted above.

=== STRATEGIST HANDOFF — TYPECHECK RESTORED ===
- what the expression at Card.tsx:458 actually is: `{ borderWidth: 2, borderColor: OBSIDIAN.mint
  as const }` — a const assertion on a PROPERTY REFERENCE. Its two sibling branches assert on
  string literals, which is legal; this one never was, and never compiled.
- what 694565f was trying to achieve: the settled three-state border map — gold = won and only won,
  mint = community field, neutral = no state — encoded in WIDTH as well as hue so it survives
  desaturation (3px, because Chromium rounds to whole device pixels and 2.5px collapsed into 2px
  at DPR 3). That intent is about values and widths; `as const` contributes to neither.
- which Card.tsx branch is :458 in: the V2 MINIMALIST branch — the LIVE one. isV2 is hardcoded true
  (:484) and v2Border is applied at :526. Not the dead Classic branch.
- fix applied: components/Card.tsx:458 — dropped `as const`, kept the value. Type-only and erased
  before emit, so colour, width and pixel are unchanged; the commit's encoding is untouched.
- does StaticCard.tsx carry the same pattern? CHECKED — NO. Its v2Border asserts on a string
  literal and has no mint branch; its other assertions are on literals too. Single-sited, unlike
  the white-bar fix.
- **tsc EXIT CODE: 0** (zero errors; checked by exit code, not output)
- CI result: CLEAN — tsc-output artifact from run 31944303617 on ddb7250 is 0 BYTES. Deploy success.
- rendering unchanged — both engines, 390 and 320, at 2P/3P/4P: board counts 4/3/2 correct in all
  12 configurations; cards 40x56, 45x59, 62x82 at 390 and 33x46, 43x54, 53x68 at 320, chromium and
  webkit agreeing to within a pixel. The EDITED line still paints: 2px rgb(79,214,168) = #4FD6A8
  mint present everywhere, with 1px rgba(0,0,0,0.22) neutral. Gold appears only on won cards.
- card sizes unchanged / glyphs >= 10px? TWO CORRECTIONS. The glyph floor in code is 9 (rank) and
  7 (suit) — utils/prdTokens.ts:26-27 — NOT 10. Measured 7px suits at 320/2P and 9px at 390/2P,
  which is those floors hitting exactly, by design, untouched. And the 68/58 & 54/44 figures do not
  match anything I measured on the game screen, so I did not confirm them — I measured the rendered
  card boxes instead and they are consistent across engines.
- if it was NOT a small fix: it WAS a small fix — one line, no restructure, no stop needed.
MACHINE: tsc completed (exit 0, no crash); memory test still not run, so local stays PROVISIONAL.
HANDOFF: file + vamos_handoffs slug 2026-08-16-typecheck-restored + chars, code-point match? Y
WHAT I DID NOT CHECK: the 68/58 and 54/44 locked sizes (I could not identify which surface they
  describe); whether any OTHER file carries an `as const` on a non-literal that would surface once
  this one stopped masking the run — tsc is now clean, so none does today; the reveal and results
  card surfaces were not re-measured, only the game screen.
=== END ===
