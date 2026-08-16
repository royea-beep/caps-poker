# 2026-08-16 — Guests cannot buy, and the bug-report flood

Three migrations. **No app code changed**, so nothing deployed. `tsc` exit 0.

## Task 1 — the guest refusal, and a much larger finding

### The refusal is clean

`redeem_starter_offer` now returns at the very top, before the eligibility lookup and before any
write:

```sql
IF p_user_id IS NULL THEN
  RETURN jsonb_build_object('success', false, 'reason', 'sign_in_required');
END IF;
```

Three anonymous calls, live:

```
call 1: status 200 | {"reason":"sign_in_required","success":false}
call 2: status 200 | {"reason":"sign_in_required","success":false}
call 3: status 200 | {"reason":"sign_in_required","success":false}
```

Was Postgres **23502** every time. **No row left behind** — verified by query, 0 probe rows in
`starter_pack_redemptions` after all three.

### The bigger finding: the starter offer has NEVER worked, for anyone

Counting the poisoned rows turned up something larger than the brief anticipated:

| | |
|---|---|
| `starter_pack_redemptions` rows | **649** |
| of those, guest rows (`user_id IS NULL`) | **648** |
| rows whose device **never received chips** | **649 — all of them** |

Not 648. **649.** Even the single signed-in row was never credited. There are **two independent
failures**, and the guest crash was only the first:

1. **Guests** threw 23502 on `chip_purchases.user_id` before reaching the credit.
2. **Signed-in users** get past that and call
   `earn_chips(p_device_id, 'starter_pack_2x', chips)` — and **`starter_pack_2x` is not in
   `earn_chips`' allow-list**, so it returns `{ok:false, error:'unknown_event_type'}` and credits
   nothing.

`chip_transactions` holds **zero** rows of `starter_pack_2x` or `iap_starter_pack`. The offer has
never granted a chip to anybody, guest or signed-in, while marking 649 devices as having redeemed
it.

The same allow-list gap hits the other purchase path: `app/shop.tsx:90` calls
`earn_chips(..., 'iap_starter_pack')`, equally absent from the list, and then does
`addChips(result?.chips_earned ?? 5000)` — so the **local wallet gains 5,000 that the server never
recorded**. Not fixed: these are grant paths worth 5,000–10,000 chips and need Roye's call.

**Recommendation on the 649 rows:** delete the ones that were never credited, so those devices can
receive the offer once the grant path works. They record a purchase that never happened. I have
**not** deleted them — the brief said report the count before deciding, and 649 rows of real
devices is not my call.

### What a guest sees on `/chip-store`

The screen renders and the packages are shown; the BEST VALUE badge still does not render, so it
remains unmeasured from the earlier brief. There is **no sign-in gate and no "sign in to buy"
copy** — a guest is offered a purchase that the server will now refuse with `sign_in_required`.
Reported only; the copy is Roye's call, and no sign-in flow was built.

### Other writers to `chip_purchases`

Four functions reference the table: `redeem_starter_offer` (fixed above), **`record_chip_purchase`
(`p_user_id uuid, p_package_id, p_receipt_id`) — same NOT NULL shape, same failure waiting if ever
called with a null user**, plus `purge_user_data` and `get_caps_dashboard`, which only read/delete.

## Task 2 — `bug_reports` rate limit

**Sized from the 250 real rows:** 245 session-days, **max 4 per session per day**, p95 = 1,
p99 = 1, average 1.02, and 8 rows with a null session.

**Limit: 20 per session per rolling 24h** — 5× the observed maximum, so a tester having a bad
session and filing repeatedly will not hit it.

**Enforced by a `BEFORE INSERT` trigger** (`enforce_bug_report_rate_limit`), not an RPC. The brief
preferred the smallest change, and the client already handles a failed insert —
`ReportBugButton.tsx:102`: `if (error) { setStatus('error'); return; }` — so a refusal surfaces as
the button's **existing error state, not a crash**. Moving to an RPC would need a client change and
a redeploy for no extra protection.

**Anon INSERT is still open.** This is a rate limit, not a revoke. A null session is allowed
through rather than blocked, so the 8 existing null-session rows remain possible.

