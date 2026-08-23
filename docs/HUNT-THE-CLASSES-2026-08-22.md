# CAPS — HUNT-THE-CLASSES: the ELO tie, then every instance of the four (2026-08-22)

The ELO tie is fixed and proven end to end. The hunt then found **one new class-C screen**, **one
new class-A pair**, and **class B measured rather than asserted** — two counters of the same fact
that are 19 devices apart in production.

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 103.
- **Class A is not a bug, it is a habit.** `netChips > 0` appears 20+ times. Each one is a
  three-way outcome squeezed into a boolean, and every one of them silently calls a tie a loss.
- **Enumerate the RPCs, not the screens.** The `/stats` defect could not be found by the QA loop:
  that block renders only for a device *with* stats, and every harness device is new, so the loop
  always measured the empty state. Roye's instruction to enumerate RPCs is what surfaced it.
- **The DB proves class B; the code only suggests it.** Two counters of "wins" disagree on 19 of
  100 devices. That is not a code smell, it is a measurement.
- **NULL is a usable third state on an existing boolean parameter** — and it beats adding a
  defaulted argument, which makes a PostgREST *overload* rather than a replacement.
- Instrument tally: **3 failures**, all named.

## 1 — The ELO tie

**Client** (`app/results.tsx`): the outcome is now derived **once**, at the top of `ResultsContent`,
from boards won — and the headline, the multiplayer sub-header **and the ELO write** all read that
one value. It was previously computed in three places from two different inputs, which is the
class-B fault that produced the original tie defect.

```js
const p_won = handOutcome === 'tie' ? null : handOutcome === 'win';
```

**DB** (`update_leaderboard_elo(text, boolean)`): **NULL now means TIE.**

| outcome | elo delta | wins | games_played |
|---|---:|---|---|
| win | **+20** | +1 | +1 |
| **tie (NULL)** | **0** | **unchanged** | **+1** |
| loss | **−10** | unchanged | +1 |

Chosen over a `p_tie` parameter deliberately: a DEFAULTed third argument creates a PostgREST
**overload**, not a replacement, and two candidates for the same name is a PGRST203 ambiguity
waiting to happen. **Same signature, same return type, no overload.** Both existing callers pass a
real boolean, so nothing that calls it today changes behaviour.

**Guards intact — confirmed.** `econ_authz_probe`, `econ_rate_ok` and `econ_bind_ok` are all still
called, in the same order, before any write. `SECURITY DEFINER` and `search_path` unchanged.

Returning 0 also hides the badge: it renders only when `eloChange !== 0`, so a tie shows **no chip
at all** rather than a silent "0 ELO".

### Proven — all three branches, one device, read off the wire

Three MP hands in a row came up 3–0 / 2–0 / 3–0, so rather than keep rolling dice this played solo
non-practice hands and intercepted the actual request
([tests/elo-tie-proof.mjs](tests/elo-tie-proof.mjs)):

```
hand  1  YOU WIN    3 — 1   elo-badge=▲ 20 ELO   request={"p_device_id":"…","p_won":true}
hand  2  YOU LOSE   1 — 3   elo-badge=▼ 10 ELO   request={"p_device_id":"…","p_won":false}
hand  3  TIE GAME   2 — 2   elo-badge=(none)     request={"p_device_id":"…","p_won":null}
```

And what the database actually recorded for that device afterwards:

```
elo 1010   games_played 3   wins 1   win_rate 33
```

**1000 + 20 − 10 + 0.** The tie moved nothing, still counted as a game, and was not credited as a
win. Screen and storage agree.

## 2 — CLASS A, every site

| site | can it tie? | what happened | verdict |
|---|---|---|---|
| `results.tsx` ELO write | yes | tie scored as a **loss**, −10 both players | **FIXED** |
| `results.tsx` win streak | yes | tie called `resetWinStreak()` — a tie **broke your streak** | **FIXED** — a tie now neither extends nor ends it |
| `results.tsx` achievement `currentWinStreak` input | yes | tie passed `0`, zeroing the streak for the check | **FIXED** |
| `results.tsx` MP sub-header + headline | yes | fixed last sprint; now one source | **FIXED (prev)** |
| `hand-history.tsx` card + tabs | yes | `netChips >= 0` → tie shown as a **WIN**, green "+0" | **FIXED** |
| `replay.tsx` net line | yes | same line, same lie | **FIXED** |
| `results.tsx` battle-pass `isWinner` | yes | tie gets no *win* XP bonus | **correct as-is** — a tie is not a win |
| `utils/achievements.ts` `isWin` | yes | tie does not count toward `win_1`/`win_100` | **correct as-is** |
| `results.tsx` mission `games_won` | yes | tie not counted | **dead** — missions retired, 0 active |
| `results.tsx` analytics `won` / `result` | yes | tie logged as `lose` | **reported** — analytics only, pollutes funnel data |
| `multiplayer-game.tsx` club `won: delta > 0` ×4 | yes | tie recorded as not-won on club rows | **reported** — club rail |
| `game.tsx:791` solo hand record `won` | yes | tie recorded as not-won | **reported** |
| `record_hand_result_d` `CASE WHEN p_won` | yes | tie stored as `'lost'` | **reported** — see below |
| `results.tsx` win overlay, XP banner | yes | no overlay / not a winner on a tie | **correct as-is** |

