# VAMOS CAPS-S48 HAND-NAME-DISPLAY-FIX
**Date:** 2026-03-24 07:35 IST
**Build:** 198+ (v1.9.4) | OTA: 554a95ba
**Priority:** 🔴 Hand names on results screen are WRONG

## CRASH SAFETY — READ BEFORE ANY CHANGE
```
IRON RULES (from crash investigation):
1. results.tsx = ZERO react-native-reanimated (use RN Animated only)
2. No withRepeat(-1) anywhere
3. Max 5 shared values per screen
4. Every animation has cancelAnimation in cleanup
5. No ConfettiCannon
6. No entering= layout animation props
7. Cancel ALL game.tsx shared values BEFORE router.replace
```

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat app/results.tsx
cat app/game.tsx
cat utils/handEvaluator.ts
cat utils/gameLogic.ts
cat components/SafeRevealOverlay.tsx 2>/dev/null
```

═══════════════════════════════════════════════════════════
BEFORE AUDIT — CURRENT STATE (read only, change nothing)
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
BEFORE AUDIT — HAND NAME BUG
═══════════════════════════════════════
How does results.tsx get hand names?
  Source: [gameStore? route params? recalculates?]
  Variable name: [handName? playerHandName? result.name?]
  
How does game.tsx pass hand data to results?
  Method: [router.replace params? store? AsyncStorage?]
  What data: [just winner? hand name? full hand object?]
  
How does reveal overlay get hand names?
  Source: [same as results? different calculation?]
  
Does the evaluator get called on results screen?
  [YES with what cards / NO — uses pre-computed]

Trace the flow:
  1. game.tsx: player places cards → [how stored?]
  2. game.tsx: READY pressed → [what function evaluates?]
  3. [where]: hand name computed → [stored where?]
  4. reveal overlay: shows hand name from [where?]
  5. results.tsx: shows hand name from [where?]
═══════════════════════════════════════
```

═══════════════════════════════════════════════════════════
BUG — HAND NAMES ARE WRONG ON RESULTS
═══════════════════════════════════════════════════════════

**Symptom:** User screenshots show ALL boards displaying "High Card"
for the player, even when the player clearly has pairs, trips, etc.

**Evidence from real game:**
Board 1: Player has 3♥,3♠ + community has 3♦ → THREE OF A KIND
  App shows: "High Card" ← WRONG

Board 2: Player has 6♦,6♠ → ONE PAIR minimum
  App shows: "High Card" ← WRONG

Board 3: Player has Q♦,K♦ + community has Q♠,K♣ → TWO PAIR
  App shows: "High Card" ← WRONG

**Key insight:** The evaluator ITSELF is correct — we proved this with
the 500-hand statistical test (3.8% High Card, 25% Pair, 38% Two Pair).
So the bug is NOT in evaluateOmahaHand(). The bug is in HOW the
hand name reaches the display.

### STEP 1 — Find where hand names are generated for display

```bash
echo "=== Where does results.tsx get hand name? ==="
grep -n "handName\|hand_name\|handRank\|playerHand\|botHand\|\.name\b" app/results.tsx | head -20

echo ""
echo "=== What data does game.tsx pass to results? ==="
grep -n "router\.replace\|router\.push\|navigate.*result\|params.*result" app/game.tsx | head -10

echo ""
echo "=== What does gameStore store about hand results? ==="
grep -n "handName\|hand_name\|boardResult\|winner\|handRank" store/gameStore.ts | head -15

echo ""
echo "=== How does reveal overlay compute hand names? ==="
grep -n "handName\|evaluateOmaha\|hand_name\|getHandName" components/SafeRevealOverlay.tsx 2>/dev/null | head -10

echo ""
echo "=== Where is evaluateOmahaHand called? ==="
grep -rn "evaluateOmahaHand\|evaluateOmaha" app/ components/ utils/ --include="*.ts" --include="*.tsx" | head -15

echo ""
echo "=== What does the evaluate function return? ==="
grep -A 10 "function evaluateOmahaHand" utils/handEvaluator.ts | head -15
grep -A 5 "return.*{" utils/handEvaluator.ts | head -10
```

### STEP 2 — Common root causes

**Bug A: Hand name is pre-computed BEFORE all community cards are dealt**
If hand evaluation runs during the ARRANGING phase (when only 3 community
cards are visible), the hand name will be wrong because turn+river haven't
been dealt yet. The evaluation MUST happen AFTER all 5 community cards exist.

```bash
echo "=== When is evaluation called? Before or after all 5 community cards? ==="
grep -B 5 -A 5 "evaluateOmaha" app/game.tsx | head -30
grep -n "turn\|river\|community.*5\|allCards\|fullBoard" app/game.tsx | head -15
```

**Bug B: Results screen recalculates but with wrong cards**
Maybe results.tsx re-evaluates hands but uses the wrong card array
(e.g., only the 3 visible community cards, not all 5).

```bash
echo "=== Does results.tsx call evaluateOmahaHand? ==="
grep -n "evaluate\|handEvaluator" app/results.tsx | head -10

echo "=== What cards does it pass? ==="
grep -B 3 -A 10 "evaluate" app/results.tsx | head -30
```

**Bug C: Hand name stored but overwritten**
Maybe the correct hand name IS computed but then gets overwritten
with a default "High Card" value somewhere.

