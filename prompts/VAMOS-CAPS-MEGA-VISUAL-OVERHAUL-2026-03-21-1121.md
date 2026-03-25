# VAMOS CAPS MEGA-VISUAL-OVERHAUL
**Date:** 2026-03-21 11:21 IST
**Priority:** 🔴🔴🔴 THE BIG ONE — Make CAPS feel like a $10M poker app
**Build:** current → target b153+

## ROLE
You are the CTO overseeing 10 department leads. Each agent is a specialist.
Execute ALL 10 agents. Do not skip any. Do not half-ass any.
When in doubt — think "Would this impress Phil Ivey?" If no → redo it.

## FIRST ACTIONS — READ EVERYTHING
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\components\CompleteOverlay.tsx
Read C:\Projects\Caps\components\ChipsDisplay.tsx
Read C:\Projects\Caps\hooks\useRevealSequence.ts
Read C:\Projects\Caps\hooks\useGameTimer.ts
Read C:\Projects\Caps\constants\theme.ts
Read C:\Projects\Caps\constants\gameConfig.ts
Read C:\Projects\Caps\constants\visualThemes.ts
Read C:\Projects\Caps\utils\sounds.ts
Read C:\Projects\Caps\utils\handEvaluator.ts
ls C:\Projects\Caps\assets\sounds\
```

## IRON RULES — NEVER BREAK
1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation (2 player + 3 board)
5. Bot = random only
6. No backend — AsyncStorage
7. Local MP via react-native-tcp-socket
8. Internet MP via Supabase Realtime
9. Tap-to-place only — NO drag
10. All 126+ existing tests MUST pass

---

═══════════════════════════════════════════════════════════
AGENT 1 — HOME SCREEN: FULL VISUAL IDENTITY REDESIGN
Lead: Creative Director
═══════════════════════════════════════════════════════════

The home screen must feel like opening the door to Bobby's Room at the Bellagio.
Not a settings page. Not a mobile game. A POKER ROOM.

### A1. Background
- Deep gradient: `#080c14` (top) → `#12192e` (bottom)
- Floating card suit particles: ♠♦♣♥ drifting slowly upward
  - 15-20 particles, opacity 0.03-0.06, fontSize 20-40
  - Each particle: random X position, slow translateY animation (10-15s loop)
  - Use `react-native-reanimated` withRepeat
  - Particles are pointerEvents: 'none' — never block taps

### A2. Logo / Title
- "CAPS" — fontSize 44, fontWeight 900, letterSpacing 10
  - Color: linear text effect → gold shimmer
  - If can't do gradient text in RN, use solid gold `#FFD700` with textShadow:
    `0 0 20px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.5)`
- "POKER" — below, fontSize 14, letterSpacing 20, rgba(255,255,255,0.4), fontWeight 300
- Between CAPS and POKER: thin gold line (width 60, height 1, opacity 0.3)

### A3. Hero Card Fan
- Below the title: 5 cards fanned out in an arc (like a poker hand)
- Cards: A♠ K♥ Q♦ J♣ 10♠ — face up, using actual Card component
- Fan spread: -15° to +15° rotation, overlapping slightly
- Subtle breathing animation: scale 1.0 → 1.02 → 1.0 (4s loop)
- This is the hero visual — it says "this is a card game" instantly

### A4. Buttons
- Primary "NEW HAND" button:
  - Height: 60px, borderRadius 16
  - Background: dark green gradient `#0d5c2e` → `#0a4422`
  - Border: 1.5px solid `rgba(255,215,0,0.4)` (gold hint)
  - Shadow: `0 4px 16px rgba(0,0,0,0.4)`
  - Text: white, fontSize 18, fontWeight 700, letterSpacing 2
  - Press animation: scale(0.97) + shadow shrinks
  - Glow pulse: subtle gold glow animation on idle (beckoning the player)
- Secondary buttons (Multiplayer, Settings, etc):
  - Height: 50px, borderRadius 12
  - Background: `rgba(255,255,255,0.06)`
  - Border: 0.5px solid `rgba(255,255,255,0.12)`
  - Text: rgba(255,255,255,0.7), fontSize 15
  - Press: bg brightens to 0.12

### A5. Pro Quote Banner
- Glass container: `rgba(255,255,255,0.05)`, border `rgba(255,255,255,0.08)`, borderRadius 12
- Blur effect if possible (or fake it with layered opacity)
- The quote text and disclaimer inside the glass card

### A6. Bottom Links Row
- fontSize 12, opacity 0.5, horizontal spacing 16px
- All caps, letterSpacing 1
- Touch target: at least 44px height (accessibility)

### A7. Chip Balance Display
- Gold accent chip icon + balance number
- fontSize 24, fontWeight 700, gold color
- Positioned prominently near the top or above buttons

