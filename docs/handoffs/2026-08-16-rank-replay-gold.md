# 2026-08-16 — Rank, replay, and the gold

Shipped `94966a1` plus one migration. `tsc` exit 0. Two fixes applied, one metric decision left
with Roye, and the gold measured rather than adjusted.

## Task 1 — rank: the bot filter, and the metric

### Which overload each screen calls — and none is on the unfiltered one

| caller | call | resolves to | bots excluded |
|---|---|---|---|
| `app/(tabs)/index.tsx:920` | `{ p_device_id }` | `get_leaderboard(text, int)` | **yes** |
| `utils/leaderboard.ts:119` | `{ p_device_id, p_limit: 20 }` | `get_leaderboard(text, int)` | **yes** |
| `app/rank.tsx:66` | `get_player_rank_by_device` | — | **yes** |

Those are the only three. **No client caller reaches the unfiltered `get_leaderboard(p_limit)`**,
and it returns a different shape anyway (`{total_players, players[]}` vs a bare array), so a caller
could not drift onto it by accident.

**And there are no bot rows to leak: `bot_%` count is 0 of 785.** The cleanup already ran. So the
missing filter was latent, not active — no tester has ever seen a bot in a human leaderboard.

Fixed regardless, per the brief's second option — the filter belongs on both so the two overloads
cannot disagree about who counts as a player. Applied to the row set **and** to `total_players`, so
the count cannot contradict the list.

**Verified with a row that exists**, because an unexercised filter is an unverified one: inserted
`bot_probe_zz` with 999,999 chips — which would have ranked #1 — and both overloads excluded it,
with `total_players` unchanged at 785. Probe row deleted.

### A dead filter worth knowing about

`app/(tabs)/index.tsx:926` still runs:

```js
const entries = raw.filter((e) => !String(e.device_id ?? '').startsWith('bot_'));
```

`device_id` is no longer emitted by `get_leaderboard` (removed 2026-08-15), so `e.device_id` is
always `undefined`, `String(undefined ?? '')` is `''`, and **every row passes**. It is a no-op that
reads as protection. Harmless today — the server filters and there are no bots — but its comment
("the server rank includes bots until the DB cleanup runs") is stale, and the cleanup has run. Left
in place: it sits in the home rank widget and removing it is a behaviour change I would rather not
bundle into a colour-and-copy brief. Flagged for a sweep.

### The metric — NOT chosen here

The contradiction is real and it is not a display bug: the badge and the list answer different
questions.

| source | orders by |
|---|---|
| `get_player_rank_by_device` (the "#5" badge) | **ELO** |
| `get_leaderboard(device, limit)` (the list) | **total_chips** |

**Chips** — matches what the list already shows and what a player watches climb after every hand.
It is volume as much as skill: time played raises it, and the economy caps shipped this week bound
how fast. It is also the number every other surface already displays.

**ELO** — measures skill rather than hours, is what `update_leaderboard_elo` already maintains on
every real hand, and does not reward grinding. But nothing else on screen shows it, so the list
would have to change to match, and a player's rank would stop tracking the number they watch go up.

Whichever is chosen, **one source of truth** — two functions computing rank on two keys is exactly
how this arose. The metric is Roye's call; I have not picked one and changed nothing about either
ordering.

## Task 2 — `/replay`: an empty state, not a fault

**How a player arrives:** `app/hand-history.tsx:305` — `router.push('/replay?id=' + id)` from the
"▶ REPLAY HAND" button. That path **always** supplies an id. A share link carries one too
(`ShareSection.tsx`). The only ways to reach the bare screen are a cold URL with no id, or an id
whose hand is gone.

**Did it depend on `boards_data`? NO.** `replay.tsx:18` imports `getHand` from
`utils/handHistory`, which is **AsyncStorage** (`caps_hand_history`) — not the database. Replay
never read `boards_data`, so deleting that write this week did not touch it. Replay has a data
source and it is intact. That was the finding that could have been much bigger, and it is clean.

So it is an empty state that looked like breakage: 21 characters and a back arrow. Now it says
which of the two cases happened, explains where replays live, and offers the place hands are:

| case | heading | explanation |
|---|---|---|
| no id | *No hand selected* | Open a hand from your history to replay it card by card. |
| stale id | *This hand is no longer saved* | Replays are kept on this device, and older hands make way for newer ones. |

