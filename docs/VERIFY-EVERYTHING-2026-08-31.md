# VERIFY-EVERYTHING — an independent audit

**2026-08-31.** Nothing below is taken from a handoff. Where a previous sprint recorded something
as true, it was either re-measured against the app and the database as they stand today, or it is
reported as unverified. Five sprints of records were available and deliberately not used as
evidence.

---

## 0 · The rule that governs every number here

**Across this series, more filed defects have turned out to be measurement error than real.** That
is not a caveat at the end; it decided how this audit was built and how confidently each finding
below is written.

**Four times in this sprint alone my instrument was wrong and the app was right.** Each is written
up where it happened, because a report that hides them is asking to be believed rather than
checked:

| # | What I nearly filed | What was actually true |
|---|---|---|
| 1 | *"A bound device placed 16 cards in 119 ms — harness."* | ⚡ **Auto-Place ALL** emits one `card_placed` per card in a `for` loop. One tap. Human. |
| 2 | *"264 routes render blank and throw."* | I skipped `scripts/fix-web-html.js`. The bundle needs `type="module"`; CI adds it, I hadn't. |
| 3 | *"The board caption is missing at every player count."* | The caption is styled uppercase and `innerText` reports the transform. My regex was case-sensitive. |
| 4 | *"23 devices are stranded below the playable floor."* | All 23 are test rigs — `eqh-eqs1-a … rig2p-loser` — one event each, from 2026‑08‑17/18. |
| 5 | *"The READY control truncates to `…` at 320 on WebKit"* — a REMATCH-class finding if true. | Chased it across 16 cells (2 engines × 4 widths × 2 player counts): **no ellipsis anywhere**. What I saw was the control mid-load, before it arms. |

So the findings are graded, and the grade is part of the finding:

- **CONFIRMED** — reproduced live, with the instrument shown able to fail first.
- **CONFIRMED, SCOPED** — real, but narrower than it first looks; the limit is stated.
- **UNRELIABLE** — measured, but the measurement has a known confound. Reported, not filed.

Every automated check in this sprint **plants a defect and requires the checker to catch it**
before any real number is trusted. The full-loop harness plants six and aborts on a miss; it
caught 6/6 on Chromium and 6/6 on WebKit. The rules suite has a `describe('0 · the instrument')`
block that fails the run if the dedupe, zero-sum or board-rule checks cannot detect a planted
fault.

**Production is unchanged.** `KILL_Board` and `KILL_game` are still `true` and were not touched. No
flag, colour, panel, cue or economy value was altered. Source edits are confined to `tests/` and
`docs/`. Three probes wrote to production and **every row was removed and the removal verified** —
see §3.4.

---

## 1 · The rules, on real hands

`tests/verify-rules.test.ts` — 17 tests, all passing. It runs the app's own functions
(`dealCardsMultiplayer`, `evaluateAllBoards`, `calculateChipDeltas`, `deriveHandOutcome`,
`tallyBoards`), never a re-implementation.

**What is sampled and what is exhaustive**, said plainly because it changes what the numbers mean:
60,000 real deals are a **sample** — they can show a shape occurs, never that one cannot. The board
rule and the chip settlement are **enumerated over their entire space**, which is a proof.

### 1.1 Ties happen at every table size — CONFIRMED

20,000 real deals per player count, dealt and evaluated by the shipped engine:

| players | boards | tied boards | hands with ≥1 tie | widest tie seen |
|---|---|---|---|---|
| 2 | 4 | 1,131 | 1,105 (**5.53 %**) | 2-way |
| 3 | 3 | 1,530 | 1,484 (**7.42 %**) | 3-way |
| 4 | 2 | 1,589 | 1,559 (**7.79 %**) | 3-way |

Ties are not an edge case — roughly **one hand in fourteen** at three and four players contains
one. On every one of the 60,000 hands the chip deltas summed to exactly zero, tied or not, and
`won + tied + lost` equalled the board count.

*A 4-way tie was never sampled at four players.* It is reachable in principle; 20,000 deals did
not produce one. That is a limit of the sample, stated rather than converted into "cannot happen".

### 1.2 Boards decide, and the seat rule matches the server — CONFIRMED (exhaustive)

Every reachable distribution of board winners was generated and compared against the server's own
rule (sole holder of the maximum = won, sharing it = tied, below it = lost):

