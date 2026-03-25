VAMOS CAPS MEGA-REDESIGN v1.9.3-b99 2026-03-19-2330

## Current state: v1.9.3 build #99 | commit ed95e5e
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## Reference: Five-O Poker screenshots analyzed:
- 4-color suits (blue ♣, green ♠, red ♥, black ♦... or blue/green for clubs/spades)
- WIN banner (green) on each won board after reveal
- Vertical card stacks in boards (5 cards stacked, not side by side)
- Landscape/Widescreen layout option
- Portrait layout (current)
- Player avatar area with chips counter
- REMATCH button after game ends

---

## TASK A — 4-color suits (agent: suits-agent)

A1. Read components/Card.tsx in full

A2. Add 4-color suit system:
    ```typescript
    // In Card.tsx — replace binary red/black with 4-color
    const SUIT_COLORS: Record<string, string> = {
      hearts:   '#E8192C',  // red (same as now)
      diamonds: '#E8192C',  // red (same as now)  
      spades:   '#000000',  // black (same as now)
      clubs:    '#000000',  // black (same as now)
    };
    
    // 4-color variant:
    const SUIT_COLORS_4: Record<string, string> = {
      hearts:   '#E8192C',  // red
      diamonds: '#1E90FF',  // blue
      spades:   '#000000',  // black
      clubs:    '#228B22',  // green
    };
    ```

A3. Add `fourColorSuits` to gameStore (persisted, default false):
    - Add to GameStore interface: `fourColorSuits: boolean`
    - Add setter: `setFourColorSuits: (v: boolean) => void`
    - Add to partialize list

A4. In Card.tsx — use fourColorSuits from store to pick color map

A5. Add toggle in Settings screen under "BACKGROUND THEME":
    ```
    🎨 SUIT COLORS
    [2-color] [4-color]
    ```

A6. npx tsc --noEmit — 0 errors

---

## TASK B — WIN banner on boards (agent: win-agent)

B1. Read components/Board.tsx in full
B2. Read components/RevealSequence.tsx — find how winner is determined per board

B3. Add WIN banner overlay to Board component:
    - New prop: `winStatus?: 'player' | 'bot' | 'tie' | null`
    - When `winStatus === 'player'`: show green "WIN" banner at bottom of board
    - When `winStatus === 'bot'`: show red "LOSE" banner
    - When `winStatus === 'tie'`: show gray "TIE" banner
    - Banner: absolute positioned, bottom of board, full width, rounded corners
    - Animate in with scale+fade after reveal

B4. Pass winStatus to Board in RevealSequence:
    - After each board is revealed, show the banner
    - Use board.winner field ('player' | 'bot' | 'tie')

B5. npx tsc --noEmit — 0 errors

---

## TASK C — Portrait/Widescreen mode (agent: layout-agent)

C1. Read app/game.tsx — understand current layout
C2. Read constants/deviceBreakpoints.ts

C3. Widescreen = landscape orientation for web + iOS
    Current: Iron Rule 2 = iOS portrait only
    Solution: portrait on iOS native, landscape available on WEB only

C4. For web widescreen layout (W >= 600px in landscape):
    - Left panel: player hand (vertical, scrollable)
    - Right panel: all boards in 2x2 or 2x3 grid
    - Center: community cards + timer

C5. Add widescreen layout to game.tsx:
    ```typescript
    const isWidescreen = Platform.OS === 'web' && DEVICE.W >= 600 && DEVICE.H < DEVICE.W;
    
    if (isWidescreen) {
      // Widescreen layout:
      // [LEFT: hand cards vertical] | [RIGHT: boards grid]
    } else {
      // Current portrait layout
    }
    ```

C6. Add widescreen layout to results/reveal screen too

C7. npx tsc --noEmit — 0 errors

---

## TASK D — Fix HIGH HAND bug (agent: eval-agent)

D1. Read utils/gameLogic.ts — find evaluateAllBoards + evaluateOmahaHand
D2. Read utils/pokerEvaluator.ts or similar — find hand evaluation

D3. The bug: every hand shows as "High Card" — hand evaluator not working correctly
    Diagnose:
    - What does evaluateOmahaHand return for a known pair?
    - Is it using exactly 2 hole cards + 3 community cards (Omaha rule)?
    - Is the hand name lookup correct?

D4. Test:
    ```
    npx jest --testPathPattern gameLogic --verbose 2>&1 | tail -30
    ```

D5. Fix the hand evaluation if broken

D6. npx tsc --noEmit + npx jest --silent — all pass

---

## TASK E — REMATCH button (agent: ux-agent)

E1. Read app/results.tsx — find the "NEW HAND" button area
E2. Add REMATCH button next to HOME:
    - REMATCH: starts a new game with same config immediately
    - Smaller secondary button, gold outline style
    - Text: "REMATCH" with replay icon
    - On press: router.replace('/game') with same config

E3. npx tsc --noEmit — 0 errors

---

## TASK F — Card back pattern (agent: design-agent)

F1. Read components/Card.tsx — find the back card render (faceDown)
F2. Replace flat navy + single diamond with rich diamond lattice pattern:
    Use SVG/inline style to create:
    - Dark navy base (#0f1a3e)
    - Gold border (already exists)
    - Diagonal diamond grid pattern using CSS/inline SVG
    - Pattern: small gold diamonds (~8px) in a grid, 15% opacity

F3. On web: use SVG pattern as background
    On native: use a View with multiple small rotated Views (simple approach)

F4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: 4-color suits, WIN banners, widescreen web, HIGH HAND fix, REMATCH, card back pattern [v1.9.3-b100]"
7. git push origin main
8. Update MEMORY.md
9. Report: what was done, what changed visually

VAMOS CAPS MEGA-REDESIGN — END
