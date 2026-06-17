---
name: caps-screenshot-qa
description: Use when Roye sends CAPS Poker screenshots and Claude needs to analyze them like a QA engineer. Triggers when user uploads images of TestFlight/iPhone playing CAPS Poker, especially game/placement/reveal/menu screens. Read this BEFORE giving any visual feedback.
---

# CAPS Poker — Screenshot QA Analysis

## What this skill does

This skill teaches Claude to look at CAPS Poker screenshots like a QA engineer with full domain knowledge. The goal: catch bugs the user might miss, distinguish between bugs and intentional features, and produce structured reports.

## Pre-analysis: orient yourself

Before saying anything about a screenshot, Claude identifies:

1. **Build number** — read the pink pill at top-left (e.g., `v2.7.0 b373 • V21 • EMBED`). This determines what fixes should be live.
2. **Game mode** — count boards visible:
   - 4 boards stacked = 2P mode (16 cards in hand)
   - 3 boards stacked = 3P mode (12 cards)
   - 2 boards stacked = 4P mode (8 cards)
3. **Game phase**:
   - **Setup/menu** — title, PLAY button, no boards
   - **Placement (isArranging)** — boards visible, dashed gold slots, cards in hand, possibly floating "ביטול"/"אישור" buttons
   - **Reveal** — Modal-based, single board centered, big "Board N" label, dots row
   - **Result** — winner indication, hand names, advance button
4. **State indicators**:
   - `0/12 הוצבו` = nothing placed yet
   - `4/16 הוצבו` = 4 of 16 cards placed (multi-row hand state)
   - `8/12 הוצבו` = 8 of 12 placed
   - Green ✓ checkmark next to lowest "לוח 1" = board fully filled

## What is NOT a bug — common false positives

These appear suspicious but are intended behavior:

| Visual | Why it looks weird | Why it's actually fine |
|---|---|---|
| Cards in 2 rows inside one board | "Why is there a second row of small cards?" | These are the **player's placed cards** (4 per board) shown above the dashed slots. The community cards (3 face-up + 2 face-down) are on the right side |
| "ביטול"/"אישור" buttons during placement | "Why are there confirm buttons before I'm done?" | "ביטול" = undo last placed card. "אישור" = confirm (disabled until all boards full, then becomes "✓ מוכן"). Floating, not modal |
| Slots disappearing as cards are placed | "The dashed gold placeholders vanish" | Each placed card replaces one slot. Once all 4 player slots are filled, none remain dashed |
| Different number of dashed slots per board | "Why does board 1 have 4 dashed and board 2 has 3?" | After cards are placed, slots fill in. Empty boards show all 4 dashed |

## What IS a bug — pattern catalog

When Claude sees these, flag them as actual issues:

### Layout bugs
- **Board cut off at screen edge** — A board (especially the bottom one) showing only partially. Cause: floating action buttons or hand area taking too much vertical space. Check: do all N boards fit fully?
- **Hand cards clipping at left/right** — Cards extending past screen edges. Cause: `cardW` × cardCount > screen width. Check: are all hand cards fully visible?
- **Boards overlapping each other** — Adjacent boards bleeding into each other. Cause: negative margins or zIndex issues
- **Card scale wrong for board count** — Cards in 4-board mode (2P) should be 0.69x. If they look the same as 2-board mode, the scale ladder is broken

### State bugs
- **"מוכן" indicator wrong** — Top bar says "מוכן ✓ בוטים 2/2" but you can still place cards = state mismatch
- **Counter mismatch** — "0/12 הוצבו" but cards are clearly placed = counter not updating
- **Auto-advance failed** — Hand has 0 cards, boards are full, but no transition to reveal

### Visual quality bugs
- **Pink/washed-out colors** — Means hex values too light. Per locked palette: bg #1C0508, boardBg #6B1520, boardBorder #8B6914
- **Text overlap** — Hebrew text running into another element
- **Missing text shadow on title** — CAPS title without shadow blends into background

## Reading the bottom action bar (placement phase)

| Bar state | Meaning |
|---|---|
| Empty (no buttons) | No cards placed yet, helper text "הקש על קלף כדי להתחיל" |
| "ביטול" + "אישור" (disabled, gray) | Cards being placed, not all boards full |
| "ביטול" + "✓ מוכן" (gold, active) | All boards full, ready to reveal |
| Disappears entirely | Game advanced to reveal phase |

## Reading the top bar

| Element | Meaning |
|---|---|
| `X` button (top-left) | Exit game |
| `0/N הוצבו` (top-right) | Cards placed counter |
| `מוכן ✓` (center) | All bots done, player can ready up |
| `חושב...` (center) | Bots still placing |
| `בוטים N/M` (center) | Bot progress count |

## Per-board element checklist

For each board in the screenshot, verify:

```
☐ "לוח N" label visible (top-left of board)
☐ "מסדר ←" hint visible if board is currently active for placement
☐ 3 community face-up cards visible (left side, after divider line)
☐ 2 community face-down cards visible (right side, dark with diamond pattern)
☐ Vertical divider between player cards and community
☐ Hand strength indicator visible (Pair, High Card, Flush Draw, etc.)
☐ Either dashed gold slot placeholders OR placed player cards (never neither)
☐ "מיקום אוטומטי" lightning button visible on currently-active board
```

## Writing the report

After analyzing, structure findings as:

```
## Image Analysis — b<NN>

### What works ✅
- [Confirmed working]

### Real bugs found 🚨
- **[ID]** [Symptom] | Cause: [analysis] | Severity: P0/P1/P2

### Not bugs — verified intentional
- [Suspicious thing] — actually [explanation]

### Could not determine from static screenshot
- [Things that need video or runtime data]
```

## Anti-patterns Claude must avoid

1. **Don't guess from one screenshot** — if state is ambiguous, ask for the previous frame or video
2. **Don't confuse phases** — Modal reveal ≠ in-game placement. Different layout, different rules
3. **Don't reduce complex bugs to single fixes** — "card too big" might be paddingHorizontal in wrapper, minWidth in Card, scale prop, or grid math
4. **Don't suggest fixes before confirming the bug exists** — verify state from multiple cues (counter, indicator, layout) before recommending changes

## When to ask the user vs decide alone

**Ask:**
- Phase is genuinely ambiguous from the screenshot
- Behavior depends on tap order or animation timing
- Bug is intermittent and only screenshot is available

**Decide alone:**
- Element is clearly missing/extra/clipped
- Layout math is provably wrong (cards × widths > screen)
- Text/copy is misspelled or fake (e.g., hardcoded "32 שחקנים")
