# 2026-08-16 — The last two surfaces, and the EZ3 survey

**No app code changed and no migration applied.** Both bounds were investigated and both were
deliberately not built — for different reasons, both measured. EZ3 is a survey, as instructed.

## Task 1 — `track_event`: the 734 was mine, and the real finding is much larger

### What the 734-event device was doing

`f972-050b-7bbd`, 2026-08-07, 08:49 → 17:15. It is **a probe — one of ours**:

```
ua: Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Claude/1.26832.0 … Electron/42.7.0 … MSIX
ua: Mozilla/5.0 (Linux; Android 14; Pixel 8) …            (device emulation)
sw: 0, sh: 0                                              (the 0x0 viewport ghost)
```

Its shape is an agent session, not a player: **19 `app_opened`, 20 `game_started`, 20
`onboarding_variant_applied`** on one persisted device id, 436 `card_placed` for 27 completed
hands (16 cards a hand — the 2P shape), peak 40 events in a minute.

**Re-derived without it:** average per device-day **10.40 → 10.00**. p95 26, p99 57 — *unchanged*.
The outlier never mattered to the sizing.

### The finding that does matter

Chasing the outlier turned up something the brief did not anticipate. `properties` has carried a
`webdriver` flag and a `ua` string **since 2026-08-01** (11,134 of 19,376 events). Of the events
that can be classified:

| | |
|---|---|
| events since 2026-08-01 | **12,485** |
| of those, automation (`webdriver=true`, `HeadlessChrome`, or the Claude in-app browser) | **9,521 — 76.3%** |
| devices since 2026-08-01 | 1,090 |
| of those, automation | **957 — 88%** |

**Three quarters of recent analytics is our own test traffic**, and the device count — the number
Roye would read as "players" — is 88% robots. Every Playwright run in these sessions starts a fresh
browser profile, which mints a fresh `device_id`, which becomes a new "device" in the table.

That reframes the task. The pollution the brief worried a flooder might cause **has already
happened, and we caused it** — and a rate limit would not have stopped one event of it, because it
was legitimate app traffic from a real browser.

**Human-only figures** (excluding every device that ever emitted an automation marker):

```
786 devices · 8,062 events · 891 device-days
max 171 · avg 9.05 · p50 5 · p95 26 · p99 56
```

The 171 predates 1 August, so it cannot be classified either way.

### Bounded upstream? No — measured

```
200 anon track_event calls, concurrency 20 -> 1,345 ms, 149/sec, 200x HTTP 200, ZERO 429s
```

Supabase's gateway refused nothing at 149 calls a second. Last run's 80-call test said the same at a
lower rate. All 200 probe rows were deleted; `analytics_events` is back to 19,376.

### Decision: no limit, deliberately

* It fires **no external service**. The cost of a flood is storage and data pollution, not spend.
* The key would be `device_id`, which is client-supplied and rotatable — the same weakness as
  `session_id` and `p_hand_id`. A flooder rotates it and the limit sees nothing, while a real
  player who hits it loses data **invisibly**: a dropped event is indistinguishable from a user who
  did not do the thing.
* Given "prefer generous, or nothing at all", and that the realistic damage is already done and came
  from us, a ceiling would buy almost nothing and can only ever subtract truth from the table.

**What would actually help, and is Roye's call:** every analytics read should exclude automation —
`properties->>'webdriver' = 'true'`, `ua like '%Headless%'`, `ua like '%Claude/%'`. That is a
reporting change, not a schema change, and it works from 1 August onward. Before that date the
traffic cannot be separated at all. I did not change any dashboard or query.

## Task 2 — `create_table`: the premise is false, so there is nothing to bound

`create_table` **cannot put a table in the lobby**. Its INSERT does not mention `is_public`:

```sql
INSERT INTO game_rooms (room_code, host_id, host_name, status, player_count,
                        current_players, max_players, game_config, expires_at)
```

and the column's default is **`false`**:

```
is_public | default false | NOT NULL
```

while `list_public_tables()` ends `FROM game_rooms WHERE is_public AND status='waiting'`. So every
room `create_table` makes is a **private invite-code table that never appears in the lobby** — which
is exactly what `utils/lobbyApi.ts:9-14` says it is, and now confirmed against the database rather
than the comment.

**The lobby is fed by something else entirely.** `ensure_public_lobby()` seeds a hostless pool and
tops it up to **2 human tables per size plus 1 bot table per size** (`need := 2 - have`). It is
idempotent — calling it in a loop creates nothing. Live now: 11 rooms, all `is_public`, 8 human +
3 `bot_practice`.