`HAND HISTORY` is the primary route; `← BACK` is demoted to a ghost button so the useful action is
the obvious one. Both keep the 44px target rule.

**Verified live, both engines, 390 and 320, both cases** — 8 configurations: distinct copy each
time, 2 buttons, **0 sub-44px targets**, 21 chars → 93 (no id) / 122 (stale id).

## Task 3 — the gold: measured, not changed

Painted RGB, sampled from `getComputedStyle` on the live build with the first opaque backdrop
behind each, on both engines at 390 and 320. **The gold is not being shifted by either engine** —
chromium and webkit paint identical values.

| paint | token | where | on | contrast |
|---|---|---|---|---|
| `rgb(201,168,76)` | `#c9a84c` gold | winner border ×30-32, chip counts ×20, buttons, badges | `rgb(22,25,34)` board / `rgb(10,10,10)` root / `rgb(28,31,38)` row | **7.22–8.66:1** |
| `rgb(255,215,0)` | `#FFD700` | `✅ YOU WIN`, `⭐ +225 XP`, borders | `rgb(10,10,10)` / `rgb(22,25,34)` | 12.52–14.12:1 |
| `rgb(232,201,106)` | `#e8c96a` goldLight/goldBright | hand names, claim toast | `rgb(10,10,10)` / `rgb(22,25,34)` | 10.86–12.25:1 |
| `rgb(139,105,20)` | `#8B6914` | `★ Best hand from…` text, a hairline border | `rgb(22,25,34)` / `rgb(10,10,10)` | **3.45–3.89:1** |
| `rgb(245,181,70)` | `#F5B546` | `🤖 Practice vs…` | `rgb(10,10,10)` | 10.92:1 |
| `rgb(240,223,192)` | cream | card rank/suit glyphs | `rgb(22,25,34)` | 13.39:1 |

### It is neither hue nor contrast — it is saturation, and there are five golds

`#c9a84c` has **good** contrast everywhere it is used: 7.22:1 to 8.66:1, comfortably above WCAG AA.
Contrast is not the problem, so the usual "go 2-3× darker" reflex is the wrong instinct here — it
would make the dull one duller.

What the numbers show is that **five different golds are on screen at once**, and on `/results` two
of them are adjacent: `#FFD700` (fully saturated, S=100%) renders `✅ YOU WIN` right beside the
`#c9a84c` winner border (S≈54%, hue 46°). Next to a pure gold, a half-saturated amber reads as
brass or chrome. That is the reported effect, and it is a *relative* judgement — which is why it
survives having perfectly good contrast against its own background.

The one genuine failure is `#8B6914` at **3.45:1**, below AA for its `★ Best hand from…` text.
That is a separate, smaller defect from the one reported.

### Proposal — not applied

Raise the winner gold toward the value already in the palette rather than inventing one:
**`#c9a84c` → `#e8c96a`** (`goldLight`/`goldBright`, measured at 10.86–12.25:1). It closes the gap
with the adjacent `#FFD700` without adding a sixth gold.

It would touch **one** of the three mechanisms — the `borderColor` literal at `Card.tsx:456` and the
matching `/results` `v2Border`. It must **not** be applied to `winGlow` (`#FFD700`, a shadow) or the
community group frame, which were confirmed separate earlier; a find-and-replace across `#c9a84c`
would also hit `Card.tsx:682` and unrelated chrome.

**Nothing recoloured.** The brief said measure first and list the sites, and the measurement changed
what the fix should be — so this needs a decision, not a commit. **The 3px winner border width is
untouched.**

## DB state

Cleaned and verified. `bot_probe_zz` deleted after proving the filter. Also removed **13 rows this
run's own browser contexts created** — 6 devices that completed a practice hand (`hand_history`
back to its 151 baseline) and 7 leaderboard rows with `hands_played: 0` and the 2530 default
wallet, all inside the probe window. A real player does not leave a row that never played.

```
leaderboard 782 | hand_history 151 | bot_ rows 0 | probe- rows 0
bug_reports 250 | rooms 11 (11/11 clean) | room_players 0
```

No `game_rooms` / `room_players` rows deleted.

## MACHINE

`tsc` exit 0 both times it ran this session; memory test still not run, so local stays PROVISIONAL.

