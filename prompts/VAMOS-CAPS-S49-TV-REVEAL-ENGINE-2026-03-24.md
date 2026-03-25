# VAMOS CAPS-S49 TV-REVEAL-ENGINE
**Date:** 2026-03-24 08:00 IST
**Build:** 221 (v1.9.4) | OTA: b2dbf5ca
**Priority:** 🔴🔴🔴 MEGA — The reveal experience is the ENTIRE GAME

## CRASH SAFETY — READ BEFORE ANY CHANGE
```
IRON RULES (from crash investigation — 5 root causes):
1. results.tsx = ZERO react-native-reanimated (use RN Animated only)
2. No withRepeat(-1) anywhere
3. Max 5 shared values per screen
4. Every animation has cleanup in useEffect return
5. No ConfettiCannon — EVER
6. No entering= layout animation props
7. Cancel ALL game.tsx shared values BEFORE router.replace
```

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat app/game.tsx
cat app/results.tsx
cat components/SafeRevealOverlay.tsx 2>/dev/null
cat components/Board.tsx
cat components/PlayerHand.tsx
cat components/Card.tsx
cat utils/handEvaluator.ts
cat utils/gameLogic.ts
cat utils/deck.ts
cat constants/gameConfig.ts
cat store/gameStore.ts
```

═══════════════════════════════════════════════════════════
BEFORE AUDIT — PRINT CURRENT STATE (read only)
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
BEFORE AUDIT — S49
═══════════════════════════════════════

DUPLICATE CARDS:
  isCardOnAnyBoard() function exists: [YES/NO — line number]
  Pre-filter before setState: [YES/NO — line number]
  Updater re-validation: [YES/NO — line number]
  Can same card appear on 2 boards?: [test it — describe]

BOARD RESIZE ON BOT FINISH:
  What triggers board resize?: [describe the layout logic]
  Board height calculation: [fixed/dynamic — how?]
  Does bot placing cards change layout?: [YES/NO — why?]

REVEAL OVERLAY:
  File: [which file?]
  Current flow: [describe step by step]
  Layout: [board position? player cards position? bot cards position?]
  Turn/river reveal: [how does it work now?]
  Timing: [how many seconds per step?]
  Hand name source: [where does it come from?]

HAND NAME DISPLAY:
  Player hands showing correct names?: [test 5 hands — report]
  Bot hands showing correct names?: [test 5 hands — report]
═══════════════════════════════════════
```

═══════════════════════════════════════════════════════════
ISSUE 1 — DUPLICATE CARDS (S46 fix incomplete)
═══════════════════════════════════════════════════════════

The S46 fix added isCardOnAnyBoard() pre-filter + updater re-validation.
BUT USER STILL SEES DUPLICATE CARDS.

### Root cause hunt:

```bash
echo "=== Where is isCardOnAnyBoard defined? ==="
grep -n "isCardOnAnyBoard" app/game.tsx | head -10

echo ""
echo "=== All places where cards are placed on boards ==="
grep -n "setBoards\|placeCard\|handlePlace\|addCardToBoard" app/game.tsx | head -20

echo ""
echo "=== Bot card placement ==="
grep -n "bot.*place\|Bot.*place\|placeBotCards\|botCards\|autoPlace\|randomPlace" app/game.tsx utils/gameLogic.ts | head -20

echo ""
echo "=== Auto-fill (timer expiry) card placement ==="
grep -n "autoFill\|auto.*fill\|timer.*expir\|fillRemaining" app/game.tsx | head -10

echo ""
echo "=== Deck creation — any chance of duplicate cards in deck? ==="
grep -A 20 "function createDeck\|function shuffleDeck\|newDeck" utils/deck.ts | head -30
```

### Possible causes S46 didn't fix:

**A. Bot placement doesn't use the same guard**
The player guard (isCardOnAnyBoard) might only check player cards. The BOT might place cards from the SAME deck subset, creating overlaps.

**B. Deck dealing gives same cards to player and bot**
If deck.ts doesn't properly separate cards — player and bot could receive the same cards.

