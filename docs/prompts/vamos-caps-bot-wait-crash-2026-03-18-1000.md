VAMOS CAPS BOT-WAIT-CRASH 2026-03-18-1000

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM 1 — iOS crashes after player presses READY, during bot wait phase
## PROBLEM 2 — Web: boards not in 2x2 grid, showing as single column

---

## TASK A — Fix iOS crash after READY
Agent: crash-hunter

A1. Read app/game.tsx lines 190-300 — find the bot placement logic
    This is where the crash happens: after player presses READY, waiting for bot

A2. Look for:
    - setTimeout callbacks that access unmounted component state
    - Any animation that starts after READY but crashes on iOS
    - placeSingleBotCards — does it mutate state safely?
    - The countdown timer — any unsafe state update?
    - navigateToReveal — does it crash if called before bot finishes?

A3. Read hooks/useGameTimer.ts in full

A4. Common cause: setState called after component unmounts
    Check all setTimeout/setInterval calls have cleanup in useEffect return
    Check mountedRef.current is checked before every setState

A5. Read app/results.tsx lines 1-50 — the navigation target after READY

A6. Fix whatever is found — add mountedRef.current checks everywhere

A7. npx tsc --noEmit — 0 errors
A8. npx jest --silent — all pass

---

## TASK B — Fix web 2x2 grid layout
Agent: web-grid-fixer

B1. Read app/game.tsx — find the boardsGrid style and boardsColumn
    Check if boardsGrid is actually being applied on web

B2. The issue: boardsColumn likely has flex:1 or flexDirection:'column'
    that overrides boardsGrid on web.

B3. Fix: on web, replace boardsColumn style completely:
    ```
    <View style={isWeb
      ? [styles.boardsGrid]  // ONLY boardsGrid, not boardsColumn
      : [styles.boardsColumn]
    }>
    ```

B4. Make sure boardsGrid has:
    ```
    boardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      paddingHorizontal: 8,
      gap: 8,
      width: '100%',
    }
    ```

B5. boardCellHalf width should be 'calc(50% - 4px)' on web:
    ```
    boardCellHalf: {
      width: '50%',
      paddingHorizontal: 4,
      paddingVertical: 4,
    }
    ```

B6. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: iOS crash after READY, web 2x2 grid boards"
7. git push origin main
8. Update MEMORY.md
9. Report root cause of iOS crash + fix

VAMOS CAPS BOT-WAIT-CRASH — END
