VAMOS CAPS REVEAL-TIMING-HOME 2026-03-18-2100

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Fix reveal timing + layout
Agent: reveal-timing-fixer

A1. Read components/RevealSequence.tsx and hooks/useRevealSequence.ts in full

A2. Fix timing:
    - Countdown 3→2→1 ONLY before TURN (not before river)
    - After turn flip: show probabilities for 2.5 seconds, then auto-flip river (no countdown)
    - After river flip: show updated probabilities for 3 seconds, then show winner
    - Total feel: TURN has drama (3-2-1), RIVER is smooth and quick

A3. Fix reveal layout — full screen per board:
    TOP SECTION (40% of screen):
      - Bot cards row: face-down cards during game, revealed after river
      - Label "BOT" above bot cards
      - Win probability % next to bot label: "BOT 33%"
    
    MIDDLE SECTION (20% of screen):
      - Community cards (FLOP visible, TURN/RIVER flip)
      - Small label: FLOP / TURN / RIVER above community cards
    
    BOTTOM SECTION (40% of screen):  
      - Player cards row
      - Label "YOU" above player cards
      - Win probability % next to you label: "YOU 67% ↑+14%"
      - Delta indicator: green ↑ when probability increases, red ↓ when decreases

A4. Win probability display:
    - Show next to each player's name throughout reveal
    - After FLOP (all 3 open): calculate and show first probability
    - After TURN: update probability + show delta
    - After RIVER: snap to 100% / 0% / 50%
    - Animation: smooth number count-up (not instant jump)

A5. "Optimal card" gimmick — show what card would have won:
    After river is revealed, show a small badge:
    "🎯 Best card: A♠ would have given you a Flush"
    Position: below the community cards, small text, gold color
    Calculate: what card from remaining deck would have given the best hand

A6. Fix between-board transition time:
    Current: too long (10 seconds auto-advance)
    New: 4 seconds auto-advance after winner shown
    But keep TAP TO CONTINUE for immediate skip

---

## TASK B — Fix card sizes responsive
Agent: card-sizer

B1. Read app/game.tsx, components/Board.tsx, components/PlayerHand.tsx

B2. The boards take too much vertical space — each board is too tall.
    Fix board card height on native:
    ```typescript
    // In game.tsx
    const BOARD_CARD_H = Platform.OS === 'web'
      ? 82
      : Math.max(48, Math.min(68, Math.floor(boardSpace / 2)));
    ```

B3. Player hand cards — make them fit perfectly in 2 rows of 8:
    ```typescript
    const cardW = Platform.OS === 'web'
      ? Math.min(72, Math.max(56, maxCardW))
      : Math.min(40, Math.max(32, maxCardW));
    ```

B4. Bot row in each board — make it more compact:
    Small face-down cards: height = BOARD_CARD_H * 0.7

---

## TASK C — Home screen redesign
Agent: home-redesigner

C1. Read app/index.tsx in full

C2. New layout (top to bottom):
    ```
    [spacer - 8% of screen]
    [CAPS POKER — large, centered, gold, bold]
    [tagline — small, centered, muted]
    [spacer - 4%]
    [stats box — compact]
    [spacer - 4%]
    [NEW HAND (vs Bot) — PRIMARY, full width, floating, gold]
    [Sign in with Google — white, full width]
    [spacer - 2%]
    [TOURNAMENT — secondary, full width]
    [PLAY ONLINE — secondary, full width]  
    [HOST GAME / JOIN GAME — side by side, 50/50]
    [spacer - 2%]
    [LEADERBOARD | HAND HISTORY | SETTINGS — small text links in a row]
    [spacer to bottom]
    ```

C3. "CAPS POKER" title:
    - Position: centered horizontally AND vertically in upper 40% of screen
    - fontSize: 56, fontWeight: '900', letterSpacing: 8
    - Color: theme accent (gold by default)
    - Subtitle below: tagline in 13px muted color

C4. Floating button effect (professional):
    Primary (NEW HAND):
    - backgroundColor: theme.accent
    - borderRadius: 18
    - paddingVertical: 16
    - shadowColor: theme.accent
    - shadowOffset: { width: 0, height: 10 }
    - shadowOpacity: 0.5
    - shadowRadius: 20
    - elevation: 16
    - Web: boxShadow: `0 10px 40px ${theme.accent}60`
    - Inner highlight: top 40% has rgba(255,255,255,0.15) overlay

    Secondary buttons:
    - backgroundColor: 'rgba(255,255,255,0.05)'
    - borderWidth: 1
    - borderColor: theme.accent + '60'  (60% opacity)
    - borderRadius: 14
    - shadowColor: '#000'
    - shadowOffset: { width: 0, height: 4 }
    - shadowOpacity: 0.25
    - shadowRadius: 10
    - elevation: 6

    Small links (LEADERBOARD etc.):
    - No background, no border
    - color: theme.accent + '80' (muted)
    - fontSize: 12, letterSpacing: 1.5

C5. Press animation on ALL buttons:
    onPressIn → scale(0.96), opacity(0.9)
    onPressOut → scale(1.0), opacity(1.0)
    Duration: 100ms

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: reveal drama timing, optimal card hint, home screen redesign"
7. git push origin main
8. Update MEMORY.md
9. Report done

VAMOS CAPS REVEAL-TIMING-HOME — END
