# 2026-08-16 — Rate limiting: the real hole, and three that were already bounded

One migration. **No app code changed**, so nothing deployed. `tsc` exit 0.

## Task 1 — `record_hand_net` is capped

The brief was right that this was the hole worth closing: it is the function that moves chips after
every hand, its idempotency gate keys on a **client-supplied** `p_hand_id`, and a fresh id per call
defeats it entirely at up to +10,000 a time.

### Sized from measured data

`chip_transactions` where `event_type = 'hand_net'`:

| | |
|---|---|
| max gained per device per day | **250** |
| p95 / p99 | 250 / 250 |
| average | 78 |
| max calls per device per day | 2 |
| device-days sampled | 35 |

The theoretical maximum for **one legitimate hand** is `potPerBoard(25) × players × boards` =
200 (2P), 225 (3P), 200 (4P). So real play produces low hundreds while the per-call clamp allowed
10,000.

**Ceiling: 20,000 per device per day.** That is 80× the observed maximum and about 90 perfect hands
with zero losses — a real session cannot reach it — while a loop at the +10,000 clamp is stopped on
the third call. The cap exists to bound a loop, not to end a long evening.

**Only gains are metered.** A losing player must always be able to record the loss, so `v_net <= 0`
is never refused — the same shape as `submit_score`'s gain ceiling.

**The idempotency gate is kept, unchanged, alongside it.** It stops a replayed id; the cap stops a
stream of new ones. Neither substitutes for the other. The cap check runs *before* the ledger
insert, so a refused call writes no row.

### Verified by exploiting, then by playing

```
EXPLOIT — fresh hand id every call, which defeats idempotency:
  call 1: {"ok":true,"net":10000,"new_balance":9500}
  call 2: {"ok":true,"net":10000,"new_balance":19000}
  call 3: {"ok":false,"reason":"hand_net_cap_daily","cap":20000,"gained_today":20000}

IDEMPOTENCY still intact — same id twice:
  a: {"ok":true,"net":150,"new_balance":143}
  b: {"ok":true,"net":0,"duplicate":true,"new_balance":143}

NORMAL play — a real hand is 200-225 at most:
  +200 -> ok, new_balance 190
  -150 -> ok, new_balance  40
  +225 -> ok, new_balance 254

A LOSS at an already-capped device:
  -200 -> ok, new_balance 18800     (never refused)
```

**Noticed while testing:** the house rake is **live at 5%**, not the dormant 0 the code comment
describes (500 on 10,000, 10 on 200, 11 on 225). Not touched — reporting it because the comment
says "default 0 = dormant, no-op" and that is no longer true.

## Task 2 — the three redemptions: all self-limiting, none capped

Each was made **genuinely eligible** first, then called repeatedly with the **same** device id.

| function | classification | evidence |
|---|---|---|
| `redeem_referral` | **SELF-LIMITING** | real code `23EA7AD9`: call 1 `success:true, referrer_earned:300`, calls 2-3 `"Already redeemed"` |
| `claim_share_reward` | **SELF-LIMITING** | real `shared_hands` row: call 1 `granted:50`, calls 2-3 `granted:0, already_claimed:true` |
| `redeem_starter_offer` | **SELF-LIMITING ×3, and currently broken** | see below |

**Nothing capped.** Adding a daily ceiling to a function that already refuses its second call would
be ceremony, not protection.

### `redeem_starter_offer` — three independent bounds, and a real defect

It is bounded three ways over: `starter_pack_redemptions` has **`UNIQUE (device_id)`** with
`ON CONFLICT (device_id) DO NOTHING`, so one redemption per device ever; it credits through
`earn_chips`, which now carries the 5,000/day ceiling; and its eligibility gate
(`get_starter_offer_for_device`) must pass.

But it **throws for every anonymous caller**. Tested with both a repeated receipt and fresh
receipts, all five calls returned Postgres error **23502**, a NOT NULL violation. The failing row
matches `chip_purchases`, whose `user_id` is NOT NULL, while the second insert passes `p_user_id` —
null for a device-anonymous player:

