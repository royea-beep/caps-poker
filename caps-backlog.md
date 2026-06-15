# CAPS Poker — Backlog (post build-466 COUNCIL audit, 2026-06-08)

Non-blocking findings from the 5-perspective audit on commit `4347c6e3` / branch state through `a0122dad`. Logged for a future cleanup pass; do NOT need a separate build to address.

Severity legend: **CRITICAL** (real bug, blocks shipping) · **HIGH** (real bug, ship-around) · **MEDIUM** (tech debt) · **LOW** (nit)

## Status
- **Portrait lock (CRITICAL)** — FIXED on 2026-06-08 (`app.json`: `UISupportedInterfaceOrientations` reduced to portrait only)
- All other items below: open

---

## Accessibility (HIGH)

- **Board.tsx:447-450** — `autoBtn.minHeight: rs(16)` ≈ 13dp on 320pt — below WCAG 2.5.5 44×44 tap target. Add explicit `minHeight: 44, minWidth: 44` or wrap in `Pressable` with `hitSlop`.
- **Board.tsx:474-481** — bot card `Pressable` has no `accessibilityRole` / `accessibilityLabel`. Add labels like `"Bot card, face down"`.
- **BoardArrangement.tsx:282-298** — floating Cancel/Place buttons no `accessibilityRole="button"` or `accessibilityState={{ disabled }}`. Add both.
- **PlayerHand.tsx:54-65** — each card `Pressable` no `accessibilityRole` / `accessibilityLabel` (e.g. `"Ace of Spades, tap to select"`) or `accessibilityState={{ selected }}`. Required for screen reader.
- **PlayerHand.tsx:281-291** — `selBadge` numeric indicator no `accessibilityLabel` describing selection order (e.g. `"selection 2 of 4"`).
- **game.tsx:1068, 1175** — only the back button has explicit `minHeight/minWidth: 44 + hitSlop`. `continueBtn` and `timeBankBtn` lack the same.
- **prdTokens.ts:21-22** — `cornerRank` floor 9pt, `cornerSuit` floor 7pt — below WCAG AA min for sustained reading. Bump floors to 10/8pt or expose as scaled tokens.

## Tech debt — RN engineering (MEDIUM/HIGH)

- **game.tsx:169-175** — `PLAYER_HAND_H` literals (170/162/305) NOT wrapped in `rs()`/`rh()`. Visible distortion on 320pt phones. Wrap each in `rh()` or refactor into `prdTokens.ts` per-boardCount table.
- **PlayerHand.tsx:106** — `handZoneH = PRD.zone.handMinH` is STALE; game.tsx already passes a per-boardCount prop that should override. PlayerHand's internal `cardHForQuad` math should read the same value game.tsx reserved. Refactor to accept `handZoneH` prop (already plumbed) and use it.
- **game.tsx:267-276** — 4 separate `useSharedValue(0)` + `useAnimatedStyle` for board shake. Should be a `useMemo` array indexed by board.
- **PlayerHand.tsx:111-119** — `cardHForQuad` subtracts 7 separate chrome constants. Extract to `getHandLayoutMetrics(handZoneH, cardsPerRow)` util shared with game.tsx so the two stay in sync.
- **Board.tsx:144-173** — 17 props (half optional, several overlapping: `cellWidth/cellHeight` + `cardHeight` + `communityScale`). Consolidate to one source of truth.
- **BoardArrangement.tsx:32-74** — `BoardArrangementProps` has 30+ fields; god-component. Split into `BoardGridProps`, `ActionBarProps`, `HintProps`.
- **Board.tsx:215-266** — fork between `cellWidth/cellHeight` path and legacy PRD path = ~50 lines of duplicated card-size math. Extract to util.
- **game.tsx:255** — `useState(99)` magic default to suppress first-time hint. Make it a named constant `FIRST_GAME_PLAYED_THRESHOLD`.

## Hardcoded pixel literals (MEDIUM)

Style values that should be `rs(N)` but are raw numbers. Scaling drift on 320pt phones.