Verified by flooding, then by reporting normally:

```
FLOOD  — same session: calls 1-20 accepted, call 21 refused
         400 {"code":"23514","message":"bug_report_rate_limit: 20 reports from this session in 24h (max 20)"}
NORMAL — a different session: 201 accepted
```

**An honest limit:** `session_id` is client-supplied, so a determined flooder can rotate it and
defeat this — the same weakness `p_hand_id` has in `record_hand_net`. It bounds the realistic case
(a stuck retry loop, a naive script reusing one session). The table stores no IP, so nothing
sturdier can be counted against history without a schema change.

**A cost I should have avoided.** The flood test inserted 21 rows, and each fired
`on_bug_report_inserted` → **21 AI triage calls were consumed**. Telegram and GitHub were *not* hit
(0 each). I should have disabled the notification trigger for the test or exercised the limit
function directly. All 21 rows are deleted and `bug_reports` is back to exactly **250**.

## Task 3 — report only

**`track_event` is NOT bounded upstream.** Tested rather than assumed: 80 rapid anon calls in
756ms returned **80 × 200, zero 429s**. Supabase's gateway refused nothing at that rate. It writes
straight to `analytics_events` and fires no external service, so the cost is data pollution — the
data Roye judges tester behaviour by. Nothing added.

**`create_table` — what a lobby flood looks like.** `utils/lobbyApi.ts:125`, not `create_room`. Each
call inserts a `game_rooms` row plus a `room_players` seat, with `expires_at = now() + 30 minutes`
and no per-device limit. `list_public_tables` returns every waiting room, so a loop would push the
11 real tables off the top of the lobby with dozens of dead ones for a 30-minute window — and the
lobby is the first thing a friend sees when invited. **I did not test this**: it would create
`game_rooms` rows, which I am not permitted to delete. The natural fix is a per-device count of
open rooms, not a time window.

## Rake comment corrected

`record_hand_net`, comment only — behaviour, the 20,000 ceiling, the ±10,000 clamp and the
idempotency gate are byte-identical. The old text claimed `default 0 = dormant, no-op`;
`app_config.hand_rake_pct` is **5**, and `chip_transactions` already holds 10 rake rows totalling
39 chips. Verified unchanged after the migration: `+200 → rake 10`, `-150 → rake 0`, duplicate id
still `{"net":0,"duplicate":true}`.

## DB state

```
probe rows: leaderboard 0 | chip_transactions 0 | analytics_events 0 | economy_log 0
            starter_pack_redemptions 0 | bug_reports 0
bug_reports 250 (baseline) | hand_history 151 (baseline) | rooms 11 | room_players 0
```

`leaderboard` is **784** against a 782 baseline. Both extra rows are **real visitors** — this run
opened no browser at all, only SQL and direct `fetch`. Deleting them would destroy real data to
make a number match.

## MACHINE

`tsc` exit 0; memory test still not run, so local stays PROVISIONAL.

=== STRATEGIST HANDOFF — GUEST PURCHASE + BUG FLOOD ===
TASK 1 GUEST PURCHASE:
  - refusal added before any write? YES — redeem_starter_offer, first statement in the body, before
    get_starter_offer_for_device and before every INSERT. Shape: {"success":false,
    "reason":"sign_in_required"}.
  - anonymous call now returns cleanly, no 23502? YES, three times:
    status 200 | {"reason":"sign_in_required","success":false}
    and 0 rows written to starter_pack_redemptions, verified by query.
  - poisoned rows: 649 total redemption rows, 648 of them guests — and ALL 649 were never credited,
    including the one signed-in row. RECOMMENDATION: delete the never-credited rows so those
    devices can receive the offer once the grant path works. NOT deleted — 649 real devices is
    Roye's call, and the brief said report the count first.
  - BIGGER FINDING: the starter offer has never granted a chip to ANYONE. Two independent
    failures — guests threw 23502; signed-in users reach earn_chips(p_device_id,'starter_pack_2x')
    and 'starter_pack_2x' is NOT in earn_chips' allow-list, so it returns unknown_event_type and
    credits nothing. chip_transactions holds ZERO starter_pack_2x or iap_starter_pack rows.
    app/shop.tsx:90 has the same gap with 'iap_starter_pack' and then does
    addChips(result?.chips_earned ?? 5000) — the LOCAL wallet gains 5,000 the server never recorded.
    Reported, not fixed: grant paths worth 5,000-10,000 chips.
  - what a guest sees on /chip-store: packages ARE shown, with no sign-in gate and no explanatory
    copy — a guest is offered a purchase the server now refuses. BEST VALUE badge still does not
    render, so it remains unmeasured. Copy is Roye's call; no sign-in flow built.
  - other chip_purchases writers with the same NOT NULL shape: record_chip_purchase(p_user_id uuid,
    p_package_id, p_receipt_id) — same failure waiting if called with a null user. purge_user_data
    and get_caps_dashboard only read/delete.
