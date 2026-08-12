# 2026-08-12 — Board rule dedupe, the Bot label, the opponent name

Shipped `00f83cd` on `main`, deployed, verified on live on both engines.

## Task 3 (done first) — does `storeOpponentName` populate in MP? **YES. My earlier answer was wrong.**

Last run I reported it "never populates". That was an inference from a missing header, and it was
incorrect. Corrected here with direct evidence.

**Where it is set.** Both MP paths write it, gated on a truthy name:

- host — `multiplayer-game.tsx:685`, from `clientArray.find(c => c.seat !== playerIndex)?.name`
- guest — `multiplayer-game.tsx:814`, from `connectedPlayers.find(p => p.seat !== playerIndex)?.name`

It is **not** persisted (`gameStore.ts:199`, outside `partialize`), and it is not cleared on a
normal finish — `multiplayer-game.tsx:999-1005` only calls `resetMultiplayer` on unmount when
`!completedRef.current`, so a completed hand keeps it.

**Evidence it populates.** After wiring the label through, a live MP hand rendered the opponent as
**`Host`** on all four board rows. The label resolves to `storeOpponentName || 'Player 2'`, so a
real name there proves the store held one. Separately, `multiplayer-game.tsx:331` computes its own
*local* `opponentName` with its own fallback chain — which is why the in-game screen showed
"Guest"/"Host" and is a different value from the store one. Two similarly named things; easy to
conflate, and I did.

**Why the "You beat X" header still never appears.** Its gate is `isMultiplayer && storeOpponentName`
(`results.tsx:1273`). The name is present, so the other half is failing. REMATCH is gated on
`!isMultiplayer` (`:1383`) and **REMATCH renders for client A**, which proves `isMultiplayer` is
FALSE there — `mpServer`/`mpClient` are null on that client by the time `/results` reads them. So
the header's absence and the name's presence are two different facts; one observation could not
separate them, which is exactly how I got it wrong the first time. Not chased further — the label
no longer depends on it.

## Task 1 — the board rule now has one source

`utils/deck.ts:41-42` inlined the mapping. Now:

```js
const cardsPerPlayer = getCardsPerPlayer(playerCount);
const boardCount = getBoardCount(playerCount);
```

`deck.ts` already imported from `constants/gameConfig`, so no new dependency edge and no
circularity. `constants/gameConfig.ts` is the only production source.

**Codebase-wide grep for a third copy.** Searched ternary chains keyed on player count, lookup
tables, and `=== 2 ? 4` / `=== 3 ? 12` shapes. Two more copies exist, **both in tests**:

| file | what |
|---|---|
| `utils/__tests__/responsive.test.ts:10,139` | `p === 2 ? 4 : p === 3 ? 3 : 2` |
| `utils/__tests__/stressTest.test.ts:45` | `playerCount === 2 ? 16 : ... : 8` |

**Left alone deliberately.** A test that calls the function it validates is tautological — an
independently restated expectation is the point of an oracle. Rewriting these to call
`getBoardCount()` would weaken them. No production hardcoding remains.

**Behaviour verified unchanged** (`tests/board-count-rule.mjs`, live, after deploy) — byte-identical
to the pre-refactor run:

| case | governing players | expected | dealt |
|---|---|---|---|
| practice `players=2` | 2 | 4 | **4** |
| practice `players=3` | 3 | 3 | **3** |
| practice `players=4` | 4 | 2 | **2** |
| NON-practice `players=3` | 2, from stored config | 4 | **4** |

Multiplayer confirmed separately: 2-player rooms dealt 4 boards across every MP hand this run.

Local suite: **2501 tests pass, 34/35 suites**. The one failure, `outsDistribution.probe.test.ts`,
is a worker abort (exit 134), not an assertion. It *does* import `dealCardsMultiplayer`, so I did
not assume: I stashed the `deck.ts` change and ran that suite against the original code — it aborts
identically. Pre-existing, unrelated.

## Task 2 — human opponents are no longer labelled "Bot"

`components/BoardResultCard.tsx` takes a new optional `opponentLabels?: string[]`, one per entry in
`allBotCards`:

```jsx
{opponentLabels?.[botIdx] ?? (multiBot ? `Bot ${botIdx + 1}` : 'Bot')}
```

