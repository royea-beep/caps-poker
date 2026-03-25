# VAMOS CAPS FINAL-3-GAPS
**Date:** 2026-03-21 12:05 IST
**Priority:** 🔴 Close the last 3 visual gaps — then CAPS is done

## ROLE
3 specialists closing the last 3 issues. No shortcuts.

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\_layout.tsx
Read C:\Projects\Caps\utils\sounds.ts
Read C:\Projects\Caps\utils\handEvaluator.ts
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\hooks\useRevealSequence.ts
ls C:\Projects\Caps\assets\sounds\
grep -rn "playSound" C:\Projects\Caps\app\game.tsx C:\Projects\Caps\app\results.tsx C:\Projects\Caps\components\*.tsx C:\Projects\Caps\hooks\*.ts | grep -v node_modules | grep -v __tests__
```

═══════════════════════════════════════════════════════════
GAP 1 — RESULTS SCREEN: Full Redesign (the biggest miss)
═══════════════════════════════════════════════════════════

The current results screen has gold borders and a DEAL ME IN button.
But it's MISSING the core: mini replay cards showing both hands per board.

### What to build in `app/results.tsx`:

**A. Board Replay Cards — the centerpiece:**

For EACH board, render a replay card component:

```typescript
interface BoardReplayCardProps {
  boardIndex: number;
  communityCards: Card[];     // 5 community cards
  playerCards: Card[];        // 4 player cards
  opponentCards: Card[];      // 4 opponent cards
  playerHandName: string;     // "Full House"
  opponentHandName: string;   // "Two Pair"
  winner: 'player' | 'opponent' | 'tie';
  potAmount: number;
}
```

Layout per card:
```
┌──────────────────────────────────────┐
│ Board 1                       +150 💰│
│ ──────────────────────────────────── │
│ 🃏 [3♥] [Q♠] [9♠] [7♦] [2♣]       │  ← actual mini Card components
│                                      │
│ You:  [A♠] [K♥] [J♦] [10♣]         │  ← mini Card components
│       FULL HOUSE                     │  ← gold if winner
│                                      │
│ Bot:  [8♣] [5♦] [3♠] [2♥]          │  ← mini Card components
│       TWO PAIR                       │  ← gray if loser
│ ──────────────────────────────────── │
│        ✅ YOU WIN                    │
└──────────────────────────────────────┘
```

Style:
- Container: `rgba(255,255,255,0.04)`, borderRadius 12, padding 12
- Winner boards: left border 3px gold `#FFD700`
- Loser boards: left border 3px `rgba(255,255,255,0.1)`
- Tie boards: left border 3px gray
- Mini cards: use actual Card component with height ~30px (tiny mode)
  - Card component needs a `size='tiny'` prop that renders just rank+suit, no corners
  - Or: render as simple colored text: "A♠" "K♥" etc with suit colors
- +/- amount: gold for positive, red for negative, right-aligned
- Hand names: fontSize 11, player hand gold if winner, opponent hand gray
- "YOU WIN" / "YOU LOSE" / "TIE": centered below, bold

**B. COMPLETE Section:**

If all boards won:
```
┌════════════════════════════════════════┐
║ 🏆 COMPLETE! +50% BONUS              ║
║ +375 bonus chips                      ║
╚════════════════════════════════════════╝
```
- Gold double border (borderWidth 2, borderColor gold)
- Gold background glow: `rgba(255,215,0,0.08)`
- fontSize 20 for title, fontSize 14 for bonus amount

**C. Best Hand Highlight:**

Below all board replay cards:
```
⭐ Best hand: Full House on Board 2
```
- Find the highest-ranked hand across all boards using handEvaluator
- Gold text, fontSize 13, italic

**D. Stats Row:**

```
Boards: 3/4 won  |  Net: +450  |  Games today: 7
```
- Horizontal row, fontSize 12, rgba white 0.5
- Use AsyncStorage `caps_games_played` for games count

**E. DEAL ME IN Button:**
- Already exists from last sprint — keep it
- Make sure it's at the bottom, always visible
- Below it: "← Back to Home" as small link

**F. Data Source:**
Read `results.tsx` — find where board results data is available.
The game store should have: each board's community cards, player cards, opponent cards, winner, pot.
If opponent cards aren't stored → store them during reveal phase in game.tsx.

═══════════════════════════════════════════════════════════
GAP 2 — SCREEN TRANSITIONS: Not just FadeIn
═══════════════════════════════════════════════════════════

Current: only `FadeIn` on some elements. Need distinct transitions per route.

### Implementation:

**A. In `app/_layout.tsx` — route-specific animations:**

```typescript
<Stack
  screenOptions={{
    headerShown: false,
    animation: 'fade',
    animationDuration: 250,
  }}
>
  <Stack.Screen name="index" options={{ animation: 'fade' }} />
  <Stack.Screen name="game" options={{ animation: 'slide_from_bottom' }} />
  <Stack.Screen name="results" options={{ animation: 'fade_from_bottom' }} />
  <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
</Stack>
```

**B. Game screen entry:**
- Game slides up from bottom (cards are coming to you)
- `animation: 'slide_from_bottom'`

**C. Game → Results transition:**
In `app/game.tsx`, when transitioning to results:
- Before `router.push('/results')`:
  - Boards shrink animation: all boards scale(1) → scale(0.8) + opacity → 0.5
  - Duration: 300ms
  - Then navigate