**And the UI caps it anyway.** `list_public_tables` has no `LIMIT`, but `app/lobby/index.tsx:232`
does `grouped[n].slice(0, TABLES_PER_TYPE)` with `TABLES_PER_TYPE = 2`, padding with placeholders so
the layout never collapses. A player sees **two slots per size, always** — the lobby cannot show a
wall of empty tables even if the pool grew.

**No bound added.** Auto-replacement is untouched: `join_table` still ends with
`IF v_room.is_public THEN PERFORM public.ensure_public_lobby(); END IF;` when a table fills. A
per-host limit on `create_table` would have risked exactly that path for no benefit.

**Residual, reported not fixed:** a `create_table` loop still writes `game_rooms` + `room_players`
rows that live 30 minutes. Invisible to players, self-cleaning, storage only. I did **not** exercise
it — it would create rooms I am not permitted to delete, and the static evidence is conclusive.

## Task 3 — EZ3 survey: what ships, measured from the deployed artifact

**The honest framing first.** Copy risk before a product has users is close to zero. Nobody clones a
game with no players. This matters *after* traction, and the only reason to look now is so the
decision is informed when it arrives — not because anything should be built today.

### What is genuinely proprietary, and where it lives

| asset | in the deployed bundle today? |
|---|---|
| the multi-board Omaha mechanic | **yes — and irrelevant.** The rules are visible from playing one hand. No amount of code secrecy protects a rules idea |
| Omaha evaluator (2-from-hand × 3-from-board) | **yes** — 4,827 B, `evaluateOmahaHand` / `evaluate5Cards` |
| equity + outs engine | **yes** — 21,242 B, `computeSeatEquity` / `computeOuts` |
| bot strategy | **yes** — 5,167 B, `placeBotCardsWithStrategy` (shares a module with `calculateHandResultsMulti`) |
| balance configuration | **yes** — 2,566 B, one readable object literal |
| deck build + shuffle | **yes** — 1,555 B, Fisher–Yates on un-seeded `Math.random()` |
| DB schema, RPC bodies, credentials | **no** |

### Measured from `index-771c094408d8c16c87f239deaa33ee52.js`

```
bundle            3,829,136 bytes across 1,571 modules
the whole engine     35,357 bytes across 5 modules  =  0.92% of the bundle
```

Every export survives minification as a readable string — `evaluateOmahaHand` appears 21 times,
`getBoardCount` 13, `computeSeatEquity` 4. Local variables are mangled; the algorithm is not:

```js
function evaluateOmahaHand(n,a){ … for(const[o,s]of u) for(const[c,i,u]of f){
  l[0]=n[o],l[1]=n[s],l[2]=a[c],l[3]=a[i],l[4]=a[u];
  const{rank:h,score:f}=evaluate5Cards(l); … if(h===t.RoyalFlush)break r
```

The board-count rule is one line:

```js
function getBoardCount(t){return 3===t?3:4===t?2:4}
e.getCardsPerPlayer=function getCardsPerPlayer(t){return 3===t?12:4===t?8:16}
```

The entire balance table — the part that took iterations to tune — is one literal:

```js
boardRevealDuration:5, turnRevealDelay:800, completeBonusDisplay:3, startingChips:2e3,
potPerBoard:25, completeBonusPercent:50, numberOfPlayers:2, botSpeedMin:1500, botSpeedMax:4e3,
revealSpeed:'normal', botDifficulty:'easy', mpBoardReveal:!0
```

And the deal is client-authoritative, confirmed from both ends: `shuffleDeck` is a plain
Fisher–Yates over `Math.random()` in the bundle, and **no RPC in the database has `deal`, `shuffle`
or `deck` in its name** — the server never touches a card.

**One thing is right:** there is **no source map**. `sourceMappingURL` appears 0 times, no
`sourcesContent`, and the `.js.map` URL returns the SPA's `index.html` (200, `text/html`, 1,902
bytes) rather than a map. That is the single change that would have handed over original file names,
comments and formatting, and it is absent.

### What a copier gets in an afternoon

Grep five names, lift 34.5 KB out of 3.8 MB, and they have: a correct Omaha evaluator, the equity
engine, the bot, the board-count mapping, and your tuned numbers. No reverse-engineering — the
functions are named after what they do. What they do **not** get is the schema, the RPCs, four
months of balance iteration *rationale*, the tester pipeline, or any users.

### Options, ranked, with real costs