**C. Auto-fill on timer doesn't check existing placements**
When timer expires and remaining cards get auto-placed, the guard might not run.

**D. The guard checks the wrong state (stale closure)**
React state in closure might be stale — seeing old board state.

### Fix requirements:

1. **Verify deck integrity**: after dealing, NO card should appear more than once in player + bot + community cards combined
2. **Add deck integrity test**: create 1000 games, check for any duplicate card across all locations
3. **Bot placement must use same guard**: isCardOnAnyBoard check before bot places
4. **Auto-fill must use same guard**: timer-expiry placement must check
5. **Add runtime assertion**: if a duplicate is detected at ANY point, log it to console.error and bug_reports table

```typescript
// Add to game.tsx after every card placement operation:
function assertNoDuplicates(boards: Board[], playerHand: Card[], botHand: Card[], communityCards: Card[][]) {
  const allCards: string[] = [];
  // Collect ALL cards
  for (const board of boards) {
    for (const card of board.playerCards) allCards.push(`${card.rank}${card.suit}`);
    for (const card of board.botCards) allCards.push(`${card.rank}${card.suit}`);
  }
  for (const card of playerHand) allCards.push(`${card.rank}${card.suit}`);
  for (const card of botHand) allCards.push(`${card.rank}${card.suit}`);
  for (const community of communityCards) {
    for (const card of community) allCards.push(`${card.rank}${card.suit}`);
  }
  
  const seen = new Set<string>();
  for (const id of allCards) {
    if (seen.has(id)) {
      console.error(`🚨 DUPLICATE CARD DETECTED: ${id}`);
      // Also report to bug_reports table
    }
    seen.add(id);
  }
}
```

═══════════════════════════════════════════════════════════
ISSUE 2 — BOARDS SHRINK WHEN BOT FINISHES
═══════════════════════════════════════════════════════════

When the bot finishes placing cards (fast), the board layout changes size.
This makes all cards smaller and harder to read.

### Diagnose:

```bash
echo "=== Board height/layout calculation ==="
grep -n "height\|flex\|board.*size\|BOARD_H\|boardHeight" components/Board.tsx | head -20

echo ""
echo "=== Is layout recalculated when bot finishes? ==="
grep -n "botDone\|botFinished\|botReady\|countdown\|phase" app/game.tsx | head -20

echo ""
echo "=== Does the layout use available height dynamically? ==="
grep -n "Dimensions\|useWindowDimensions\|screenHeight\|SCREEN_H\|availableHeight" app/game.tsx components/Board.tsx | head -15
```

### Fix:

**Board dimensions MUST be fixed from the start of the game and NEVER change.**

```typescript
// At game start, calculate board height once:
const BOARD_HEIGHT = useMemo(() => {
  const screenH = Dimensions.get('window').height;
  const headerH = rv(80);  // timer + chip counter
  const handH = rv(120);   // player hand area
  const footerH = rv(60);  // buttons
  const available = screenH - headerH - handH - footerH;
  const boardCount = gameConfig.boards; // 2, 3, or 4
  const gap = rv(8);
  return Math.floor((available - (boardCount - 1) * gap) / boardCount);
}, []); // Empty deps = calculated ONCE

// Board.tsx should accept a fixed height prop:
<Board height={BOARD_HEIGHT} ... />
```

**NEVER recalculate layout based on game state** (bot done, player done, phase change).

═══════════════════════════════════════════════════════════
ISSUE 3 — TV BROADCAST REVEAL ENGINE (COMPLETE REDESIGN)
═══════════════════════════════════════════════════════════

This is the heart of the game. The reveal must feel like a professional
poker TV broadcast — like WPT, WSOP Main Event, Poker After Dark.

### THE EXPERIENCE — Board by Board:

For EACH board (one at a time, full screen):