- **2 players**, 4 boards → 81 distributions, **0 mismatches**
- **3 players**, 3 boards → 64 distributions, **0 mismatches**
- **4 players**, 2 boards → 25 distributions, **0 mismatches**

The documented limit of the collapsed fallback (`winner` with no `winnerSeat`) was also enumerated
rather than taken on the comment's word. It is wrong at **exactly one shape** — three players,
three boards, one board each — and identical to the seat rule at every 2P and 4P distribution.
The comment in `utils/handOutcome.ts` is accurate.

### 1.3 Geometry — CONFIRMED

Over 2,000 real deals per player count: board count came from `getBoardCount()` (never a literal),
cards per player equalled `boardCount × 4`, every board carried exactly 5 community cards and 4
cards per player, the total never exceeded 52, and **no card was ever dealt twice**. The dedupe
check was proved able to fail on a planted duplicate first.

### 1.4 One writer — CONFIRMED, structurally

Settlement cannot be written twice. Four partial unique indexes enforce it in the database rather
than in code:

```
uq_hand_net_ref        (device_id, reference_id) WHERE event_type='hand_net'
uq_play_grant_ref      (device_id, reference_id) WHERE event_type='play_grant'
uq_starting_grant_ref  (device_id, reference_id) WHERE event_type='starting_grant'
uq_purchase_provider_receipt (provider, receipt_id)
uq_hand_history_client_ref   (device_id, client_hand_id)
room_players_room_id_seat_index_key (room_id, seat_index)
```

`record_hand_net` and `credit_purchase` both gate their credit on the insert *actually happening*
(`GET DIAGNOSTICS` / `RETURNING … INTO`), so a retry lands on the conflict and pays nothing.

### 1.5 "Won, and negative chips" — CONFIRMED: it cannot happen

Enumerated over every distribution at every player count. **There is no reachable hand where the
boards say you won and the chips are negative.** The only disagreement between the two definitions
in the whole space is six cases, all at three players, and all of them the *other* direction:

```
3P seats=[0,1,1] outcome=loss chips=+0        3P seats=[1,1,0] outcome=loss chips=+0
3P seats=[0,2,2] outcome=loss chips=+0        3P seats=[2,0,2] outcome=loss chips=+0
3P seats=[1,0,1] outcome=loss chips=+0        3P seats=[2,2,0] outcome=loss chips=+0
```

You take one board, one opponent takes two: the hand is a **loss** and the chips come out at
**exactly zero** (−75 paid in, +75 taken back). A player will read "you lost" over a scoreboard
that did not move. That is defensible — boards decide, chips settle — but it is the one place the
two definitions visibly diverge, and it is worth knowing it is *this* case and not the frightening
one.

---

## 2 · The economy, measured

Every number below is read from `app_config` **and** cross-checked against the rows the system
actually wrote. A configured value that has never been paid is not a working faucet.

### 2.1 The four faucet numbers — three of them have effectively never run

| key | configured | what production actually shows |
|---|---|---|
| `presence_grant_multiplier` | **0.4** | ✅ **live and working.** Every `daily_streak` since 2026‑08‑28 pays 200 (= 500 × 0.4). 14 grants so far; the 1,321 rows at 500 all predate the change. |
| `play_grant_practice_pct` | **50** | ⚠️ paid **once, ever** — a single 40-chip row (= 80 × 50 %) on 2026‑08‑28 14:00:59. |
| `play_grant_per_hand` | **80** | ⚠️ **never paid.** Zero rows at 80. |
| `play_grant_daily_cap` | **800** | ⚠️ **never approached.** The largest device-day total in the ledger's history is **40**. |

**The tap Roye tuned has been opened once.** What actually fills the economy is the streak:

| event | rows | chips |
|---|---|---|
| `daily_streak` | 1,379 | **+700,900** |
| `daily_login` (retired) | 2,217 | +110,850 |
| `daily_reward` (retired) | 498 | +14,940 |
| `starting_grant` | 13 | +26,000 |
| `hand_net` | **25** | **+225** |
| `play_grant` | **1** | **+40** |
| `rake` | **3** | **−16** |

`daily_streak` alone is **81 %** of the entire ledger. `hand_net` — the record of actually playing —
is 25 rows in the app's lifetime. **The rake has collected sixteen chips.** Tuning the play grant
is tuning something almost nobody has reached.

### 2.2 The ledger gap is frozen — CONFIRMED