TASK 2 BUG REPORTS:
  - realistic volume from the 250 rows: 245 session-days, MAX 4 per session-day, p95 1, p99 1,
    avg 1.02, 8 null-session rows.
  - limit: 20 per session per rolling 24h (5x the observed max). Enforced by a BEFORE INSERT
    TRIGGER (enforce_bug_report_rate_limit), not an RPC — smallest change, and the client already
    handles a failed insert so no client work was needed.
  - anon INSERT still open? YES. Rate limit, not a revoke. Null sessions pass through.
  - FLOOD: calls 1-20 accepted, refused at CALL 21 —
    400 {"code":"23514","message":"bug_report_rate_limit: 20 reports from this session in 24h (max 20)"}
    NORMAL: a different session -> 201 accepted.
  - does a refusal look like a crash? NO — ReportBugButton.tsx:102 already does
    `if (error) { setStatus('error'); return; }`, the button's own error state.
  - HONEST LIMIT: session_id is client-supplied and can be rotated to defeat this, same weakness as
    p_hand_id. No IP is stored, so nothing sturdier can be counted without a schema change.
  - COST I CAUSED: the flood test fired the notification trigger 21 times, consuming 21 AI triage
    calls. Telegram and GitHub were NOT hit (0 each). I should have disabled the trigger for the
    test. All 21 rows deleted; bug_reports back to exactly 250.
TASK 3 REPORT ONLY:
  - track_event bounded upstream? NO — measured, not assumed: 80 rapid anon calls in 756ms returned
    80x200 with zero 429s. Writes to analytics_events, fires no external service. Nothing added.
  - create_table lobby flood: each call writes a game_rooms row + a room_players seat, expires_at
    now()+30min, no per-device limit; list_public_tables returns every waiting room, so a loop
    buries the 11 real tables under dead ones for 30 minutes — and the lobby is the first thing an
    invited friend sees. NOT tested: it would create game_rooms rows I may not delete. Natural fix
    is a per-device open-room count, not a time window.
RAKE COMMENT corrected? YES — record_hand_net, comment only, behaviour byte-identical (verified:
  +200 rake 10, -150 rake 0, duplicate still {"net":0,"duplicate":true}). hand_rake_pct is 5, and
  10 rake rows totalling 39 chips already exist.
CLEANUP: all probe rows deleted and verified — leaderboard 0, chip_transactions 0, analytics_events
  0, economy_log 0, starter_pack_redemptions 0, bug_reports probe rows 0. bug_reports 250,
  hand_history 151, rooms 11, room_players 0. leaderboard 784 vs 782 baseline: both extra rows are
  REAL visitors (no browser opened this run), so they were left alone.
MACHINE: tsc exit 0; memory test still not run, local remains PROVISIONAL.
tsc: exit code 0 (by exit code, not output). No app code changed — nothing deployed.
HANDOFF: file + vamos_handoffs slug 2026-08-16-guest-purchase-and-bug-flood + chars, match? Y
WHAT I DID NOT CHECK: whether the 649 never-credited rows include devices that later signed in;
  whether record_chip_purchase is called anywhere from the client; the chip-store screen was read
  for structure, not exercised through an actual purchase attempt; create_table was reasoned about
  rather than flooded; and I did not verify that 20/session/day survives a real tester filing from
  multiple devices, since the limit keys on session rather than person.
=== END ===