1. **Do nothing now — recommended.** Cost: zero. Correct until there is traction to protect. The
   mechanic is copyable from watching one hand regardless of what the bundle contains.
2. **Move the balance configuration server-side.** Cost: small — `app_config` already exists and is
   already read this way (`mp_board_reveal_enabled`, `starter_pack_chips`), so it is a fetch, a
   fallback, and a staleness decision. Buys two things: the tuned numbers stop shipping, and they
   become changeable without a release. Does **not** hide the mechanic or the evaluator.
3. **Server-side adjudication.** Cost: large — a genuine architectural change; every hand becomes a
   round-trip, practice/offline play needs an answer, and the reveal-timing work would need
   re-verifying. It is the only option that actually removes the engine from the bundle, and it
   **pays twice**: it also ends client-authoritative dealing, which is a cheating problem today
   independent of copying. Not started, per the brief.
4. **Obfuscation — rejected**, on the brief's instruction and on merit. It delays a copier by hours,
   the algorithm still ships, and every future stack trace is worse forever.

**Nothing was built and nothing was obfuscated. No export was renamed.**

## DB state

```
bug_reports 250 (baseline) | probe rows 0
analytics_events 19,376 (baseline; 200 burst rows deleted) | probe rows 0
hand_history 151 | rooms 11 | room_players 0 | chip_transactions probes 0
_backup_starter_redemptions_20260816 649 — INTACT
```

`leaderboard` reads **794** against 782. This run opened no browser that executes the app — only SQL,
direct `fetch`, and an `Invoke-WebRequest` download of the bundle — so the drift is real visitors.

## MACHINE

`tsc` crashed **three times consecutively** with `0xC0000005` and produced no verdict. I am not
claiming a pass. No app code changed this run, so HEAD is still `3bf67be`, whose CI typecheck
artifact is an empty file — that verdict stands and is the only one I have.

