# VAMOS CAPS EVALUATOR-AND-REVEAL-FIX
**Date:** 2026-03-24 05:47 IST
**Priority:** 🔴 Hand evaluator showing too many "High Card" + restore proper reveal

## CRASH SAFETY — READ BEFORE ANY CHANGE
```
IRON RULES (from crash investigation — 5 root causes found):
1. results.tsx = ZERO Reanimated. No import, no Animated.View, nothing.
2. No withRepeat(-1) anywhere. Only withRepeat(N) finite.
3. Max 5 shared values per screen.
4. Every animation has cancelAnimation in cleanup.
5. No ConfettiCannon, no CompleteOverlay with particles.
6. Cancel ALL game.tsx shared values BEFORE router.replace('/results').
7. No entering= layout animation props (FadeInDown etc) — they register worklets during transition.
```

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat utils/handEvaluator.ts
cat utils/gameLogic.ts
cat app/game.tsx
cat app/results.tsx
cat components/Board.tsx
cat components/PlayerHand.tsx
```

═══════════════════════════════════════════════════════════
ISSUE 1 — HAND EVALUATOR: Too many "High Card" results
═══════════════════════════════════════════════════════════

**The user sees "High Card" on almost every board.** This is wrong — Omaha
with 4 player cards + 5 community cards should produce pairs, straights,
flushes frequently. Getting High Card on 4 out of 4 boards is extremely rare.

### 1A. Audit the evaluator

```bash
echo "=== evaluateOmahaHand function ==="
grep -A 60 "function evaluateOmahaHand\|function evaluateOmaha" utils/handEvaluator.ts | head -70

echo ""
echo "=== evaluate5Cards / evaluate5CardsFast ==="
grep -A 40 "function evaluate5Card" utils/handEvaluator.ts | head -50

echo ""
echo "=== How are hands compared? ==="
grep -n "rank\|value\|compare\|winner\|best" utils/handEvaluator.ts | head -20

echo ""
echo "=== getHandName function ==="
grep -A 20 "function getHandName\|handName\|HAND_NAMES" utils/handEvaluator.ts | head -30

echo ""
echo "=== How does gameLogic call the evaluator? ==="
grep -A 20 "evaluateOmaha\|playerHand\|botHand\|handResult" utils/gameLogic.ts | head -30
```

### 1B. Run a quick test

```bash
# Run existing hand evaluator tests:
npx jest utils/__tests__/handEvaluator.test.ts --verbose 2>&1 | tail -30

