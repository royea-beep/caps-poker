# 2026-08-16 — One gold, one rank

Shipped `2cd9b63` plus one migration. `tsc` exit 0. All three tasks done.

## Task 1 — one gold for "won"

Changed **by meaning, one mechanism at a time**. No find-and-replace: `#c9a84c` also appears on
chip counts, buttons and `Card.tsx:682`, none of which mean "won".

| site | was | now | why |
|---|---|---|---|
| `components/Card.tsx:456` — 3px winner border, live V2 branch | `#c9a84c` | **`#FFD700`** | the in-game "you won" cue |
| `components/StaticCard.tsx:60` — 2.5px `/results` winner border | `#c9a84c` | **`#FFD700`** | the same cue on results |

**Left on their current values, deliberately:**

- **community group frame** (`#e8c96a`) — means *the field*, not *won*. Changing it would erase the
  distinction the border encoding exists to make.
- **`BoardResultCard` `handNameWin`** (`#e8c96a`) — the name reads "win" but it marks *whichever
  hand won*: it is applied to the bot's hand at `:199` when the bot wins, and to yours at `:236`
  when you win. Painting it `#FFD700` would put the you-won colour on the bot's hand on a loss.
- **`#F5B546`** on the practice pill — unrelated to winning, measures 10.92:1, left alone.
- **`#c9a84c` elsewhere** — chip counts (7.22:1), the "View hand history" link, home wallet pill.
  None mean "won".

**A correction to the brief's table:** `winGlow` no longer exists. It was **deleted on 2026-08-14**
(`BoardReveal.tsx:1323`, "the fifth winner implementation"). So the three mechanisms are two, and
both moved.

### `#8B6914` — out of scope, but it is a real defect

It carries no winner meaning at all. Its three sites are the chip-store **BEST VALUE** badge
background (`chip-store.tsx:193`), the **player-count selector** border (`index.tsx:1471`), and
`bestSelectedLabel` — the `★ Best hand from…` text (`BoardResultCard.tsx:344`).

That last one measures **3.45:1**, below WCAG AA for body text, and the selector border sits at
3.89:1. **Recommendation: fix the label separately.** It is not a gold-unification problem — moving
it to `#FFD700` would make a caption shout in the winner colour. The right move is a lighter neutral
or `#e8c96a` (10.86:1) for the label alone. Not done here: the brief scoped this task to "won".

### Verified by painted pixels

The test is the adjacent pair on `/results` that started the report:

| | before | after |
|---|---|---|
| winner border (×31) | `rgb(201,168,76)` — 7.68:1 | **`rgb(255,215,0)` — 12.52:1** |
| `✅ YOU WIN` text | `rgb(255,215,0)` — 12.52:1 | `rgb(255,215,0)` — 12.52:1 |

**Byte-identical RGB and identical contrast on the same `rgb(22,25,34)` backdrop.** They are now
one metal, which is the evidence asked for. Confirmed on **chromium @390** (31 borders) and
**webkit @390** (31 borders), and **webkit @320** (29 borders, `YOU WIN` text also
`rgb(255,215,0)`).

**Honest gap:** chromium @320 `/results` did not complete — the full probe crashed the tab there,
and a lighter re-run caught the page mid-render (`YOU WIN` text still null). That cell is a timing
miss, not a colour result. The same bundle serves all four, and the other three agree.