### ⚠️ The stored outcome still cannot express a tie

`hand_history.result` has a CHECK constraint — `won | lost | folded | timeout`. There is **no value
for a tie**, so `record_hand_result_d` writes `'lost'`. Measured in production:

- **127 of 243** hand_history rows are net-zero
- of the **22** genuinely board-tied hands, **15 are stored `lost` and 5 `won`** — the same outcome
  recorded both ways
- 4 rows say `won` while the player won a *minority* of boards

Storing `'tied'` needs a constraint change **and** a decision about those 22 existing rows, so it
is reported rather than done. **The display is corrected regardless** — `/hand-history` and
`/replay` now derive from the boards, which are authoritative, with a neutral treatment for a tie.
The tab counts do too, so **All is deliberately not Wins + Losses**; that is the honest arithmetic.

## 3 — CLASS C: every RPC checked against its consumer

| RPC | emits | component reads | verdict |
|---|---|---|---|
| **`get_player_stats`** | `hands_won`, `biggest_win`, `win_rate`, `hands_played`, … | **`wins`, `best_hand`, `roi`, `vpip`** | ⚠️ **MISMATCH — FIXED** |
| `get_player_rank_by_device` | `has_row, elo, games_played, wins, rank_position, total_players` | same six | ✅ |
| `get_cup_collection` | `cups, total, earned, id, tier, name_he, color, progress, desc` | same | ✅ |
| `get_leaderboard` | `players, total_players`, rows with `display_name/player_name/is_me/rank` | same | ✅ |
| `claim_daily_reward` | `success, chips_earned, streak, …` | same three | ✅ |
| `claim_emergency_chips` | `ok, new_balance, reason, …` | `ok`, `new_balance` | ✅ |
| `get_starter_offer_for_device` | `eligible, chips, price_usd, days_remaining` | same four, all with fallbacks | ✅ |
| `get_sng_activity_feed` | `won, chips_won, ended_at` | same three | ✅ |
| `get_play_of_the_day` | `available, data, player, …` | `available`, nested `data.*` behind `??` | ✅ |
| `get_achievements_list_d` | — | — | ✅ fixed h94 |
| `get_daily_missions_d` | — | — | was broken; **retired** |

### ⚠️ `/stats` — the FIFTH screen in this class

`get_player_stats` returns `hands_won` and `biggest_win`. The component asked for `wins`,
`best_hand`, **`roi`** and **`vpip`** — and **not one of those four is emitted**. Verified by
calling the RPC against a real device, not by reading types. The screen rendered:

```
HANDS (DB)  0      sub "undefinedW"
WIN %       0%
ROI         NaN%
BEST POT    +undefined
```

…with **zero console errors**, which is what makes this class invisible.

**Fixed at the fetch boundary**, accepting both spellings so a future rename cannot re-break it.
**The ROI card is removed** rather than left showing NaN: nothing server-side has ever computed
ROI, and computing it in the component would be a second source of truth for a number the server is
supposed to own — class B, which is what this sprint is hunting.

## 4 — CLASS D: every explicit-literal adapter

| adapter | drops | verdict |
|---|---|---|
| `adaptRevealBoardsForReveal` (mp) | `playerBestCards`, `botBestCards` | **fixed last sprint** |
| `handRecordToShareData` (hand-history) | `playerBestCards`, `botBestCards`; zeroes all three highlight arrays | ⚠️ **structurally drops — but `HandRecord` never stored them**, so there is nothing to give. A shared/replayed hand therefore shows bare category names by construction. Reported, not a rename away from working. |
| `realtimeMultiplayer` HAND_READY / STATE_SNAPSHOT board literals | everything except `openCards` + `closedCardCount` | ✅ **deliberate** — this is the privacy design; sending the closed cards would leak them |
| `gameLogic.ts` ×3 board rebuilds | — | ✅ pre-evaluation; nothing evaluated exists yet to drop |
| `normalisePackage`, `normaliseDbStats` | by design | ✅ these are **validating whitelists at a fetch boundary**, the correct use of the shape |

## 5 — CLASS B: two places deciding the same fact

**Fixed:** `results.tsx` had the outcome in three places from two inputs (headline ← boards,
sub-header ← chips, ELO ← chips). Now one derivation, three readers.

**⚠️ Measured, not asserted — `leaderboard.wins` vs `hand_history`:**

| | leaderboard | hand_history |
|---|---:|---:|
| wins | 22 | 39 |
| games | 79 | 122 |
| devices disagreeing | **19 (wins) · 24 (games)** of 100 | |