```
leaderboard rows        547
float  Σ total_chips    1,249,117
ledger Σ amount           864,624
gap                       384,493
```

**384,493 — the same figure as the 2026‑08‑28 cutoff, to the chip.** Between the cutoff and today
the float grew by exactly 29,900 and the ledger grew by exactly 29,900. The gap not growing is the
test, and it passes. `trg_ledger_starting_grant` is live; 13 `starting_grant` rows totalling 26,000
chips, first 2026‑08‑28 12:46:50, last 2026‑08‑30 23:20:01.

*The 384,493 itself is historic and unexplained by this audit* — it is the balance that existed
before the ledger started recording. Nothing here reduces it; the point is that it is no longer
growing.

### 2.3 The zero-chip guarantee has never had to fire — CONFIRMED, SCOPED

`min_playable_chips` = 100. **23 leaderboard rows sit below it, 17 of them at exactly zero.**

They are **all test rigs**: `eqh-eqs1-a` … `eqh-eqs10-b`, `rig3p-b`, `rig3p-c`, `rig2p-loser`,
`dev-s2-host`, `dev-s2-guest`. One or two analytics events each, every one on 2026‑08‑17 or
2026‑08‑18. **No real player is below the playable floor**, which is why `low_chip_rescue` has one
row and `emergency_chips` has one.

**But**: none of those 23 appears in `v_automation_devices` — they never sent a user agent at all,
so the project's own harness-detection rule cannot see them. See §5.2.

### 2.4 The bindings went 3 → 6, and all six are real — CONFIRMED

The brief asked whether the three new bindings are harness residue the cleanup rule missed again.
**They are not.**

| device | bound | evidence |
|---|---|---|
| `45bf-df1f-d8d8` | 2026‑08‑28 08:18 | 46 events, web, one 2P hand |
| `290a-83fa-33f2` | 2026‑08‑28 08:19 | **464 events spanning 2026‑04‑03 → 08‑28**, iOS, tutorial completed in April, 30 game starts, 26 rage-taps |
| `c0bd-67d6-1f6f` | 2026‑08‑28 14:00 | 72 events from 2026‑08‑09, iOS, tutorial completed, one tied hand |

**This is the finding I nearly got wrong**, and it is worth spelling out because the mistake was
seductive. `45bf-df1f-d8d8` placed **16 cards in 119 milliseconds** — human-impossible, and I had
written it up as a harness device. Then I read the emit site: `app/game.tsx:1128` fires one
`card_placed` per card inside a `for` loop behind the **⚡ Auto-Place ALL** button. Sixteen events
in 119 ms is *one tap*. The `source` property settles it beyond argument — every sub-50 ms burst on
every bound device carries `source: auto_all` or `source: auto`, and every `source: tap` placement
is human-paced.

**The cleanup rule did not miss anything. The count went up because three real people bound.**

---

## 3 · Payments and security — attacked, not read

Every probe below ran **against production over HTTPS with the public anon key** — the same key
that ships inside the web bundle and the iOS binary, i.e. exactly what an attacker already holds.
No service-role key, no session, no account created.

### 3.1 The payment lock holds — CONFIRMED

| attack | result |
|---|---|
| `verify-purchase`, no key at all | **401** `UNAUTHORIZED_NO_AUTH_HEADER` — `verify_jwt` is on |
| `verify-purchase`, anon key, no signature | **401** `stub_secret_not_configured` |
| `verify-purchase`, anon key, forged signature | **401** `stub_secret_not_configured` |
| `verify-purchase?provider=payplus` | **401** `payplus_adapter_not_implemented` |
| `verify-purchase?provider=<invented>` | **400** `unknown_provider` |
| `credit_purchase` RPC direct | **42501** permission denied — granted to `postgres`/`service_role` only |
| `record_chip_purchase` RPC direct | **42501** permission denied |
| `purchases` table INSERT | **42501** permission denied |

`purchases` is still **0 rows**. `iap_enabled` = `false`, `web_payments_enabled` = `false`,
`verify-purchase` deployed with `verify_jwt: true` — all three read directly, not from a handoff.
The trust boundary is real: there is no path from the browser to a credit.

### 3.2 The throttle works, exactly at the boundary — CONFIRMED

`econ_rate_ok` is 30/minute and 120/hour per device. Called 40 times in a row from outside:
calls 1–30 returned `true`, **call 31 returned `false`.** `econ_throttle_enabled` = `true`.