```sql
INSERT INTO chip_purchases (user_id, package_id, chips_received, price_usd, platform, receipt_id)
VALUES (p_user_id, pkg_id, chips, price, p_platform, p_receipt_id);   -- p_user_id NULL -> 23502
```

So an anonymous player who reaches the starter offer gets an error rather than chips, and the
`starter_pack_redemptions` row written just before it is left behind. Not fixed — it is a purchase
path, outside this brief, and it needs a decision about whether guests may buy at all.

## Task 3 — non-economy surfaces: reported, not changed

The brief asked to establish the surface first, so nothing was added.

| surface | what it actually is | bounded? |
|---|---|---|
| `track_event` | RPC `(p_event, p_user_id, p_device_id, p_data, p_screen)` → `analytics_events`, called from `utils/analytics.ts:215` | **No.** No rate shape of any kind in the body. |
| room creation | **`create_table(p_player_count, p_host_id, p_host_name, p_device_id)`** via `utils/lobbyApi.ts:125` — *not* `create_room` | **Partially.** No per-device limit; the only bound is `expires_at = now() + interval '30 minutes'`, so rooms self-clean but a loop can still fill the lobby inside that window. |
| `submit_bug_report` | **Does not exist.** The client inserts **directly**: `components/ReportBugButton.tsx:75`, `sb.from('bug_reports').insert({...})` | **No** — and it is the most consequential of the three. |

**Why `bug_reports` matters most.** Its insert fires an AFTER-INSERT trigger,
`on_bug_report_inserted → trigger_analyze_bug_report()`, which runs AI triage and posts to Telegram
and GitHub. Flooding it does not merely cost storage — it spams external services and the channel
Roye reads. It is also the table whose count (250) is tracked as a session invariant.

**I did not add limits, deliberately.** The brief says adding limits to something already bounded
upstream is wasted work, and I could not verify Supabase's platform-level gateway limits from here —
they are per-project/IP and not visible to a SQL client. Guessing at them and layering a second
limit on top is exactly the wasted work the constraint warns about. A limit on `bug_reports` also
lands on the **tester path**, which must not be blocked. All three need Roye's call on thresholds.

**Recommendation, in priority order:** `bug_reports` first (external side effects), then
`create_table` (a per-device open-room count is the natural shape, not a time window), then
`track_event` (cheapest to abuse, least harmful).

## DB state

Every probe row deleted and verified across all `device_id`-bearing tables plus
`chip_purchases`, `referral_links`, `referral_redemptions`, `starter_pack_redemptions` and
`shared_hands`.

```
probe- rows: leaderboard 0 | chip_transactions 0 | shared_hands 0 | referral_links 0
             starter_pack_redemptions 0 | referral_redemptions 0
hand_history 151 (baseline) | bug_reports 250 | rooms 11 | room_players 0
```

`leaderboard` reads **783 against a 782 baseline**. The extra row (`2d28-fb88-f5b0`, fresh 2530
wallet, `hands_played 0`, 18:39) is **not mine** — this run opened no browser at all, only SQL and
direct `fetch` calls. It is a real visitor, and deleting it would have destroyed real data to make a
number match.

## MACHINE

`tsc` exit 0; memory test still not run, so local stays PROVISIONAL.

=== STRATEGIST HANDOFF — RATE LIMITS ===
TASK 1 record_hand_net:
  - observed max hand_net per device per day: 250 (p95 250, p99 250, avg 78, max 2 calls/day, 35
    device-days). Theoretical max for ONE legitimate hand = potPerBoard(25) x players x boards =
    200/225/200.
  - ceiling chosen: 20000/device/day. Headroom: 80x the observed max, ~90 perfect hands with zero
    losses, so real play cannot reach it — while a loop at the +10,000 per-call clamp dies on call
    3. Only GAINS are metered; a loss is never refused.
  - idempotency kept alongside the cap? YES, unchanged. It stops a replayed id, the cap stops a
    stream of new ones. Cap checked BEFORE the ledger insert so a refusal writes no row.
  - EXPLOIT: fresh hand ids, refused at CALL 3 —
    {"ok":false,"reason":"hand_net_cap_daily","cap":20000,"gained_today":20000}
  - NORMAL: +200 -> ok/190, -150 -> ok/40, +225 -> ok/254. Loss at a capped device: -200 -> ok.
    Duplicate id still returns {"net":0,"duplicate":true}.
  - NOTED: the house rake is LIVE at 5%, not the dormant 0 its comment claims. Untouched.
