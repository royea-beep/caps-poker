VAMOS CAPS CARD-CENTER

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## THE PROBLEM
Cards show rank+suit in top-left AND bottom-right (rotated).
This looks bad — two A's, one upside down.

## THE FIX
Remove bottom-right corner completely.
Show ONE large rank + suit centered in the middle of the card.
Like a real playing card.

## TASK — Fix Card.tsx

A1. Read components/Card.tsx in full

A2. New card layout:
    - TOP-LEFT corner: small rank + suit (fontSize height*0.14, height*0.11)
    - CENTER of card: ONE large rank (fontSize height*0.42) + suit below it (fontSize height*0.32)
    - NO bottom-right corner at all — remove it completely

A3. Keep everything else the same:
    - White background #FFFFFF
    - Red suits #E8192C, black suits #000000
    - borderRadius 8, shadow, gold highlight

A4. npx tsc --noEmit — 0 errors
A5. npx jest --silent — all pass
A6. npx expo export --platform web
A7. node scripts/fix-web-html.js
A8. py -3.11 scripts/ftp_deploy.py
A9. git add -A && git commit -m "fix: card layout — center rank+suit, remove upside-down corner"
A10. git push origin main
A11. Report done

VAMOS CAPS CARD-CENTER — END