### 3.3 The binding guard is narrower than its name — CONFIRMED, SCOPED

`econ_binding_enabled` = `true`, and the refusal path is **not dead code**: production carries one
`analytics_events` row with `case = 'identity_mismatch'`, on 2026‑08‑20 21:26:37. It has fired for
real, once.

**But read what it actually refuses.** `econ_bind_ok` returns `true` immediately when
`auth.uid() IS NULL`. It can only reject a caller who *has* a session and claims a device bound to
a *different* account. Against a caller with **no session at all** it is inert — and 650
`analytics_events` rows with `case = 'no_session'` show that economy calls arrive that way
routinely (`claim_daily_streak` 206, `get_poker_shop` 204, `record_hand_net` 52, `earn_chips` 45),
most recently 2026‑08‑30 23:20. It also ends in `EXCEPTION WHEN OTHERS THEN RETURN true` — it fails
open by design.

*I could not test the mismatch refusal directly: it requires two accounts, and account creation is
outside what I am permitted to do. The production row is the evidence; the code path is read, not
exercised.*

### 3.4 Two things that ARE open — CONFIRMED, live

**(a) `earn_chips` mints chips to any caller with no session.** From outside, with the public key,
against a device id I invented:

```
earn_chips('iap_starter_pack', p_amount: 999999)  →  {"ok":true,"chips_earned":5000}
earn_chips('iap_starter_pack')  again             →  {"ok":false,"reason":"already_granted"}
earn_chips('hand_won',          p_amount: 999999) →  {"ok":true,"chips_earned":1500}
```

**6,500 chips, no account, no purchase, no game.** The clamp works — the caller's 999,999 was
ignored and the amount came from `app_config` — but the grant is real and it lands in
`leaderboard`. The bounds are: 5,000 once per device id, 1,500 per call clamped, 5,000/day per
device on the allowlisted events, 30 calls/minute. **Device ids are caller-chosen strings**, so
"once per device" is "once per string you invent". This is the hole handoff 97 named; it is still
open. `econ_authz_probe` logged my calls as `case: no_session` — *the function knows the caller is
unauthenticated and grants anyway.*

**(b) `chip_transactions` accepts forged ledger rows from anon.** RLS policy `insert_tx` is
`FOR INSERT TO public WITH CHECK (true)`. A single request inserted a **+1,000,000** row.

It cannot mint playable chips — `leaderboard` INSERT/UPDATE/DELETE are `service_role` only and both
were refused (`42501`) — so balances are safe. What it corrupts is **the ledger**, which is the
exact number the float-vs-ledger reconciliation in §2.2 is measured against. Anyone can make that
reconciliation say anything. And there is no `DELETE` policy for anon, so an attacker can add rows
that only `service_role` can remove.

**Everything else was refused**: `leaderboard` INSERT and UPDATE, `purchases` INSERT, `app_config`
INSERT, `device_identity` INSERT. RLS is enabled on all 14 economy-relevant tables;
`purchases`, `device_identity` and `econ_rate_counters` have RLS on with **zero policies**, i.e.
deny-all to anon — correct and strong.

**Cleanup, and I am not hiding that I wrote to production.** Three probes created rows. All were
removed and the removal was verified by re-reading the totals, not by trusting the delete:

```
deleted   leaderboard 1 · chip_transactions 3 · analytics_events 4 · econ_rate_counters 4
after     AUDIT-* rows anywhere: 0
float 1,249,117   ledger 864,624   gap 384,493   leaderboard rows 547
```

Identical to the pre-probe reading, to the chip. **No `game_rooms` or `room_players` row was ever
touched.**

### 3.5 The surface, counted

`72` tables · `8` views · `198` functions · **`157` of them executable by `anon`** · `14` triggers ·
`14` active Edge Functions.

*(`CLAUDE.md` says 56 tables, 127 RPCs, 16 Edge Functions. All three are stale. Corrected in §5.)*

---

## 4 · The full loop, once

`tests/verify-full-loop.mjs` — **33 routes × 4 widths (320/375/393/430) × 2 engines = 264 cells**,
against a local build of `main` as it stands. WebKit is the second engine deliberately: it is
Safari's engine, the closest a web harness gets to the iOS binary Roye taps.

**The self-test ran first and the run aborts without it.** Six planted defects — console error,
page error, 20px target, unlabelled control, 3000px overflow, blank body — **6/6 caught on
Chromium, 6/6 on WebKit.**

