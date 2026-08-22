# CAPS — the price ladder, and a subscription with nothing behind it (2026-08-22)

Config only. The ladder and the subscription are fixed. **Three findings say the subscription is a
promise with no delivery behind it**, and one correction says the clamp was never the blocker.

---

## 1. The new ladder — read back from production

| # | id | label | chips | price | chips/$ | vs below | clamp |
|---|---|---|---:|---:|---:|---|---|
| 1 | `small` | Starter | 2,000 | $0.99 | **2,020.2** | anchor | within |
| 2 | `medium` | Popular | 7,000 | $2.99 | **2,341.1** | +16% | above |
| 3 | `large` | Pro | 13,000 | $4.99 | **2,605.2** | +11% | above |
| 4 | `premium` | High Roller | 30,000 | $9.99 | **3,003.0** | +15% | above |
| 5 | `mega` | Whale | 70,000 | $19.99 | **3,501.8** | +17% | above · **BEST VALUE** |

**Curve monotonically increasing: proven** from a production read, computed in SQL rather than
asserted — 2020.2 < 2341.1 < 2605.2 < 3003.0 < 3501.8, every step positive. **The rule for whoever
edits this next: each tier must give more chips per dollar than the one below it.**

Top tier drops **200,000 → 70,000** as instructed — ~700 hands at the 100-chip worst case, still a
Whale tier with something after it.

### Badge

**"BEST VALUE" moved to `mega`, and removed from `medium`.**

It is the only badge I can defend. On a monotonically increasing curve the top tier *is* the best
value per dollar — 3,501.8 against 2,020.2 at the bottom — so the claim is arithmetically true.
`medium` previously carried it while being the **worst** value on the board (1,672/$ against small's
2,020/$), which is what made it a trust problem rather than a pricing opinion.

I did **not** replace it with "MOST POPULAR" or similar: there have been **zero purchases ever**, so
any popularity claim would be invented.

## ⚠️ Correction to the brief: the clamp was never the blocker

The brief says *"three of five now sit under the 2,000 clamp — the $9.99 and $19.99 tiers still need
the separate purchase-credit path"*. Measured: **four of five exceed 2,000 chips** — only `small`
(2,000 exactly) is within it.

**But it does not matter.** `credit_purchase` (built last sprint) **never calls `record_reward`** and
is not subject to its clamp — it reads chips from `app_config` and credits directly. **Proven live:**

```
credit_purchase(..., 'mega', ...) → {ok:true, granted:70000, new_balance:70000}
```

So no tier needs anything further, and the clamp question the last two sprints carried is **closed
for the purchase path**. `record_reward` and its clamp remain untouched.

## 2. The subscription — and three findings that matter more than the number

**Applied:** `subscription_price_usd` 2.99 → **4.99**; `subscription_daily_chips` 1,000 → **400**
(= 12,000/month).

| pack | one-off chips | sub month 1 (12,000 / $4.99) | sub month 2 (24,000 / $9.98) |
|---|---:|---|---|
| $0.99 small | 2,000 | sub 6.0× more | sub 12.0× more |
| $2.99 medium | 7,000 | sub 1.7× more | sub 3.4× more |
| **$4.99 large** | **13,000** | **pack wins by 1,000** | **sub 1.8× more** |
| $9.99 premium | 30,000 | pack wins | pack still wins (sub passes in m3) |
| $19.99 mega | 70,000 | pack wins | pack wins (sub passes in m6) |

Against the same-priced $4.99 pack the subscription gives **less in month one and more in month
two** — the commitment shape asked for. Per dollar the sub sits at 2,405/$: above small and medium,
**below** large, premium and mega. The packs are better value; the subscription is the steady drip.

Previously the sub was **10,033/$** and beat even the old top pack (10,005/$) — which is why nobody
who did the maths would have bought a pack.

> ### ⚠️ Finding 1 — the subscription delivers nothing today
> `is_subscriber` is **written** in two places (AsyncStorage and `profiles`,
> [shop.tsx:127](app/shop.tsx:127)) and **read in zero**. There is no job, RPC or trigger that pays
> out `subscription_daily_chips`. Whatever number is in config, **no chips are delivered**. Changing
> 400 vs 1,000 changes an *advertised promise*, not a payout.

> ### ⚠️ Finding 2 — the daily figure was hardcoded
> `shop.tsx` rendered the literal `"1,000 chips/day"` in the card and `"1000 chips/day"` in the
> activation toast; neither read the config. A number that lives in config **and** is typed into the
> UI will drift, and it already had. **Fixed:** both now read `subscription_daily_chips`, falling
> back to stating *no* number rather than a stale one.

> ### ⚠️ Finding 3 — `subscription_price_usd` is inert
> The price a player sees comes from RevenueCat (`monthlyPack.product.priceString`), not from
> `app_config`. My change to 4.99 **does not change the displayed price**. It must also be changed in
> the store product, or config and the store will disagree — the same drift as finding 2, one layer
> out.

### Non-chip perk

Added `app_config.subscription_perks = ["vip_avatar","vip_leaderboard_marker"]`. Chosen because the
cosmetic system already supports permanent entitlements of exactly this shape — `buy_avatar`,
`buy_card_back`, `buy_emotes`, `buy_table_theme` all exist and were proven 5/5 in the shop sprints.

**Stated plainly: this is declared, not delivered.** Like the daily chips it needs a reader for
`is_subscriber`, and there isn't one. I am not going to report a perk as shipped when the mechanism
that would grant it does not exist.

### `pro_tier_price_usd` / `business_tier_price_usd` — leftovers, and a collision

Repo-wide search returns **zero consumers** for either. **And there is now a collision:**
`pro_tier_price_usd` is 4.99 — the same as the new subscription price, with a different meaning and
no owner. **Not silently reconciled**, as instructed. Recommend deleting both keys once someone
confirms no external tool reads them.

## 3. Live verification — and its boundary, named

Chip store on caps.ftable.co.il, **webkit and chromium, 375 and 393**, four runs:

- labels `[]` · badges `[]` · prices `[]` · **buy controls `[]`**
- `overflowX` **false** at both widths · **0 page errors**
- screen reads *"💎 Chip packs are coming soon!"*

**Nothing purchasable, flags off: confirmed** — that empty buy-control list *is* the proof.

**Boundary, stated rather than glossed:** the five packages **did not render**, because rendering
them requires `(iap_enabled || web_payments_enabled)` and both are false. So *"five packages, correct
chips, correct prices, badge on the right tier"* could **not** be verified visually without flipping
a payment flag, which the brief forbids. **I did not flip it.** The card content is instead verified
from a production config read (the table above), and the layout is verified for the screen as it
actually renders. **The card layout at 375/393 with five cards present remains unverified.**

## 4. Untouched, confirmed from production

daily reward **150** · rescue **200** · rake **5%** · `iap_enabled` **false** ·
`web_payments_enabled` **false** · `record_reward` clamp untouched · no catalogue cosmetic added or
repriced · no C5, stake tiers, stakes UI or tournaments · no `game_rooms` or `room_players` row
edited.

`purchases` 0 rows · `purchase_chips` transactions 0 · 0 `test-` devices · real bindings 3 · real
player `6956-24d1-5ee4` untouched, 59 events.

**Cleaned:** 1 SQL probe device (`test-ladder-probe`, used to prove the 70,000 credit) and 4 browser
devices from the live shop runs — purchases, chip_transactions, leaderboard, daily_rewards,
device_identity and analytics_events all cleared.

*(handoff: `vamos_handoffs` id 99 · shipped `main b0ebaeb`, `5b19927`)*
