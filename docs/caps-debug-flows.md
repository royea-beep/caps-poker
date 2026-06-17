---
name: caps-debug-flows
description: Use when debugging complex multi-step flows in CAPS Poker — placement state machine, reveal animation, drag/drop hand interaction, scroll/navigation between boards, or scale/layout calculations. Activates on questions about "why X behavior", "the reveal does Y", "scrolling problem", "card placement issue", "layout cuts off". Provides debugging methodology for behaviors that aren't visible in single screenshots.
---

# CAPS Poker — Debugging Complex Flows

## Purpose

Some bugs are dynamic. They don't show in screenshots. Roye says "the cards do something weird when X" and Claude needs to:
1. Understand the flow architecturally
2. Form hypotheses
3. Find the right files
4. Make targeted fixes

This skill documents the major flows and how to investigate them.

## When to invoke

- "There's a problem when X happens"
- "The reveal/placement/scroll/animation doesn't work right"
- "It only happens after Y"
- Any bug that requires understanding state transitions

## Flow #1 — Placement state machine

### Files involved
- `app/game.tsx` — main screen, game store integration, READY transition
- `components/BoardArrangement.tsx` — board layout + floatingActions
- `components/Board.tsx` — individual board rendering
- `components/PlayerHand.tsx` — hand cards with drag/tap
- `components/Card.tsx` — single card (V2 branch active, Classic dead)

### State transitions

```
PHASE: idle
  ↓ (PLAY pressed)
PHASE: dealing
  ↓ (cards animated to hand)
PHASE: arranging
  ↓ (player taps card)
PHASE: cardSelected
  ↓ (player taps board slot)
PHASE: cardPlaced (card moves from hand to board)
  ↓ (all 4 boards have 4 player cards each)
PHASE: allBoardsFull (READY button enables)
  ↓ (READY pressed)
PHASE: pre-reveal (bots finish if not done)
  ↓ (all bots committed)
PHASE: revealing (Modal opens)
  ↓ (each board reveals sequentially)
PHASE: result
  ↓ (next hand or end game)
PHASE: idle
```

### Key state variables (in `useGameStore`)

- `phase` — string enum
- `boards[]` — array of `{ communityCards, playerCards, botCards, ... }`
- `playerHand[]` — remaining cards in hand
- `selectedCardIds[]` — currently selected for placement
- `numberOfPlayers` — 2/3/4 (determines board count)

### Common bugs in placement
1. **"אישור" never enables** — boards have cards but `allBoardsFull` returns false. Check: each board's `playerCards.length === 4`
2. **Cards re-appear after placement** — state mutation issue (mutating `playerHand` directly instead of returning new array)
3. **Counter mismatch** — `0/16 הוצבו` while cards are visible on boards = `placedCount` not derived from `boards`

## Flow #2 — Reveal Modal

### Files involved
- `components/BoardReveal.tsx` (1013 lines) — the entire Modal experience
- `app/game.tsx` lines 458-597 — pre-reveal preparation, `revealBoards` build

### Architecture (KEY INSIGHT)

`BoardReveal` is a **Modal** component, NOT a scroll-based view. It displays ONE board at a time via `currentIdx` state, with `translateX` slide animation transitioning between boards.

```jsx
<Modal visible animationType="fade" transparent={false}>
  <SafeAreaView>
    <Pressable style={[styles.container, { backgroundColor: revealBg }]}>
      <Animated.View style={[styles.boardContent, { transform: [{ translateX: boardSlideX }] }]}>
        {/* Single board view, swaps via currentIdx */}
      </Animated.View>
    </Pressable>
  </SafeAreaView>
</Modal>
```

### Common bugs in reveal
1. **"Half screen" appearance** — usually NOT a reveal bug. The Modal takes full screen by design. If user reports this, suspect:
   - Modal didn't actually open (state didn't transition)
   - User is seeing the placement screen with `floatingActions` taking flow space
   - StatusBar handling issue
2. **Slide doesn't animate** — `boardSlideX` Animated.Value not driven properly between board transitions
3. **Skip button doesn't work** — `handleSkip` not bound to Pressable
4. **Wrong board shown** — `currentIdx` out of sync with `revealBoards` array

### Investigation method for reveal bugs

```
1. Confirm: did Modal open? (visible state in BoardReveal)
2. Confirm: did currentIdx update? (would change "Board N" header)
3. Confirm: did slide animation run? (boardSlideX value changes)
4. Then: check actual layout (container flex, boardContent paddingTop/Bottom)
```

## Flow #3 — Layout math (stacked-only, post-b370)

### The constants

