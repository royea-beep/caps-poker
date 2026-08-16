# 2026-08-16 — The 4+2 highlight

Shipped `01a0e50`, deployed, verified on live. **The evaluator was never wrong.** The highlight was.

## Task 1 — the evaluator is CORRECT

`utils/handEvaluator.ts` enforces Omaha structurally, not by convention:

```js
// C(4,2) = 6 player card combos (indices into 4-card hand)
const PLAYER_COMBO_IDX = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];                     // :59
// C(5,3) = 10 board combos
const BOARD_COMBO_IDX = { 5: [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],
                              [0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]], … };        // :61-65
```

**6 × 10 = 60 candidates.** Not 126. It cannot consider a 4+1 or 3+2 split because the index sets
make illegal combinations unrepresentable — the constraint is in the data structure, not in a check
that could be forgotten. `evaluateOmahaHand` (`:182`) also guards `playerCards.length >= 2 &&
boardCards.length >= 3`, and returns `playerCardsUsed` and `boardCardsUsed` separately.

**Tested against the photographed hand** — board `J♣ 8♥ 2♣ Q♠ 6♣`, hand `A♠ A♥ A♦ A♣`:

```
playerCardsUsed  2
boardCardsUsed   3
name             "One Pair"
```

Four aces in hand and it returns **One Pair**, because Omaha permits only two of them. A Hold'em
"best five of nine" evaluator would have returned Four of a Kind. That is the strongest possible
evidence the evaluator is right, and it matches the `ONE PAIR` label on Roye's screenshot.

**VERDICT: evaluator correct.** No stop needed. Rankings, results and `hand_history` are unaffected.

## Task 2 — the highlight was the bug

`app/game.tsx:681` built the community highlight as a **union of two different selections**:

```js
boardHighlightIds: result ? [
  ...result.playerResult.boardCardsUsed.map((c) => c.id),   // the player's 3
  ...result.botResult.boardCardsUsed.map((c) => c.id),      // the bot's 3
] : [],
```

Each side's three are legal on their own. But the two sides rarely choose the *same* three, and
there is only **one shared community row**, so the union rendered 4 or 5 marks. Where the two
selections overlapped in two cards, the union was exactly 4 — the photographed case.

The hand rows were always right (2 each) because they use `playerCardsUsed` unmerged. That is why
the defect looked like "4+2": one row merged, the other not.

**The UI does not re-derive anything** — it renders exactly what the evaluator returned. The bug was
in *combining* two correct answers, which is a subtler failure than re-deriving and, unlike a
re-derivation, produces a legal-looking display most of the time.

**Fix:** the shared row now carries the **winner's** three:

```js
boardHighlightIds: result
  ? (result.winner === 'bot' ? result.botResult : result.playerResult)
      .boardCardsUsed.map((c) => c.id)
  : [],
```

The reveal's message is "X beats Y", so the winning five is the hand being explained. **The loser's
own three are therefore not shown** — a limitation of one shared row, not a rule violation, and
worth stating plainly because the brief asked for the loser's board selection to also be exactly 3.
It cannot be, on the same row, without recreating the union. Ties fall back to the player's
selection: deterministic, and on an equal-ranked tie usually the same three cards.

**Multiplayer was never affected** — `multiplayer-game.tsx:627-629` and `:717-719` set all three
highlight arrays to `[]`, so MP renders no highlights at all. The defect was solo-only.

## Task 3 — the invariant is now asserted

`utils/__tests__/omahaHighlight.test.ts`, 5 tests, all passing:

| test | scale |
|---|---|
| evaluator returns 2+3 on the photographed hand | 1 |
| four aces in hand → One Pair, not quads | 1 |
| evaluator holds 2+3 across random deals | **2,000+ evaluations**, 2P/3P/4P |
| highlight set is 2 + 2 + 3 across random deals | **700+ boards**, 2P/3P/4P |
| the photographed board shows 2 + 3 | 1 |

Board counts re-derived via `getBoardCount()` inside the test — 2P=4, 3P=3, 4P=2 — and asserted
against the dealer's output, so a change to either would fail here.

Two guards worth noting, because a passing test that examined nothing is this project's signature
failure:

- `expect(checked).toBeGreaterThan(2000)` — a loop that silently ran zero times cannot report pass.
- `expect(unionWouldHaveBeenWrong).toBeGreaterThan(0)` — the test recomputes the **old** union and
  asserts it really did exceed three marks on real deals. If it could not, the test would be
  guarding a regression that cannot happen.

### Verified on the live build

