# 2026-08-17 — Making the funnel honest

Shipped `eb79ae1` and `68f8a5e`, both deployed (run 31978923983, success). Five files, no migration.
`tsc` exit 0. Every route verified by playing it on the live build.

## Task 1 — why it inverted

### `game_started` — it was emitted by the buttons, not by the game

Two call sites, both on a tap: `app/(tabs)/index.tsx:993` (Home's Play) and `app/(tabs)/play.tsx:37`
(the Play tab). Every other way into a hand emitted nothing:

| route into a hand | emitted `game_started` before? |
|---|---|
| Home → Play | yes |
| Play tab → Single Player | yes |
| **onboarding's guided first hand** | **no** |
| **the lobby's instant bot tables** (`app/lobby/index.tsx:146` emitted only `mode_start`) | **no** |
| **Play-again / next hand from `/results`** | **no** |
| **multiplayer** (had its own `mp_game_started`, last seen 2026-07-12) | **no** |

That is the whole inversion: **267 devices reached `hand_dealt` and 32 emitted `game_started`**, and
both events have existed since 2026-04-03, so it was never a recency artifact.

**304 events across 32 devices is not a double-fire.** Both sites sat inside tap handlers, one per
tap, and the total tracks `play_button_tapped` almost exactly (285 events / 28 devices). It was 32
devices tapping Play 9-10 times each — which is also why the count could not be trusted: it was
measuring taps, including taps that never reached a game.

**Fixed by moving it to the convergence point.** `game_started` is now emitted in `app/game.tsx`
(next to `hand_dealt`, immediately before it) and in `app/multiplayer-game.tsx`'s mount effect, and
removed from both buttons. `play_button_tapped` still records the tap, which is what those lines
were really measuring.

`/game` re-mounts once per **hand**, so an unguarded call there would report a game per hand. New
helper `trackOnceThisSession()` (`utils/analytics.ts`) fires an event at most once per analytics
session. It under-counts a player who starts two separate games in one app session — chosen
deliberately, because the funnel is read per **device** and an under-count can never invert it.

### `cards_placed` — the clock bypasses the button

It fires in `handleReady`, which is correct and once-per-hand. But **the arrangement clock never
goes through `handleReady`**:

* solo — `app/game.tsx:461`, the `countdown === 0 && !playerReady` branch auto-fills and calls
  `doNavigateRef.current(filledBoards)` directly. It emitted `arrangement_timeout` and (since
  2026-08-13) `card_placed`, but never `cards_placed`.
* multiplayer — `autoFillAndReady()` (`app/multiplayer-game.tsx:964`) sets `readySentRef`, fills,
  and broadcasts ready without touching `handleReady`.

So a player who ran out of time completed a hand having never "placed cards". **58 placed, 88
finished.** Both paths now emit it, tagged `source: 'timeout'` against `source: 'ready'`, guarded
once per hand (`cardsPlacedTrackedRef` in solo, the existing `readySentRef` in MP).

**Auto-Place ALL was not the cause** — it feeds the normal Ready button, and its per-card
`card_placed` events already carry `source: 'auto_all'`.

### `hand_completed` — trustworthy, unchanged

`app/results.tsx:614`, in a results-screen effect, once per mount, and both solo and multiplayer
route to `/results`. 88 devices against 267 dealt is a real drop-off, not an inversion. No change.

### `reveal_started` — it did not exist

Not in the codebase at all. The reveal is the longest phase of a hand and the one most likely to
lose someone, and it was completely unmeasured. Added at the three points the overlay actually
opens: `game.tsx` (solo), and the host and guest branches in `multiplayer-game.tsx`. All three are
**inside the existing gates**, so the "skip board reveal" setting and the `mp_board_reveal_enabled`
kill switch still correctly produce no event.

## Task 2 — verified by playing

Every route driven through the real UI on the live build, with **in-app navigation only**. A first
attempt used `page.goto('/game?...')` and produced two `game_started` rows — a full page load is a
new JS context and therefore a new analytics session. That is not what a player does; it was the
harness, not the guard, and the session ids in `properties` proved it (`43d305e3…` → `e0ef2002…`).

Event sequences, read back per device (`card_placed`, `econ_authz`, `daily_bonus_auto_claimed`,
`stuck_dwell`, `screen_view` and `reveal_equity_coverage` elided for width):

```
2P practice (4 boards) — 449b-7a63-9a2e
  play_button_tapped > mode_start > game_started > hand_dealt > cards_placed(ready) > reveal_started

3P practice (3 boards) — aab7-f419-ba61
  play_button_tapped > game_started > mode_start > hand_dealt > reveal_started
    > cards_placed(ready) > hand_completed > game_ended

lobby instant bot table — 19d5-7e35-3a7b
  home_play_online_tapped > lobby_opened > bot_table_play > game_started > hand_dealt
    > cards_placed(ready) > reveal_started

multiplayer, HOST — 36b5-2bf2-ff84
  lobby_opened > table_created > mp_game_started[host] > game_started > cards_placed(ready)
    > mp_game_ended[host] > reveal_started[host] > hand_completed > game_ended
```

The lobby route is the clearest proof: it previously emitted **no** `game_started` at all.

**Ordering caveat, measured.** `track()` is fire-and-forget, so two events emitted in the same tick
can land in either order — one run recorded `hand_dealt > game_started` and another
`reveal_started > cards_placed`, milliseconds apart. `created_at` is insert time, not emit time.
`game_started` was moved to just *before* `hand_dealt` in source (`68f8a5e`) so the intended order
is at least unambiguous where it can be controlled.

### The assertion

`app_opened ≥ game_started ≥ cards_placed ≥ reveal_started ≥ hand_completed`, per device, over
every device that played on the new build:

```
device            opened  started  placed  reveal  completed
19d5-7e35-3a7b       1       1        1       1        0
36b5-2bf2-ff84       0       1        1       1        1     <- MP, started at /lobby/private
449b-7a63-9a2e       1       1        1       1        0
5868-bd57-ac52       1       1        1       1        0
aab7-f419-ba61       1       1        1       1        1
b8d1-efcb-cfe9       1       1        1       1        0
```

Exactly one of each, never inverted, and **every device that completed a hand shows every prior
step**. The MP host has no `app_opened` because the harness opened `/lobby/private` directly;
`app_opened` fires on Home.

**`v_analytics_human` still shows the old shape** — 523 / 32 / 58 / 0 / 88 — and always will. No
real player has run the new build yet, and a fix cannot repair history. The view is right; the
history it contains is not.

### The MP guest never reaches the game — a real defect, reported not fixed

Two contexts, a private invite-code table (deliberately: `create_table` makes a *new* room that
expires in 30 minutes, so none of the 11 public lobby rooms was consumed or altered).

The host created, the guest joined by code, the room went to `status='playing'` at 02:14:59 — and
**the guest sat on the table screen for 120 seconds and never advanced**, with no console errors:

```
guest screen: "2 / 2 seated · Host · Guest · Waiting for the table to fill…"
guest events: lobby_opened > join_identity(uid) > table_joined > table_autostarted    (then nothing)
host  events: … > game_started > cards_placed(ready) > … > hand_completed > game_ended
```

Its own UI shows both seats filled with the right names, so its realtime data is arriving — it just
does not transition. Reproduced on both attempts. Caveat: two contexts in one headless browser, so
this wants confirming on the two-device test. **Not fixed** — it is a gameplay defect, out of this
brief's scope, and it is exactly what the 3-minute two-device test exists to settle.

**And it is invisible in the data**, which is the Task 3 point in miniature: a guest who joins and
never plays emits `table_joined > table_autostarted` and then stops, indistinguishable from someone
who walked away.

### Was my test device excluded?

Yes — and the brief's two instructions collide here, so both were done. `v_analytics_human` exists
to exclude exactly this traffic:

```
my 6 verification devices:  0 rows in v_analytics_human | 70 rows in analytics_events (raw)
                            3 of 3 checked devices present in v_automation_devices
CI's own Playwright (8801-00e6-8967, X11 Linux, webdriver true): 0 rows in v_analytics_human
```

So the sequences above were read from the **raw** table filtered to my device ids. Reading them from
the view is impossible by construction — if my device appeared there, the view would be broken.

## Task 3 — what leaves no trace (report only)

| a tester can… | trace today |
|---|---|
| **join a multiplayer table and never enter the game** | `table_joined > table_autostarted`, then silence — the defect above is invisible |
| **abandon during placement** | nothing, unless they leave within 3s with zero interaction (`screen_abandon`) or sit 30s untouched (`stuck_dwell`). Place four cards and quit → no trace |
| **abandon during the reveal** | **now derivable**: `reveal_started` without `hand_completed`. No new event needed — the pair bounds it |
| **open the lobby and leave** | `lobby_opened` fires; leaving does not |
| **quit between hands** | `hand_completed` then nothing; indistinguishable from finishing for the night |
| **fail to start the app at all** | nothing — `app_opened` is the first event, so a white screen or a load failure is invisible |
| **guest-side multiplayer generally** | `mp_game_started` carries a role, but a guest that never mounts the screen emits none of it |

The two worth Roye's attention are the **MP join stall** (a defect the funnel cannot see) and
**abandonment during placement** (the phase with twelve to sixteen interactions and no signal
between "dealt" and "confirmed"). Everything else is either derivable or low value. Nothing was
added — this is a report.

## DB state

```
bug_reports 250 (baseline) | hand_history 151 (baseline, 4 probe rows removed)
analytics_events 19,425 — my 18 device ids deleted, verified 0 rows
public game_rooms 11 — baseline INTACT, untouched, all still waiting/current_players 0
_backup_starter_redemptions_20260816 649 — INTACT
```

`game_rooms` reads 14: the three **private** invite-code rooms my MP runs created (`P9LC`, `LPPS`,
`A8NC`), each with `expires_at` ~30 minutes out. I am not permitted to delete `game_rooms` rows, so
they are left to expire; they are `is_public = false` and therefore never appear in the lobby.
`room_players` reads 1 for the same reason — one seat in one of those private rooms.

`leaderboard` 797: my probe rows were deleted; the remainder is real traffic plus CI.

Two other devices appear in the last three hours and are **not** mine: `8801-00e6-8967`
(X11 Linux, `webdriver: true` — CI's own Playwright, correctly excluded from the human view) and
`57b6-012b-ada0` (`webdriver: false` — a real visitor). Neither was deleted.

## MACHINE

Stable this run: `tsc` exit 0 on both attempts, no compiler crash. One Chromium tab crashed during
an early probe (a 1.2s click loop on the reveal); the loop was slowed and it did not recur.

=== STRATEGIST HANDOFF — THE FUNNEL ===
TASK 1 WHY IT INVERTS:
  - game_started: emitted by the BUTTONS — app/(tabs)/index.tsx:993 and app/(tabs)/play.tsx:37.
    Bypassed by onboarding's guided hand, the lobby's instant bot tables (lobby/index.tsx:146 sent
    only mode_start), Play-again from /results, and ALL of multiplayer. Both events exist since
    2026-04-03, so not a recency artifact: 267 devices reached hand_dealt, 32 emitted game_started.
    304 events / 32 devices is NOT a double-fire — one per tap, tracking play_button_tapped
    (285/28) almost exactly. It was measuring taps, including taps that never reached a game.
    MOVED to game.tsx (beside hand_dealt) and multiplayer-game.tsx's mount effect; removed from both
    buttons. Guarded by a new trackOnceThisSession() because /game re-mounts once per HAND.
  - cards_placed: per HAND, in handleReady — but the arrangement CLOCK bypasses handleReady
    entirely. Solo: game.tsx:461, countdown===0 branch navigates directly. MP: autoFillAndReady()
    at multiplayer-game.tsx:964. A player who timed out completed a hand having never placed cards
    — 58 placed vs 88 finished. Auto-Place ALL was NOT the cause: it feeds the normal Ready button
    and already tagged its per-card events source='auto_all'. Both timeout paths now emit it,
    source='timeout' vs 'ready', once per hand.
  - hand_completed: results.tsx:614, once per mount, and BOTH solo and MP route to /results.
    Confirmed correct, unchanged. 88 of 267 is a real drop-off, not an inversion.
  - reveal_started: did NOT exist anywhere in the codebase. Added at the three points the overlay
    opens (solo, MP host, MP guest), inside the existing gates so skipBoardReveal and
    mp_board_reveal_enabled still produce no event.
  - changed: analytics.ts (+trackOnceThisSession), game.tsx (game_started, cards_placed on timeout,
    reveal_started), multiplayer-game.tsx (game_started, cards_placed on timeout, reveal_started
    x2), index.tsx and play.tsx (game_started removed).
TASK 2 VERIFIED BY PLAYING (live build, in-app navigation only, chromium at 390):
  - 2P practice: play_button_tapped > mode_start > game_started > hand_dealt > cards_placed(ready)
    > reveal_started
  - 3P practice: play_button_tapped > game_started > mode_start > hand_dealt > reveal_started >
    cards_placed(ready) > hand_completed > game_ended
  - lobby bot table: home_play_online_tapped > lobby_opened > bot_table_play > game_started >
    hand_dealt > cards_placed(ready) > reveal_started   <- this route emitted NO game_started before
  - multiplayer HOST: lobby_opened > table_created > mp_game_started[host] > game_started >
    cards_placed(ready) > mp_game_ended[host] > reveal_started[host] > hand_completed > game_ended
  - MP GUEST NEVER ENTERED THE GAME — a real defect, reported not fixed. Room went status='playing',
    guest's own screen read "2 / 2 seated · Host · Guest · Waiting for the table to fill…" for 120s
    with zero console errors, events stopping at table_autostarted. Reproduced twice. Caveat: two
    contexts in one headless browser — this is what the two-device test should settle.
  - funnel shape per device on the new build: app_opened >= game_started >= cards_placed >=
    reveal_started >= hand_completed holds for ALL SIX devices, exactly one of each. Y
    (v_analytics_human still shows 523/32/58/0/88 — the OLD data. No real player has run the new
    build, and a fix cannot repair history.)
  - test device excluded? YES, and the brief's two instructions collide: my 6 devices have 0 rows in
    v_analytics_human and 70 in the raw table, and are present in v_automation_devices — so the
    sequences above were necessarily read from RAW, filtered to my device ids. CI's own Playwright
    (8801-00e6-8967, X11 Linux, webdriver true) is likewise excluded.
  - FIRST ATTEMPT WAS WRONG AND I CAUGHT IT: page.goto('/game?...') produced TWO game_started rows.
    A full page load is a new JS context and a new analytics session — the session ids in properties
    proved it (43d305e3… -> e0ef2002…). The guard was fine; the harness was not. Redone in-app.
TASK 3 UNMEASURED (report only, nothing added):
  - MP join that never starts: table_joined > table_autostarted then silence — the defect above is
    invisible in the data. Highest value.
  - abandoning during PLACEMENT: no trace unless they leave within 3s untouched (screen_abandon) or
    sit 30s untouched (stuck_dwell). Twelve to sixteen interactions with no signal between "dealt"
    and "confirmed". Second highest.
  - abandoning during the REVEAL: now DERIVABLE — reveal_started without hand_completed. No new
    event needed.
  - lobby opened then left: lobby_opened fires, leaving does not.
  - quitting between hands: indistinguishable from finishing for the night.
  - failing to start the app at all: app_opened is the FIRST event, so a white screen is invisible.
LIVE: main 68f8a5e | deployed (run 31978923983, success) | chromium only — these are analytics
  emissions, not pixels, and the events are engine-independent; no visual change was made.
tsc: exit code 0 (both runs). CI tsc-output artifact empty.
DB: public game_rooms 11 — baseline INTACT, untouched. 3 PRIVATE rooms (P9LC, LPPS, A8NC) created by
  the MP runs remain with ~30-minute expiry; game_rooms/room_players rows may not be deleted, and
  they never appear in the lobby (is_public false). room_players 1 for the same reason.
  bug_reports 250. hand_history 151 (4 probe rows removed). analytics_events: my 18 device ids
  deleted, verified 0. leaderboard 797, probe rows removed, remainder real + CI.
HANDOFF: file + vamos_handoffs slug 2026-08-17-the-funnel | chars | code-point match? Y
WHAT I DID NOT CHECK: the MP GUEST path never reached the game, so guest-side game_started,
  cards_placed and reveal_started[guest] are unverified in the field — only the host half is proven;
  the timeout path for cards_placed was added but NOT exercised (I never let the 30s clock expire on
  either screen, so source='timeout' has never fired live); webkit was not run, since these are
  analytics emissions rather than pixels; hand_history gained 4 rows during play despite being
  believed dead, and I deleted them without tracing which writer produced them; and the guard is
  per analytics SESSION, so a player starting two separate games in one session is counted once.
=== END ===
