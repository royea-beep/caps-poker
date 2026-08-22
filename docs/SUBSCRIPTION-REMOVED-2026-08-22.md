# CAPS — the subscription is out, and the Isracard letter is drafted (2026-08-22)

Roye ruled **option 1**. Two findings came out of doing it that were not in handoff 99.

---

## 1. The subscription is removed

**What it actually did when bought** — the full chain, and why removal was right rather than a
tidy-up:

- money left through RevenueCat
- `caps_is_subscriber` was written to **device-local AsyncStorage** — gone on reinstall
- the server write targeted **`profiles`, a table that does not exist**. Only `user_profiles` exists,
  and it has no `is_subscriber` column. supabase-js **returns** the error rather than throwing, and
  the result was discarded — **so it failed silently, every time**
- a toast promised *"VIP Activated! N chips/day unlocked"*
- and **nothing paid those chips** — no job, RPC or trigger reads any subscriber flag

So it was not merely **undelivered**, it was **unrecorded**. A player who paid, reinstalled and
contacted support left no trace of ever having paid. **That is a refund problem, not a product gap.**

**Removed** from [app/shop.tsx](app/shop.tsx): the VIP Monthly card · `handleBuySubscription` (which
is what deletes the broken `profiles` write and the AsyncStorage-only flag) · the `monthly_sub`
offering lookup · `monthlyPack` state · and the `subDaily` config read added earlier today, which
existed only to feed that card. `AsyncStorage` and `getSupabase` became unused in this file and went
with them — **verified by grep before deleting, not assumed**.

The rationale is recorded **at the site** in a comment, so nobody re-adds the card without building
the mechanism first. The Starter Pack path and the chip-priced cosmetics are untouched.

## 2. ⚠️ The subscription never shipped to web — and it killed my verification plan

I planned to prove removal by diffing the deployed web bundle for `VIP Monthly`. The **before**
capture returned **zero** occurrences — of `VIP Monthly`, `monthly_sub`, `caps_is_subscriber` and
`Auto-renews` — *before I had removed anything*.

**Cause, found rather than assumed.** [shop.tsx:261](app/shop.tsx:261) gates the whole IAP block with:

```
Platform.OS !== 'web' && isIapEnabled()
```

Metro statically replaces `Platform.OS` with `'web'` in a web build, so `'web' !== 'web'` is a
constant false and **the entire block is dead-code-eliminated from the web bundle**. The bundle *was*
current — my own string from earlier today ("Card payment is not switched on yet") is in it and the
old copy is gone — so this is elimination, not a stale deploy.

**Consequence, stated:** the VIP card was **native-only** and has never been visible to a web player.
The bundle diff cannot prove its removal, because the string was never there. Removal is proven
instead by source grep (zero references), a clean `tsc`, and `/shop` rendering correctly after the
deletion. **Native verification is not possible in this environment** and is named as a boundary
rather than implied.

This also means the web-facing purchase surface is `chip-store.tsx` alone — which is where last
sprint's `startCheckout` was wired, so that rail is consistent.

## 3. ⚠️ New finding, reported not fixed: the fallback ladder is stale and incompatible

[chip-store.tsx:35](app/chip-store.tsx:35) holds `DEFAULT_PACKAGES`, a **hardcoded fallback** used
whenever the `app_config` fetch fails:

| id | chips | price | per $ |
|---|---:|---:|---:|
| `chips_99` | 500 | $0.99 | 505 |
| `chips_299` | 1,500 | $2.99 | **502** ← *POPULAR, and worse value than the tier below* |
| `chips_499` | 3,000 | $4.99 | 601 |
| `chips_999` | 7,500 | $9.99 | 751 |
| `chips_1999` | 20,000 | $19.99 | 1,000 |

Three problems: it is **far stingier** than the ladder just published (2,000–70,000); it **reproduces
the same inverted-value bug** fixed today, one tier lower; and **its ids do not exist in
`app_config`**, so `credit_purchase` would return `unknown_package` for every one — a player who hit
the fallback could be shown a price and then not be creditable.

**Not fixed:** outside this brief, and it deserves a decision rather than a quiet edit — either
delete the fallback and show an error, or regenerate it from the live ladder.

## 4. The Isracard letter — draft only

