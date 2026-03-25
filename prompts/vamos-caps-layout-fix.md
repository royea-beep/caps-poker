VAMOS CAPS LAYOUT-FIX

Read MEMORY.md before starting. Iron Rules 1-8 confirmed.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for credentials
- Never give user commands to run

---

## Context
Two problems:
1. RevealSequence modal is NOT showing bot cards — user sees "BOT WINS" without seeing bot's cards
2. Web layout: app renders in a narrow column on desktop — needs to fill the screen properly

---

## TASK A — Fix RevealSequence: Show ALL cards per board
Agent: reveal-fix

A1. Read components/RevealSequence.tsx in full
A2. The reveal modal must show for each board:
    - All 5 community cards (3 flop face-up always, turn + river flip with timing)
    - Player's 4 cards — face-up, highlight winning combo
    - Bot's 4 cards — face-up, highlight winning combo
    - Winner label (YOU WIN / BOT WINS / TIE)
    - Hand names for both sides (e.g. "Straight", "One Pair")

A3. Check types/gameTypes.ts — what fields does RevealBoardData have?
    Make sure botCards (4 cards) is available in RevealBoardData.
    If not — trace back to where RevealBoardData is created and add botCards.

A4. Make cards bigger in the modal:
    - Community cards: 64×90px
    - Player/bot cards: 54×76px

A5. npx tsc --noEmit — 0 errors
A6. npx jest --silent — all pass

---

## TASK B — Web layout: full-width responsive
Agent: web-layout

B1. Read components/WebContainer.tsx in full
B2. Read app/_layout.tsx and app/index.tsx

B3. On web (Platform.OS === 'web'), the game should fill the full viewport width.
    Current problem: renders in a narrow centered column (~375px)
    Fix: WebContainer should allow up to 900px width on desktop, centered.
    Game screen (game.tsx) on web: use full viewport width for boards layout.

B4. In app/game.tsx:
    - On web, boards should be displayed in a 2×2 grid (for 4 boards) or 1×3 (for 3 boards)
    - Cards should be bigger on web — use Platform.OS === 'web' to scale up
    - Board card height on web: min 64px

B5. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. Upload dist/ via FTP (ftableco / Sb9k46-l)WI2Gq / ftable.co.il → /home/ftableco/public_html/caps/)
6. git add -A && git commit -m "fix: reveal shows all cards, web full-width layout"
7. git push origin main
8. Update MEMORY.md
9. Report result table

VAMOS CAPS LAYOUT-FIX — END
