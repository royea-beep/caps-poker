# 2026-08-12 — Board count, the 403, the Bot label

Shipped `1c647c7` on `main`, deployed, verified on live on both engines.

## Task 1 — 3 players dealt 4 boards: **MISREAD. Closed.**

The rule, re-derived from source rather than from the brief: `getBoardCount()`
(`constants/gameConfig.ts:102`) returns 3 for three players, 2 for four, else 4. 2=4 / 3=3 / 4=2.

**What the room said.** `YYPT`, the room both MP hands used, is `max_players: 2`,
`game_config: {"numberOfPlayers": 2}`. A two-player room. Four boards is correct, and the
`boards_total = 4` in `hand_history` is correct with it. Nothing to fix.

**Why the report happened.** `app/game.tsx:122`:

```js
const practicePlayers = isPractice ? (parseInt(players ?? '', 10) as 2 | 3 | 4) : null;
```

The `players` parameter is parsed **only when `isPractice` is true** — by design, the comment at
`:175` calls it a local practice override that is never persisted. My probe requested
`/game?players=3` *without* `practice=true`, so `practicePlayers` was null, `:176` fell through to
`config.numberOfPlayers` (`DEFAULT_CONFIG` = 2), and `getBoardCount(2) = 4`. The game was never a
three-player game. The URL asked; the app correctly ignored.

**Where each route derives the count.**

| route | derivation |
|---|---|
| solo | `game.tsx:178` — `getBoardCount(numberOfPlayers)` |
| MP table | `multiplayer-game.tsx:168` — `boardsParam.length`, i.e. trusts what the host dealt |
| MP host deal | `realtimeMultiplayer.ts:560` — `this.clients.size` → `dealNewHand(playerCount, config)` |

The MP screen does **not** call `getBoardCount`; it renders whatever the host dealt. That is
defensible (host-authoritative), and the host's count comes from the real connected client count,
not from a URL.

**Measured, not just read** (`tests/board-count-rule.mjs`, counts rendered `BOARD n` labels):

| case | governing players | expected | dealt |
|---|---|---|---|
| practice `players=2` | 2 | 4 | **4** |
| practice `players=3` | 3 | 3 | **3** |
| practice `players=4` | 4 | 2 | **2** |
| NON-practice `players=3` (the report) | 2, from stored config | 4 | **4** |

Practice and MP agree for the same player count. Every case obeys the rule.

### One thing worth knowing

`utils/deck.ts:41-42`, the function that actually deals, **inlines** the rule instead of calling
the helpers:

```js
const cardsPerPlayer = playerCount === 2 ? 16 : playerCount === 3 ? 12 : 8;
const boardCount     = playerCount === 2 ?  4 : playerCount === 3 ?  3 : 2;
```

The values are correct and match `getBoardCount`/`getCardsPerPlayer` exactly, so this is **not** a
defect today. But CLAUDE.md's first hard rule is "NEVER hardcode board counts — use
`getBoardCount()`", and the dealer is the one place that does. Two sources of truth for the rule
that has already been stated inverted three times. Flagged, not changed — changing the dealer was
not in scope and the values are right.

## Task 2 — the `hand_history` 403: **removed the insert**

**Mechanism, confirmed.** The only policy on the table is `users_own_hh`:
`auth.uid() = user_id`, `polcmd = '*'` (all commands). CAPS is device-anonymous, so `auth.uid()`
is NULL, `NULL = user_id` is never true, and the anon insert was always rejected. The RPC at
`results.tsx:569` is `SECURITY DEFINER`, which is exactly why its row lands while this one never
did. Both halves confirmed against the live catalogue.

**Is anything reading `boards_data`? No — and it was never written.**

- `boards_data` is non-null in **0 of 146 rows**. The insert has not succeeded once, ever.
- `get_hand_history`, the only reader RPC, selects `hole_cards`, `community_cards`, `result`,
  `winning_hand`, `pot_size`, `chips_delta`, `opponent_name`, `is_all_in`, `created_at`. It never
  selects `boards_data`.
- No `.ts`/`.tsx` references the column apart from the write itself.

So the earlier phrasing — "`boards_data` is silently discarded" — overstated it. Nothing was being
lost, because nothing was ever stored and nothing wants it.

**Recommendation, and what was done.** Of the three options, the third applies: stop writing it.
Deleted the block at `results.tsx:376-400` (deleted, not `{false && …}`), leaving a comment
recording the mechanism and the evidence so it is not re-added. The RPC stays the single writer.

Not replaced with an RLS policy: that would widen anon's direct table access in order to store data
no consumer wants — against the pattern the security work has followed. Not folded into
`record_hand_result_d` either, for the same reason: there is no reader to serve. **If per-board
replay data is ever actually wanted, add it to the RPC** so `hand_history` keeps one writer.

