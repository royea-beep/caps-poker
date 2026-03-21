VAMOS CAPS CRASH-AUDIT

Read MEMORY.md before starting. Iron Rules 1-8 confirmed.

Standing Orders:
- Try ALL actions autonomously first
- Never give user commands to run
- Fix everything, ask nothing

---

## TASK A — Find and fix the crash
Agent: crash-finder

A1. Run: npx tsc --noEmit 2>&1
A2. Run: npx jest --silent 2>&1
A3. Run: npx expo export --platform web 2>&1 | tail -20
    If export fails — that's likely the crash source

A4. Read app/_layout.tsx in full — check for:
    - Font loading errors
    - Missing imports
    - Supabase initialization issues

A5. Read app/index.tsx in full — check for:
    - Undefined variables
    - Broken animations
    - Missing exports

A6. Read app/game.tsx lines 1-50 — check imports

A7. Fix any issue found. Report exactly what crashed and what was fixed.

---

## TASK B — Simulation: 5000 games
Agent: simulator

B1. Create utils/__tests__/crash_audit.test.ts:

```typescript
import { initializeGameMulti, placeSingleBotCards, autoFillPlayerCards, calculateHandResultsMulti } from '../gameLogic';
import { DEFAULT_CONFIG } from '../../constants/gameConfig';

describe('Crash Audit', () => {
  it('5000 games with 2 players - no crash', () => {
    for (let i = 0; i < 5000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(2);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      const final = placeSingleBotCards(botHands[0], filled, 0);
      const results = calculateHandResultsMulti(final, 2, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(4);
      results.boardResults.forEach(r => {
        expect(r).toBeDefined();
        expect(['player','bot','tie']).toContain(r.winner);
      });
    }
  });

  it('2000 games with 3 players - no crash', () => {
    for (let i = 0; i < 2000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(3);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      let final = filled;
      for (let b = 0; b < botHands.length; b++) {
        final = placeSingleBotCards(botHands[b], final, b);
      }
      const results = calculateHandResultsMulti(final, 3, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(3);
    }
  });

  it('1000 games with 4 players - no crash', () => {
    for (let i = 0; i < 1000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(4);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      let final = filled;
      for (let b = 0; b < botHands.length; b++) {
        final = placeSingleBotCards(botHands[b], final, b);
      }
      const results = calculateHandResultsMulti(final, 4, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(2);
    }
  });
});
```

B2. npx jest --silent 2>&1 — all pass
B3. If any test fails — fix the underlying bug and re-run

---

## TASK C — Screen audit: check every screen for crashes
Agent: screen-auditor

C1. Read and check each screen for runtime crash risks:
    - app/index.tsx
    - app/game.tsx (lines 1-100)
    - app/results.tsx (lines 1-100)
    - app/settings.tsx
    - app/gameover.tsx
    - app/hand-history.tsx
    - app/leaderboard.tsx
    - app/tournament.tsx
    - app/sit-and-go.tsx

C2. For each screen check:
    - No .map() or .filter() on potentially undefined arrays
    - No undefined?.property access without null checks
    - No hooks called inside conditions
    - No missing required props

C3. Fix every issue found

C4. npx tsc --noEmit — 0 errors

---

## TASK D — BIG CARDS (do this properly, once and for all)
Agent: card-sizer

D1. Read components/Card.tsx, components/Board.tsx, app/game.tsx, components/PlayerHand.tsx

D2. Apply these sizes — cards must be clearly visible:

    Card.tsx default sizes:
    ```
    const width = cardWidth ?? (small ? 52 : 76);
    const height = cardHeight ?? (small ? 74 : 108);
    ```

    Board.tsx default card height:
    ```
    const ch = cardHeightProp ?? 64;
    ```

    game.tsx BOARD_CARD_H:
    ```
    const BOARD_CARD_H = Platform.OS === 'web'
      ? 88
      : Math.max(44, Math.min(84, Math.floor(boardSpace / 2)));
    ```

    PlayerHand.tsx:
    ```
    const cardW = Math.min(58, Math.max(44, maxCardW));
    ```

D3. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — ALL pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. py -3.11 scripts/ftp_deploy.py
6. git add -A && git commit -m "fix: crash audit 8000 games, bigger cards, screen audit"
7. git push origin main
8. Update MEMORY.md
9. Report table: what crashed, what fixed, test count

VAMOS CAPS CRASH-AUDIT — END