### 4.1 The headline

| | |
|---|---|
| navigation failed | **0 / 264** |
| rendered nothing | **0 / 264** |
| horizontal overflow | **0 / 264** |
| app-originated console errors | **0 / 264** |
| routes clean at every width on both engines | **24 of 33** |
| cells with a target under 44 pt | 64 / 264 — see 4.3 |
| cells with an unnamed interactive control | 8 / 264 |

Every route loads and renders real content at every width on both engines, with no horizontal
overflow anywhere. That is the strongest single result in this audit.

**The 83 "console error" cells are all one message** — `ERR_CONNECTION_RESET` fetching
`fonts.googleapis.com`, which is this sandbox's proxy dropping the Google Fonts request, not the
app. Zero Supabase requests were blocked. **The four "page errors" are all
`play() failed because the user didn't interact with the document first`** — a browser autoplay
policy, not a defect, though it does mean a sound call's promise is unhandled and could carry a
`.catch()`.

### 4.2 The board rule, on the screen — 12/12 CONFIRMED

`tests/verify-board-counts.mjs` drives the real game route at 2, 3 and 4 players with **three
independent witnesses per cell**, produced by different lines of the component:

| engine | width | players | expected boards | visible caption | aria label | "PLACE N CARDS" |
|---|---|---|---|---|---|---|
| chromium | 320 / 393 | 2 | 4 | 4 | 4 | 16 / 16 |
| chromium | 320 / 393 | 3 | 3 | 3 | 3 | 12 / 12 |
| chromium | 320 / 393 | 4 | 2 | 2 | 2 | 8 / 8 |
| webkit | 320 / 393 | 2 | 4 | 4 | 4 | 16 / 16 |
| webkit | 320 / 393 | 3 | 3 | 3 | 3 | 12 / 12 |
| webkit | 320 / 393 | 4 | 2 | 2 | 2 | 8 / 8 |

**12/12.** The expected numbers are derived from `getBoardCount()`, never typed in. Four cards per
board, not four total, at every size.

### 4.3 Touch targets — the number is 64, and most of it is my instrument

`getBoundingClientRect` **cannot see `hitSlop`**, and this app uses `hitSlop` 77 times —
`components/Board.tsx:751` says outright that the Auto-Place button reaches 44 pt that way
(18 + 15 + 15 = 48). So a large share of the 64 cells are fine on the phone.

**And the split is platform-dependent**, which matters more than the raw count:
`react-native-web` implements `hitSlop` **only in the legacy `Touchable` export, not in
`Pressable`** — and this app uses `Pressable`. So on **web** the slop does nothing and the targets
really are that small; on **iOS** `Pressable` honours it and they are not.

**Two findings survive that caveat because their screens have no `hitSlop` at all:**

- **CONFIRMED — `app/settings.tsx:1379` and `:1382`.** The **Privacy Policy** and **Terms of Use**
  links are bare `Pressable`s wrapping `rf(11)` text, with no `hitSlop` and no `minHeight`. They
  measure **68×12** and **65×12**. Twelve points tall, on web *and* on iOS. These are the two links
  Apple requires.
- **CONFIRMED — `app/achievements.tsx`.** The category filter chips are **28 pt tall** and the file
  contains zero `hitSlop`. Six of them.

Everything else in the 64 is **UNRELIABLE as filed** and needs a per-element source check I did not
do: `/battle-pass` (62 distinct, min 32), `/game` (89 distinct, min 18 — but `Board.tsx` carries
6 `hitSlop` uses), `/hand-history` (12, min 30), `/lobby/private` (8, min 32), `/lobby/table` (2,
min 41), `/club/[code]` (2, min 18), `/shop` (10, min 35, **WebKit only**).

*`/shop` and `/achievements` flag on WebKit and not Chromium — a font-metrics difference, not a
different app. Noted, not filed.*

### 4.4 One unnamed control — CONFIRMED

**`components/Board.tsx:796`.** The bot's face-down card is wrapped in a `Pressable` with an
`onPress` that opens the "Revealed after River" tooltip — but **no `accessibilityRole` and no
`accessibilityLabel`**. It is focusable and a screen reader announces nothing. It appears at all
four widths on both engines (28×33 at 320, up to 40×47 at 430). It is the only unnamed interactive
element in the entire 33-route sweep.

### 4.5 The gated screens — all four behave

