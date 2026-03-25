VAMOS CAPS HAND-CARDS-FIX

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
Hand cards (YOUR HAND section) are too small on web.
Board cards look great but hand cards are tiny in comparison.
Also need version bump and deploy to all platforms.

## TASK A — Fix hand card sizes on web

A1. Read components/PlayerHand.tsx in full

A2. On web, hand cards need to be bigger:
    Use Platform.OS === 'web' to set larger sizes:
    ```
    const cardW = Platform.OS === 'web'
      ? Math.min(80, Math.max(64, maxCardW))
      : Math.min(58, Math.max(46, maxCardW));
    ```

A3. Also fix the hand container on web — it should show 2 rows of 8 cards, centered:
    On web: use flexWrap: 'wrap', justifyContent: 'center'
    Each card should be clearly visible

A4. Read app/game.tsx — check BOARD_CARD_H on web
    Increase to 110 on web so board cards are also bigger

A5. npx tsc --noEmit — 0 errors

---

## TASK B — Version bump + deploy everywhere

B1. Open app.json — bump version from current to next patch (e.g. 1.9.1 → 1.9.2)

B2. npx tsc --noEmit — 0 errors
B3. npx jest --silent — all pass

B4. Web deploy (CORRECT METHOD — Vercel not FTP):
    npx expo export --platform web
    node scripts/fix-web-html.js
    cd dist && vercel --prod --yes

B5. iOS TestFlight:
    git add -A && git commit -m "fix: bigger hand cards on web, version bump"
    git push origin main
    (CI will auto-build and submit to TestFlight)

B6. Update MEMORY.md

B7. Report done with version number and live URL confirmation

VAMOS CAPS HAND-CARDS-FIX — END
