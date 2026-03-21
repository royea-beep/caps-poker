VAMOS CAPS FULL-AUDIT v1.9.3-b101 2026-03-19-2359

## Current state: v1.9.3 build #101 | commit 20150b9
Read MEMORY.md. Iron Rules confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## MISSION
1. Fix BugReporter crash
2. Implement Five-O Poker inspired graphics from user screenshots
3. Full audit — score everything 1-10

---

## TASK A — Fix BugReporter crash (agent: crash-agent)

A1. Read components/BugReporter.tsx in full
A2. Read app/game.tsx — how BugReporter is used
A3. Reproduce the crash: what triggers it?
    - Likely: BugReporter rendered on game screen causes state conflict
    - Or: Supabase call fails silently + throws
A4. Check the "hidden on game screens" logic — is it actually hiding?
A5. Fix the crash — add try/catch, null checks, and ensure hidden correctly
A6. npx tsc --noEmit — 0 errors

---

## TASK B — Five-O Poker inspired graphics (agent: graphics-agent)

### Reference from user screenshots:
1. **Cards layout in boards**: Five-O shows cards STACKED VERTICALLY in each board
   (5 cards per board shown as a vertical column, not horizontal row)
2. **4-color suits**: blue ♦, green ♣, red ♥, black ♠ (already done in b100 — verify)
3. **WIN banner**: green "WIN" + hand name (TWO PAIR, 3 OF A KIND etc) on winning boards
   (already done in b100 — verify working)
4. **Board background**: deep red felt — already have this
5. **Card size**: much larger cards — full readable rank+suit
6. **Player area**: shows player avatar + chip count + name (left side panel)
7. **Results screen**: shows score (2-3, 5-0 etc) + YOU LOSE/WIN large text
8. **Card back**: dark with ornamental pattern

B1. Read components/Board.tsx — check current card layout direction
B2. Check if cards in boards are horizontal or vertical
    Five-O style: in the REVEAL screen, cards are shown VERTICALLY stacked in columns
    Each board = one column of cards

B3. Read components/RevealSequence.tsx — check reveal card layout

B4. Implement improvements inspired by Five-O:

    ### B4a — Score display (like "2-3" or "5-0")
    In results/reveal screen, show boards won count clearly:
    "YOU WIN 4-1" or "YOU LOSE 2-3" in large text
    This is the CAPS equivalent of Five-O's score display

    ### B4b — WIN banner with hand name
    Each board should show:
    - Green "WIN" badge + hand name (TWO PAIR, FLUSH etc) when player wins
    - Red "LOSE" badge when bot wins
    Check if b100 WIN banners include the hand name — if not, add it

    ### B4c — Board card layout for reveal
    In RevealSequence, after reveal, show community cards + player cards in a cleaner layout
    inspired by Five-O's vertical stacking

    ### B4d — Results screen score
    In app/results.tsx — show large "YOU WIN" or "YOU LOSE" with boards score (3-1 etc)

B5. Read app/results.tsx to understand current state
B6. Implement all improvements
B7. npx tsc --noEmit — 0 errors

---

## TASK C — Full audit (agent: audit-agent)

C1. For each feature requested by user today, check git log + read relevant files:

    Features to audit:
    1. Splash screen 3.5s — check _layout.tsx
    2. Bot speed 1.5-4s — check constants/gameConfig.ts
    3. Board layout iPhone 16 — check BOARD_CHROME, rv() in game.tsx
    4. LEADERBOARD buttons fit — check index.tsx linkRow
    5. Results pre-calculation — check game.tsx precalculatedResultsRef
    6. 4-color suits — check components/Card.tsx + store/gameStore.ts
    7. WIN/LOSE/TIE banners — check components/Board.tsx
    8. REMATCH button — check app/results.tsx
    9. Diamond lattice card back — check components/Card.tsx
    10. Orientation choice screen — check app/orientation-pick.tsx
    11. WhatsApp bot multi-project — check Edge Function
    12. WhatsApp audio transcript in reply — check Edge Function
    13. BugReporter crash — check components/BugReporter.tsx
    14. Five-O inspired graphics — check after B4 above

C2. For each item, assign score 1-10:
    10 = perfect, fully working
    7-9 = working but minor issues
    4-6 = partially done
    1-3 = broken or not done

C3. Write report to docs/AUDIT-2026-03-19.md

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: BugReporter crash, Five-O graphics, full audit [v1.9.3-b102]"
7. git push origin main
8. Print full audit table with scores

VAMOS CAPS FULL-AUDIT — END
