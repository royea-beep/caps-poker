# 2026-08-16 — Make the purchase paths actually credit

Shipped `e8a76dd`, deployed, CI `tsc` clean (0-byte artifact). One migration, one client fix.

## Task 1 — both event types added, with the server as the authority

`starter_pack_2x` and `iap_starter_pack` are now in `earn_chips`, but not as ordinary entries in
the allow-list. They are handled as **one-time purchase grants** in their own branch, because three
things about them differ from every other event in that list.

### The server decides the amount

`p_amount` is **ignored** for these two. The amounts come from the same `app_config` keys the offer
itself reads:

| event | config key | value |
|---|---|---|
| `starter_pack_2x` | `starter_pack_2x_chips` | **10,000** |
| `iap_starter_pack` | `starter_pack_chips` | **5,000** — matches the shop's "+5,000 chips" copy |

That was three different numbers for one grant before: `app/shop.tsx:90` passed **no** amount (so
the server default of 50 would have applied), the UI promised 5,000, and the client fell back to
5,000.

Proven — the client cannot dictate the value:

```
p_amount 999999 on iap_starter_pack -> {"ok":true,"chips_earned":5000,"one_time":true}
p_amount 1      on starter_pack_2x  -> {"ok":true,"chips_earned":10000,"one_time":true}
```

### `iap_starter_pack` had no bound at all — that was a real hole

`starter_pack_2x` was bounded by `UNIQUE (device_id)` on `starter_pack_redemptions`.
**`iap_starter_pack` had nothing**: `app/shop.tsx` called `earn_chips` directly after RevenueCat,
so a repeat call was an unlimited 5,000-chip grant. It only ever failed because the event type was
missing — the moment it was added, that hole would have opened.

Closed in `earn_chips` itself with an `EXISTS` check on `chip_transactions`, which covers both
paths in one place:

```
call 1: {"ok":true,"chips_earned":5000,"one_time":true}
call 2: {"ok":false,"reason":"already_granted","chips_earned":0}
```

### They bypass the 5,000/day ceiling — deliberately

That ceiling exists to stop **farming a repeatable event**. These are one-time-per-device
purchases whose bound is *uniqueness, not rate*. Counting them against it would make the 10,000
starter pack impossible to grant at all, and a 5,000 IAP would swallow a player's entire daily
allowance for winning hands.

Verified the ceiling is untouched for ordinary events and **was not consumed** by the purchase
grants — on the same device that had just received 10,000:

```
hand_won 1500 x3 -> ok (4,500 total)
hand_won 1500 x4 -> {"ok":false,"reason":"earn_cap_daily","earned_today":4500,"cap":5000}
```

### End to end — in the ledger, not just a balance

```
device        event_type         amount  action
probe-buy-3   starter_pack_2x     10000  credit
probe-buy-2   iap_starter_pack     5000  credit
probe-buy-1   iap_starter_pack     5000  credit
```

`chip_transactions` held **zero** rows of either type before this. Probe rows deleted afterwards.

## Task 2 — the optimistic local credit

`app/shop.tsx:94` was `result?.chips_earned ?? 5000`. The wallet gained a hardcoded 5,000 whenever
the server refused or returned nothing — chips the database never recorded, gone on the next
refresh. For this feature's entire life the server refused **every** one of these calls, so that
fallback was the only thing crediting anybody.

Now the wallet moves only on `result?.ok === true`, and reads the amount back from the server:

```js
const earned = result?.ok === true ? (result.chips_earned ?? 0) : 0;
if (earned <= 0) { showToast(…); return; }   // wallet untouched
```

The refusal wording does **not** claim the purchase failed — the money has already left
RevenueCat — it says the chips did not arrive and to contact support. `already_granted` gets its
own line.

**Every other `?? <number>` after a server call was checked.** This was the only site that credits
a wallet. `results.tsx:1183` (`res?.granted ?? 0`) and `:1186` (`res?.chips_earned ?? 0`) already
use the safe zero-fallback shape; the rest are display defaults (`?? 0` counts, `?? 1.1` scale,
`?? 1000` an ELO default).

## Task 3 — the chip store, and the badge

**My previous report was wrong and I am correcting it.** Last run I said a guest "sees the packages
with no sign-in gate". That was inferred, not read. Reading the live screens:

```
/chip-store (122 chars): ← Back | 💰 Chip Store | YOUR BALANCE | 💰 2,000 |
                         ⚡ Flash Deal — 2× chips for 24h! | ✕ | 💎 Chip packs are coming soon!
                         BEST VALUE: false | price strings: false | Buy/Soon: false

/shop       (333 chars): chip-priced items only — Rebuy 500 / Emote pack / Custom avatar …
                         price strings: false
```