Excluding practice — which deliberately skips `update_leaderboard_elo` — closes most of it
(32 practice rows), but **11 hands and 4 wins across 12 devices still drift**. The two writes are
separate network calls: the outbox can land a `hand_history` row on retry without the ELO call ever
being made. `check_achievements` counts `result='won'` from `hand_history`; `/rank` and the
leaderboard show `leaderboard.wins`. **A player can see both numbers and they will not match.**
Reported — reconciling them is architectural, not a line.

## 6 — MP hand labels: still unresolved after the time-box

Solo prints `"Two Pair, Jacks and Sixes beats Pair of Fives"`; MP still prints `"Two Pair beats One
Pair"`. Class D was the right suspect and I chased it properly. **Five links verified pass-through
this sprint:**

1. `useGameStore.setRevealData` — `set({ revealData: data })`, no rebuild
2. `applyDevRevealFixture` — a pass-through in production (`__DEV__` false, fixture env absent)
3. `onBoardReveal` — stores the payload verbatim
4. `<BoardResultCard board={board as any} …>` — passed straight through
5. `adaptRevealBoardsForReveal` — the one real drop, **fixed last sprint**

The edits are in the deployed bundle (read back: `playerBestCards:best5(s)` on the host,
`n?.bestCards` on the guest), the component demonstrably enriches when given the data (solo does it
on every hand, re-verified after every change today), and the labels are still bare. **Time-box
expired; cause not established.** It is an enrichment, not a defect — solo is correct and MP is
merely less rich — so it stays reported rather than claimed.

---

## FINAL CYCLE

| engine | 320 | 375 | 393 | 1280 |
|---|---|---|---|---|
| **webkit** | 4p · **2 boards** | 4p · **2 boards** | 3p · **3 boards** | 2p · **4 boards** |
| **chromium** | 2p · **4 boards** | 3p · **3 boards** | 4p · **2 boards** | 2p · **4 boards** |

Each engine covers all four widths and all three board counts. Every cell walks the whole first
session: overlay → tutorial → P1 dealt → P2 partly placed → P4 ready armed → **P5 reveal** →
results → 22 routes → zero-chip state.

**Self-test caught its planted defects in every run: confirmed** — all eight printed
`planted overflow caught=true  planted clip caught=true`.

**What the cycle found: NOTHING.** 8 of 8 cells: **0 findings, 0 `console.error`**. `pageerror` was
0 on three webkit cells and 1 on one (an `AbortError` from the harness aborting in-flight requests
as it walks 22 routes); 2–4 on chromium cells, all the autoplay `NotAllowedError` that handoff 101
proved benign by measuring an idle page at 0 on both engines.

Nothing these fixes touched broke two screens away: `/results`, `/hand-history`, `/replay` and
`/stats` all reported clean in every cell.

## Instrument failures — 3, all named

1. **Two browser crashes** (`Target crashed`) when the last two loop cells were run concurrently —
   webkit 320 and chromium 1280. Both passed cleanly when re-run one at a time. The machine cannot
   hold two headed browsers alongside the rest of this session's load.
2. **The `/stats` proof did not observe the block on webkit.** Chromium rendered it correctly
   (`HANDS (DB) 1 · 1W · WIN % 100% · BEST POT +50`, zero "undefined", zero "NaN"); webkit's run
   did not finish the hand in time, so the POKER IQ block never appeared. Both engines reported
   **0 "undefined" and 0 "NaN"** on the page. Recorded as **not observed on webkit** rather than
   claimed — the code path is shared, but that is an argument, not a measurement.
3. **Three MP hands in a row refused to tie** (3–0, 2–0, 3–0), which is why the ELO proof was moved
   to solo hands with a request interceptor. Not a defect — dice — but it cost a run and is the
   reason the proof takes the shape it does.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `purchases` **0** · daily reward
**150** · `emergency_chips_amount` **200** · `hand_rake_pct` **5** · `rewarded_ad_chips` **100** ·
`record_reward` and its clamp untouched · `verify_jwt` untouched · **missions still inactive (0 of
20 active, all 20 definitions kept)** · no `app_config` key added, deleted or edited · no
`game_rooms` or `room_players` row edited · `Card.tsx` untouched.

**DB changes, in full:** `update_leaderboard_elo` — NULL now means tie, same signature, all three
guards intact. **Nothing else.**

**Cleaned:** 15 harness devices (including the ELO-proof device, whose leaderboard row this sprint
created) plus the `test-elo-tie-probe` row, across `referral_links`, `referral_redemptions`,
`user_missions`, `hand_history`, `chip_transactions`, `daily_rewards`, `analytics_events`,
`device_identity` and `leaderboard`. Bindings back to **3** · `test-` devices **0** · leaderboard
**1,079**. Real player `6956-24d1-5ee4` **untouched** — 2,530 chips.

*(handoff: `vamos_handoffs` id 103 · shipped `main b70ff8c`, `d39d640`)*