=== STRATEGIST HANDOFF — LAST BOUNDS + EZ3 SURVEY ===
TASK 1 track_event:
  - the 734-event device (f972-050b-7bbd, 2026-08-07) is a PROBE — OURS. ua carries
    "Claude/1.26832.0 … Electron/42.7.0 MSIX" and a Pixel 8 emulation, with sw:0/sh:0 (the 0x0
    viewport ghost). Shape: 19 app_opened, 20 game_started, 20 onboarding_variant_applied on ONE
    persisted device id, 436 card_placed for 27 hands, across 8.5 hours. Not a player, not a loop.
  - re-derived WITHOUT it: avg per device-day 10.40 -> 10.00; p95 26 and p99 57 UNCHANGED. The
    outlier never affected the sizing.
  - MUCH BIGGER FINDING: properties has carried `webdriver` + `ua` since 2026-08-01. Of the 12,485
    events since then, 9,521 (76.3%) are AUTOMATION, and 957 of 1,090 devices (88%) are automation.
    The pollution the brief feared has already happened AND WE CAUSED IT — every Playwright run
    mints a fresh browser profile, so a fresh device_id, so a new "device". A rate limit would not
    have stopped one event of it: it was legitimate app traffic from a real browser.
    Human-only: 786 devices, 8,062 events, 891 device-days, max 171, avg 9.05, p95 26, p99 56.
  - bounded upstream by Supabase? NO, measured: 200 anon calls at concurrency 20 -> 1,345 ms,
    149/sec, 200x HTTP 200, ZERO 429s. All 200 probe rows deleted.
  - limit added? NO, DELIBERATELY. It fires no external service, so a flood costs storage and
    pollution, not spend. The only key is client-supplied device_id — rotatable, so a flooder is
    unaffected while a real player loses data INVISIBLY. Per "prefer generous or nothing", nothing.
    RECOMMENDATION (Roye's call, not built): filter automation out of every analytics READ —
    webdriver='true', ua like '%Headless%', ua like '%Claude/%'. Works from 1 Aug; before that date
    the traffic cannot be separated at all.
TASK 2 create_table:
  - does list_public_tables cap its output? NO LIMIT in SQL — but it does not matter twice over.
  - THE PREMISE IS FALSE: create_table's INSERT omits is_public, whose column default is FALSE, and
    list_public_tables filters `WHERE is_public AND status='waiting'`. Every room create_table makes
    is a PRIVATE invite-code table that NEVER appears in the lobby. A loop cannot fill it.
  - the lobby is fed by ensure_public_lobby(), which tops up to 2 human + 1 bot table per size
    (need := 2 - have) and is idempotent — looping it creates nothing. Live: 11 rooms, all public,
    8 human + 3 bot_practice.
  - and the UI caps it: app/lobby/index.tsx:232 slice(0, TABLES_PER_TYPE) with TABLES_PER_TYPE = 2,
    padded with placeholders. A player always sees two slots per size. No wall of empty tables is
    reachable.
  - bound added? NO — not needed. Auto-replacement UNTOUCHED: join_table still calls
    ensure_public_lobby() when a public table fills. RESIDUAL: a loop still writes game_rooms +
    room_players rows for 30 minutes — invisible, self-cleaning, storage only. NOT exercised: it
    would create rooms I may not delete, and the static evidence is conclusive.
TASK 3 EZ3 SURVEY (report only):
  - proprietary and IN THE BUNDLE TODAY: evaluator (4,827 B, evaluateOmahaHand/evaluate5Cards);
    equity+outs (21,242 B, computeSeatEquity/computeOuts); bot strategy (5,167 B,
    placeBotCardsWithStrategy, sharing a module with calculateHandResultsMulti); balance config
    (2,566 B — one literal: startingChips 2000, potPerBoard 25, completeBonusPercent 50,
    botSpeedMin/Max 1500/4000, turnRevealDelay 800, boardRevealDuration 5, revealSpeed 'normal',
    botDifficulty 'easy'); deck build + Fisher-Yates on un-seeded Math.random (1,555 B).
    NOT in the bundle: schema, RPC bodies, credentials. The MECHANIC is in the bundle and it does
    not matter — the rules are visible from playing one hand.
  - MEASURED FROM THE DEPLOYED ARTIFACT (index-771c094408d8c16c87f239deaa33ee52.js):
    3,829,136 bytes / 1,571 modules; the ENTIRE engine is 35,357 bytes across 5 modules = 0.92%.
    Exports survive minification: evaluateOmahaHand x21, getBoardCount x13, computeSeatEquity x4.
    getBoardCount is one line. NO RPC in the database has deal/shuffle/deck in its name — the server
    never touches a card, confirmed from both ends.
  - GOOD NEWS: NO SOURCE MAP. sourceMappingURL x0, no sourcesContent, and the .js.map URL returns
    the SPA index.html (200, text/html, 1,902 bytes). That is the one thing that would have handed
    over file names, comments and formatting.
  - an afternoon buys: grep five names, lift 34.5 KB out of 3.8 MB — evaluator, equity, bot,
    board-count mapping, tuned numbers. It does NOT buy the schema, the RPCs, the balance
    RATIONALE, the tester pipeline, or any users.
  - OPTIONS RANKED: (1) do nothing now — cost zero, correct until there is traction; (2) move the
    balance config to app_config — small cost, the pattern already exists, stops the tuned numbers
    shipping and makes them changeable without a release, hides nothing else; (3) server-side
    adjudication — large, a real architectural change, but the only option that removes the engine,
    and it PAYS TWICE by ending client-authoritative dealing (a cheating problem today, independent
    of copying); (4) obfuscation — REJECTED, hours of delay, permanent debugging cost, algorithm
    still ships.
  - nothing built, nothing obfuscated, no export renamed? YES.
CLEANUP: bug_reports 250 and 0 probe rows, verified by query. analytics_events back to 19,376 with
  0 probe rows (the 200 burst rows deleted). hand_history 151, rooms 11, room_players 0,
  chip_transactions probes 0, backup 649 intact. No game_rooms/room_players rows created or deleted.
  leaderboard 794 vs 782 — no app-executing browser was opened this run, so the drift is real.
MACHINE: tsc crashed THREE times consecutively with 0xC0000005 and gave no verdict.
tsc: NO LOCAL VERDICT — not claiming a pass. No app code changed, so HEAD is still 3bf67be, whose
  CI typecheck artifact is an empty file; that is the only verdict I have.
HANDOFF: file + vamos_handoffs slug 2026-08-16-last-bounds-and-ez3 | chars | code-point match? Y
WHAT I DID NOT CHECK: whether automation pollution can be separated before 1 August (it cannot from
  the data, so every behaviour figure older than that is suspect and I did not try to reconstruct
  it); I did not change any dashboard, report or query to apply the automation filter; create_table
  was proven private from the schema and the function body, NOT exercised; the 171-event human max
  predates the webdriver flag and may itself be automation; the bundle survey covers the WEB
  artifact only — the native binary was not extracted; and I did not measure how much of the 3.8 MB
  bundle is game logic beyond the five modules named.
=== END ===
