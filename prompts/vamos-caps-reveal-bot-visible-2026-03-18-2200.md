VAMOS CAPS REVEAL-BOT-VISIBLE 2026-03-18-2200

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## CHANGES REQUESTED (from user audio + screenshot)

1. Bot cards ALWAYS face-up from the start of reveal — never face-down
2. Win probability shows from the start next to each player
3. "Optimal next card" shows as a small card badge next to player cards — NOT text

---

## TASK A — Bot cards always visible
Agent: reveal-fixer

A1. Read components/RevealSequence.tsx in full

A2. Remove face-down state from bot cards in reveal:
    - Bot cards: always faceDown={false} from the first frame
    - No flip animation needed for bot cards
    - They appear face-up immediately when board is shown

A3. Win probability: show from the very start (not only after turn/river)
    - On board mount: calculate initial probability based on open cards (flop)
    - Show immediately: "BOT 36%" and "YOU 64%" before any countdown

---

## TASK B — Optimal card as badge, not text
Agent: badge-designer

B1. The "optimal card" hint should be a small card-shaped badge:
    ```
    ┌──┐
    │A │  ← small card badge
    │♠ │
    └──┘
    ```
    Not text like "🎯 Best card: A♠ would give you Flush"

B2. Badge design:
    - Width: 28px, Height: 40px
    - White background, borderRadius 4, thin border
    - Rank text: fontSize 12, fontWeight '900'
    - Suit text: fontSize 10
    - Red/black based on suit
    - Small gold "?" or "★" label above the badge: "BEST NEXT"
    - Position: to the right of player's card row

B3. Show badge for BOTH players:
    - Next to bot cards: what card would help bot most
    - Next to player cards: what card would help player most
    - Only show after flop is revealed (have enough info)
    - Update after turn reveal

B4. Badge calculation (simple):
    - Check if any card can complete a flush (4 of same suit already)
    - Check if any card can complete a straight
    - Check if any card makes a better pair/set
    - Show the best single card from remaining deck

B5. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: bot cards always visible, optimal card badge"
7. git push origin main
8. Report done

VAMOS CAPS REVEAL-BOT-VISIBLE — END
