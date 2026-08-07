# MEASUREMENT PROTOCOL

**Why this exists:** five wrong findings in two days, one root cause — *the instrument selected the
wrong element and the report was confident.* Every one was measured, and every one was wrong. This is
a procedure, not a reminder to be careful.

| # | The claim | The truth |
|---|---|---|
| 1 | "The reveal is static" | Measured **geometry**; the animation is opacity / rotateY / scaleY — none of which move a bounding box. |
| 2 | "The 35px glyph is decoration" | It's a **card pip** — ancestor chain `19×41 → 54×70 → 54×70`, inside a card. |
| 3 | "The primary action is 10px" | That was a **header status chip**. Four elements read `✓ READY`; the button is 16px. |
| 4 | "`rf(11)` renders as 7px" | **Two elements, two files.** `BoardReveal.sectionLabel` (rf(11), `🤖 Bot`) vs `Board.rowLabel` (rf(7), `Bot 1`). |
| 5 | "`adjustsFontSizeToFit` shrinks handName to 10px" | It's **`HandBadge`**, two literals by prop. And `Board.handName` **never renders in solo at all**. |

---

## The six rules

### 1. Never identify an element by its text content alone
Text repeats, and the duplicates are usually the trap:
- **four** elements read `✓ READY` — one is the button, the rest are status
- `Bot 1` exists in **two components** (`Board.rowLabel`, `BoardResultCard`)
- `🤖 Bot 1` and `Bot 1` are **different controls in different files** — and a regex anchored `^Bot \d$`
  silently excludes the emoji one, so you sample one file while reading the other

Identify by a **stable structural anchor**: a `testID`, the ancestor chain, or a uniquely-shaped
parent. *"The row that contains a bare `Bot N` label and four cards"* is an anchor. *"The element
whose text is `Bot 1`"* is not.

### 2. Walk the ancestors before classifying anything
**"Decoration" and "primary action" are claims about ROLE, and role lives in the tree, not in the
font size.** Finding #2 died the moment the chain showed a 54×70 card. One `parentElement` loop would
have prevented it — and prevented #3 and #5 too.

### 3. Confirm the element is reachable on the path you are testing
Before measuring *or editing*. `Board.handName` was edited **twice** while being unrenderable in solo
play — it is gated on `revealed &&`, hardcoded `false` at `game.tsx:1245` and
`BoardArrangement.tsx:260`. Grep the prop that gates it and check who passes what.

### 4. A mechanism that explains the numbers is a hypothesis, not a finding
The most dangerous of the five. `16 × 0.65 = 10.4` matched the `10` on screen, so a completely wrong
explanation looked *confirmed by arithmetic*. **A coincidence that fits is not evidence.**

> **Require a second, independent confirmation: change the input and PREDICT the output before
> measuring it.** If `adjustsFontSizeToFit` were really governing, widening the box would change the
> rendered size. That test takes one minute and would have killed the hypothesis immediately.

### 5. Fresh mount, never resize
Memoized layouts do not re-lay-out on window resize. Reload at the target size. This produced two
further wrong conclusions ("identical at all four widths", "constant 129px overflow") — see
MEMORY.md (6).

### 6. Weight and colour carry hierarchy too
Size alone is a poor proxy. `/results` renders a **31px** `—` beside a **24px** headline, which reads
as an inversion until you see it is `fontWeight: 300` in `textDim` next to 41px black numerals — i.e.
visually **recessive**. Read the whole computed style before calling a size a defect.

---

## Proposal: `testID` on the elements this project keeps re-measuring

**Not added in this sprint — this is the list, so the size of it is visible before anyone commits.**
One prop per element, and it ends this entire class of error: a `testID` cannot be ambiguous, cannot
be duplicated by a coincidence of copy, and does not move when the text is translated.

| # | testID | Element | File | Times mis-measured |
|---|---|---|---|---|
| 1 | `seat-label` | `Bot N` row label | `Board.tsx:966` | 2 |
| 2 | `reveal-section-label` | `🤖 Bot N` section header | `BoardReveal.tsx:888` | 1 |
| 3 | `hand-badge` | hand name badge (both sizes) | `HandBadge.tsx` | 1 |
| 4 | `board-hand-name` | MP-only hand name | `Board.tsx:1110` | 2 |
| 5 | `ready-button` | the actual READY/Confirm button | `BoardArrangement.tsx:455` | 1 |
| 6 | `ready-status-chip` | the header chip that is **not** the button | `game.tsx` header | 1 |
| 7 | `score-numerals` | `/results` score pair | `results.tsx:876` | 0 (pre-emptive) |
| 8 | `result-headline` | `YOU WIN` / `YOU LOSE` | `results.tsx:862` | 0 (pre-emptive) |
| 9 | `breakdown-hand` / `breakdown-vs` | per-board hand names | `results.tsx:1543/1550` | 0 (pre-emptive) |
| 10 | `card-pip` | card face suit glyph | `Card.tsx` | 1 |

**10 elements, ~10 lines.** Six of them have already cost a sprint each.
