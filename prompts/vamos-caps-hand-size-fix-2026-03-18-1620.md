VAMOS CAPS HAND-SIZE-FIX 2026-03-18-1620

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
Hand cards (YOUR HAND section) are too big on iPhone.
Cards are getting cut off by the camera notch/Dynamic Island area.
Need to fit ALL 16 cards comfortably in the hand area without overflow.

## TASK — Fix hand card sizes on native iOS

A1. Read components/PlayerHand.tsx in full
A2. Read app/game.tsx — find PLAYER_HAND_H constant

A3. On native iOS, cards must:
    - Fit 8 cards per row in 2 rows = 16 total
    - NOT overflow into camera/notch area
    - Each card minimum readable size (rank visible)
    - Account for safe area insets at bottom

A4. Fix card sizing:
    ```typescript
    // Native: smaller cards to fit 8 per row
    const cardW = Platform.OS === 'web'
      ? Math.min(72, Math.max(56, maxCardW))
      : Math.min(46, Math.max(36, maxCardW));  // smaller on native
    ```

A5. Also check: is useSafeAreaInsets used in PlayerHand or game.tsx?
    If not — add bottom inset padding so cards don't go under home indicator

A6. Fix PLAYER_HAND_H in game.tsx to account for safe area:
    ```typescript
    const { bottom } = useSafeAreaInsets();
    const PLAYER_HAND_H = 2 * cardH + 24 + bottom; // 2 rows + gap + safe area
    ```

A7. npx tsc --noEmit — 0 errors
A8. npx jest --silent — all pass
A9. npx expo export --platform web
A10. node scripts/fix-web-html.js
A11. cd dist && vercel --prod --yes
A12. git add -A && git commit -m "fix: hand cards smaller on iPhone, safe area handling"
A13. git push origin main
A14. Report done

VAMOS CAPS HAND-SIZE-FIX — END