- **Board.tsx**: L467 `paddingVertical: 6` (contentSafetyPad band-aid), L500 `marginLeft: 4`, L603 `hitSlop:{10,...}`, L694 `borderWidth: 2`, L746 `borderRadius: 6`, L782-783 `right: -4, top: -2`, L793 `paddingVertical: 1`, L804 `borderRadius: 1`, L812 `borderWidth: 0.5`, L930-931 `borderBottomLeftRadius: 12`, L978 `borderWidth: 1`
- **BoardArrangement.tsx**: L219 `(boardCount === 4 ? 40 : 0)` magic offset (real bug carrier — move to a per-mode token), L390 `borderWidth: 1`, L462 `borderWidth: 1.5`
- **PlayerHand.tsx**: L86 `availableW = SCREEN_W - 16`, L94 `CARD_WRAPPER_OVERHEAD = 12`, L105 `CARD_WRAPPER_BORDER_V = 2`, L249 `borderWidth: 2`, L251 `padding: 1`, L282-283 `top: -2, right: -2`
- **game.tsx**: L178 `BOARD_GAPS = (boardCount-1)*4`, L210 `_gridGap = 4`, L211 `_gridSidePadIfWide = 8`, L213 `>= 180` magic breakpoint, L217 `+4`, L218 `_chromeSafety = 28`, L227 `_boardChromeH = 32`, L1377 `borderRadius: 18`, L1516 `height: 48`, L1520 `borderRadius: 12`

## Edge cases (MEDIUM)

- **Board.tsx:391** — `allBotCards.some((bc) => bc.length > 0)` crashes if any `bc` is null/undefined. 4-bot multiplayer race risk. Add `bc && bc.length > 0`.
- **Board.tsx:584-614** — hint row gated by `false &&` (dead code) but still imports `getHandHint`, `getLanguage`, `HINT_EXPLANATIONS`. Bundle bloat — remove imports or remove the dead code path.
- **BoardArrangement.tsx:266-278** — `winAllBanner` shows when `allBoardsFull`; if `potPerBoard` is 0/NaN (corrupted config) the banner shows "WIN ALL 0". Guard the value before render.
- **PlayerHand.tsx:75** — `WEB_MAX_WIDTH` could be undefined if WebContainer import fails. No defensive fallback. Add `?? 800` or similar.
- **PlayerHand.tsx:39-44** — `playSound` runs on every card with `index % 4 === 0`. On rapid re-mount (theme change), 4 sounds fire simultaneously → audio glitch. Debounce.
- **prdTokens.ts:30** — `cellHCap: rh(118)` is unused after PR-M. Dead token — remove.
- **game.tsx:135** — `as 2 | 3 | 4` unsafe cast. If config corrupted (e.g. 5), `getBoardCount` falls to default silently. Use a runtime guard + `console.warn` in `__DEV__`.

## i18n (LOW)

- **Board.tsx:621-631** — `winnerBadge` shows `"WIN" / "LOSE" / "TIE"` English-only inside Hebrew UI. Wrap in `t()`.
- **PlayerHand.tsx:185** — `emptyText` `"All cards placed!"` English-only. Wrap in `t()`.

## i18n test artifact (LOW)

- Jest run reported 6 test suites errored at discovery: Playwright `tests/visual/*.spec.ts` files leak into Jest collection (`throwIfRunningInsideJest`). Not test failures, but the noise hides real failures. Add `testPathIgnorePatterns: ['tests/visual/']` to `jest.config.*`.

## UI/UX polish (LOW)

- **PlayerHand.tsx:91** — `useQuadRows` triggers at `length >= 13`. 3p (12 cards) stays 2-row though 1 card short. Visible card-size jump at boundary if a 3p game briefly hits 13 cards. Use `>= 12` or pre-decide based on `numberOfPlayers`.
- **PlayerHand.tsx:152-194** — "YOUR HAND" label fixed-left; Hebrew RTL alignment looks orphaned. Use `start`/`end` instead of `left`/`right`.
- **prdTokens.ts:48** — `handMinH = max(rh(180), 0.40*SCREEN_H)` on tall phones (>800h) gives 40% hand zone. Cap at `min(0.40*SCREEN_H, rh(340))`.

## Notes
- The COUNCIL prediction "320pt 2-player = unusable 4-row stack" was DISPROVED by the actual 320×844 screenshot (`320_2p.png`): renders a clean 2×2 grid with all 16 cards visible.
- Cross-platform divergence (web vertical-stack vs native 2x2) is an accepted limitation documented at `BoardArrangement.tsx:117-135`.
