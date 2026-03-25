VAMOS CAPS CARD-REDESIGN

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## REFERENCE
Target look: 5-0 Poker app (see attached description)
- Cards are LARGE and fill the board space
- Each card has a BIG rank number/letter in center (not just corners)
- Suit symbol is large and centered below the rank
- Red suits (hearts/diamonds) are bright vivid red #e63946
- Black suits (spades/clubs) are deep navy #1a1a2e  
- Card face is clean warm white #f5f0e8
- Cards have clear shadow and border-radius

## TASK A — Redesign Card component
Agent: card-designer

A1. Read components/Card.tsx in full

A2. Redesign the card face layout:
    - Keep corner rank+suit (top-left, bottom-right rotated)
    - ADD a large center display: big rank text + big suit symbol below it
    - Center rank font size: Math.floor(height * 0.35) — very large
    - Center suit font size: Math.floor(height * 0.30)
    - Make corners smaller since center carries the information

A3. Default sizes (NOT small):
    width = cardWidth ?? 82
    height = cardHeight ?? 116

    Small sizes:
    width = cardWidth ?? 60
    height = cardHeight ?? 86

A4. Card shadow — make it dramatic:
    iOS: shadowColor #000, shadowOffset {0,4}, shadowOpacity 0.5, shadowRadius 8
    Web: boxShadow '0 4px 16px rgba(0,0,0,0.5)'

A5. Highlighted card: bright gold glow border
    borderColor: #c9a84c, borderWidth: 2.5
    Web: boxShadow '0 0 16px rgba(201,168,76,0.8)'

A6. npx tsc --noEmit — 0 errors

---

## TASK B — Make cards fill the boards
Agent: board-sizer

B1. Read components/Board.tsx, app/game.tsx, components/PlayerHand.tsx

B2. Set these exact sizes:

    Board.tsx — ch default:
    const ch = cardHeightProp ?? 80;

    game.tsx — BOARD_CARD_H:
    const BOARD_CARD_H = Platform.OS === 'web'
      ? 100
      : Math.max(60, Math.min(100, Math.floor(boardSpace / 2)));

    PlayerHand.tsx:
    const cardW = Math.min(72, Math.max(54, maxCardW));

    RevealSequence.tsx:
    commCardW: web=82, native=58
    commCardH: web=116, native=82
    handCardW: web=68, native=50
    handCardH: web=96, native=70

B3. In Board.tsx — make the board use ALL available space:
    - communityRow: justifyContent center, gap 6
    - playerRow: justifyContent center, gap 6
    - Remove any maxWidth constraints on card rows

B4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. py -3.11 scripts/ftp_deploy.py
6. git add -A && git commit -m "redesign: big centered cards like 5-0 poker"
7. git push origin main
8. Update MEMORY.md
9. Report done with screenshot description

VAMOS CAPS CARD-REDESIGN — END