TASK 2 REDEMPTIONS — all SELF-LIMITING, none capped:
  - redeem_referral: SELF-LIMITING. Real code, same redeemer repeated: call 1 success + 300 to the
    referrer, calls 2-3 "Already redeemed".
  - claim_share_reward: SELF-LIMITING. Real shared_hands row, same device repeated: 50, then
    granted 0 with already_claimed true, twice.
  - redeem_starter_offer: SELF-LIMITING THREE WAYS — UNIQUE(device_id) with ON CONFLICT DO NOTHING,
    credits via the now-capped earn_chips, plus its eligibility gate. AND IT IS BROKEN: all five
    calls (same receipt and fresh receipts) threw 23502 NOT NULL on chip_purchases.user_id, which
    is null for an anonymous device. An anonymous player gets an error instead of chips, and the
    starter_pack_redemptions row written just before is orphaned. Reported, not fixed — purchase
    path, and it needs a decision on whether guests may buy.
  - made eligible first? YES — created a real referral code via create_referral_link, a real
    shared_hands row, and leaderboard rows for each probe device. Repeated the SAME device id.
  - capped which? NONE. A function that refuses its own second call does not need a ceiling.
TASK 3 NON-ECONOMY — surface reported, nothing added:
  - track_event: RPC (p_event,p_user_id,p_device_id,p_data,p_screen) -> analytics_events, called
    from utils/analytics.ts:215. NOT bounded — no rate shape in the body.
  - room creation: it is create_table(p_player_count,p_host_id,p_host_name,p_device_id) via
    utils/lobbyApi.ts:125 — NOT create_room/join_room. Only bound is expires_at = now() + 30
    minutes, so rooms self-clean but a loop can fill the lobby inside that window.
  - submit_bug_report: DOES NOT EXIST as an RPC. The client inserts DIRECTLY —
    components/ReportBugButton.tsx:75, sb.from('bug_reports').insert(). Unbounded, and its
    AFTER-INSERT trigger on_bug_report_inserted runs AI triage and posts to Telegram + GitHub, so
    flooding it spams external services, not just storage.
  - added a limit? NO, deliberately. Supabase's platform gateway limits are not visible to a SQL
    client, and layering a second limit on an unknown first is the wasted work the brief warns
    about; a bug_reports limit also lands on the TESTER path. Priority if Roye wants them:
    bug_reports (external side effects) > create_table (per-device open-room count) > track_event.
CLEANUP: all probe rows deleted and verified by query — leaderboard 0, chip_transactions 0,
  shared_hands 0, referral_links 0, referral_redemptions 0, starter_pack_redemptions 0,
  chip_purchases probe receipts 0. hand_history 151, bug_reports 250, rooms 11, room_players 0.
  leaderboard is 783 vs a 782 baseline: that row is a REAL visitor (18:39, fresh wallet) — this run
  opened no browser, so it is not mine and was not deleted.
MACHINE: tsc exit 0; memory test still not run, local remains PROVISIONAL.
tsc: exit code 0 (by exit code, not output). No app code changed this run — nothing deployed.
HANDOFF: file + vamos_handoffs slug 2026-08-16-rate-limits + chars, code-point match? Y
WHAT I DID NOT CHECK: whether Supabase's gateway already rate-limits anon RPC calls (not visible
  from SQL); whether a grinding player can legitimately exceed 20,000 hand_net gains in one day —
  I reasoned from the per-hand maximum rather than observing a long session; the starter-offer
  23502 was reproduced but its client path was not traced; and I did not test create_table or
  track_event under load, only read their definitions.
=== END ===