```
STEP 1 — THE SETUP (3 seconds)
┌─────────────────────────────────────┐
│          BOARD 1 of 4               │
│                                     │
│  BOT HAND:                          │
│  [J♥][Q♣][A♠][5♣]                  │
│                                     │
│  ┌──────────────────────────┐       │
│  │  COMMUNITY (FLOP)        │       │
│  │  [K♠] [Q♥] [7♣]  [?] [?]│       │
│  └──────────────────────────┘       │
│                                     │
│  YOUR HAND:                         │
│  [6♦][4♥][6♠][9♦]                  │
│                                     │
│  You: One Pair (6s)                 │
│  Bot: One Pair (Qs)                 │
│                                     │
│  ⚡ Bot leads                       │
└─────────────────────────────────────┘
```
- Show: flop (3 cards face up) + BOTH players' 4 cards
- Calculate & show: "best possible hand" for each with current 3 community cards
- Show who leads: "⚡ [Player/Bot] leads"
- The evaluation at this stage uses Omaha rules (2 from hand + 3 from board)
  BUT since only 3 community cards are visible, it evaluates 2 from hand + 3 from flop
- **IMPORTANT**: Consider "dead cards" — cards visible on OTHER boards' flops
  are known information. Show "outs" count: how many cards in the deck
  could improve each player's hand

```
STEP 2 — THE TURN (3 seconds)
- Dramatic animation: 4th community card flips face up
- Sound effect: card flip + dramatic beat
- Haptic: medium impact
- Recalculate: best hand using 4 community cards (still Omaha — 2+3, 
  but now choosing best 3 from 4 community cards)
- Show updated hand names + who leads
- If lead changed: "⚡ LEAD CHANGE!" in gold flash
```

```
STEP 3 — THE RIVER (3 seconds)  
- More dramatic animation: 5th card flips face up
- Bigger sound effect + haptic
- Final evaluation: full Omaha (2 from hand + 3 from 5 community)
- Show final hand names for both players
- Winner announcement:
  - WIN: green pulse + "✅ YOU WIN +150" 
  - LOSE: red dim + "❌ YOU LOSE -50"
  - TIE: white + "🤝 TIE"
```

```
STEP 4 — TRANSITION (1 second)
- Board result slides out
- Next board slides in
- After last board → COMPLETE check → Results screen
```

### TOTAL TIMING PER BOARD:
- Step 1 (setup): 3 seconds
- Step 2 (turn): 3 seconds
- Step 3 (river): 3 seconds
- Step 4 (transition): 1 second
- **Total per board: ~10 seconds**
- **4 boards = ~40 seconds of drama**

### TAP BEHAVIOR:
- TAP = advance to next step immediately (skip the timer)
- SKIP button (top right) = skip ALL remaining reveals → go to results