# Check if specific hands are evaluated correctly:
echo "Check: does a pair of Aces get detected?"
echo "Check: does a flush get detected?"
echo "Check: does a straight get detected?"
```

### 1C. Common evaluator bugs

**Bug 1: Wrong combination selection**
Omaha = must use EXACTLY 2 from player + EXACTLY 3 from community.
If the code uses best-5-of-9 (like Hold'em) → wrong hands.

```bash
# Verify Omaha rule:
grep -n "2.*player\|exactly.*2\|choose.*2\|C(4,2)\|PLAYER_COMBO" utils/handEvaluator.ts | head -5
```

**Bug 2: Hand name mapping wrong**
Maybe evaluation is correct but hand name mapping returns "High Card" for everything.

```bash
grep -n "High Card\|highCard\|HIGH_CARD\|rank.*0\|rank.*===.*0" utils/handEvaluator.ts | head -10
```

**Bug 3: The pre-computed indices are wrong**
We optimized with PLAYER_COMBO_IDX and BOARD_COMBO_IDX — maybe they're wrong.

```bash
grep -n "PLAYER_COMBO_IDX\|BOARD_COMBO_IDX" utils/handEvaluator.ts | head -10
grep -A 5 "PLAYER_COMBO_IDX" utils/handEvaluator.ts
grep -A 10 "BOARD_COMBO_IDX" utils/handEvaluator.ts
```

Verify:
- PLAYER_COMBO_IDX should be: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] (C(4,2) = 6 combos)
- BOARD_COMBO_IDX[5] should be: [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]] (C(5,3) = 10 combos)

**Bug 4: The evaluation is correct but the DISPLAY uses wrong data**
Maybe results.tsx shows handName from the wrong field.

```bash
grep -n "handName\|playerHandName\|botHandName\|hand\.name\|result\.name" app/results.tsx app/game.tsx utils/gameLogic.ts | head -20
```

### 1D. Add a comprehensive test

```typescript
// In handEvaluator.test.ts — add:
describe('Hand recognition accuracy', () => {
  it('detects a pair', () => {
    const player = [{rank:'A',suit:'spades'},{rank:'A',suit:'hearts'},{rank:'2',suit:'clubs'},{rank:'3',suit:'diamonds'}];
    const community = [{rank:'K',suit:'spades'},{rank:'Q',suit:'hearts'},{rank:'7',suit:'clubs'},{rank:'8',suit:'diamonds'},{rank:'9',suit:'spades'}];
    const result = evaluateOmahaHand(player, community);
    expect(result.name).toContain('Pair'); // Should be "One Pair" not "High Card"
  });

  it('detects a flush', () => {
    const player = [{rank:'A',suit:'hearts'},{rank:'K',suit:'hearts'},{rank:'2',suit:'clubs'},{rank:'3',suit:'diamonds'}];
    const community = [{rank:'Q',suit:'hearts'},{rank:'J',suit:'hearts'},{rank:'7',suit:'hearts'},{rank:'8',suit:'diamonds'},{rank:'9',suit:'spades'}];
    const result = evaluateOmahaHand(player, community);
    expect(result.name).toContain('Flush');
  });

  it('detects a straight', () => {
    const player = [{rank:'5',suit:'spades'},{rank:'6',suit:'hearts'},{rank:'2',suit:'clubs'},{rank:'3',suit:'diamonds'}];
    const community = [{rank:'7',suit:'spades'},{rank:'8',suit:'hearts'},{rank:'9',suit:'clubs'},{rank:'K',suit:'diamonds'},{rank:'A',suit:'spades'}];
    const result = evaluateOmahaHand(player, community);
    expect(result.name).toContain('Straight');
  });

  it('detects full house', () => {
    const player = [{rank:'A',suit:'spades'},{rank:'A',suit:'hearts'},{rank:'K',suit:'clubs'},{rank:'K',suit:'diamonds'}];
    const community = [{rank:'A',suit:'clubs'},{rank:'K',suit:'spades'},{rank:'7',suit:'clubs'},{rank:'8',suit:'diamonds'},{rank:'9',suit:'spades'}];
    const result = evaluateOmahaHand(player, community);
    expect(result.name).toContain('Full House');
  });

  // Statistical test — run 100 random hands, count hand types:
  it('produces variety of hands (not all High Card)', () => {
    const handCounts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const deck = shuffleDeck(createDeck());
      const player = deck.slice(0, 4);
      const community = deck.slice(4, 9);
      const result = evaluateOmahaHand(player, community);
      handCounts[result.name] = (handCounts[result.name] || 0) + 1;
    }
    console.log('Hand distribution:', handCounts);
    // High Card should be < 30% of hands in Omaha
    expect(handCounts['High Card'] || 0).toBeLessThan(30);
    // Should have at least 3 different hand types
    expect(Object.keys(handCounts).length).toBeGreaterThanOrEqual(3);
  });
});
```

═══════════════════════════════════════════════════════════
ISSUE 2 — RESTORE PROPER REVEAL SEQUENCE
═══════════════════════════════════════════════════════════

SafeRevealOverlay currently looks bad:
- Background too transparent (boards visible behind)
- Text overlaps board cards
- "Calculating results..." stays visible

### Fix SafeRevealOverlay:

```typescript
// The overlay MUST:
// 1. Have a SOLID dark background (opacity 0.95+) — not transparent
// 2. Cover the ENTIRE screen
// 3. Show ONE board at a time — not all overlapping
// 4. Each board shows: Board N → WIN/LOSE → hand name → chips
// 5. Auto-advance after 1.5s per board
// 6. TAP to skip / advance faster
// 7. After all boards → navigate to results

// ZERO Reanimated. Pure React state + setTimeout.

// IMPORTANT: Hide "Calculating results..." text when reveal starts