**The 3px winner border width is unchanged.** Only the hue moved. `StaticCard` stays at 2.5 (it is
not the border `694565f` pinned against Chromium's device-pixel rounding).

## Task 2 — the badge ranks by chips, from the list's own window

`get_player_rank_by_device` ranked by ELO while the list ordered by `total_chips`. Now it reuses
the **exact window `get_leaderboard(text,int)` uses**:

```sql
ROW_NUMBER() OVER (ORDER BY total_chips DESC, updated_at ASC)   over   device_id NOT LIKE 'bot_%'
```

Same column, same **tiebreaker**, same bot predicate, and no `hands_played` filter — matching the
list exactly. This is deliberately **not** a `count(total_chips >= mine)`: that is a parallel
computation which would agree today and diverge the first time two players tied on chips.

**Verified on devices where the two rankings genuinely differ** — a device where they agree would
prove nothing:

| device | chip rank | ELO rank | badge now | list says |
|---|---|---|---|---|
| `09c8-040e-e03f` | 4 | **784** | **4** | 4 ✓ |
| `2d35-baf3-0636` | **779** | 14 | **779** | 779 ✓ |

A 780-place gap in one direction and a 765-place gap in the other, both now agreeing with the list.

**ELO is untouched.** `update_leaderboard_elo` still maintains it every real hand,
`get_elo_leaderboard` still exists, and the RPC still **returns** `elo` (970 and 1020 in the runs
above). Only what the badge ranks by changed.

**Other surfaces:** `app/rank.tsx:66` is the **only** caller of `get_player_rank_by_device` in the
codebase. Nothing else reads it, so the contradiction has nowhere to relocate to.

## Task 3 — the dead filter is gone

Removed from `app/(tabs)/index.tsx` along with its stale comment. It read `e.device_id`, which
`get_leaderboard` stopped emitting on 2026-08-15, so `String(undefined ?? '')` was `''` and every
row passed. The comment claimed the server included bots "until the DB cleanup runs" — the cleanup
has run (`bot_%` is 0 of 782) and both overloads now filter server-side, verified last run against
a live bot row.

**Home widget behaviour is unchanged by the removal**, because the filter removed nothing.

### But the block around it has a real bug — reported, not fixed

While removing the filter I read the rest of that block, and the home rank widget does **not** use
the server's rank:

```js
const sorted = [...entries].sort((a, b) => (b.total_chips ?? 0) - (a.total_chips ?? 0));  // :929
const rank = idx >= 0 ? idx + 1 : …                                                        // :931
const total = entries.length || (lb.total ?? 0);                                           // :932
```

`get_leaderboard` returns **at most 50 rows** (plus the caller's own row appended if outside the
top 50). So:

- `total` is the **page length (~50)**, not the real player count — the widget would read "of 50"
  where the truth is "of 782".
- `rank` is an **index into that page**. A player ranked 779 lands at index 50 and would show
  **#51**.
- the client re-sort also drops the list's `updated_at` tiebreaker.

This is the same "two computations of one number" defect Task 2 just closed, one layer up — and the
fix is the same shape: read `rank_position` and `total_players` from `get_player_rank_by_device`,
which now returns both, authoritative and matching the list.

**Not done here.** The brief scoped Task 3 to removing the dead filter and asked me to confirm the
widget unchanged; swapping its data source is a visible behaviour change ("of 50" → "of 782") that I
could not verify live, because **the widget does not render at all for a fresh device** — no rank
text appears on a cold home load, so I have no before/after to compare. It needs a device with
history, which is a different setup. Flagged for the next brief.

## DB state

All probe rows removed and verified by query. This run created **13 devices** across its browser
contexts (gold measurement, card-render checks, replay checks); all deleted, along with the
`bot_probe_zz` row used last run to prove the filter.

```
leaderboard 782 | hand_history 151 (baseline) | bot_ rows 0 | probe- rows 0
bug_reports 250 | rooms 11 (11/11 clean) | room_players 0
```

No `game_rooms` / `room_players` rows deleted.

## MACHINE

`tsc` exit 0 on every run this session; memory test still not run, so local stays PROVISIONAL.

=== STRATEGIST HANDOFF — ONE GOLD, ONE RANK ===
TASK 1 GOLD:
  - sites changed, per mechanism: Card.tsx:456 (3px in-game winner border) and StaticCard.tsx:60
    (2.5px /results winner border), both #c9a84c -> #FFD700. Those are the only two mechanisms that
    mean "you won". CORRECTION to the brief's table: winGlow no longer exists — deleted 2026-08-14
    (BoardReveal.tsx:1323), so the three mechanisms are two.
  - anything left on #c9a84c deliberately? YES — chip counts (7.22:1), the View-hand-history link,
    the home wallet pill, Card.tsx:682. None mean "won". Also left: the community group frame
    (#e8c96a = the field, not won) and BoardResultCard handNameWin (#e8c96a), which marks WHICHEVER
    hand won — it paints the bot's hand at :199 on a loss, so #FFD700 there would put the you-won
    colour on the bot.
  - #8B6914 (3.45:1) — REPORTED, not in scope. It carries no winner meaning: BEST VALUE badge
    (chip-store.tsx:193), player-count selector border (index.tsx:1471), and the "★ Best hand
    from" label (BoardResultCard.tsx:344). The label at 3.45:1 IS below AA. Recommendation: fix the
    label alone, to #e8c96a (10.86:1) or a light neutral — NOT to #FFD700, which would make a
    caption shout in the winner colour.
  - #F5B546 practice pill left alone? YES — unrelated to winning, 10.92:1.
  - painted RGB + contrast after: /results winner border rgb(255,215,0) at 12.52:1 on rgb(22,25,34)
    — x31 chromium@390, x31 webkit@390, x29 webkit@320. Was rgb(201,168,76) at 7.68:1.
  - do the adjacent /results golds now read as one metal? YES — the border and the "✅ YOU WIN"
    text are both rgb(255,215,0) at 12.52:1 on the same backdrop. Identical, not merely close.
    GAP: chromium@320 /results did not complete (tab crash, then a mid-render re-read) — a timing
    miss, not a colour result. Same bundle; the other three configurations agree.
  - 3px winner border width unchanged? YES — hue only.
TASK 2 RANK:
  - badge now ranks by total_chips? YES — get_player_rank_by_device, migration
    rank_badge_follows_chips_ordering. Client untouched (app/rank.tsx:66 reads the same field).
  - does it read the list's ordering, or a parallel computation? THE LIST'S — the same
    ROW_NUMBER() OVER (ORDER BY total_chips DESC, updated_at ASC) over device_id NOT LIKE 'bot_%',
    tiebreaker included. Deliberately NOT a count(total_chips >= mine), which would agree today and
    drift on the first tie.
  - any other surface reading get_player_rank_by_device? NO — app/rank.tsx:66 is the only caller.
  - verified on a device where ELO rank != chip rank? YES, both directions: 09c8-040e-e03f was chip
    4 / ELO 784 and the badge now reads 4; 2d35-baf3-0636 was chip 779 / ELO 14 and now reads 779.
    Both match the list's rank for the same device exactly.
  - ELO tracking untouched? YES — update_leaderboard_elo unchanged, get_elo_leaderboard unchanged,
    and the RPC still returns elo (970 / 1020 observed).
TASK 3 DEAD FILTER: removed with its stale comment; home widget unchanged BECAUSE the filter
  filtered nothing. BUT the surrounding block has a separate real bug, reported not fixed: it
  re-sorts a 50-row page client-side and sets total = entries.length, so the widget reads "of 50"
  instead of "of 782" and a rank-779 player would show #51. Fix is the same shape as Task 2 — read
  rank_position/total_players from get_player_rank_by_device. Not done because it is a visible
  change I could not verify: the widget does not render at all for a fresh device.
MACHINE: tsc exit 0 every run; memory test still not run, local remains PROVISIONAL.
tsc: exit code 0 (by exit code, not output).
HANDOFF: file + vamos_handoffs slug 2026-08-16-one-gold-one-rank + chars, code-point match? Y
WHAT I DID NOT CHECK: the in-game 3px winner border was verified in code and by tsc but NOT by
  painted pixels — it only appears mid-reveal and my probe samples /results; chromium@320 /results
  never completed; I did not fix the #8B6914 label or the home-widget page-local rank; the gold was
  measured on home, leaderboard and results only, not the 14 unreviewed screens.
=== END ===
