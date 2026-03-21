# Caps Poker — Full Build Prompt for Claude

## Overview
Build a fully functional **Caps Poker** demo app in **React Native + Expo** for iOS (TestFlight distribution).  
1 human player vs 1 bot. The bot plays randomly — it exists only for testing purposes.

---

## Game Rules

### The Deck
- Standard 52-card deck, shuffled fresh every hand.

### Player Setup (Demo: 2 players)
- Each player receives **16 cards**
- There are **4 boards**

### Board Structure
Each board has **5 cards total**:
- 3 open cards (visible from the start, like a flop)
- 2 closed cards (revealed at the end, simulating turn + river)

### Card Arrangement Phase
- After cards are dealt, a **60-second timer** starts
- Each player must place **exactly 4 cards** on each board (drag & drop from hand)
- If timer runs out and a board isn't full → system fills remaining spots randomly
- A **"Ready" button** appears once all boards are filled
- If both players ready → game proceeds immediately

### Hand Calculation (Omaha Rules)
- From the 4 cards a player placed on a board, exactly **2 are used**
- Combined with exactly **3 board cards** = best 5-card Omaha hand
- Best hand wins that board

### Pot System
- Each board has a **separate pot**
- Pot amount is equal and fixed across all boards
- Winner of each board takes that board's pot

### Complete Bonus
- If a player wins **ALL boards** in one hand:
  - Display "COMPLETE" message for 2 seconds
  - That player receives a bonus from the opponent equal to **50% of the total amount paid at the start of the hand**

### Starting Chips
- Each player starts with **1000 chips**

---

## Board Reveal Sequence
After both players are ready:
1. Boards reveal **left to right**, one at a time
2. For each board:
   - Reveal all 4 cards of each player
   - Open the 2 closed board cards (turn + river reveal animation)
   - System calculates and highlights the **winning hand cards**
   - Show winner of that board + chips animation
   - Duration: ~5 seconds per board
3. After all boards: show final summary, check for COMPLETE bonus

---

## Settings Screen (CRITICAL FEATURE)
All game parameters must be adjustable via a **Settings / Debug Panel** — no code changes needed for tuning.

Adjustable parameters:
- `arrangementTime` — seconds to arrange cards (default: 60)
- `boardRevealDuration` — seconds per board reveal (default: 5)
- `completeBonusDisplay` — seconds COMPLETE message shows (default: 2)
- `startingChips` — chips per player at start (default: 1000)
- `potPerBoard` — chips per board pot (default: 25)
- `completeBonusPercent` — % of hand total paid as complete bonus (default: 50)
- `botSpeed` — delay in ms before bot places cards (default: random between 5000–30000ms)

This screen should feel like a **developer debug panel** — functional, fast, no fluff.

---

## Screen Structure

### 1. Home Screen
- Game title: **CAPS POKER**
- "New Hand" button
- Chips balance display
- Settings button (gear icon)

### 2. Game Screen — Arrangement Phase
Layout (portrait mobile):
- **Top section**: Bot's cards (face-down, count visible)
- **Middle section**: 4 boards displayed in a 2x2 grid
  - Each board shows: 3 open cards, 2 face-down slots, 4 player card slots (2 per player side), pot amount
- **Bottom section**: Player's hand (scrollable row of cards)
- **Timer** prominently displayed
- **Ready button** (appears when all boards have 4 cards)
- Drag cards from hand to board slots

### 3. Game Screen — Reveal Phase
- Same layout, boards reveal one by one left to right
- Winning hand cards highlighted with glow
- Chips animate to winner
- Active board has visual emphasis

### 4. Hand Summary Screen
- Results for all 4 boards
- Net chips won/lost
- COMPLETE bonus if applicable
- "Next Hand" button

### 5. Settings Screen
- Clean debug panel with all parameters listed above
- Sliders or input fields for each value
- Reset to defaults button

---

## Bot Logic
- Bot randomly assigns its 16 cards across 4 boards (4 cards each)
- Optional: add configurable delay before bot marks "ready" (`botSpeed` parameter)
- No strategy needed — pure random placement

---

## Hand Evaluation
Implement proper **Omaha hand evaluation**:
- From 4 player cards: choose best 2
- From 5 board cards: choose best 3
- Must use exactly 2 + 3
- Evaluate all C(4,2) × C(5,3) = 60 combinations
- Return best 5-card hand + which cards were used (for highlighting)

Hand rankings (standard poker):
Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card

---

## Tech Stack
- **React Native + Expo** (SDK 51+)
- **react-native-reanimated** for animations
- **react-native-gesture-handler** for drag & drop
- **expo-haptics** for tactile feedback on card placement
- **AsyncStorage** for persisting chip balance between sessions
- TypeScript preferred

---

## Visual Design
Go bold. This is a poker game — make it feel premium, atmospheric, and alive.

Direction: **Dark luxury casino aesthetic with modern edge**
- Deep dark green felt texture background
- Gold/amber accents for wins, chips, highlights
- Cards: clean white with sharp suit colors (red/black)
- Boards: slightly raised with subtle shadow/glow
- Typography: something distinctive — not Inter, not Roboto
- Animations: card dealing should feel satisfying, chip movements should feel weighty
- COMPLETE message: full-screen dramatic gold burst
- Winning hand highlight: warm amber glow on winning cards
- Active board during reveal: pulsing border

Make it feel like something people would actually want to play — not a prototype, a product.

---

## File Structure
```
/app
  index.tsx          — Home Screen
  game.tsx           — Game Screen (arrangement + reveal)
  summary.tsx        — Hand Summary
  settings.tsx       — Settings/Debug Panel
/components
  Card.tsx           — Single card component (face up/down states)
  Board.tsx          — Board component with card slots
  PlayerHand.tsx     — Scrollable hand of cards
  ChipsDisplay.tsx   — Chip count with animation
  CompleteOverlay.tsx — Full screen COMPLETE animation
/utils
  deck.ts            — Shuffle, deal logic
  handEvaluator.ts   — Omaha hand evaluation (full implementation)
  gameLogic.ts       — Game state management
/constants
  gameConfig.ts      — Default values for all settings parameters
/store
  gameStore.ts       — Global state (Zustand or Context)
```

---

## Important Notes
- All timers and parameters read from the settings store — never hardcoded
- Portrait orientation only
- iPhone safe area handling (notch, home indicator)
- No backend needed — everything local
- The bot "thinks" by just doing a setTimeout before placing cards randomly
- Make sure hand evaluator is well tested — this is the core logic

---

## Deliverable
A complete, runnable Expo project. All files. Ready to `npx expo start` and test immediately.
