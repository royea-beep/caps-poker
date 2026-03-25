VAMOS CAPS CRASH-AUDIT

Read MEMORY.md before starting. Iron Rules 1-8 confirmed.

Standing Orders:
- Try ALL actions autonomously first
- Never give user commands to run
- Fix everything, ask nothing

---

## CRITICAL: App crashes on launch — fix first

A1. Run the app and check for runtime errors:
    cd C:/Projects/Caps
    npx tsc --noEmit 2>&1
    npx jest --silent 2>&1

A2. Check app/_layout.tsx for crash causes:
    - Any missing imports
    - Any font loading errors
    - Any Supabase/AsyncStorage initialization errors

A3. Check app/index.tsx for crash causes:
    - Any undefined variables
    - Any broken animations on web

A4. Check constants/theme.ts — make sure all color values are valid hex strings

A5. Run a quick smoke test:
    npx expo export --platform web 2>&1 | tail -5
    If export fails — that's the crash source, fix it

---

## TASK A — Full Crash Audit (5000 simulated plays)
Agent: crash-auditor

A1. Read utils/gameLogic.ts, utils/handEvaluator.ts in full

A2. Run stress test — simulate 5000 complete games (2 players):
    ```typescript
    // Add to utils/__tests__/crash_audit.test.ts
    import { initializeGameMulti, placeSingleBotCards, autoFillPlayerCards, calculateHandResultsMulti } from '../gameLogic';
    import { DEFAULT_CONFIG } from '../../constants/gameConfig';

    describe('Crash Audit — 5000 games', () => {
      it('completes 5000 games without error', () => {
        for (let i = 0; i < 5000; i++) {
          const { boards, playerHand, botHands } = initializeGameMulti(2);
          // Auto-fill player
          const { boards: filledBoards } = autoFillPlayerCards(
            [...playerHand].sort(() => Math.random() - 0.5),
            boards
          );
          // Bot places cards
          const finalBoards = placeSingleBotCards(botHands[0], filledBoards, 0);
          // Evaluate
          const results = calculateHandResultsMulti(finalBoards, 2, DEFAULT_CONFIG);
          // Validate
          expect(results.boardResults).toHaveLength(4);
          expect(results.playerChipsWon).toBeGreaterThanOrEqual(0);
        }
      });

      it('completes 2000 games with 3 players', () => {
        for (let i = 0; i < 2000; i++) {
          const { boards, playerHand, botHands } = initializeGameMulti(3);
          const { boards: filledBoards } = autoFillPlayerCards(
            [...playerHand].sort(() => Math.random() - 0.5),
            boards
          );
          let finalBoards = filledBoards;
          for (let b = 0; b < botHands.length; b++) {
            finalBoards = placeSingleBotCards(botHands[b], finalBoards, b);
          }
          const results = calculateHandResultsMulti(finalBoards, 3, DEFAULT_CONFIG);
          expect(results.boardResults).toHaveLength(3);
        }
      });
    });
    ```

A3. npx jest --silent 2>&1 — all pass including new crash audit tests

---

## TASK B — BIG CARDS (FINAL FIX — do this properly)
Agent: card-size-fixer

This has been requested many times. Cards must be BIG and clearly visible.

B1. Read components/Card.tsx, components/Board.tsx, app/game.tsx in full

B2. Fix card sizes — make them as big as possible while fitting the screen:

    **In Card.tsx — increase default sizes:**
    ```typescript
    const width = cardWidth ?? (small ? 52 : 76);   // was 46/68
    const height = cardHeight ?? (small ? 74 : 108); // was 64/98
    ```

    **In Board.tsx — increase board card height:**
    ```typescript
    const ch = cardHeightProp ?? 64;  // was 56
    ```

    **In game.tsx — increase BOARD_CARD_H:**
    ```typescript
    const BOARD_CARD_H = Platform.OS === 'web'
      ? 88          // was 72
      : Math.max(40, Math.min(80, Math.floor(boardSpace / 2)));  // was 32/68
    ```

    **In PlayerHand.tsx — bigger hand cards:**
    ```typescript
    const cardW = Math.min(58, Math.max(42, maxCardW));  // was 50/34
    ```

    **In RevealSequence.tsx — bigger reveal cards:**
    ```typescript
    const commCardW = Platform.OS === 'web' ? 72 : 52;   // was 64/46
    const commCardH = Platform.OS === 'web' ? 102 : 74;  // was 90/66
    const handCardW = Platform.OS === 'web' ? 60 : 44;   // was 54/38
    const handCardH = Platform.OS === 'web' ? 86 : 62;   // was 76/54
    ```

B3. npx tsc --noEmit — 0 errors

---

## TASK C — Full Screen Audit
Agent: screen-auditor

C1. Check EVERY screen for crashes:
    - app/index.tsx — home screen
    - app/game.tsx — main game
    - app/results.tsx — results/summary
    - app/settings.tsx — settings
    - app/gameover.tsx — game over
    - app/hand-history.tsx — hand history
    - app/leaderboard.tsx — leaderboard
    - app/tournament.tsx — tournament
    - app/sit-and-go.tsx — sit & go

C2. For each screen check:
    - No undefined variable access
    - No missing required props
    - No broken imports
    - No hooks called conditionally

C3. Fix any issues found

C4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — ALL pass (including 5000-game stress test)
3. npx expo export --platform web — must succeed
4. node scripts/fix-web-html.js
5. py -3.11 scripts/ftp_deploy.py
6. git add -A && git commit -m "fix: crash audit, bigger cards, full screen audit"
7. git push origin main
8. Update MEMORY.md
9. Report: what crashed, what was fixed, test results

VAMOS CAPS CRASH-AUDIT — END
