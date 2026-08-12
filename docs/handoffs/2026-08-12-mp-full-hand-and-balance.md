# 2026-08-12 — Multiplayer hand played, balance mismatch closed

## Task 2 — the balance mismatch (CLOSED, no defect)

Read home and `/shop` in **one session**, before and after a hand, on device `acf7-8cc0-8f2a`:

| | home | shop | stored wallet |
|---|---|---|---|
| before | `🪙 2,530` | `💰 2,530` | 2530 |
| after a hand | `🪙 2,530` | `💰 2,530` | 2530 |

The shop's other figures (100/150/200/300/500) are **item prices**, not balances.

There is no second source to disagree with. `app/(tabs)/index.tsx:534` and `app/shop.tsx:40` are the
**same selector** — `useGameStore((s) => s.chips)` — and `shop.tsx:174` renders it directly. A
wallet-vs-config divergence between those two screens is structurally impossible.

The `DEFAULT_CONFIG.startingChips` suspicion is also disproven: it appears only in `simulate.tsx`,
`settings.tsx` and `gameover.tsx`, never in the shop. The reported `💰 2,000` was a **cross-run
reading** — a different device/session — which is the same artifact class as the previous six.

Probe: `tests/balance-same-run.mjs` (reads both sides in one continuous context).

## Task 1 — a multiplayer hand, two clients (THE ANSWER IS YES)

Two contexts, room `YYPT`, played through placement into the reveal. **The clients agree.**

| | A (host) | B (guest) |
|---|---|---|
| verdict | `✅ YOU WIN` | `❌ YOU LOSE` |
| running score | `Trailing 0-1 · 3 left` | `Leading 1-0 · 3 left` |
| board 2 community | `9♠ 7♣ 8♠ 7♦ 3♠` | `9♠ 7♣ 8♠ 7♦ 3♠` |
| host holds | `PLAYER 1` TWO PAIR | `HOST` TWO PAIR |
| guest holds | `GUEST` TWO PAIR | `PLAYER 1` TWO PAIR |

7/7 assertions passed: distinct devices, both reach the table, both render an outcome, exactly one
winner, score mirrored, neither double-claiming the lead, zero page errors / supabase 4xx.

**A design correction that mattered.** Comparing the two headlines for *equality* would fail every
correct hand — each client renders its own perspective. Agreement means **mirroring**: exactly one
winner, and `A.scoreMine == B.scoreTheirs`. The first version of this probe asserted the wrong thing.

**What is NOT yet verified.** The reveal is **manual** (`Tap to reveal`, one board at a time). The
run reached board 2 of 4, so the hand never settled. Therefore:

- final chip settlement — **untested**; the wallet read 2000 → 2000, unchanged mid-hand
- per-player `hand_history` rows — **untested**; zero rows written for all six MP devices

Do not read those zeroes as "MP never records". `multiplayer-game.tsx:696/825/853` routes to
`/results`, and `/results:569` is the sole caller of `record_hand_result_d`. MP *does* record — this
run just ended before it got there. Finishing the reveal is the remaining work.

Probe: `tests/mp-full-hand.mjs`.

## Finding — raw floats shown to the player during the chip count-up

Both clients rendered, next to the verdict:

```
✅ YOU WIN    15.342293749999996 🪙
❌ YOU LOSE   -11.539762011718746 🪙
```

`components/BoardReveal.tsx:958` animates a **string**:

```js
outputRange: [`${chipSign}0 🪙`, `${chipSign}${board.potAmount} 🪙`],
```

RN's pattern interpolation walks the numeric substring linearly and formats it with no rounding, so
every intermediate frame of the count-up shows ~16 decimal places. It settles on the integer only at
t=1. Not MP-specific — the same component drives the solo reveal.

Not fixed: outside this brief's scope, and `BoardReveal` is a partially-fenced file. The S68
"floored chip count-up" fix covered a different surface and does not reach this interpolation.

## Note — `BoardResultCard` is not dead everywhere

It was proven dead in the **solo/practice** path (`visibleBoardCount=0`). It renders in
multiplayer. The earlier "dead code" conclusion was correct but **scoped to solo**.

## Note — an unledgered absolute wallet write

`app/gameover.tsx:57` does `setChips(config.startingChips)` when a busted player confirms "Play
Again" (reachable via `results.tsx:788`). `setChips` is `set({ chips })` in `gameStore.ts:204` —
local only, persisted, **no RPC**. So the wallet is reset to a game-config constant with no server
ledger entry, which is the absolute-write pattern the single-writer refactor removed elsewhere. It
may well be intentional ("you're broke, here's a fresh stack"); flagging the client/server
divergence, not proposing a change.

## DB state — restored and verified by query

Baseline before: 10 rooms all `waiting`/0/`NULL`, `room_players` 0, `hand_history` 146,
`bug_reports` 250.

`YYPT` was left `finished`/2/host set after each run and restored each time. **A hazard in the
inherited restore SQL:** it hardcodes `host_name='Open Table'`, but `CJTK` and `QW7U` are
`'CAPS Bot'` — restoring one of those blindly would corrupt it. Restored from the captured baseline
instead.

Final verified state: `room_players` 0 · `hand_history` 146 · `bug_reports` 250 ·
clean rooms 10/10. All probe rows deleted.

## Carried forward

1. Finish the MP reveal to settlement — final result, chip movement, `hand_history` per player.
2. The `BoardReveal` count-up float.
3. `record_hand_result_d` still hardcodes `v_session_type := 'practice'` (found last run), so every
   row is stamped practice and `chips_delta` can never be non-zero.
4. Google OAuth / anonymous-to-signed-in progression loss.
5. Performance and memory across 20 consecutive hands.

=== STRATEGIST HANDOFF ===
Balance mismatch: NO DEFECT. Home and shop read the same selector; 2,000 was a cross-run artifact.
Multiplayer: CLIENTS AGREE. 7/7 — one winner, mirrored score, identical community cards and rankings.
Reveal is manual, so the hand stopped at board 2 of 4: settlement and hand_history remain untested.
MP does route to /results, which is the sole hand_history writer — the zero rows are incompleteness.
NEW: BoardReveal.tsx:958 shows raw floats (15.342293749999996 🪙) through the whole count-up.
NEW: gameover.tsx:57 resets the wallet to a config constant, client-only, no ledger entry.
BoardResultCard is dead in solo only; it renders in MP.
DB restored and verified: rooms 10/10 clean, room_players 0, hand_history 146, bug_reports 250.
