VAMOS CAPS LAZY-RESULTS v1.9.3-b94 2026-03-19-1900

## Current state: v1.9.3 build #94 | commit 667328a
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM
Results calculation is too slow — user waits before seeing anything.
All boards calculated sequentially before showing any results.

## TASK — Lazy/parallel board calculation

A1. Read utils/gameLogic.ts — find calculateHandResultsMulti()
A2. Read app/game.tsx — find where results are calculated before navigation
A3. Read app/results.tsx — find how RevealBoardData is consumed

A4. Understand current flow:
    - game.tsx calls calculateHandResultsMulti(boards) → gets ALL results → navigates
    - results.tsx receives all boards pre-calculated
    - User waits for ALL boards before seeing ANYTHING

A5. Choose the best optimization strategy:
    OPTION 1 — Calculate board 1 first, then stream the rest:
    - Calculate board 1 → navigate immediately with partial results
    - results.tsx calculates boards 2,3,4 lazily as user views board 1
    
    OPTION 2 — Parallel calculation using Promise.all:
    - Calculate all boards in parallel (Promise.all) instead of sequentially
    - Much simpler, likely 2-4x faster
    
    OPTION 3 — Pre-calculate during countdown:
    - Start calculating results during the 3-2-1 countdown
    - By the time countdown ends, results are ready
    
    Pick the option that gives the best UX improvement with least risk.
    Recommendation: OPTION 3 first (safest), then OPTION 2 if still slow.

A6. Implement chosen option:
    For OPTION 3 (pre-calculate during countdown):
    ```typescript
    // In game.tsx, when countdown starts (countdownActive = true):
    // Start calculating in background using setTimeout(0) to not block UI
    useEffect(() => {
      if (countdownActive) {
        // Pre-calculate results in background during countdown
        setTimeout(() => {
          const results = calculateHandResultsMulti(boardsRef.current, deckRef.current);
          precalculatedResultsRef.current = results;
        }, 0);
      }
    }, [countdownActive]);
    
    // When navigating to reveal:
    // Use precalculated results if available, otherwise calculate now
    const results = precalculatedResultsRef.current ?? calculateHandResultsMulti(boards, deck);
    ```
    
    For OPTION 2 (parallel):
    - Check if calculateHandResultsMulti already uses loops
    - If yes, wrap each board calculation in Promise.all

A7. Make sure results.tsx can handle partial results if needed

A8. npx tsc --noEmit — 0 errors
A9. npx jest --silent — 115/115
A10. npx expo export --platform web --clear
A11. node scripts/fix-web-html.js
A12. cd dist && vercel --prod --yes
A13. git add -A && git commit -m "perf: pre-calculate results during countdown, parallel board eval [v1.9.3-b95]"
A14. git push origin main
A15. Report: which option was chosen, how much faster (estimate), what changed

VAMOS CAPS LAZY-RESULTS — END
