VAMOS CAPS ROTATING-TAGLINE v1.9.3-b87 2026-03-18-2330

## Current state: v1.9.3 build #87 | commit e8ceb35
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## FEATURE: Rotating tagline on home screen

Every time the user opens the home screen, a different tagline appears.
Cycle through all 10 in order (or random), never repeating until all shown.

## TASK — Implement rotating tagline

A1. Read app/index.tsx in full

A2. Add taglines array:
    ```typescript
    const TAGLINES = [
      "4 Boards. One Winner. No Excuses.",
      "Every Card Counts. Every Board Matters.",
      "Omaha Like You've Never Played It.",
      "Stack the Boards. Take the Chips.",
      "Play All 4. Win the Night.",
      "Think Ahead. Play All Boards.",
      "The Poker Game That Never Sleeps.",
      "More Boards. More Action. More Fun.",
      "Deal. Place. Dominate.",
      "Where Every Board Is a Battle.",
    ];
    ```

A3. Pick tagline on each mount:
    - Use useRef to track last index (persisted across re-renders, not across sessions)
    - Or use a simple module-level counter that increments on each mount
    - Show a different tagline each time the screen mounts

A4. Add subtle fade animation when tagline appears:
    - Fade in from 0 to 1 over 800ms on mount
    - No slide animation — just opacity

A5. Replace the current static tagline with the rotating one

A6. npx tsc --noEmit — 0 errors
A7. npx jest --silent — all pass
A8. npx expo export --platform web --clear
A9. node scripts/fix-web-html.js
A10. cd dist && vercel --prod --yes
A11. git add -A && git commit -m "feat: rotating tagline on home screen — 10 lines [v1.9.3-b88]"
A12. git push origin main
A13. Report done

VAMOS CAPS ROTATING-TAGLINE — END