```bash
grep -n "High Card\|highCard\|HIGH_CARD\|default.*hand" app/results.tsx app/game.tsx utils/gameLogic.ts store/gameStore.ts | head -15
```

**Bug D: The hand preview text is being shown instead of final evaluation**
During arrangement, there's a hand preview feature ("High Card", "Flush Draw").
Maybe the PREVIEW text (which only evaluates with 3 community cards) is
being carried into results instead of the FINAL evaluation (with 5 cards).

```bash
echo "=== Hand preview during arrangement ==="
grep -n "preview\|Preview\|PREVIEW\|handPreview\|previewHand" app/game.tsx components/Board.tsx | head -15

echo "=== Is preview hand name stored and reused? ==="
grep -n "previewName\|preview.*name\|hand.*preview" store/gameStore.ts app/game.tsx | head -10
```

### STEP 3 — Fix

Based on what you find, apply the fix:

**IF evaluation uses only 3 community cards:**
- Find where community cards are passed to evaluator
- Ensure ALL 5 community cards (flop + turn + river) are used
- turn and river should be dealt BEFORE evaluation runs

**IF results shows preview instead of final:**
- After turn+river are dealt, RE-EVALUATE all hands with full 5 cards
- Store the FINAL hand name separately from the preview
- Results screen must use the FINAL name, not the preview

**IF hand name is never stored:**
- In the reveal/results calculation, after evaluating each board:
```typescript
const playerResult = evaluateOmahaHand(playerCards, allCommunityCards);
const botResult = evaluateOmahaHand(botCards, allCommunityCards);

// Store BOTH the rank value AND the name
boardResult.playerHandName = playerResult.name; // "Two Pair", "Flush", etc
boardResult.botHandName = botResult.name;
boardResult.winner = playerResult.rank > botResult.rank ? 'player' : 
                     playerResult.rank < botResult.rank ? 'bot' : 'tie';
```

### STEP 4 — Verify fix with specific known hands

Add a test that reproduces the EXACT bug from the screenshots:

```typescript
describe('Bug fix: hand names on results', () => {
  it('detects three of a kind with 3♥,3♠ + community 3♦', () => {
    const player = [
      {rank:'9',suit:'clubs'}, {rank:'K',suit:'spades'},
      {rank:'3',suit:'hearts'}, {rank:'3',suit:'spades'}
    ];
    const community = [
      {rank:'3',suit:'diamonds'}, {rank:'A',suit:'clubs'},
      {rank:'10',suit:'spades'}, {rank:'6',suit:'hearts'},
      {rank:'9',suit:'spades'}
    ];
    const result = evaluateOmahaHand(player, community);
    console.log('Hand name:', result.name, 'Rank:', result.rank);
    expect(result.name.toLowerCase()).toContain('three');
  });

  it('detects one pair with 6♦,6♠', () => {
    const player = [
      {rank:'6',suit:'diamonds'}, {rank:'4',suit:'hearts'},
      {rank:'6',suit:'spades'}, {rank:'9',suit:'diamonds'}
    ];
    const community = [
      {rank:'A',suit:'spades'}, {rank:'5',suit:'clubs'},
      {rank:'2',suit:'hearts'}, {rank:'10',suit:'clubs'},
      {rank:'2',suit:'clubs'}
    ];
    const result = evaluateOmahaHand(player, community);
    console.log('Hand name:', result.name, 'Rank:', result.rank);
    // Should be at least One Pair (6s), possibly Two Pair (6s and 2s)
    expect(result.name.toLowerCase()).not.toBe('high card');
  });
});
```

### STEP 5 — Also verify reveal overlay shows correct names

The reveal overlay should show the same hand names as the results screen.
If reveal gets names from a different source — unify them.

```bash
echo "=== Reveal overlay hand name source ==="
cat components/SafeRevealOverlay.tsx 2>/dev/null | grep -n "handName\|hand_name\|name"
```

### STEP 6 — Test + Deploy

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -10
eas update --branch production --message "fix: hand names display correctly on results (was showing High Card for everything)"
git add -A && git commit -m "fix: CAPS-S48 hand name display bug — results showing wrong hand names"
git push origin main
```

═══════════════════════════════════════════════════════════
AFTER AUDIT
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
AFTER AUDIT — HAND NAME FIX
═══════════════════════════════════════
Root cause: [DESCRIBE — preview vs final? 3 cards vs 5? never stored?]

Hand name flow BEFORE fix:
  [describe the broken flow]

Hand name flow AFTER fix:
  [describe the fixed flow]

Verification — specific hands from screenshots:
  3♥,3♠ + 3♦ community: [now shows "Three of a Kind" / still wrong]
  6♦,6♠: [now shows "One Pair" or "Two Pair" / still wrong]

Evaluator test:
  New regression tests: [PASS/FAIL]
  Existing 500-hand distribution: [still passing?]

Reveal overlay: [uses same source as results? YES/NO]

Tests: [N]/[N]
OTA: [ID]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change the evaluateOmahaHand function (it's correct!)
- Do NOT add Reanimated to results.tsx
- Do NOT change game logic or Iron Rules
- Keep all existing animations (stagger, chip roll, glow, COMPLETE, deal-in)

VAMOS CAPS-S48 HAND-NAME-DISPLAY-FIX — END