**Cost of doing nothing** (had it been left): one guaranteed-failing HTTPS round trip per real hand,
403 noise in logs, and a block of code that reads as if it persists replay data while persisting
nothing — the kind of thing that gets trusted later. No user-visible symptom, no data loss.

**Verified on live, both engines:** a full real-chip hand start to `/results` produced
`supabase 4xx []` — zero errors of any status, `hand_history` 403s: 0. Before this, every real hand
produced one.

## Task 3 — REPORT ONLY: the "Bot" label on human opponents

Source: `components/BoardResultCard.tsx:178`.

```jsx
{multiBot ? `Bot ${botIdx + 1}` : 'Bot'}
```

**It does not distinguish bot from human at all.** The literal is unconditional — no mode check, no
prop, no name. Multiplayer opponents arrive through the same `allBotCards` array as bots and are
labelled identically, so a human opponent is called "Bot" on every board row.

The real name is available and already used elsewhere on the same screen:
`results.tsx:1273-1276` renders `🏆 You beat {storeOpponentName}!` / `Defeated by
{storeOpponentName}`, gated on `isMultiplayer && storeOpponentName`. It is simply never passed down
to the per-board row label.

Worth noting precisely: in both captured MP runs that header line did **not** render — the screens
went straight from the verdict to XP — so `storeOpponentName` was empty and "Bot" was the only
opponent identity shown anywhere. Whether that is a population failure or expected for anonymous
guests was not investigated.

Reported only. Nothing changed, nothing proposed. (`BoardResultCard` is on the do-not-touch list.)

## DB state

Captured before, restored to that, verified by query. `room_players` 0 · `hand_history` 146 ·
`bug_reports` 250 · rooms 11/11 clean · `54YU` left alone as instructed · both `CAPS Bot` rooms
(`CJTK`, `QW7U`) still `CAPS Bot`. All probe rows deleted.

## Carried forward

1. `utils/deck.ts:41-42` duplicates the board-count rule instead of calling `getBoardCount()`.
2. Whether `storeOpponentName` ever populates in MP, and the "Bot" label itself.
3. Whether any non-web client still sends a 4-arg `record_hand_result_d` call.
4. Google OAuth / anonymous-to-signed-in progression loss.
5. Performance and memory across 20 consecutive hands.
6. Audit blind spots: persisted profile still the most valuable open one.

=== STRATEGIST HANDOFF — BOARDS / 403 / BOT LABEL ===
TASK 1 BOARD COUNT:
  - game_config for YYPT (the room both MP hands used): max_players 2, numberOfPlayers 2.
  - MP derives it at multiplayer-game.tsx:168 as boardsParam.length — does NOT call getBoardCount;
    the host deals via realtimeMultiplayer.ts:560 from clients.size -> dealNewHand.
  - practice vs MP for the same count: AGREE. Measured 2->4, 3->3, 4->2.
  - VERDICT: MISREAD. game.tsx:122 parses `players` ONLY when isPractice, so my non-practice URL
    fell through to config.numberOfPlayers (default 2) and 4 boards was correct.
  - boards_total in hand_history is therefore CORRECT, not wrong. Nothing to fix.
  - BUT: utils/deck.ts:41-42 hardcodes the rule instead of calling getBoardCount(). Values agree
    today, so no defect — but it is a second source of truth for the rule.
TASK 2 THE 403:
  - anything reading boards_data? NO. 0 of 146 rows populated; get_hand_history never selects it;
    no client code references it. It never worked and has no consumer.
  - mechanism confirmed: only policy is users_own_hh (auth.uid() = user_id, ALL); anon uid is NULL
    so the insert always failed; the RPC is SECURITY DEFINER and bypasses it.
  - recommendation: STOP WRITING IT. Cost of doing nothing = a guaranteed-failing request per real
    hand plus code that looks like it persists replay data. No data loss either way.
  - implemented: YES, deleted results.tsx:376-400. Live check: supabase 4xx [] on both engines
    through a full real hand. If replay data is ever wanted, add it to record_hand_result_d.
TASK 3 BOT LABEL: components/BoardResultCard.tsx:178 | does NOT distinguish bot from human — the
  literal is unconditional | reported only, nothing changed. The real name exists and is used at
  results.tsx:1273-1276, but never reaches the row label; in both MP runs it was empty anyway.
LIVE: main 1c647c7 | deployed | #root OK chromium (1 kid/648 chars), webkit (1 kid/641).
DB: bug_reports 250 | hand_history 146 | room_players 0 | rooms 11/11 clean, 54YU left alone,
    CJTK/QW7U still 'CAPS Bot'.
HANDOFF: file + vamos_handoffs slug 2026-08-12-boards-403-bot-label + chars, matches file? Y
WHAT I DID NOT CHECK: whether storeOpponentName ever populates in MP; whether any non-web client
  sends the 4-arg RPC call; I did not change utils/deck.ts.
tsc: PASSED clean, no crash.
=== END ===
