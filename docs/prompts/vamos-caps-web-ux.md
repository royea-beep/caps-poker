VAMOS CAPS WEB-UX

Read MEMORY.md before starting. Iron Rules 1-8 confirmed.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for credentials
- Never give user commands to run

---

## Context
caps.ftable.co.il is live. Two issues found:

1. React error #300 on /results page (web only)
2. Reveal UX needs improvement:
   - Cards too small on web
   - Reveal too fast — need 10s per board OR manual "Next Board" button
   - Must show ALL cards (bot + player) during reveal so user can understand who won and why
   - Need a pause/delay between turn and river reveal (suspense)

---

## TASK A — Fix React error #300 on /results (web)
Agent: results-fix

A1. React error #300 = "Minified React error" — usually means hooks called conditionally or component rendered outside context provider.
A2. Read app/summary.tsx and app/results.tsx (if exists) in full
A3. Check what route /results maps to in expo-router
A4. Find and fix the root cause
A5. npx tsc --noEmit — 0 errors
A6. npx jest --silent — all pass

---

## TASK B — Reveal UX: Show all cards + timing
Agent: reveal-ux

B1. Read hooks/useRevealSequence.ts and app/game.tsx in full
B2. During board reveal phase — show ALL cards face-up:
    - All 5 community cards (flop + turn + river)
    - Player's 4 cards
    - Bot's 4 cards (currently hidden — must be shown)
    - Highlight the winning combination
B3. Reveal timing:
    - Each board stays visible for minimum 10 seconds
    - OR add a "Next Board →" button so user can advance manually
    - Add a 1.5s pause between turn reveal and river reveal (suspense moment)
B4. npx tsc --noEmit — 0 errors

---

## TASK C — Card size on web
Agent: web-card-size

C1. Read components/Card.tsx and components/Board.tsx
C2. On web (Platform.OS === 'web'), cards should be larger:
    - Regular card: at least 60x85px on web (vs smaller on mobile)
    - Small card (on board): at least 44x62px on web
C3. Use Platform.select or Platform.OS === 'web' to apply different sizes
C4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. Upload dist/ to FTP:
   - ftableco / CPANEL_PASSWORD_REDACTED / ftable.co.il
   - Target: /home/ftableco/public_html/caps/
5. Verify https://caps.ftable.co.il loads without errors
6. git add -A && git commit -m "fix: web results error, reveal UX, card sizes"
7. Update MEMORY.md
8. Report result table

VAMOS CAPS WEB-UX — END