| route | gate | verdict |
|---|---|---|
| `/chip-store` | both payment flags `false` | **CLOSED — and it says so**: "💎 Chip packs are coming soon!", no buy surface |
| `/simulate` | `__DEV__` guard | **CLOSED** — redirected to home |
| `/debug` | `__DEV__` guard | **CLOSED** — redirected to home |
| `/spectate` | no room code | renders "⚠️ No room code provided" — **correct**, my expectation was wrong |

*One inconsistency worth a glance:* `/chip-store` shows **"⚡ Flash Deal — 2× chips for 24h!"**
directly above "Chip packs are coming soon!". It advertises a deal on a store that cannot sell.

---

## 5 · The honest list

### 5.1 Confirmed independently, and the previous record was right

- `KILL_Board` and `KILL_game` are both `true` (`utils/animationKill.ts:65,68`). Untouched.
- `app.json`: version `2.7.0`, `ios.buildNumber` **510**, `android.versionCode` 90.
- **The splash is three grounds and two wordmarks**, exactly as filed. `assets/splash.png` is
  1284×2778 with corners `#08341A` (green); `app.json` declares `backgroundColor: "#1C0508"`
  (maroon); the app is `#0a0a0a`. Measured from the pixels, not read.
  **One item the previous filing missed**: `android.adaptiveIcon.backgroundColor` is *also*
  `#1C0508` — the same stale maroon sits behind the new Android icon.
- **`cups.tier` is broken as described.** `cups.tier` is `integer` 1–5 in the database;
  `app/(tabs)/cups.tsx:9` keys `TIER_LABELS` by `'bronze'…'diamond'`. So `TIER_LABELS[1]` is
  `undefined` and both call sites fall through to `name_he`, which holds `"Bronze Cup"`. Rows read
  "Bronze Cup" over a "1". Mild, real, two lines to fix — index by `cup.id`.
- All six C1 icon assets are present at 1024×1024 (64×64 favicon) on a `#0A0A0A` ground.

### 5.2 Open, and worth Roye's decision

1. **`earn_chips` grants chips to an unauthenticated caller** (§3.4a). Bounded but open, and it is
   the same hole handoff 97 named. The narrow fix is to require a session for the purchase-shaped
   event types; the broad one is to make the grant server-initiated.
2. **`chip_transactions` accepts forged ledger rows from anon** (§3.4b). This is the cheaper fix and
   arguably the more urgent, because it is what makes the reconciliation number meaningless. The
   `insert_tx` policy has `WITH CHECK (true)` for `public`; every legitimate writer is a
   `SECURITY DEFINER` function, so the policy can be narrowed to `service_role` without breaking
   anything the app does.
3. **`v_automation_devices` no longer catches this project's own harnesses.** The view matches on
   `webdriver = true` or a `ua` containing Headless/Playwright/Claude/Electron/bot. **Not one row
   in the entire database has `webdriver = true`** — including devices the view *does* flag, which
   it catches on the UA instead. And the 23 rigs in §2.3 carry no UA at all, so the view misses all
   23. The rule adopted last sprint precisely because a hand-maintained list cannot be complete has
   the same shape of hole.
4. **`hand_history.player_count` is a column default, not data.** Default `2`; `boards_total`
   default `5` — an impossible board count. All 73 rows read `player_count = 2`, including 10 rows
   whose `boards_total` is 3 and 2 whose `boards_total` is 2. Any analysis keyed on `player_count`
   is reading the default. `boards_total` is the usable field.
5. **The two legal links are 12 pt tall** (§4.3). App Store review looks at exactly these.
6. **The bot card has no accessible name** (§4.4).
7. **The play grant has paid once** (§2.1). Either the client is not calling `record_hand_net` with
   a `p_hand_id`, or almost nobody finishes a hand. 25 `hand_net` rows in the app's life suggests
   the second, but I did not establish which.
8. **`/chip-store` advertises a flash deal it cannot honour** (§4.5).

### 5.3 What has never been verified — by anyone, including me

**The following modules ship with no test at all.** This is the list I would want before a tester
round, and it is not short:

