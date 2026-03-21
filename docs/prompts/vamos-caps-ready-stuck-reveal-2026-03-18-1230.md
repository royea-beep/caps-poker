VAMOS CAPS READY-STUCK-REVEAL 2026-03-18-1230

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEMS
1. App gets stuck after "BOTS 2/2 READY" — never navigates to reveal
2. Board labels show B1/B2 wrong — each board shows B1+B2 instead of one label
3. Reveal screen needs to be full-screen per board (one board at a time, full screen)

---

## TASK A — Fix stuck after BOTS READY
Agent: ready-flow-fixer

A1. Read app/game.tsx in full — find what happens after allBotsReady && playerReady

A2. The flow should be:
    allBotsReady && playerReady → wait short delay → navigateToReveal()
    
A3. Check if navigateToReveal() is actually being called:
    - Is there a condition blocking it?
    - Is mountedRef.current false too early?
    - Is the try/catch swallowing the navigation silently?

A4. Add console.log statements to trace:
    console.log('[GAME] allBotsReady:', allBotsReady, 'playerReady:', playerReady);
    console.log('[GAME] navigateToReveal called');
    console.log('[GAME] router.replace called');

A5. Fix the navigation — make sure it fires

A6. Also check: after navigateToReveal, does results.tsx actually load?
    Read app/results.tsx lines 1-50

---

## TASK B — Fix board labels
Agent: board-label-fixer

B1. Read components/Board.tsx — find where B1/B2 label is rendered
B2. Each board should show ONE label: B1, B2, B3, B4
    Not show both B1 and B2
B3. Fix the label rendering

---

## TASK C — Full-screen reveal per board
Agent: reveal-screen-fixer

C1. Read components/RevealSequence.tsx in full
C2. Read hooks/useRevealSequence.ts in full

C3. The reveal should work like this:
    - Show ONE board at a time, full screen
    - Show community cards (flop face up, turn+river flip one by one)
    - Show player cards vs bot cards
    - Show winner for this board
    - "TAP TO CONTINUE" → next board
    - After all boards → results summary

C4. Make sure each board takes the FULL screen height
    No scrolling — everything fits in one screen per board

C5. Fix any issues preventing this from working correctly

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: stuck after ready, board labels, full-screen reveal"
7. git push origin main
8. Report what caused the stuck and what was fixed

VAMOS CAPS READY-STUCK-REVEAL — END