[docs/ISRACARD-DOMAIN-REQUEST-DRAFT.md](docs/ISRACARD-DOMAIN-REQUEST-DRAFT.md), in Hebrew,
transparency-first. **Roye edits and sends.** I did not send it and did not touch the acquiring
account.

It asks to add **caps.ftable.co.il** to the existing approved terminal, states plainly that **no
transaction has been made on that domain yet**, and describes what is sold: **virtual chips with no
cash-out** — no conversion to money, no prizes, no real-money wagering — priced $0.99–$19.99.

It also states the technical posture: card details never touch our servers; the credit happens only
after the provider calls our server with a signed message verified before any action; the browser
cannot assert a payment; a repeated callback cannot credit twice.

**Every factual claim is tabulated against its source in the repo** at the end of the file, so Roye
can stand behind each sentence — it is a declaration to an acquirer, not marketing copy. Business
details are explicit `[[placeholders]]`: legal entity, company id, terminal number, contact. **I did
not invent any of them** and made no commitment on his behalf.

It notes the subscription is now removed, so there is no recurring-billing question to raise — that
would be a separate classification if it is ever built.

## 5. Verification

- `tsc` **clean** (one pre-existing unrelated Deno error).
- Source grep: **zero** references to `monthlyPack`, `handleBuySubscription`, `VIP Monthly`,
  `monthly_sub`, `subDaily`, `caps_is_subscriber`, `is_subscriber`.
- `/shop` on live **after** deploy, **both engines** at 393: renders correctly — 34 lines, 7 cosmetic
  items with costs, **no VIP/Subscribe/Auto-renews anywhere**, no horizontal overflow, **0 page
  errors**. Deleting the two imports broke nothing.
- `tests/price-ladder.mjs` re-run, both engines at **375 and 393**: buy controls `[]` at all four, no
  overflow, 0 page errors — **the gate still holds**.
- Production read: `iap_enabled` false · `web_payments_enabled` false · `purchases` 0 ·
  `purchase_chips` 0 · daily reward **150** · rake **5%** · rescue **200** — all untouched.

## 6. Cleanup, and six rows I did not delete

**Cleaned 10 harness devices** from today's runs — analytics_events, chip_transactions,
daily_rewards, leaderboard and device_identity all cleared. 0 `test-` devices. Real bindings 3. Real
player `6956-24d1-5ee4` untouched, 59 events. No `game_rooms`/`room_players` row edited.

**Not deleted — and worth reframing rather than repeating last sprint's shrug.** Six leaderboard rows
updated today share one fingerprint: exactly **2,530 chips**, machine-paced spans of 29s or ~1m40s,
and **zero card placements**. Three appeared at 09:27/09:30/09:32 and three more at 15:19/15:33/18:57
— and I ran no browser during the 15:xx window.

That fingerprint is **also exactly what a real visitor produces** who opens CAPS, collects the daily
reward, and leaves without playing a hand — which is the funnel drop-off this project keeps trying to
measure. **Deleting them would erase evidence of the thing we care about**, so they stay. Leaderboard
reads **1,055** rather than 1,049, and that difference is those six.

## 7. Left for Roye

1. **Send the Isracard letter** (draft in `docs/`, placeholders marked).
2. **Deactivate the `monthly_sub` product** in RevenueCat / App Store Connect — removing the card
   stops CAPS offering it, but the store product still exists and that console is yours.
3. **Decide on the orphaned `app_config` keys:** `subscription_price_usd` (4.99),
   `subscription_daily_chips` (400), `subscription_perks` — now unreferenced but accurate if the
   subscription is ever built — alongside `pro_tier_price_usd` / `business_tier_price_usd`, which
   have zero consumers and **collide at 4.99**. Not deleted silently.

**Nothing else changed:** subscription mechanism not built · no payment flag enabled ·
`record_reward`, its clamp, the outbox and every economy guard untouched · faucet, rescue, ad amount
and rake untouched · no `app_config` key deleted · RevenueCat wiring and `iap_enabled` untouched · no
C5, stake tiers, stakes UI or tournaments · MP sign-in prompt, DEVELOPER and the 7-tap gate untouched
· `delete_user_account` grant not restored.

*(handoff: `vamos_handoffs` id 100 · shipped `main 65fa1ad`)*