**No screen currently offers anyone a real-money purchase.** `chip-store.tsx:155` gates the entire
package list behind `isIapEnabled()`, and `app_config.iap_enabled` is **false**
(VAMOS-HIDE-IAP-506: "products not configured in App Store Connect; Apple rejects non-functional
IAP"). `/shop`'s IAP cards need a RevenueCat package, which web does not supply.

**So the smallest honest change today is none.** There is no offer to gate. The `sign_in_required`
refusal is correct and simply unreachable from the UI at present. When `iap_enabled` is flipped on,
the choice arrives, and the options for Roye are:

1. **A line of copy** under the packages — "Sign in to purchase" — smallest, keeps the packages
   visible as an incentive to sign in.
2. **Disable the buy buttons for guests** with the same line — clearer, no failed taps.
3. **Hide the packages from guests** — cleanest, but hides the reason to sign in.

No sign-in flow was built.

**BEST VALUE badge: not a defect.** It never renders because the whole package list is hidden by
that same `iap_enabled` gate — not because the badge is broken. Both `DEFAULT_PACKAGES`
(`chip-store.tsx:36`) and the live `app_config.chip_store_packages` carry a `BEST VALUE` badge, so
it will appear the moment IAP is enabled. Two briefs of "unmeasured" resolved: **intentional**.

## DB state

```
probe rows: chip_transactions 0 | leaderboard 0 | analytics_events 0 | economy_log 0
starter_pack_2x / iap_starter_pack rows left: 0   (probe grants removed)
starter_pack_redemptions 0 | _backup_starter_redemptions_20260816 649 — INTACT, not dropped
bug_reports 250 | hand_history 151 | rooms 11 | room_players 0
```

Nothing re-deleted, no `game_rooms` / `room_players` rows touched.

## MACHINE

`tsc` crashed once with 0xC0000005 and zero output, then returned 0 on retry; CI's artifact is
0 bytes, clean. Memory test still not run, so local stays PROVISIONAL.

=== STRATEGIST HANDOFF — PURCHASE PATHS ===
TASK 1 ALLOW-LIST:
  - both added, in their own one-time-grant branch in earn_chips (migration
    earn_chips_purchase_grants), not as ordinary allow-list entries.
  - intended values, SERVER as the authority? YES — p_amount is IGNORED. starter_pack_2x reads
    app_config.starter_pack_2x_chips = 10000; iap_starter_pack reads starter_pack_chips = 5000
    (matches the shop's "+5,000 chips" copy). Proven: p_amount 999999 granted 5000, p_amount 1
    granted 10000. Before, three numbers disagreed — the client sent NO amount (server default 50),
    the UI said 5,000, the fallback said 5,000.
  - is iap_starter_pack one-time-per-device? IT WAS NOT — a real hole. starter_pack_2x had
    UNIQUE(device_id) on starter_pack_redemptions; iap_starter_pack had nothing, and shop.tsx
    called earn_chips directly after RevenueCat, so a repeat call was an unlimited 5,000-chip
    grant. It only ever failed because the event type was missing. Closed with an EXISTS check
    inside earn_chips covering both paths: call 2 returns already_granted.
  - ceiling interaction: BYPASS, deliberately. The 5,000/day ceiling stops farming a REPEATABLE
    event; these are one-time-per-device purchases bounded by uniqueness, not rate. Counting them
    would make a 10,000 starter pack ungrantable and a 5,000 IAP would eat a whole day's allowance.
    Verified the ceiling still bites ordinary events and was NOT consumed: hand_won 1500 x3 ok,
    4th refused at earned_today 4500.
  - END TO END: chip_transactions gained starter_pack_2x 10000 credit and iap_starter_pack 5000
    credit (was ZERO rows of either, ever), and the server wallet updated (new_balance 10000 /
    5000). Probe rows deleted after.
TASK 2 OPTIMISTIC CREDIT:
  - fixed at app/shop.tsx:94. Wallet moves only on result?.ok === true; on refusal it does not move
    and the player is told the chips did not arrive (wording avoids claiming the purchase failed —
    the money already left RevenueCat). already_granted gets its own message.
  - other `?? <number>` after a server call: NONE that credit. results.tsx:1183 (res?.granted ?? 0)
    and :1186 (res?.chips_earned ?? 0) already use the safe zero fallback; every other hit is a
    display default (?? 0 counts, ?? 1.1 card scale, ?? 1000 ELO, ?? 75 social proof).
TASK 3 CHIP STORE:
  - CORRECTION to my last report: I said guests "see the packages with no sign-in gate". Wrong —
    that was inferred. Read live, /chip-store shows "💎 Chip packs are coming soon!" and NO
    packages, no prices, no buy buttons (122 chars total). /shop shows only chip-priced items.
    NO screen currently offers anyone a real-money purchase.
  - smallest honest change: NONE today — there is no offer to gate, and sign_in_required is
    correct but unreachable from the UI. When iap_enabled is flipped on, Roye picks: (1) a "Sign in
    to purchase" line under the packages, (2) the same line plus disabled buy buttons for guests,
    or (3) hide packages from guests entirely. No sign-in flow built.
  - BEST VALUE badge: NOT a defect — INTENTIONAL. chip-store.tsx:155 gates the whole package list
    on isIapEnabled(), and app_config.iap_enabled is false (VAMOS-HIDE-IAP-506, Apple rejects
    non-functional IAP). Both DEFAULT_PACKAGES and the live chip_store_packages config carry a
    BEST VALUE badge, so it renders the moment IAP is enabled. Two briefs of "unmeasured" resolved.
CLEANUP: probe rows deleted and verified — chip_transactions 0, leaderboard 0, analytics_events 0,
  economy_log 0, and 0 starter_pack_2x/iap_starter_pack rows left. starter_pack_redemptions 0 (not
  re-deleted), _backup_starter_redemptions_20260816 still 649 (not dropped). bug_reports 250,
  hand_history 151, rooms 11, room_players 0.
MACHINE: tsc crashed once (0xC0000005, no output) then returned 0; CI artifact 0 bytes = clean.
tsc: exit code 0 on retry; CI clean. Deployed e8a76dd, run 31958243020 success.
HANDOFF: file + vamos_handoffs slug 2026-08-16-purchase-paths + chars, code-point match? Y
WHAT I DID NOT CHECK: no real purchase was exercised — RevenueCat supplies no packages on web and
  iap_enabled is false, so shop.tsx's new refusal path was verified by reading the RPC contract,
  not by tapping Buy; whether the 649 restored-from-backup devices would now pass the eligibility
  window (get_starter_offer_for_device checks a 7-day window from first play, so most are likely
  expired); and record_chip_purchase still has the same NOT NULL shape if ever called with a null
  user.
=== END ===
