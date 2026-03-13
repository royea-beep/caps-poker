# Sprint-44 QA — UI Flow Audit (All Screens)

**Date:** 2026-03-13
**Method:** Static code analysis of all app screens + components + web endpoint checks
**Result:** 20 issues found — 3 P1, 6 P2, 11 P3

## Screen Audit

| Screen | Status | Issues |
|--------|--------|--------|
| Home (index.tsx) | OK | P3: glowOpacity missing from useEffect deps. P3: "Reset Chips" no confirm dialog. P3: No disabled state on NEW HAND when chips < buy-in. |
| Game (game.tsx) | OK | P3: Board key uses array index (acceptable, boards don't reorder). P2: playerHandRef closure in autoFillAndReady not in deps (intentional ref pattern). |
| Results (results.tsx) | OK | P2: submitScore may use stale handsPlayed count (Zustand sync timing). P2: useDerivedValue in AnimatedChipCount runs every frame. |
| Settings (settings.tsx) | FIXED | **P2: `&amp;` rendered literally in "AUDIO & NOTIFICATIONS"** → Fixed: changed to `&`. P3: No visual feedback when botSpeedMax < botSpeedMin. |
| Game Over (gameover.tsx) | OK | Clean. Timer cleanup proper. |
| Leaderboard (leaderboard.tsx) | OK | Handles Supabase unavailable gracefully. Loading, empty, and error states all present. |
| Simulate (simulate.tsx) | OK | Dev-only. Proper timeout cleanup. |
| Multiplayer Game (multiplayer-game.tsx) | OK | P2: handleTimerExpire has stale closure (empty deps). P3: botCards prop creates new [] ref each render. |
| Lobby Host (lobby/host.tsx) | OK | P2: maxPlayers captured at server start, changing later has no effect. P3: Player name overflow not truncated. |
| Lobby Join (lobby/join.tsx) | OK | P2: onCardsDealt captures stale roomState closure. P3: No IP format validation. |
| Internet Host (internet-host.tsx) | FIXED | **P1: router.push without params** → Fixed: deals cards, broadcasts to players, navigates with full params. |
| Internet Join (internet-join.tsx) | FIXED | **P1: No handler to navigate after host starts** → Fixed: added onMessage('cards_dealt') listener. |
| Reveal (reveal.tsx) | DELETED | **P1: Dead screen** — nothing navigated to /reveal. Replaced by results.tsx in earlier sprint. |
| Summary (summary.tsx) | DELETED | **P1: Dead screen** — only reveal.tsx navigated here. Both deleted as dead code. |
| Layout (_layout.tsx) | OK | Clean. Properly guards GestureHandlerRootView for web. |

## Component Audit

| Component | Status | Issues |
|-----------|--------|--------|
| Board.tsx | OK | P3: Empty slot count hardcoded to 4 (should use CARDS_PER_BOARD constant). |
| Card.tsx | OK | Clean. Handles missing data gracefully. |
| Button.tsx | OK | Platform-split (Pressable web, AnimatedTouchable native). Proper disabled/loading states. |
| ChipsDisplay.tsx | OK | P3: Hardcoded #f0c040 instead of COLORS.gold. |
| CompleteOverlay.tsx | OK | P2: Emoji may render inconsistently cross-platform. |
| PlayerHand.tsx | OK | Dynamic sizing. |
| Badge.tsx | OK | Clean. |

## Navigation Path Audit

| Path | Status | Notes |
|------|--------|-------|
| index → game → results → index | OK | Normal game loop works |
| index → game → results → gameover | OK | Game over triggers correctly |
| index → settings → index | OK | Back button works |
| index → leaderboard → index | OK | Back button works |
| index → simulate → index | OK | Dev only, back works |
| index → lobby/host → multiplayer-game → results | OK | WiFi host flow complete |
| index → lobby/join → multiplayer-game → results | OK | WiFi join flow works (P2: stale roomState risk) |
| index → internet-host → multiplayer-game → results | FIXED | Was broken, now deals cards + navigates with params |
| index → internet-join → multiplayer-game → results | FIXED | Was broken, now listens for cards_dealt message |
| reveal → summary | DELETED | Dead code path removed |
| gameover → game (play again) | OK | 2-step confirm, resets chips |
| gameover → index (main menu) | OK | Clean navigation |

## Web Endpoint Checks

| URL | Status | OK? |
|-----|--------|-----|
| https://caps.ftable.co.il | 200 | OK |
| https://caps.ftable.co.il/game | 200 | OK |
| https://caps.ftable.co.il/settings | 200 | OK |
| https://caps.ftable.co.il/leaderboard | 200 | OK |
| https://caps.ftable.co.il/privacy.html | 200 | OK |

## All Issues by Severity

### P0 — Critical (app crash / data loss): NONE

### P1 — High (broken feature / blocked flow): 3 found, 3 FIXED
1. **internet-host.tsx line 60**: `router.push('/multiplayer-game')` without any params. Game screen rendered empty boards with no cards.
   → **FIX:** Deal cards via `dealCardsMultiplayer()`, broadcast to each player via `sendToPlayer('cards_dealt', ...)`, navigate with full params (isHost, playerIndex, playerCount, yourCards, boards).

2. **internet-join.tsx**: No handler to navigate to multiplayer-game after host starts. Guest stuck on "Waiting for host to start..." forever.
   → **FIX:** Added `client.onMessage('cards_dealt', ...)` listener that navigates to `/multiplayer-game` with params from the host's broadcast.

3. **reveal.tsx + summary.tsx**: Dead screens. Nothing in the app navigates to `/reveal`. The flow was changed from game→reveal→summary to game→results in a prior sprint, but old files were never deleted.
   → **FIX:** Deleted both files. -803 lines of dead code removed.

### P2 — Medium (visual bug / UX issue): 6 found, 1 FIXED
4. **settings.tsx line 212**: `&amp;` rendered as literal text in section title "AUDIO &amp; NOTIFICATIONS".
   → **FIX:** Changed `&amp;` to `&` in JSX.

5. **multiplayer-game.tsx**: `handleTimerExpire` defined with `useCallback(..., [])` — empty deps means it captures initial `autoFillAndReady`. Stale closure risk if timer/server refs change.
   → **STATUS:** Low risk — callback is stable, refs are used internally. Deferred.

6. **lobby/join.tsx**: `onCardsDealt` callback captures stale `roomState` from closure. By the time callback fires, `roomState` may be null.
   → **STATUS:** Low risk in practice — roomState is set before cards dealt. Deferred.

7. **results.tsx**: `useDerivedValue` in AnimatedChipCount calls `runOnJS(updateDisplay)` on every UI thread frame during animation.
   → **STATUS:** Cosmetic — animation is brief. No visible perf impact. Deferred.

8. **CompleteOverlay.tsx**: Coin emoji in bonus display may render inconsistently across platforms.
   → **STATUS:** Cosmetic. Deferred.

9. **results.tsx**: `submitScore` reads `store.handsPlayed` immediately after `incrementHandsPlayed()`. May submit stale count depending on Zustand batching.
   → **STATUS:** Off-by-one in leaderboard stat, not user-visible. Deferred.

### P3 — Low (code quality / minor polish): 11 found, all DEFERRED
10. index.tsx: `glowOpacity` not in useEffect deps (stable shared value)
11. index.tsx: "Reset Chips" has no confirmation dialog
12. index.tsx: No disabled state on "NEW HAND" when chips < buy-in
13. Board.tsx: Empty slot count hardcoded to 4 instead of CARDS_PER_BOARD
14. ChipsDisplay.tsx: Hardcoded `#f0c040` instead of COLORS.gold
15. settings.tsx: No visual feedback when botSpeedMax < botSpeedMin
16. lobby/join.tsx: No IP address format validation
17. lobby/host.tsx: Changing maxPlayers after server started has no effect
18. simulate.tsx: No back button if deep-linked on web
19. game.tsx: Board key uses array index (acceptable)
20. multiplayer-game.tsx: botCards prop `[]` creates new ref each render