In `app/results.tsx`:
- Board replay cards enter with stagger:
  - Each card: `entering={FadeInDown.duration(300).delay(index * 150)}`
  - Board 1 fades in first, then 2, then 3, then 4
- Stats row: `entering={FadeIn.duration(300).delay(800)}`
- DEAL ME IN: `entering={FadeInUp.duration(400).delay(1000)}`

**D. Results → Home:**
- `animation: 'fade'` — simple, clean, reset

═══════════════════════════════════════════════════════════
GAP 3 — SOUND MAPPING: Fix Wrong Sounds + Add Missing
═══════════════════════════════════════════════════════════

### A. Fix wrong sound assignments:

| Moment | Currently plays | Should play | Fix |
|--------|----------------|-------------|-----|
| Ready button | `chipsWin` ❌ | Confident "lock in" beep | Use `cardSelect` (short, decisive) — or create `ready` sound |
| Timer at 0s | `lose` ❌ | Buzzer / time-up | Use `timerLow` at higher urgency — or create `buzzer` sound |

### B. Create missing sounds:

**Sound 5 — Reveal start (tension build):**
- Option A: Find a 1-second low drum roll / tension riser on freesound.org
  ```
  curl -s "https://freesound.org/apiv2/search/text/?query=tension+drum+roll+short&fields=id,name,previews&token=..." 
  ```
- Option B: Use the existing `timerLow` sound slowed down
- Option C: Create `assets/sounds/revealStart.wav` as a TODO placeholder
  ```
  // In sounds.ts: add 'revealStart' to sound map
  // TODO: Replace with proper tension sound
  ```
- Play it in `useRevealSequence.ts` at the START of the reveal sequence, before first board

**Sound 15 — Screen transition (subtle whoosh):**
- Option A: Find a short 200ms whoosh on freesound.org
- Option B: Skip this one — transitions are visual, sound is optional
- If skipping: add comment `// TODO: optional transition whoosh`

### C. Timer sound escalation:

Current: `timerLow` plays at 10s and 5s (same sound).

Fix:
```typescript
// In useGameTimer.ts or game.tsx:
if (timeLeft === 10) playSound('timerLow');                    // normal tick
if (timeLeft <= 5 && timeLeft > 0) {
  // Play tick every second, but louder/faster
  playSound('timerLow');  // same sound but it fires every second now
}
if (timeLeft === 3) {
  // Haptic medium
  Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
}
if (timeLeft === 0) {
  playSound('lose');  // OR a dedicated buzzer if we create one
  Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy);
}
```

Actually — check if timer already does per-second ticks at 5s. If not, add it.

### D. Full sound map after fixes:

Print final state:
```
═══════════════════
FINAL SOUND MAP
═══════════════════
1.  Deal:          cardPlace (on stagger)
2.  Card place:    cardPlace
3.  Card remove:   cardSelect
4.  Ready:         cardSelect (changed from chipsWin)
5.  Reveal start:  [new: revealStart / or timerLow / or TODO]
6.  Card flip:     cardFlip
7.  Board win:     chipsWin
8.  Board loss:    lose
9.  COMPLETE:      complete
10. Timer 10s:     timerLow
11. Timer 5s:      timerLow (per-second)
12. Timer 0s:      [buzzer or timerLow heavy]
13. Chip gain:     chipsWin
14. Chip loss:     lose
15. Transition:    [optional / TODO]
Coverage: [N]/15
═══════════════════
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
D1. npx tsc --noEmit — 0 errors
D2. npx jest --forceExit — 126+ tests pass
D3. npx expo export --platform web --output-dir web-dist
D4. node scripts/fix-web-html.js
D5. cd web-dist && vercel --prod --yes
D6. git add -A && git commit -m "feat: results redesign with replay cards + screen transitions + sound fixes"
D7. git push origin main
D8. Update MEMORY.md
```

## PROOF REQUIRED IN REPORT

```
═══════════════════════════════════════
FINAL 3 GAPS — VERIFIED
═══════════════════════════════════════

GAP 1 — Results:
  Board replay cards with BOTH hands: [YES + line numbers / NO]
  Mini Card components or text cards: [which approach + lines]
  Hand names per side: [YES + lines / NO]
  COMPLETE section with gold border: [YES + lines / NO]
  Best hand highlight: [YES + lines / NO]  
  Stats row: [YES + lines / NO]
  DEAL ME IN at bottom: [already existed — confirmed]

GAP 2 — Transitions:
  Game entry slide_from_bottom: [YES + line in _layout / NO]
  Results staggered FadeInDown: [YES + lines / NO]
  DEAL ME IN FadeInUp: [YES + lines / NO]

GAP 3 — Sound:
  Ready changed from chipsWin to: [what sound + line]
  Timer 0 changed from lose to: [what sound + line]
  Reveal start: [ADDED / TODO / SKIPPED]
  Timer 5s per-second tick: [YES / NO]
  Coverage: [N]/15

Tests: [N]/[N]
TS: [N] errors
═══════════════════════════════════════
```

## DO NOT
- Do NOT skip the board replay cards — this is the MAIN deliverable
- Do NOT say "pre-existing" without line numbers
- Do NOT use chipsWin for Ready button
- Do NOT break existing animations or features

VAMOS CAPS FINAL-3-GAPS — END