```
iPhone 16: 393pt × 852pt
iPhone 17 Pro Max: 430pt × 932pt
```

### The vertical budget (top → bottom)

```
~50pt  — SafeArea top + status bar
~40pt  — Game header (X button, counter, מוכן indicator)
~Npt   — Board area (flex:1, share between N boards)
~180pt — Hand area (locked since b370)
~30pt  — SafeArea bottom
```

For 3P (3 boards), each board gets ~(852 - 50 - 40 - 180 - 30) / 3 = **~184pt**

If `floatingActions` adds 72pt to flow (paddingVertical + minHeight), the budget shrinks: ~(184 - 72/3) = ~160pt per board. Bottom board gets cut.

### Card scale ladder
```
2 boards (4P mode): scale 1.0x — most space per board
3 boards (3P mode): scale 0.85x
4 boards (2P mode): scale 0.69x — least space per board
floor: 50pt community card height
```

### Hand area math (REGRESSION-PRONE)
```
8 cards per row × cardW + (7 gaps × gapW) + (2 × paddingHorizontal of grid)
must be < screen width

If cardWrapper has paddingHorizontal:rs(4), add 8pt × cardCount
```

### Common layout bugs
1. **Board cut at bottom** — flow elements (hand, floating actions) take more space than budget allows
2. **Hand cards clipped at edges** — total width exceeds screen
3. **Scale doesn't match board count** — `card_layout='v2'` config may override

## Flow #4 — Drag/drop hand interaction

### Files involved
- `components/PlayerHand.tsx` — `AnimatedCardSlot` per card
- `components/Card.tsx` — receives `cardWidth/cardHeight` props
- `useGameStore.selectedCardIds` — selection state

### CRITICAL: Card.tsx has THREE rendering branches

1. **faceDown** — back of card
2. **V2 Minimalist (lines ~350-360)** — ACTIVE in production
3. **Classic (lines ~365-391)** — DEAD CODE, edits do nothing unless you change `card_layout` config

When investigating card visual bugs, ALWAYS verify which branch is active.

### Common drag/drop bugs
1. **Tap doesn't select** — `onSelectCard` not bound, or Pressable nested incorrectly
2. **Card disappears on tap** — opacity animation completing without callback
3. **Selection badge wrong number** — `selIndex` calculation off

## Investigation toolkit

### Available without asking Roye

```
github-file?action=search&path=<file>&q=<term>     — find code
github-file?action=lines&path=<file>&start=N&end=M — read code
github-debug?action=runs&workflow=ios-testflight.yml&n=10 — recent CI
github-debug?action=jobs&run_id=<id>               — find failing step
github-debug?action=logs&run_id=<id>&filter=<key>  — logs of step
Supabase execute_sql                                — query DB tables
list_edge_functions, get_edge_function              — read EF source
```

### Diagnostic SQL queries

```sql
-- Recent build history with notes
SELECT id, build_number, status, completed_at, notes
FROM build_history ORDER BY id DESC LIMIT 5;

-- Current session state
SELECT * FROM session_handoffs WHERE id = 1;

-- Check if a feature has DB tables
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%feature_name%';

-- Recent bug reports
SELECT id, status, suggested_fix, created_at
FROM bug_status_log ORDER BY id DESC LIMIT 10;
```

## Hypothesis → verification pattern

When debugging:

1. **Form hypothesis** based on symptom description
2. **Identify smallest verifiable claim** ("if X is true, Y file should contain Z")
3. **Check via code** before assuming
4. **State confidence** — "I'm 70% sure it's this" vs "I confirmed it's this"
5. **Suggest minimal fix** before refactor

### Example trace: "reveal cuts to half-screen"

Hypothesis A: ScrollView in reveal not scrolling
→ Verify: `search BoardReveal.tsx ScrollView` → no matches
→ Reject A.

Hypothesis B: Modal not opening (placement screen still visible)
→ Verify: `search game.tsx setPendingRevealBoards` → exists
→ Inconclusive.

Hypothesis C: Placement screen has element pushing layout off
→ Verify: `search BoardArrangement.tsx floatingActions` → found at line 264
→ Read style: paddingVertical 10pt + minHeight 52pt = 72pt of flow space
→ ACCEPT C. Fix: change to position:absolute.

## Anti-patterns

1. **Don't fix without verifying hypothesis** — wastes builds
2. **Don't refactor when small fix works** — risk:reward bad
3. **Don't trust file size as feature completeness** — 1000-line file may still be UI shell with no backend
4. **Don't assume Modal == Screen** — different mounting, different lifecycle
5. **Don't conflate user-reported phase with actual phase** — Roye says "reveal" but means "placement near end"
