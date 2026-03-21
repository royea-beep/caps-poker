VAMOS CAPS LOBBY-CRASH-FIX

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM 1: App crashes before/during reveal phase
## PROBLEM 2: Lobby screen needs redesign to match red+gold theme

---

## TASK A — Find and fix the reveal crash
Agent: crash-hunter

A1. Read app/results.tsx lines 1-100 — check for undefined access
A2. Read components/RevealSequence.tsx in full — check for:
    - Any .map() on potentially undefined arrays
    - allBotCards[0] access without null check
    - boardHighlightIds, playerHighlightIds undefined access
    - Any animation that could crash on web

A3. Read types/gameTypes.ts — check RevealBoardData fields
    Make sure all arrays have default values

A4. Add defensive null checks everywhere in RevealSequence.tsx:
    - allBotCards?.map() instead of allBotCards.map()
    - board.boardHighlightIds ?? []
    - board.playerHighlightIds ?? []
    - board.botHighlightIds ?? []
    - board.allBotCards ?? []
    - board.allBotHandNames ?? []

A5. Read app/gameover.tsx — check for crashes

A6. Run crash simulation — add test:
    In utils/__tests__/crash_audit.test.ts add reveal data test:
    - Create RevealBoardData objects with edge cases (empty arrays, undefined fields)
    - Verify no crash

A7. npx tsc --noEmit — 0 errors
A8. npx jest --silent — all pass

---

## TASK B — Lobby redesign (index.tsx)
Agent: lobby-designer

B1. Read app/index.tsx in full

B2. Redesign to match red+gold theme:
    - Background: #0a0a0a (deep black)
    - Remove the brown/couch scene completely if still there
    - Title "CAPS" — large, gold, Playfair Display font
    - Subtitle: "The Game Where Every Board Counts"
    - Stats box: #111 background, #2a2a2a border, gold text for numbers
    - NEW HAND button: gold background #c9a84c, black text, large
    - Other buttons: dark background #111, gold border, gold text
    - Version: bottom-right, gold, reads from Constants.expoConfig.version
    - Only ONE version shown — remove any duplicates

B3. npx tsc --noEmit — 0 errors

---

## TASK C — Full screen audit for crashes
Agent: screen-auditor

C1. Check every screen for potential crashes:
    - app/results.tsx — null checks on revealData
    - app/gameover.tsx — null checks
    - app/hand-history.tsx — empty array handling
    - app/leaderboard.tsx — empty data handling
    - app/tournament.tsx — null checks
    - app/sit-and-go.tsx — null checks

C2. Fix all potential undefined/null access

C3. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: reveal crash, lobby redesign, null safety"
7. git push origin main
8. Update MEMORY.md
9. Report: what crashed, what fixed, live URL

VAMOS CAPS LOBBY-CRASH-FIX — END