═══════════════════════════════════════════════════════════
AGENT 2 — CARD FLIP ANIMATION ON REVEAL
Lead: Animation Director
═══════════════════════════════════════════════════════════

This is the MOST important animation in the entire game.
Every poker app has card flips. Without it, CAPS feels unfinished.

### B1. Card Back Design
- Create a card back visual in Card.tsx (when `faceDown={true}`)
- Design: dark navy `#1a1a3e` with:
  - Centered CAPS logo (small, gold, opacity 0.3)
  - Diamond crosshatch pattern (subtle, opacity 0.08)
  - Gold border matching face-up cards
- The back must look premium — not a blank rectangle

### B2. Flip Animation (rotateY)
Using `react-native-reanimated`:

```typescript
// Flip from back to front
const flipProgress = useSharedValue(0); // 0 = back, 1 = front

function flipCard() {
  flipProgress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
}

const frontStyle = useAnimatedStyle(() => ({
  transform: [{ perspective: 800 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [90, 0])}deg` }],
  opacity: flipProgress.value > 0.5 ? 1 : 0,
  backfaceVisibility: 'hidden',
}));

const backStyle = useAnimatedStyle(() => ({
  transform: [{ perspective: 800 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, -90])}deg` }],
  opacity: flipProgress.value <= 0.5 ? 1 : 0,
  backfaceVisibility: 'hidden',
  position: 'absolute',
}));
```

### B3. Reveal Sequence Integration
In `hooks/useRevealSequence.ts`:

For each board during reveal:
1. Turn card (4th community card) flips — 400ms
2. Pause 300ms — let player absorb
3. River card (5th community card) flips — 400ms  
4. Pause 200ms
5. Show hand name (see Agent 3)
6. Show win/loss result
7. Pause 500ms → move to next board

Total per board: ~2 seconds. For 4 boards = ~8 seconds of drama.

### B4. Sound sync
- Card flip sound at the START of each flip animation
- Use the existing `cardFlip` sound from `utils/sounds.ts`
- If no flip sound exists, use the `cardPlace` sound as fallback

### B5. Haptic sync
- Light haptic at the moment each card lands face-up (halfway through flip)

═══════════════════════════════════════════════════════════
AGENT 3 — HAND NAME OVERLAY DURING REVEAL
Lead: UX Designer
═══════════════════════════════════════════════════════════

After each board reveals, the player should INSTANTLY know what hand they have.

### C1. Create `components/HandNameOverlay.tsx`

```typescript
interface HandNameOverlayProps {
  handName: string;    // "Full House", "Two Pair", "Straight Flush"
  isWinner: boolean;   // gold vs gray
  boardIndex: number;
}
```

### C2. Visual Design
- Text slides in from right: translateX(50) → translateX(0), 200ms
- Winner: gold text `#FFD700`, fontSize 14, fontWeight 900, subtle glow
- Loser: dim gray `rgba(255,255,255,0.3)`, fontSize 13
- Position: overlaid on the board, centered, below community cards
- Background: semi-transparent pill `rgba(0,0,0,0.6)`, borderRadius 8, paddingH 12

### C3. Get Hand Name from Evaluator
`utils/handEvaluator.ts` already evaluates hands.
Check if it returns a hand name string. If not, add:
```typescript
export function getHandName(rank: number): string {
  const NAMES = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind',
    'Straight Flush', 'Royal Flush'
  ];
  return NAMES[rank] || 'Unknown';
}
```

### C4. Show in reveal sequence
After each board's river card flips → show HandNameOverlay for 800ms → then show win/loss badge.

═══════════════════════════════════════════════════════════
AGENT 4 — CHIP ANIMATION: FLOATING +/- CHIPS
Lead: Motion Graphics Artist
═══════════════════════════════════════════════════════════

### D1. Create `components/FloatingChips.tsx`

When a board resolves:
- Winner sees: "+150" floating up from the board, gold, fontSize 18, fontWeight 700
  - Animates: translateY(0 → -40), opacity(1 → 0), duration 1200ms
- Loser sees: "-150" floating up, red `#ff4444`, same animation

### D2. COMPLETE mega animation
When COMPLETE triggers:
- ALL boards simultaneously show their +chip amounts
- Then: one BIG "+BONUS" text floats up from center screen
  - Gold, fontSize 28, with particle trail
  - Duration: 1500ms

### D3. Chip Stack Visual Update
- ChipsDisplay should animate the number counting up/down
  - Use `withTiming` to interpolate from old value to new value
  - Duration: 800ms, shows the chips "rolling"

═══════════════════════════════════════════════════════════
AGENT 5 — CARD DEALING ANIMATION
Lead: Game Feel Designer
═══════════════════════════════════════════════════════════

### E1. Deal to Hand
When game starts and player receives cards:
- Cards slide in one by one from top-center of screen
- Each card: translateY(-200 → 0) + slight rotation → lands in hand
- Stagger: 80ms between each card (16 cards × 80ms = 1.3s total deal)
- Sound: card slide/deal sound on each card
- Cards land face-up in hand area

### E2. Community Cards Deal
- Flop (3 cards per board) deals simultaneously with slight stagger (100ms each)
- Cards slide from deck position to board position
- Face-up (the flop is visible during arrangement)

### E3. Implementation
In `app/game.tsx`, add a `dealing` phase before `arranging`:
```
Phase flow: DEALING (2s) → ARRANGING (90s timer) → REVEAL → RESULTS
```
- During DEALING: cards animate in, no interaction allowed
- After DEALING: transition to ARRANGING with all cards in place

═══════════════════════════════════════════════════════════
AGENT 6 — SCREEN TRANSITIONS
Lead: Interaction Designer
═══════════════════════════════════════════════════════════

### F1. Home → Game
- Fade out home elements (300ms)
- Cards deal in (Agent 5 animation)

### F2. Game → Results
- Boards shrink and slide up (300ms)
- Results content fades in below (200ms after boards settle)
- Chip balance updates with counting animation

### F3. Results → Home
- All elements fade out (200ms)
- Home elements fade in (200ms)
- Chip balance in home updates with counting animation

### F4. Implementation
Use `expo-router` animation config or `react-native-reanimated` layout animations:
```typescript
// In _layout.tsx
<Stack screenOptions={{
  animation: 'fade',
  animationDuration: 300,
}}>
```
Or use `Animated.View` with `entering` and `exiting` props on each screen.

═══════════════════════════════════════════════════════════
AGENT 7 — TIMER BAR UPGRADE
Lead: UI Systems Engineer
═══════════════════════════════════════════════════════════

### G1. Visual Timer Bar
Replace text timer with a horizontal progress bar:
- Full width of game area, height 4px, borderRadius 2
- Shrinks from right to left as time passes
- Color transitions:
  - 100-60%: green `#4CAF50`
  - 60-30%: yellow `#FFC107`
  - 30-10%: orange `#FF9800`
  - 10-0%: red `#f44336` + PULSING (opacity 0.5 → 1 → 0.5, 500ms loop)

### G2. Time Number
- Small text above bar: "42s" — right-aligned
- Same color as the bar
- At 10s: fontSize bumps from 12 to 14, fontWeight to 900

### G3. Sound Escalation
- At 10s: start tick sound every second
- At 5s: tick sound gets faster / louder
- At 3s: continuous rapid tick

### G4. Haptic
- At 10s: light haptic
- At 5s: medium haptic
- At 0s: heavy haptic (time's up!)

═══════════════════════════════════════════════════════════
AGENT 8 — HAND PREVIEW BEFORE COMMITTING
Lead: Strategy UX Designer
═══════════════════════════════════════════════════════════

### H1. When 4 cards are placed on a board
Show ghost text below the board:
- Use `handEvaluator.ts` to evaluate the 4 player cards + 3 visible community cards
- Display: "Two Pair" or "Flush Draw" or "Full House"
- Style: fontSize 10, italic, rgba(255,255,255,0.4)
- Animate in: fadeIn 200ms when 4th card is placed
- Animate out: fadeOut 100ms when any card is removed

### H2. Draw Detection
If the hand evaluation can't determine a made hand but can detect draws:
- "Flush Draw (4 to flush)"
- "Straight Draw (open-ended)"
- If no draw: just show made hand name

### H3. Position
Below the player cards row on each board, centered.
Does NOT interfere with tap targets.

═══════════════════════════════════════════════════════════
AGENT 9 — RESULTS SCREEN REDESIGN
Lead: Product Designer
═══════════════════════════════════════════════════════════

### I1. Board Replay Cards
Each board shows as a mini card:
```
┌──────────────────────────────┐
│ Board 1                  +150│
│ Community: 3♥ Q♠ 9♠ 7♦ 2♣   │
│ You:  A♠ K♥ J♦ 10♣          │
│ Bot:  8♣ 5♦ 3♠ 2♥           │
│ ─────────────────────────────│
│ You: TWO PAIR    Bot: PAIR   │
│ ✅ YOU WIN                   │
└──────────────────────────────┘
```
- Winner boards: gold left border
- Loser boards: dim gray left border
- COMPLETE bonus: special gold frame around ALL boards

### I2. Stats Summary
After board cards:
- Best hand of the game (highlighted)
- Total won/lost
- Win streak counter (if applicable)

### I3. Play Again Button
- HUGE — same styling as home screen primary button
- Gold glow pulse animation on idle
- Text: "PLAY AGAIN" or "DEAL ME IN"
- Positioned fixed at bottom

═══════════════════════════════════════════════════════════
AGENT 10 — SOUND DESIGN PASS: EMOTION LAYER
Lead: Audio Director
═══════════════════════════════════════════════════════════

### J1. Map Every Sound to an Emotion

| Moment | Sound | Emotion |
|--------|-------|---------|
| Game start / deal | Card shuffle + slide | Anticipation |
| Card placed on board | Soft click/tap | Satisfaction |
| Card removed | Softer reverse click | Correction |
| Ready button | Confident "lock in" beep | Commitment |
| Reveal starts | Low drum roll / tension rise | Suspense |
| Card flip (per card) | Snap/whoosh | Drama |
| Board won | Bright chime (ascending) | Joy |
| Board lost | Subtle low tone (descending) | Mild disappointment |
| COMPLETE | MASSIVE fanfare — 3s, unique, unmistakable | ECSTASY |
| Timer 10s | Tick... tick... tick... | Urgency |
| Timer 5s | Faster tick | Panic |
| Timer 0 | Buzzer | Finality |
| Chip gain | Cash register / coin clink | Reward |
| Chip loss | Subtle whoosh | Loss |

### J2. Existing vs New Sounds
Check what exists in `assets/sounds/`:
- If sound exists → verify it matches the emotion above
- If wrong emotion → replace
- If missing → create or find royalty-free equivalent

### J3. Sound Generation
For missing sounds, use one of:
- Find royalty-free from freesound.org (download via curl)
- Generate via description if AI sound tools available
- Create silence placeholder with TODO comment

### J4. The COMPLETE Sound
This deserves special attention:
- Must be **unique** — heard nowhere else in the app
- Must be **3 seconds long** — matches the celebration duration
- Must build: hit → sustain → fade
- Think: slot machine jackpot + poker tournament win horn
- If can't find perfect sound — use best available + TODO for custom

═══════════════════════════════════════════════════════════
QUALITY GATE — Before Moving to Deploy
═══════════════════════════════════════════════════════════

After ALL 10 agents finish:

**Self-Review Checklist:**
```
[ ] Home screen: Would you screenshot this and show a friend? 
[ ] Card flip: Does the reveal feel like watching a poker show?
[ ] Hand name: Can player INSTANTLY know what they have?
[ ] Chips: Does winning FEEL like winning?
[ ] Deal: Does game start feel like sitting at a table?
[ ] Transitions: Is the flow smooth between screens?
[ ] Timer: Do you feel urgency at 10 seconds?
[ ] Hand preview: Does it help strategy without cluttering?
[ ] Results: Do you want to press Play Again immediately?
[ ] Sound: Does the audio tell an emotional story?
```

If ANY answer is NO → fix it before deploying.

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
D1. npx tsc --noEmit — 0 errors
D2. npx jest --forceExit — 126+ tests pass
D3. npx expo export --platform web --output-dir web-dist
D4. node scripts/fix-web-html.js
D5. cd web-dist && vercel --prod --yes
D6. git add -A && git commit -m "feat: MEGA visual overhaul — home redesign, card flip, hand names, chip animation, deal animation, transitions, timer bar, hand preview, results redesign, sound pass"
D7. git push origin main
D8. Update MEMORY.md — list all 10 changes with before/after

Report:
═══════════════════════════════════════
MEGA VISUAL OVERHAUL — DELIVERY REPORT
═══════════════════════════════════════
Agent 1  Home Screen:       [DONE/PARTIAL] — describe
Agent 2  Card Flip:         [DONE/PARTIAL] — describe
Agent 3  Hand Name:         [DONE/PARTIAL] — describe  
Agent 4  Chip Animation:    [DONE/PARTIAL] — describe
Agent 5  Deal Animation:    [DONE/PARTIAL] — describe
Agent 6  Transitions:       [DONE/PARTIAL] — describe
Agent 7  Timer Bar:         [DONE/PARTIAL] — describe
Agent 8  Hand Preview:      [DONE/PARTIAL] — describe
Agent 9  Results Redesign:  [DONE/PARTIAL] — describe
Agent 10 Sound Pass:        [DONE/PARTIAL] — describe

Tests: [N]/[N]
TypeScript: [N] errors
Web: [URL]
Build: [number] triggered
═══════════════════════════════════════
```

## DO NOT
- Do NOT change game logic (Omaha evaluation, board count, card count)
- Do NOT change Iron Rules
- Do NOT remove existing features (pro quotes, voice clips, tutorial, etc)
- Do NOT change multiplayer logic
- Do NOT skip any of the 10 agents

VAMOS CAPS MEGA-VISUAL-OVERHAUL — END
