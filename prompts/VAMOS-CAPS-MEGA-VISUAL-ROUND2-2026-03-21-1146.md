# VAMOS CAPS MEGA-VISUAL-ROUND2
**Date:** 2026-03-21 11:46 IST
**Priority:** 🔴 Complete the 6 items that were SKIPPED or HALF-DONE

## ROLE
You are fixing items marked "pre-existing" that were NOT actually done.
Do NOT mark anything as "pre-existing" this time. BUILD IT or VERIFY IT.
For each item: if it truly exists — print the EXACT code lines proving it.
If it doesn't exist — BUILD IT NOW.

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\components\ChipsDisplay.tsx
Read C:\Projects\Caps\components\CompleteOverlay.tsx
Read C:\Projects\Caps\hooks\useRevealSequence.ts
Read C:\Projects\Caps\utils\sounds.ts
ls C:\Projects\Caps\assets\sounds\
```

═══════════════════════════════════════════════════════════
FIX 1 — CARD FLIP: Verify or Build (claimed "pre-existing")
═══════════════════════════════════════════════════════════

**AUDIT FIRST:**
```
grep -n "rotateY\|flip\|backface\|perspective\|cardBack\|FLIP" C:\Projects\Caps\components\Card.tsx
grep -n "rotateY\|flip" C:\Projects\Caps\hooks\useRevealSequence.ts
grep -n "flip\|rotateY" C:\Projects\Caps\app\game.tsx
```

Report:
- Does Card.tsx have a card BACK design? YES (print lines) / NO
- Does Card.tsx have rotateY animation? YES (print lines) / NO
- Does useRevealSequence trigger a flip? YES (print lines) / NO

**IF ANY IS NO → BUILD IT:**

Card.tsx needs:
- Card back: dark navy `#1a1a3e`, diamond lattice pattern (can be simple repeating View elements), centered CAPS text (gold, opacity 0.3), gold border
- Flip: `useSharedValue` for flipProgress (0→1)
- Front and back rendered as overlapping Animated.Views
- `rotateY` with `perspective: 800`
- Front visible when flipProgress > 0.5, back when ≤ 0.5
- Duration: 400ms, Easing.out(cubic)

useRevealSequence needs:
- For turn card: trigger `flipCard()` on the card
- Wait 300ms
- For river card: trigger `flipCard()`
- Wait 200ms
- Then show hand name + result

**Card flip sound** must play at the START of each flip.

═══════════════════════════════════════════════════════════
FIX 2 — FLOATING CHIPS: Verify or Build (claimed "pre-existing")
═══════════════════════════════════════════════════════════

**AUDIT FIRST:**
```
grep -n "FloatingChip\|floating.*chip\|float.*chip\|\+.*chip\|chip.*anim" C:\Projects\Caps\components\Board.tsx
grep -n "FloatingChip\|floating.*chip" C:\Projects\Caps\app\game.tsx C:\Projects\Caps\app\results.tsx
```

What we need:
- When a board resolves → "+150" text floats UP from the board (gold, fadeOut)
- "-150" for losses (red, fadeOut)
- translateY: 0 → -40px, opacity: 1 → 0, duration 1200ms
- On COMPLETE: all boards show chips + one BIG "+BONUS" from center

Report: Does this exist? Print the exact animation code.

**IF NOT → BUILD `components/FloatingChips.tsx`:**

```typescript
interface FloatingChipsProps {
  amount: number;      // positive = win, negative = loss
  visible: boolean;
  onDone?: () => void;
}
```

- Positive: gold `#FFD700` text "+{amount}", translateY up, fadeOut
- Negative: red `#ff4444` text "-{amount}", translateY up, fadeOut
- Position: absolute, centered on the board
- Add to Board.tsx: show FloatingChips after reveal with the pot amount

═══════════════════════════════════════════════════════════
FIX 3 — DEAL ANIMATION: Rebuild (was weak — only "slide-up 12px")
═══════════════════════════════════════════════════════════

The current "deal" is just a generic mount animation. We need a REAL card deal.

**Delete or replace the existing mount animation in PlayerHand.tsx.**

**Build proper deal sequence in `app/game.tsx`:**

### Phase: DEALING (before ARRANGING)

Add a `dealing` state to the game flow:
```
DEALING (1.5s) → ARRANGING (timer) → REVEAL → RESULTS
```

During DEALING:
- All cards start at position: top-center of screen (like a deck)
- Cards slide one by one into the PlayerHand area:
  - translateY: -300 → 0 (from above screen to hand position)
  - translateX: 0 → final X position in hand
  - rotation: slight random rotation → 0
  - Stagger: 60ms between cards
  - 16 cards × 60ms = ~1 second total
  - Sound: `cardPlace` sound on each card landing
