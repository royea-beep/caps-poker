VAMOS CAPS BIG-CARDS

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## THE ONLY TASK: MAKE CARDS BIG

The user has asked for bigger cards many times. Cards must be clearly readable like a real poker app.

A1. Read components/Card.tsx lines 30-45 — find current default width/height values
A2. Read components/Board.tsx — find current ch value  
A3. Read app/game.tsx — find BOARD_CARD_H
A4. Read components/PlayerHand.tsx — find cardW

A5. Set these exact values — no calculation, just set them:

    components/Card.tsx:
      small=false: width=82, height=116
      small=true:  width=62, height=88

    components/Board.tsx:
      ch default = 76

    app/game.tsx:
      web:    BOARD_CARD_H = 100
      native: Math.max(56, Math.min(100, Math.floor(boardSpace / 2)))

    components/PlayerHand.tsx:
      cardW max=70, min=52

    components/RevealSequence.tsx:
      commCardW web=80, native=54
      commCardH web=114, native=76
      handCardW web=66, native=46
      handCardH web=94, native=66

A6. npx tsc --noEmit — 0 errors
A7. npx jest --silent — all pass
A8. npx expo export --platform web
A9. node scripts/fix-web-html.js
A10. py -3.11 scripts/ftp_deploy.py
A11. git add -A && git commit -m "fix: BIG cards — final"
A12. git push origin main
A13. Report done.

VAMOS CAPS BIG-CARDS — END