// Structure:
<Modal visible={showReveal} animationType="fade" transparent={false}>
  <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0f1a' }}>
    {/* Header: Board X of N */}
    <Text>Board {currentBoard + 1} of {totalBoards}</Text>
    
    {/* Current board result — BIG and clear */}
    <View style={styles.revealCard}>
      <Text style={styles.boardNumber}>BOARD {currentBoard + 1}</Text>
      
      {/* Community cards — face up */}
      <View style={styles.cardRow}>
        {communityCards.map(c => <CardComponent ... />)}
      </View>
      
      {/* Player's hand */}
      <Text>YOUR HAND</Text>
      <View style={styles.cardRow}>
        {playerCards.map(c => <CardComponent ... />)}
      </View>
      <Text>{playerHandName}</Text>
      
      {/* Result */}
      <Text style={winner === 'player' ? styles.win : styles.lose}>
        {winner === 'player' ? '✅ YOU WIN' : winner === 'bot' ? '❌ YOU LOSE' : '🤝 TIE'}
      </Text>
      
      {/* Chips */}
      <Text>{chipDelta > 0 ? `+${chipDelta}` : chipDelta}</Text>
    </View>
    
    {/* Footer */}
    <Pressable onPress={advance}>
      <Text>TAP TO CONTINUE</Text>
    </Pressable>
    
    <Pressable onPress={skipAll}>
      <Text>SKIP</Text>
    </Pressable>
  </SafeAreaView>
</Modal>
```

### Wire the reveal:
```
game.tsx: READY → calculate → show SafeRevealOverlay (Modal)
  → board by board (1.5s each or tap)
  → all done → dismiss modal → router.replace('/results')
```

═══════════════════════════════════════════════════════════
ISSUE 3 — CARDS IN HAND TOO BIG WHEN FEW REMAIN
═══════════════════════════════════════════════════════════

When only 2 cards left in hand, each card takes a full row = giant.
Fix: card size should be FIXED regardless of how many remain.

```bash
grep -n "handCardW\|handCard\|playerHand.*card\|YOUR HAND" components/PlayerHand.tsx app/game.tsx | head -20
```

Fix: always use the same card width as when there are 16 cards.
```typescript
// Card width in hand = always floor((screenWidth - padding) / 8)
// This makes 2 rows of 8 cards each
// When there are fewer cards — same size, just fewer cards shown
const HAND_CARD_W = Math.floor((SCREEN_W - rs(24)) / 8);
```

═══════════════════════════════════════════════════════════
ISSUE 4 — AUTO BUTTON VISIBILITY
═══════════════════════════════════════════════════════════

Verify AUTO button is visible on empty boards.
```bash
grep -n "AUTO\|auto.*fill\|autoFill\|⚡" components/Board.tsx | head -10
```

AUTO should appear:
- On boards with < 4 player cards
- Below or beside the dashed empty slots
- Always tappable (min 44pt touch target)

═══════════════════════════════════════════════════════════
ISSUE 5 — "CALCULATING RESULTS..." TEXT
═══════════════════════════════════════════════════════════

```bash
grep -n "Calculating\|calculating" app/game.tsx | head -5
```

Hide this text when SafeRevealOverlay is showing (the overlay covers it anyway if opaque).

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -10

eas update --branch production --message "fix: hand evaluator + reveal overlay + card sizing + AUTO button"
git add -A && git commit -m "fix: hand evaluator accuracy + solid reveal overlay + hand card sizing + AUTO visibility"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
EVALUATOR + REVEAL — REPORT
═══════════════════════════════════════
Hand Evaluator:
  Bug found: [YES — describe / NO — was correct]
  Hand distribution test: [High Card %] [Pair %] [etc]
  Fix: [what changed]

Reveal:
  Background: [solid dark / still transparent]
  One board at a time: [YES/NO]
  Cards visible: [YES/NO]
  Auto-advance: [YES — Ns per board]
  Skip button: [YES/NO]
  "Calculating..." hidden: [YES/NO]

Cards in hand:
  Size when 2 remaining: [same as 16 / still giant]
  Fixed width: [YES/NO]

AUTO button:
  Visible on empty boards: [YES/NO]

Tests: [N]/[N] + hand distribution test
OTA: [ID]
═══════════════════════════════════════
```

## DO NOT
- Do NOT add Reanimated to results.tsx
- Do NOT use entering= props anywhere
- Do NOT add withRepeat(-1)
- Do NOT add ConfettiCannon
- SafeRevealOverlay = Modal + React state + setTimeout ONLY
- Keep ALL debug logging infrastructure (just silent in production)

VAMOS CAPS EVALUATOR-AND-REVEAL-FIX — END