- Community cards (flop) slide from deck to board positions simultaneously
  - Stagger: 100ms per card per board

After DEALING completes → auto-transition to ARRANGING phase.

**During DEALING:**
- Timer does NOT run yet
- Buttons are disabled
- "Dealing..." text shown briefly

═══════════════════════════════════════════════════════════
FIX 4 — SCREEN TRANSITIONS: Upgrade (was just animation:'fade')
═══════════════════════════════════════════════════════════

**AUDIT:**
```
grep -n "animation\|entering\|exiting\|Fade\|Slide\|transition" C:\Projects\Caps\app\_layout.tsx
```

The basic `animation:'fade'` is a start but not enough.

**Upgrade:**

Home → Game:
- Home elements: FadeOut.duration(200)
- Game screen: FadeIn.duration(200).delay(100)

Game → Results:
- Game boards: use `exiting={SlideOutUp.duration(300)}` — boards slide UP and shrink
- Results content: `entering={FadeIn.duration(300).delay(200)}`

Results → Home:
- Results: FadeOut.duration(200)
- Home: FadeIn.duration(200).delay(100)

Apply using `react-native-reanimated` layout animations on the screen-level wrapper Views:
```typescript
import Animated, { FadeIn, FadeOut, SlideOutUp } from 'react-native-reanimated';

// Wrap the main content of each screen:
<Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
  {/* screen content */}
</Animated.View>
```

═══════════════════════════════════════════════════════════
FIX 5 — RESULTS SCREEN REDESIGN (was NOT done — only added HandNameOverlay)
═══════════════════════════════════════════════════════════

This is the biggest miss. The results screen needs a FULL redesign.

**Read current results:**
```
cat C:\Projects\Caps\app\results.tsx
```

**Redesign with Board Replay Cards:**

For each board, create a mini recap card:
```
┌──────────────────────────────────────┐
│ 🟢 Board 1                    +150  │
│ ──────────────────────────────────── │
│ Community: [3♥][Q♠][9♠][7♦][2♣]    │
│ You:  [A♠][K♥][J♦][10♣]            │
│ Opp:  [8♣][5♦][3♠][2♥]             │
│ ──────────────────────────────────── │
│ You: FULL HOUSE   Opp: TWO PAIR     │
│          ✅ YOU WIN                  │
└──────────────────────────────────────┘
```

- Use ACTUAL mini Card components (tiny, ~20px wide) not just text
- Winner boards: left border gold `#FFD700`
- Loser boards: left border dim `rgba(255,255,255,0.1)`
- Tied boards: left border gray
- Each card animates in with stagger (mini deal effect)
- Hand names shown below each side

**COMPLETE Section:**
If player got COMPLETE:
- Gold frame around the entire results area
- "🏆 COMPLETE! +50% BONUS" header, gold, large
- Bonus amount highlighted separately

**Best Hand Highlight:**
- Below all board cards: "Best hand: Full House on Board 2"
- Gold text, subtle glow

**Stats Row:**
- Boards won: X/4
- Net chips: +/- amount (gold/red)
- Games played today: N

**PLAY AGAIN Button:**
- HUGE: height 64px, borderRadius 16
- Same premium style as home screen primary button
- Gold glow pulse animation on idle
- Text: "DEAL ME IN" (fontSize 20, fontWeight 700, letterSpacing 2)
- Positioned at the bottom, always visible
- Below it: smaller "Back to Home" link

═══════════════════════════════════════════════════════════
FIX 6 — SOUND PASS: Verify ALL 15 moments (claimed "pre-existing")
═══════════════════════════════════════════════════════════

**FULL AUDIT — check each sound point:**

```
# List all sound files
ls -la C:\Projects\Caps\assets\sounds\

# Check what playSound calls exist
grep -rn "playSound\|sounds\." C:\Projects\Caps\app\game.tsx C:\Projects\Caps\app\results.tsx C:\Projects\Caps\components\*.tsx C:\Projects\Caps\hooks\*.ts | grep -v node_modules | grep -v __tests__
```

For EACH of these 15 moments, report: [HAS SOUND / MISSING]

```
1.  Game start / card deal      → playSound('deal') or similar?
2.  Card placed on board        → playSound('cardPlace')?
3.  Card removed from board     → playSound('cardRemove') or similar?
4.  Ready button pressed        → playSound('ready') or similar?
5.  Reveal sequence starts      → playSound('revealStart') or tension sound?
6.  Card flip (each card)       → playSound('cardFlip')?
7.  Board won                   → playSound('chipsWin') or similar?
8.  Board lost                  → playSound('lose')?
9.  COMPLETE triggered          → playSound('complete')?
10. Timer at 10s                → playSound('timerLow') or tick?
11. Timer at 5s                 → faster tick or louder?
12. Timer at 0s (time up)       → buzzer sound?
13. Chip gain animation         → coin/cash sound?
14. Chip loss animation         → whoosh/loss sound?
15. Screen transition           → subtle whoosh?
```

