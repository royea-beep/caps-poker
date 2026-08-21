# CAPS — the other three families, and a correction (2026-08-21)

All four shop families now grant something durable and reachable. One number from the previous
handoff is withdrawn, and the WON-border measurement fails a third time with a named cause.

---

## ⚠️ Correction — the winner cue is **not** `#c9a84c`

[Card.tsx:469](components/Card.tsx:469) records **VAMOS-ONE-GOLD (2026-08-16)**: the WON border was
changed **from `#c9a84c` to `#FFD700`**, 3px, because beside "✅ YOU WIN" in `#FFD700` a
half-saturated amber "reads as brass". I carried the retired colour forward into the card-back
handoff and measured against it.

| pair (greyscale) | corrected | what I reported |
|---|---:|---:|
| WON `#FFD700` vs SLATE back | **5.804 : 1** | 3.562 : 1 |
| WON `#FFD700` vs CLASSIC back | **12.621 : 1** | 7.746 : 1 |
| WON `#FFD700` vs field mint | 1.300 : 1 | — |

The conclusion holds and improves — the cue separates from the new back *better* than reported — but
the figures were measured against a colour that has not existed since 2026-08-16, and are withdrawn.

**And it explains the capture failures:** every live scan searched for `rgb(201,168,76)`. The border
paints `rgb(255,215,0)`.

## The 3px WON border — third failure, cause named

Re-ran the deliberate 4P drive with the **correct** colour. Still not captured, and the diagnostic
says why: **the harness never reaches a reveal.** After clicking Auto-Place and then `ready-button`,
the screen still reads *"PLACE 4 CARDS"* with 26 bordered cards and testids `[board-0, board-1,
hand-row, ready-button]` — still in **placement**. Auto-Place does not complete placement under
Playwright, so Ready never arms.

This is a finding about the harness, exactly as the brief predicted: the blocker is driving
*placement* headlessly. Stopping per instruction. The cue rests on diff scope (zero winner-cue lines
touched) and the corrected separation above.

## The three families

| family | variant | how |
|---|---|---|
| **Avatar** | 12 premium emoji | `AVATAR_OPTIONS` (12) untouched and free; `AVATAR_OPTIONS_PREMIUM` unlocked by `buy_avatar` |
| **Table theme** | `streetStencil` | Existed in `constants/visualThemes.ts` since S76 with every token resolved — unreachable **only** because the picker hardcoded two literals. `buy_table_theme` unlocks it; classic and fiveo stay free. **No new content invented** |
| **Emotes** | WILD pack | A pack **swaps six for six**, never appends — the chat strip is a fixed `space-between` row documented to fit "6 emotes + chat toggle" at 320–480px (Issue D); thirteen items overflow at 320–375 |

Ownership now has **one home** — [utils/ownedItems.ts](utils/ownedItems.ts) `useOwnedSkus()` —
instead of being read inline per picker. It returns `ready` so a caller can distinguish *not loaded*
from *owns nothing*: falling back on a set that had simply not arrived would reset a selection the
player really owns.

## Five criteria, both engines (webkit/430, chromium/393) — identical

| step | result |
|---|---|
| shop | 2,530 → 1,680 = **exactly 850** (150 + 200 + 500) · Buy 7→4 · **Owned 3** |
| unowned | theme tiles 2 (no STREET) · emote tiles 0 · **avatars 12** |
| owned | theme tiles **3 with STREET** · emote tiles **2** · **avatars 24** |
| selected | `streetStencil` · `wild` · `🐉` |
| **after reload** | **all three unchanged** |
| console | no errors on either engine |

**Defaults byte-identical, nothing gated:** confirmed for all three — a device owning nothing sees
exactly what it sees today. **Pickers hide until owned and fall back on loss:** confirmed for theme
and emote pack (and the card back). Avatar has no separate picker to hide — its grid simply grows —
and falls back to `AVATAR_OPTIONS[0]` if a premium selection is no longer owned.

## Table theme vs the game surface

Same device, classic vs streetStencil, 4P, `/game`:

- `hand-row` top **592**, lowest board bottom **546** — **identical under both themes**
- **overlap 0px under both** — the 83px→0 layout work is untouched
- no horizontal overflow under either
- gold-bordered elements: classic 3, streetStencil 1 — a **chrome** difference (streetStencil's
  accent is spray-yellow `#F2C230`), **not** the winner cue. Card-sized gold was 0 in both because
  no reveal is on screen, and the cue is hardcoded `#FFD700` at
  [Card.tsx:475](components/Card.tsx:475), not theme-derived, so a theme cannot change it.

## Emotes: the fifth criterion is **not** claimed

The chat strip is multiplayer-only ([multiplayer-game.tsx:1540](app/multiplayer-game.tsx:1540)). The
pack is purchasable, the picker appears only when owned, WILD selects, and the selection persists —
but I did **not** observe the six WILD emoji on a live MP strip, which needs a real second player.
**Four of five for emotes.** Avatar and table theme have all five.

## C5 — restated for Roye, not built

C5 is **per-hand** monotony: every back in a hand is identical to its neighbours. A second back did
not address it. The palette refactor made all four filed options cheaper — they now apply inside
`renderBack()` over `back.*` instead of five hardcoded constants.

| option | what varies | cost | risk |
|---|---|---|---|
| **A** ring alpha | the inner ring fades slightly differently per card, ~4 steps | ~10 lines + a small hash | lowest — and possibly invisible at the size backs actually render, in which case it doesn't answer the complaint |
| **B** glyph rotation | the "C" tilts a couple of degrees per card | ~10 lines, one transform | low — reads as craft on big cards; at 44px wide it may read as a rendering fault |
| **C** ring offset | the ring sits 1–2px off-centre, four directions | ~15 lines; the only one touching the back's absolute layout, so it needs a layout re-check | medium |
| **D** pattern seed | a subtle repeating mark, seeded per card | real artwork inside the back | highest — and the only one unambiguously visible |

**Leak guidance, unchanged and non-negotiable:** hash a **card ID**, never rank, suit or value. The
back is what the opponent stares at all hand and it turns face-up at the reveal; anything
correlating with the face is an information leak that only surfaces once someone notices. Whichever
is chosen needs a test asserting no correlation.

**The prior question still stands:** is the monotony a problem at the size backs actually render, or
only in a mock? A and B may be literally invisible there — in which case the honest answer is D or
nothing.

## Close

**Shop end to end: 4 of 4 families** grant something durable and reachable. Three have all five
criteria proven; emotes has four of five, blocked on a live MP context rather than on anything
unbuilt.

**Cleanup:** 7 purchases, 16 chip_transactions, 4 leaderboard rows, 3 bindings, 45 analytics events,
11 counters across 4 browser test devices. `purchases` back to **zero**; 0 test devices, 0 QA
functions.

**Nothing else changed:** nothing free gated · no catalogue item added · no price changed · no stake
tiers, stakes UI or tournaments · MP prompt untouched · no keys.

*(handoff: `vamos_handoffs` id 85)*