Solo passes nothing and keeps the bot wording unchanged. `app/results.tsx` builds the labels in a
`useMemo` (the component is `React.memo`'d on prop identity):

- solo → `undefined`
- 2 players → `[storeOpponentName || 'Player 2']`
- 3-4 players → `Player 2` / `Player 3` / `Player 4`

**Why only the 2-player case takes the real name.** With one opponent, `opponentName`
unambiguously belongs to them. With 3-4 there is no established mapping from seat to position in
`allBotCards`, and guessing would print one human's name over another human's hand — worse than a
neutral label. The fallback is never "Bot" for a human, which was the whole point.

**Verified on a live MP hand.** Both clients rendered all four boards with `"Bot" x0`; the rows
read **`Host`**:

```
BOARD 1 | WIN | +50 | Host | 5♠ 5♥ 5♣ 8♠ … | YOU | J♠ J♥ J♦ 2♥ | Full House | ✅ YOU WIN
BOARD 2 | LOSS | -50 | Host | 8♥ 8♦ 6♦ 6♣ … | YOU | 2♦ 3♦ 3♣ Q♠ | Two Pair | ❌ YOU LOSE
```

### A measurement trap that nearly passed this off

Two earlier verification runs reported `"Bot" x0` and looked like success. They were reading a
~450-char `/results` page where the board rows had not rendered yet — zero rows scores zero "Bot"
just as convincingly as a fixed label. The probe now waits for `BOARD 1` and a body over 800 chars
before judging. A first attempt at that guard was itself wrong — it counted only `Bot` and
`Player N`, so a real name ("Host") scored INCONCLUSIVE — and now keys on whether the rows rendered
at all.

## DB state

Captured before, restored to it, verified by query. `room_players` 0 · `hand_history` 146 ·
`bug_reports` 250 · rooms 11/11 clean · `54YU` untouched · `CJTK`/`QW7U` still `CAPS Bot`. All
probe rows deleted (7 devices from this run's MP hands).

Noted in passing: rooms left by a completed MP hand carry `host_name = 'Player'`, so the default
player name appears to be the literal "Player".

## Carried forward

1. Why `isMultiplayer` is false at `/results` for one client — it suppresses the "You beat X"
   header and shows REMATCH on a multiplayer hand.
2. Whether any non-web client still sends a 4-arg `record_hand_result_d` call.
3. Google OAuth / anonymous-to-signed-in progression loss — next brief, highest user cost.
4. Progression systems actually being earned (Cups, Battle Pass, Achievements, Missions).
5. Performance and memory across 20 consecutive hands.
6. Audit blind spots: persisted profile still the most valuable open one.

=== STRATEGIST HANDOFF — DEDUPE / LABEL / NAME ===
TASK 1 BOARD RULE:
  - deck.ts now calls getBoardCount()/getCardsPerPlayer() — utils/deck.ts:45-46.
  - other hardcodings: TWO, both in tests — responsive.test.ts:10,139 and stressTest.test.ts:45.
    Left deliberately: a test that calls the function it validates is tautological. No production
    copy remains outside constants/gameConfig.ts.
  - values verified unchanged, live after deploy — practice 2/3/4 -> 4/3/2 | MP 2P -> 4 boards.
    Local suite 2501 pass; the one failing suite aborts identically with my change stashed.
TASK 3 OPPONENT NAME (done first):
  - set at multiplayer-game.tsx:685 (host) and :814 (guest), from the roster, gated on truthy.
    Not persisted; NOT cleared on a normal finish.
  - POPULATES. My last-run "never populates" was WRONG — inferred from a missing header. A live MP
    hand rendered the opponent as "Host". The header stays hidden for a different reason: its gate
    is isMultiplayer AND the name, and REMATCH rendering proves isMultiplayer is FALSE at /results
    for one client. Two facts, one symptom.
TASK 2 BOT LABEL:
  - wired: BoardResultCard.tsx opponentLabels prop; built in results.tsx useMemo at :150.
  - fallback: "Player 2/3/4" — never "Bot" for a human. Real name used only at 2 players, where
    there is exactly one opponent it can belong to; guessing at 3-4 could put one human's name on
    another human's hand.
  - verified live: both clients, all four boards rendered, "Bot" x0, rows read "Host".
LIVE: main 00f83cd | deployed | #root OK chromium (1 kid/724), webkit (1 kid/717).
DB: bug_reports 250 | hand_history 146 | room_players 0 | rooms 11/11 clean, 54YU untouched,
    CJTK/QW7U still 'CAPS Bot'.
HANDOFF: file + vamos_handoffs slug 2026-08-12-dedupe-label-name + chars, matches file? Y
WHAT I DID NOT CHECK: why isMultiplayer is false at /results for one client; the 3-4 player label
    path was never exercised on a live hand (no 3P/4P MP hand was played); whether any non-web
    client sends the 4-arg RPC call.
tsc: PASSED clean, no crash.
=== END ===