Per board the reveal marks 2 (your hand) + 2 (opponent's) + 3 (community) = **7**, so the page total
must be exactly `boards × 7`:

| engine | 2P (4 boards) | 3P (3 boards) | 4P (2 boards) |
|---|---|---|---|
| chromium | **28 = 28** ✓ | **21 = 21** ✓ | **14 = 14** ✓ |
| webkit | tab crashed | **21 = 21** ✓ | **14 = 14** ✓ |

5 of 6 configurations exact, 0 mismatches. WebKit 2P crashed the tab — a harness failure, not a
result; the same bundle serves all six and the other five agree.

**A measurement mistake worth recording.** The first version of the live probe grouped cards into
rows and asserted "a row of 5 is the board". It found **nothing** — every card matches *two* nested
elements (outer frame, inner face), so a 5-card row measured as 10 and no row ever looked like a
board. It reported `NO BOARD ROWS SEEN — failed run, not a clean one` and exited non-zero, which is
the only reason the flaw was visible rather than being read as "0 violations, pass". The committed
probe uses the total-count invariant instead, which needs no row detection.

## DB state

All probe rows removed and verified. This run's practice hands created 15 `hand_history` rows
across 9 devices, plus 4 leaderboard rows; all deleted.

```
hand_history 151 (baseline) | leaderboard 782 | bot_ rows 0 | probe- rows 0
bug_reports 250 | rooms 11 (11/11 clean) | room_players 0
```

No `game_rooms` / `room_players` rows deleted.

## MACHINE

`tsc` crashed **twice** locally with 0xC0000005 and zero output — no verdict, so CI is the verdict:
its `tsc-output` artifact for `01a0e50` is **0 bytes, clean**. The memory test is still not run.

=== STRATEGIST HANDOFF — 4+2 HIGHLIGHT ===
TASK 1 EVALUATOR:
  - enforces 2-from-hand and 3-from-board? YES, structurally. utils/handEvaluator.ts:59
    PLAYER_COMBO_IDX = C(4,2) = 6 index pairs; :61-65 BOARD_COMBO_IDX[5] = C(5,3) = 10 index
    triples. Illegal splits are unrepresentable — the rule is in the data structure, not a check.
  - 60 candidates (correct) or 126? SIXTY. 6 x 10. Not a Hold'em best-five-of-nine.
  - tested against J♣8♥2♣Q♠6♣ / A♠A♥A♦A♣: playerCardsUsed 2, boardCardsUsed 3, name "One Pair".
    Four aces in hand and it does NOT return quads — a Hold'em evaluator would. Matches the
    screenshot's ONE PAIR label.
  - VERDICT: EVALUATOR CORRECT. Rankings, results and hand_history are unaffected. No stop needed.
TASK 2 HIGHLIGHT:
  - source: app/game.tsx:681 — it built boardHighlightIds as the UNION of the player's three board
    cards and the bot's three.
  - does the UI re-derive? NO — it renders the evaluator's own selections. The bug was COMBINING
    two correct answers onto the one shared community row: the two sides rarely pick the same
    three, so the union showed 4 or 5. Overlap of two = exactly the photographed 4.
  - fix: the shared row now carries the WINNER's three (tie -> player's). The loser's three are not
    shown — one shared row cannot carry both without recreating the union. Hand rows were always
    correct at 2 each, which is why it presented as 4+2.
  - MP was never affected: multiplayer-game.tsx:627-629/:717-719 set all highlight arrays to [].
TASK 3 INVARIANT:
  - test added: utils/__tests__/omahaHighlight.test.ts — 5 tests, all passing.
  - hands run: 2,000+ evaluator checks and 700+ highlight sets over random deals at 2P/3P/4P, board
    counts re-derived via getBoardCount(). Winner AND loser hand rows both asserted at 2.
  - guards: asserts the loop actually ran (>2000), and asserts the OLD union really did exceed
    three marks on real deals — so the regression it guards is reachable, not theoretical.
  - any board still != 2+3? NO. Live: marked cards = boards x 7 exactly — chromium 28/21/14 and
    webkit 21/14. webkit 2P crashed the tab (harness, not a result). 5 of 6 exact, 0 mismatches.
LIVE: main 01a0e50 | deployed (run 31948496200, success) | chromium + webkit.
tsc: local CRASHED twice (0xC0000005, zero output — no verdict). CI artifact 0 bytes = CLEAN.
HANDOFF: file + vamos_handoffs slug 2026-08-16-omaha-highlight + chars, code-point match? Y
WHAT I DID NOT CHECK: the in-game reveal screen (BoardReveal) — I verified /results, where the
  same boardHighlightIds are consumed, but did not count marks mid-reveal where Roye's screenshot
  was taken; webkit 2P never completed; I did not quantify how often the old union exceeded three
  marks (the test asserts only that it does); the loser's board selection is now unshown by design
  and no one has judged whether that reads worse than the union did.
=== END ===