### LAYOUT REQUIREMENTS:
- Board cards: CENTER of screen, big (at least 60pt wide)
- Bot cards: ABOVE the board, labeled "BOT" in red
- Player cards: BELOW the board, labeled "YOU" in green
- Hand names: next to each player's cards, clear text
- Who leads: center, below community cards
- Background: solid dark (#080d16), full screen, no transparency
- Font: hand names at least 16pt, winner text at least 24pt

### "BEST POSSIBLE HAND" CALCULATION:

At each stage (flop, turn, river), calculate the best Omaha hand:

```typescript
function getBestPossibleHand(
  playerCards: Card[],    // 4 cards
  communityCards: Card[], // 3, 4, or 5 cards
): { name: string; rank: number } {
  // Omaha: choose exactly 2 from player + exactly 3 from community
  // If community has < 5 cards, still use all available (3 or 4)
  // For 3 community cards: C(4,2) × C(3,3) = 6 × 1 = 6 combos
  // For 4 community cards: C(4,2) × C(4,3) = 6 × 4 = 24 combos
  // For 5 community cards: C(4,2) × C(5,3) = 6 × 10 = 60 combos
  return evaluateOmahaHand(playerCards, communityCards);
}
```

### DEAD CARDS / VISIBLE INFORMATION:

The user specifically asked for this — during the reveal of Board N,
the system should know which cards are already visible:
- All community cards on ALL boards (flops are visible from the start)
- Cards already revealed on previously shown boards (turns/rivers)

This information should be used for "outs" calculation:
```typescript
function calculateOuts(
  playerCards: Card[],
  communityCards: Card[],  // current board
  deadCards: Card[],       // visible on other boards
): number {
  // How many unknown cards could improve this hand?
  const deck52 = createFullDeck();
  const knownCards = [...playerCards, ...communityCards, ...deadCards];
  const remainingCards = deck52.filter(c => 
    !knownCards.some(k => k.rank === c.rank && k.suit === c.suit)
  );
  
  const currentBest = evaluateOmahaHand(playerCards, communityCards);
  let outs = 0;
  
  for (const card of remainingCards) {
    const withCard = [...communityCards, card];
    const newBest = evaluateOmahaHand(playerCards, withCard);
    if (newBest.rank > currentBest.rank) outs++;
  }
  
  return outs;
}
```

### IMPLEMENTATION:

Use a NEW component: `components/TVRevealOverlay.tsx`

DO NOT modify SafeRevealOverlay — create a new one.
Keep SafeRevealOverlay as fallback.

```typescript
// TVRevealOverlay.tsx
// Pure React state + setTimeout + RN Animated (NOT Reanimated)
// 
// Props:
// - boards: BoardResult[]
// - onComplete: () => void
// - allCommunityCards: Card[][] (all boards' community cards — for dead card calc)
//
// State:
// - currentBoardIndex: number
// - currentStep: 'setup' | 'turn' | 'river' | 'result'
// - timer: auto-advance or tap
//
// For card flip animation on turn/river:
// Use RN Animated rotateY — the card starts face-down, flips to face-up
// Duration: 400ms
// 
// CRASH SAFETY: 
// - Zero Reanimated imports
// - All Animated.Values cleaned up in useEffect return
// - All setTimeouts cleaned up
```

### Wire it in game.tsx:

```typescript
// Replace SafeRevealOverlay with TVRevealOverlay:
{showReveal && (
  <TVRevealOverlay
    boards={boardResults}
    allCommunityCards={boards.map(b => b.communityCards)}
    playerCards={boards.map(b => b.playerCards)}
    botCards={boards.map(b => b.botCards)}
    onComplete={() => {
      setShowReveal(false);
      router.replace('/results');
    }}
  />
)}
```

═══════════════════════════════════════════════════════════
ISSUE 4 — HAND NAME VERIFICATION
═══════════════════════════════════════════════════════════

S48 fixed the pre-calc timing bug. Verify it's actually working:

```bash
echo "=== Pre-calc skip logic ==="
grep -n "playerDone\|precalc\|preCalc\|pre_calc" app/game.tsx | head -10

echo "=== Fresh calculation on READY ==="
grep -n "calculateHandResults\|doNavigate\|precalcRef" app/game.tsx | head -10
```

Run auto-sim 5 hands — check hand names in console output.

═══════════════════════════════════════════════════════════
TESTS
═══════════════════════════════════════════════════════════

### New tests:

```typescript
// 1. Deck integrity — no duplicates ever
describe('Deck integrity', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck();
    const ids = deck.map(c => `${c.rank}${c.suit}`);
    expect(new Set(ids).size).toBe(52);
  });

  it('dealing to 2 players (4 boards) produces no duplicates', () => {
    for (let i = 0; i < 100; i++) {
      const deck = shuffleDeck(createDeck());
      // 16 player + 16 bot + 20 community (5 per 4 boards) = 52
      const allCards = deck.slice(0, 52).map(c => `${c.rank}${c.suit}`);
      expect(new Set(allCards).size).toBe(52);
    }
  });
});

// 2. Hand evaluation with partial community cards
describe('Partial community evaluation', () => {
  it('evaluates with 3 community cards (flop only)', () => {
    const player = [
      {rank:'A',suit:'hearts'},{rank:'A',suit:'spades'},
      {rank:'2',suit:'clubs'},{rank:'3',suit:'diamonds'}
    ];
    const flop = [
      {rank:'K',suit:'hearts'},{rank:'Q',suit:'hearts'},{rank:'7',suit:'clubs'}
    ];
    const result = evaluateOmahaHand(player, flop);
    expect(result.name).toContain('Pair'); // At least one pair of Aces
  });

  it('evaluates with 4 community cards (flop + turn)', () => {
    const player = [
      {rank:'A',suit:'hearts'},{rank:'K',suit:'hearts'},
      {rank:'2',suit:'clubs'},{rank:'3',suit:'diamonds'}
    ];
    const flopTurn = [
      {rank:'Q',suit:'hearts'},{rank:'J',suit:'hearts'},
      {rank:'7',suit:'clubs'},{rank:'10',suit:'hearts'}
    ];
    const result = evaluateOmahaHand(player, flopTurn);
    // A♥K♥ with Q♥J♥10♥ on board — should be flush or better
    expect(result.name.toLowerCase()).not.toBe('high card');
  });
});

// 3. Board layout doesn't change size
describe('Board layout stability', () => {
  it('board height is fixed regardless of game phase', () => {
    // This is a visual test — verify in code that BOARD_HEIGHT
    // is calculated once in useMemo with empty deps
  });
});
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -10

# Test: auto-sim 5 hands with new reveal
# Verify: no crash, no duplicate cards, hand names correct

eas update --branch production --message "feat: CAPS-S49 TV broadcast reveal engine + duplicate cards fix V2 + board resize lock"
git add -A && git commit -m "feat: CAPS-S49 — TV reveal (turn/river drama, dead cards, outs) + board height locked + duplicate guard V2"
git push origin main
```

═══════════════════════════════════════════════════════════
AFTER AUDIT
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
AFTER AUDIT — S49
═══════════════════════════════════════

DUPLICATE CARDS:
  Root cause found: [describe]
  Fix applied: [describe]
  assertNoDuplicates added: [YES/NO]
  100-game test: [PASS/FAIL]

BOARD RESIZE:
  Root cause: [describe]
  Board height now: [fixed/dynamic]
  Does bot finishing change layout: [YES/NO]

TV REVEAL ENGINE:
  New file: components/TVRevealOverlay.tsx [CREATED/NOT]
  Step 1 (setup with flop): [WORKS — seconds]
  Step 2 (turn flip): [WORKS — seconds]
  Step 3 (river flip): [WORKS — seconds]
  Step 4 (transition): [WORKS — seconds]
  Bot cards above board: [YES/NO]
  Player cards below board: [YES/NO]
  Hand names shown: [YES/NO — both sides?]
  Who leads indicator: [YES/NO]
  Lead change flash: [YES/NO]
  Dead cards considered: [YES/NO]
  Outs calculation: [YES/NO]
  Card flip animation: [YES/NO — RN Animated only]
  Tap to advance: [YES/NO]
  SKIP button: [YES/NO]
  Crash test (10 hands): [PASS/FAIL]

HAND NAMES:
  Verified correct: [YES — tested N hands / NO]

ANIMATION LIBRARY:
  Reanimated in TVRevealOverlay: [MUST BE NO]
  RN Animated used: [YES/NO]

Tests: [N]/[N]
OTA: [ID]
Build: eas build:list --platform ios --limit 1
═══════════════════════════════════════
```

## DO NOT
- Do NOT import ANYTHING from 'react-native-reanimated' in TVRevealOverlay
- Do NOT use withRepeat(-1)
- Do NOT use entering= layout animation props
- Do NOT add ConfettiCannon
- Do NOT change board dimensions based on game state
- Do NOT modify the hand evaluator (it's correct)
- Every animation MUST have cleanup in useEffect return
- Every setTimeout MUST have clearTimeout in cleanup

## REFERENCE — Pro Poker Broadcast Style
Think of how WPT / WSOP broadcasts show a hand:
1. First you see both players' hole cards — the audience knows everything
2. Flop is dealt — commentators discuss odds and outs
3. Pause for drama — who's ahead?
4. Turn card — did it change anything?
5. River card — THE MOMENT OF TRUTH
6. Winner revealed with fanfare

That's EXACTLY what this reveal should feel like.
Each board = one complete "hand" with full drama.

VAMOS CAPS-S49 TV-REVEAL-ENGINE — END