=== STRATEGIST HANDOFF — RANK / REPLAY / GOLD ===
TASK 1 RANK:
  - which overload does each screen call? index.tsx:920 and leaderboard.ts:119 both pass
    p_device_id and resolve to get_leaderboard(text,int) — the FILTERED one. rank.tsx:66 uses
    get_player_rank_by_device. NO caller is on the unfiltered get_leaderboard(p_limit).
  - bot rows visible in a human leaderboard anywhere? NO — bot_% count is 0 of 785, the cleanup
    already ran. The missing filter was LATENT. Fixed anyway: added the bot exclusion to the
    (p_limit) overload, on the rows AND on total_players. Verified by inserting bot_probe_zz with
    999,999 chips (would have been rank #1) — excluded by both overloads; probe row deleted.
  - ALSO: index.tsx:926 filters on e.device_id, which get_leaderboard no longer emits, so it is a
    NO-OP that reads as protection. Harmless today. Flagged, not changed.
  - metric trade-off for Roye — CHIPS: matches the list and the number players watch climb, but is
    volume as much as skill. ELO: measures skill, already maintained by update_leaderboard_elo on
    every real hand, but nothing else on screen shows it, so the list would have to change and rank
    would stop tracking the visible number. Whichever is chosen, ONE source of truth.
  - metric NOT chosen by the bot? CONFIRMED — nothing about either ordering was changed.
TASK 2 REPLAY:
  - arrival: hand-history.tsx:305 pushes /replay?id=<id> from "▶ REPLAY HAND"; share links carry an
    id too. The normal path ALWAYS supplies one.
  - did replay depend on boards_data? NO. replay.tsx:18 reads getHand from utils/handHistory =
    AsyncStorage, never the DB. Deleting the boards_data write did not affect it.
  - EMPTY STATE, not a missing data source. Now distinguishes "No hand selected" from "This hand is
    no longer saved", explains replays are device-local, and offers HAND HISTORY as the primary
    route with BACK demoted. Verified both engines, 390 and 320, both cases: 0 sub-44px targets,
    21 chars -> 93/122.
TASK 3 GOLD:
  - sites and backdrops: #c9a84c rgb(201,168,76) on board rgb(22,25,34) / root rgb(10,10,10) / row
    rgb(28,31,38) — winner border x30-32, chip counts x20, buttons, badges. #FFD700 rgb(255,215,0)
    on YOU WIN and XP. #e8c96a rgb(232,201,106) on hand names. #8B6914 rgb(139,105,20) on "Best
    hand from". #F5B546 rgb(245,181,70) on the practice pill.
  - painted RGB, both engines, 390 and 320: IDENTICAL on chromium and webkit at both widths — no
    engine shift. Contrast: #c9a84c 7.22-8.66:1, #FFD700 12.52-14.12:1, #e8c96a 10.86-12.25:1,
    #8B6914 3.45-3.89:1.
  - hue or contrast? NEITHER — SATURATION, plus inconsistency. #c9a84c has good contrast
    everywhere (7.2-8.7:1, above AA), so "go darker" is the wrong reflex. FIVE golds are on screen
    at once and on /results two sit adjacent: fully-saturated #FFD700 renders YOU WIN right beside
    the half-saturated #c9a84c winner border, so the amber reads as brass. Separately, #8B6914 at
    3.45:1 IS a real contrast failure on "Best hand from" text — a smaller, different defect.
  - proposed value: #c9a84c -> #e8c96a, already in the palette as goldLight/goldBright, so no sixth
    gold. Touches ONE mechanism: the borderColor literal at Card.tsx:456 and the matching /results
    v2Border. NOT winGlow (#FFD700 shadow) and NOT the community group frame. NOT APPLIED — the
    measurement changed what the fix should be, so it needs a decision.
  - 3px winner border width unchanged? YES — untouched.
MACHINE: tsc exit 0; memory test still not run, local remains PROVISIONAL.
tsc: exit code 0 (checked by exit code, not output).
HANDOFF: file + vamos_handoffs slug 2026-08-16-rank-replay-gold + chars, code-point match? Y
WHAT I DID NOT CHECK: whether ELO and chips actually disagree for a specific player (I compared the
  ORDER BY keys, not two rankings of the same device); the #8B6914 3.45:1 failure was measured but
  not fixed; I did not remove the dead bot filter at index.tsx:926; the gold was measured on home,
  leaderboard and results only — not on the 14 unreviewed screens.
=== END ===