**For EACH missing sound:**
- If sound file exists but not called → add the playSound() call at the right moment
- If sound file doesn't exist:
  - Check freesound.org or use existing sounds creatively
  - At minimum: create a TODO comment with exact description of needed sound
  - Use the closest existing sound as placeholder

**Sounds that MUST be unique (not shared with other moments):**
- COMPLETE fanfare — must be its own sound, 2-3 seconds
- Timer tick — must escalate (slow at 10s, fast at 5s)
- Board win vs board loss — must be clearly different emotions

═══════════════════════════════════════════════════════════
QUALITY GATE
═══════════════════════════════════════════════════════════

After ALL 6 fixes, answer these honestly:

```
[ ] Card flip: Can you SEE a card physically rotate from back to front? (not just appear)
[ ] Floating chips: Do numbers visually fly up after each board?
[ ] Deal: Do cards slide from a deck into the hand one by one?
[ ] Transitions: Is there visible animation between screens?
[ ] Results: Are there mini replay cards showing both hands per board?
[ ] Sound: Are at least 12 of 15 moments covered?
```

If ANY is NO → FIX IT before deploying.

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
D1. npx tsc --noEmit — 0 errors
D2. npx jest --forceExit — 126+ tests pass
D3. npx expo export --platform web --output-dir web-dist
D4. node scripts/fix-web-html.js
D5. cd web-dist && vercel --prod --yes
D6. git add -A && git commit -m "feat: MEGA visual round 2 — card flip, deal anim, floating chips, results redesign, transitions, sound pass"
D7. git push origin main
D8. Update MEMORY.md

Report with PROOF (code lines, not just "done"):
═══════════════════════════════════════════════════════════
MEGA VISUAL ROUND 2 — VERIFIED REPORT
═══════════════════════════════════════════════════════════
Fix 1 Card Flip:
  Card back design: [line numbers in Card.tsx]
  rotateY animation: [line numbers]
  Triggered in reveal: [line numbers in useRevealSequence]
  Sound on flip: [YES line / NO]

Fix 2 Floating Chips:
  Component: [file + line numbers]
  Triggered after board resolve: [line numbers]
  Gold for win, red for loss: [YES/NO]

Fix 3 Deal Animation:
  DEALING phase exists: [line numbers in game.tsx]
  Cards animate from deck to hand: [line numbers]
  Stagger between cards: [YES + ms value]
  Sound per card: [YES/NO]

Fix 4 Transitions:
  Home→Game animation: [line numbers]
  Game→Results animation: [line numbers]
  Results→Home animation: [line numbers]

Fix 5 Results Redesign:
  Board replay cards with both hands: [line numbers in results.tsx]
  Hand names per side: [YES/NO]
  COMPLETE section: [YES/NO]
  Best hand highlight: [YES/NO]
  PLAY AGAIN button size + glow: [line numbers]

Fix 6 Sound:
  1.  Deal:          [HAS / MISSING]
  2.  Card place:    [HAS / MISSING]
  3.  Card remove:   [HAS / MISSING]
  4.  Ready:         [HAS / MISSING]
  5.  Reveal start:  [HAS / MISSING]
  6.  Card flip:     [HAS / MISSING]
  7.  Board win:     [HAS / MISSING]
  8.  Board loss:    [HAS / MISSING]
  9.  COMPLETE:      [HAS / MISSING]
  10. Timer 10s:     [HAS / MISSING]
  11. Timer 5s:      [HAS / MISSING]
  12. Timer 0s:      [HAS / MISSING]
  13. Chip gain:     [HAS / MISSING]
  14. Chip loss:     [HAS / MISSING]
  15. Transition:    [HAS / MISSING]
  Coverage: [N]/15

Quality gate:
  [ ] Card flip VISIBLE?
  [ ] Chips FLY UP?
  [ ] Deal FROM DECK?
  [ ] Transitions ANIMATED?
  [ ] Results REPLAY CARDS?
  [ ] Sound 12+ moments?
═══════════════════════════════════════════════════════════
```

## DO NOT
- Do NOT mark anything "pre-existing" without printing the exact code lines
- Do NOT skip any fix
- Do NOT use generic "slide-up 12px" as a deal animation
- Do NOT just add HandNameOverlay and call Results "redesigned"
- Do NOT break existing features or tests

VAMOS CAPS MEGA-VISUAL-ROUND2 — END
