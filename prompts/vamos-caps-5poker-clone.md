VAMOS CAPS 5POKER-CLONE

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## COPY THIS EXACTLY — 5-0 Poker style

---

## TASK A — Card component (Card.tsx)
Agent: card-agent

A1. Read components/Card.tsx and constants/cardThemes.ts in full

A2. Redesign card face to match 5-0 Poker EXACTLY:

    Card face:
    - background: #FFFFFF (pure white)
    - borderRadius: 8
    - borderWidth: 1
    - borderColor: rgba(0,0,0,0.15)
    - box-shadow web: '2px 3px 10px rgba(0,0,0,0.45)'
    - iOS shadow: shadowColor #000, offset {2,3}, opacity 0.4, radius 6

    Card content layout:
    - NO center suit symbol
    - Rank in top-left: very large, bold, font-family 'Arial Black' or fontWeight '900'
    - Suit below rank in top-left: large
    - Bottom-right: same rank+suit rotated 180deg
    - Rank font size: Math.floor(height * 0.40) — very large
    - Suit font size: Math.floor(height * 0.28)

    Colors:
    - Hearts ♥ and Diamonds ♦: #E8192C (bright red)
    - Spades ♠ and Clubs ♣: #000000 (pure black)

    Default sizes:
    - normal: width=58, height=82
    - small: width=52, height=74

    Face-down card:
    - background: linear gradient #0f1a3e to #0a0a1e
    - border: 1.5px solid #c9a84c
    - center: faint gold diamond ♦ at 30% opacity

A3. npx tsc --noEmit — 0 errors

---

## TASK B — Board background color (Board.tsx)
Agent: board-agent

B1. Read components/Board.tsx in full

B2. Change board background from green felt to deep red:
    - container background: '#6B0000'
    - border: 1px solid '#8B0000'
    - active/selected board border: '#c9a84c' gold

B3. Update constants/theme.ts:
    - felt: '#6B0000'
    - feltLight: '#8B0000'
    - feltBorder: '#a00000'
    - boardBg: '#6B0000'
    - boardBorder: '#8B0000'

B4. npx tsc --noEmit — 0 errors

---

## TASK C — Card sizes everywhere
Agent: size-agent

C1. Read app/game.tsx, components/PlayerHand.tsx, components/RevealSequence.tsx

C2. Set sizes:

    game.tsx BOARD_CARD_H:
      web: 82
      native: Math.max(56, Math.min(82, Math.floor(boardSpace / 2)))

    PlayerHand.tsx:
      cardW max=58, min=46

    RevealSequence.tsx:
      commCardW: web=58, native=52
      commCardH: web=82, native=74
      handCardW: web=52, native=46
      handCardH: web=74, native=66

C3. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. py -3.11 scripts/ftp_deploy.py
6. git add -A && git commit -m "redesign: 5-0 poker style — white cards, red boards, big ranks"
7. git push origin main
8. Update MEMORY.md
9. Report done

VAMOS CAPS 5POKER-CLONE — END