> `chipMath` · `boardTally` · `deck` · `economy` · `supabaseEconomy` · `webPayments` ·
> `iapEnabled` · `serverAdjudication` · `serverDeal` · `auth` · `guestMigration` · `leaderboard` ·
> `analytics` · `animationKill` · `realtimeMultiplayer` · `privateChannel` · `revealEquity` ·
> `handOutbox` · `shareHand` · `ownedItems` · `playerProfile` · `clubApi` · `lobbyApi` ·
> `notifications` · `sounds` · `heatmap` · `learning` · `crashDetector` · `crashUploader` ·
> `dirtyShutdown` · `efficiencyAnalysis` · `handColors` · `completeBonusPct` · `safeArea` ·
> and ~15 more.

Two of those deserve naming. **`chipMath.ts` is the settlement arithmetic** — the leaf both the
client and the server run, whose entire header explains how a wrong bonus percent would "bundle
green, run, and be quietly wrong in the economy". It has no dedicated test. **`boardTally.ts` is
the three-way tally written *because* four separate screens got the tie count wrong** — it had no
test either. (`tests/verify-rules.test.ts` now exercises both, incidentally rather than by design.)

`boardTally` could not be called from jest at all until this sprint: it reads the React Native
global `__DEV__`, which Metro defines and Node does not, so it throws `ReferenceError` before
computing anything. That is not an app defect. It is a good part of the reason nobody had tested it.

**Also never verified, and not verifiable from here:**

- **Anything about the phone.** This audit is web. iOS renders **Georgia**, not Playfair;
  `adjustsFontSizeToFit` is a no-op on web and real on iOS; `Pressable` honours `hitSlop` there and
  not here. **Nothing in §4 is evidence about build 510.** The masthead at 118 pt in Georgia has
  still never been seen by anyone.
- **Multiplayer end to end.** `mp_server_adjudication_enabled` is `true` and `resolve-hand` is
  deployed, but `hand_history` contains **no `multiplayer` session type at all** — only `practice`
  and `quick_poker`. Two devices have never been driven through a real MP hand by me.
- **The binding refusal path** (§3.3) — exercised in production once, read but not run by me.
- **`run_daily_reconciliation`** is the one economy function that is *not* `SECURITY DEFINER`. I
  did not run it.

### 5.4 Corrections to `CLAUDE.md`

| line | says | measured today |
|---|---|---|
| tables | 56 | **72** |
| RPCs | 127 | **198 functions** (157 anon-callable) |
| Edge Functions | 16 | **14 active** |
| tests | 2,474 | **2,671 passing, 44 suites, 0 failures** (`npm test`, 165 s). 17 of those are this sprint's, so the figure before today was 2,654 — the line has been stale for a while. |

---

## 6 · The verdict

**Is it right?** The parts that decide a hand are right, and they are right by proof rather than by
sampling. The board rule matches the server over every reachable distribution at every table size.
Ties occur at 5–8 % and settle zero-sum on all 60,000 hands I dealt. The dynamic board count is
correct in the function *and* on the screen, at three player counts, two engines and four widths,
with three independent witnesses agreeing in all twelve cells. No card is ever dealt twice. Every
route loads and renders at every width on both engines with no horizontal overflow and no
app-originated console error. The payment boundary is genuinely closed: eight separate attacks from
outside, all refused, `purchases` still empty. That is a better result than I expected to write.

**What would I not put in front of testers?**

**One thing, and it is not on the screen.** `chip_transactions` accepts a forged ledger row from
anyone holding the public key, and `earn_chips` hands 6,500 chips to a caller with no session at
all. Neither breaks a game. Both break the *numbers you use to decide things* — the reconciliation
in §2.2 is the metric this project has been watching, and today anyone can move it. A tester round
generates exactly the kind of traffic that makes such a gap hard to read afterwards. **I would fix
the `insert_tx` policy first** — it is one policy, it breaks nothing the app does, and until it is
fixed the economy has no trustworthy ledger.

**Two smaller things I would fix before a tester round**, both cheap: the 12-pt Privacy and Terms
links, because App Store review reads exactly those, and the flash-deal banner over a closed store,
because it reads as broken rather than as "coming soon".

**And the honest limit of all of the above.** This is the web build. Build 510 is on TestFlight and
**no human has looked at it.** The masthead is Georgia there and Playfair here; the wordmark is flat
gold there and a gradient here; `hitSlop` works there and not here; the first frame is a green,
sans-serif splash on maroon bars opening a black, serif app. Everything in §4 is a floor
measurement of the web surface. **The thing most likely to be wrong about this release is the thing
this audit could not reach**, and the shortest path to knowing is Roye opening TestFlight and
looking at the first second and the home screen.
