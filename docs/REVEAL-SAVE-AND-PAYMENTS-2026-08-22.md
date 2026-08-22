# CAPS — the hand is kept, and what payments already exist (2026-08-22)

Roye ruled: a player who leaves mid-reveal **keeps the hand**, because they played it. Shipped and
proven. Then an inventory of the payment machinery — which turned out to be far more built, and far
less safe, than expected.

---

## 1. The reveal save — shipped and proven

**Where:** [game.tsx:742](app/game.tsx:742) hoists `revealHandId`, `setRevealData` uses it at
[:760](app/game.tsx:760), and the queue block sits immediately after (`:786-800`).
[results.tsx](app/results.tsx) now passes `id: revealData.handId` on its existing call.

**Outbox reused, no second path:** the queue calls `queueHandResult` from
[utils/handOutbox.ts](utils/handOutbox.ts) — the same function results.tsx already used. Nothing new
was built for persistence or retry.

**Why it cannot double-count:** `handId` — the stable per-hand id that *already existed* for
`record_hand_net`'s dedup, generated once per hand behind `hasNavigatedRef` — is now also the
`client_hand_id`. Both writes carry **one key**, so `uq_hand_history_client_ref` collapses them: the
first lands, the second returns `{duplicate:true}`. The results call was **kept rather than deleted**,
because *"the reveal block always runs"* is a claim; keying both identically makes the belt-and-braces
free.

### No double-count — four cases, each on its own fresh device, both engines

| case | webkit/430 | chromium/393 |
|---|---|---|
| 1 normal → `/results` | 1 row · 1 key · 2 unlocks | 1 row · 1 key · 1 unlock |
| 2 **left mid-reveal** | **1 row** · 1 key · 2 unlocks | **1 row** · 1 key · 1 unlock |
| 3 **left + relaunch** | **1 row** · 1 key · 1 unlock | **1 row** · 1 key · 1 unlock |
| 4 left during placement | 0 rows · 0 keys · 0 unlocks | 0 rows · 0 keys · 0 unlocks |

**Case 2 was zero rows before this change** — that is the fix. **Case 3 is 1, not 2**, and it has
*three* chances to write: the reveal queue, the results queue, and the app-start flush.

**Achievement counts match hands** in every case — award `chip_transactions` equal unlocks exactly
(2/2, 2/2, 1/1, 0/0 on webkit; 1/1, 1/1, 1/1, 0/0 on chromium). The engine difference is only which
hands were *won* (`win_1` fires on a win, `play_1` on any hand), not a counting difference.

**Leaving during placement: nothing is recorded, and that is the rule.** `setRevealData` only runs
when the hand reaches an outcome, so a player who leaves before pressing Ready has no hand to keep.

**Multiplayer untouched** — MP rows are written by the server.

### ⚠️ And it surfaced a regression I shipped in handoff 94 — now fixed

The first run showed rows landing correctly but **zero unlocks on every device**, including the
normal case.

`achievements.user_id` carries FK `achievements_user_id_fkey → user_profiles(id)`, and h94's identity
bridge stamps the auth uid bound to the device. **CAPS signs players in anonymously, and an anonymous
auth user has no `user_profiles` row** — so every INSERT raised `23503` and the exception-wrapped
trigger swallowed it. The hand still recorded and the failure *was* logged as designed (3
`achievement_check_failed` rows), but nothing unlocked. Achievements had silently stopped working
again, for exactly the devices the bridge was meant to help.

**Fix** (`fix_achievement_uid_fk_violation`): the resolver returns a uid only when it satisfies the
constraint, otherwise NULL — correct, because identity in CAPS is the device. All four cases were
re-run after the fix; the table above is the post-fix result.

## 2. Payment infrastructure — inventory, nothing built

**`iapEnabled`** is a remote kill-switch reading `app_config.iap_enabled`, **defaulting to false**. It
gates [chip-store.tsx:155](app/chip-store.tsx:155) (the five package cards + Restore Purchases),
[shop.tsx:26](app/shop.tsx:26) (starter pack + subscription) and `StarterOfferModal`. **Live value:
`false`, set 2026-06-22** — its own header explains why: the App Store Connect products were never
confirmed, and Apple rejects non-functional IAP buttons.

### What is behind it — more than "somebody started this"

- **`react-native-purchases` ^9.15.0 (RevenueCat) is installed and wired.** Configured at
  [_layout.tsx:471](app/_layout.tsx:471) from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`.
- `shop.tsx` calls `getOfferings()` and `purchasePackage()` for `starter_pack` and `monthly_sub`;
  `StarterOfferModal` does the same for `starter_pack_2x`.
- **`chip-store`'s own buy button is a "Coming Soon" alert** — the five chip packages were never
  wired to anything.
- **Prices are already configured** in `app_config`: five tiers $0.99–$19.99 for 2,000–200,000 chips,
  plus starter packs, a $2.99 subscription with 1,000 daily chips, and pro/business tiers.

**Absent entirely:** no Stripe, no PayPal, no web payment code of any kind. No receipt table, no
webhook table, no subscription table. **None of the 13 Edge Functions is payment-related.** The
`purchases` table's `price` is in **chips** — no currency, no platform, no transaction id.

**Never used once:** **0** `chip_transactions` with an `iap_` event type, ever. `earn_chips`' allow-list
contains exactly one: `iap_starter_pack`.

> ### ⚠️ The finding that matters most: the grant is client-trusted
>
> After `Purchases.purchasePackage` resolves **on the device**, the **client** calls
> `earn_chips('iap_starter_pack')` ([shop.tsx:99](app/shop.tsx:99)). **There is no receipt
> verification anywhere in the system.** Anyone who can call that RPC gets the chips without paying.
> The only ceilings are the throttle and the once-per-device rule — `econ_bind_ok` covers 0.29% of
> devices, so it is not one. **This path must not be enabled as it stands.** That is an engineering
> statement, not a legal one.

### How much of `purchase_item` reuses

The honest answer is **"not `purchase_item`, but most of what surrounds it"**. `purchase_item` is the
wrong direction — it debits chips and grants an entitlement (chips **out**). A real-money purchase is
chips **in**.

| | |
|---|---|
| **reuses** | the guard triple `econ_authz_probe` + `econ_rate_ok` + `econ_bind_ok`, unchanged |
| **reuses** | `record_reward` as the credit writer, with clamp and `p_once` idempotency |
| **reuses** | `chip_transactions` and the `(device_id, reference_id)` partial-unique shape — a receipt id is the natural `reference_id`, so **the hardest correctness problem in payments already has a proven pattern here** |
| **partial** | `purchases` exists but needs currency, platform and receipt-id columns |
| **absent** | receipt verification — the entire trust boundary |
| **absent** | a webhook Edge Function |
| **blocker** | `record_reward` clamps a single grant at **2,000**. The Whale pack is **200,000**. The clamp protects a 157:1 inflationary economy, so raising it is not a small decision |

**The security spine is built; the verification is 0% built.**

## 3. The panel — every monetisation route

*The legal facts below are those the brief established plus general knowledge. This inventories
engineering cost and names where counsel is required; it is not legal advice.*

### Route A — buy chips with money, no cash out

- **Has:** RevenueCat wired for 3 products · prices configured · a working kill switch · the ledger ·
  the guard triple · a proven receipt-idempotency pattern.
- **Missing:** receipt verification · a webhook Edge Function · receipt columns · a credit path that
  can exceed 2,000 · the five chip packages are not wired at all.
- **Cost:** web via Stripe **~3 days**. In-app via RevenueCat **~1 week**, most of it store product
  setup and webhook verification, because the client code largely exists.
- **Risk:** the client-trusted grant. Ship verification first or not at all.

> **The 30% consequence, stated plainly.** Apple takes 30% of in-app purchases of virtual currency
> (15% under the Small Business Program) and forbids steering users to external payment for them. The
> web is free to use Stripe at roughly 2.9% + 30¢. Same product, **~10× difference in take rate** —
> and it means **web and in-app are different builds and different code paths.** That is a decision
> *before* any work starts.

### Route B — tournaments, entry in free chips, real prizes (sweepstakes)

- **Has:** server-side settlement · zero-sum verified at row level · a rake · an idempotent ledger ·
  identity binding. **The wagering engine itself is genuinely built.**
- **Missing:** a no-purchase-necessary path that actually works · prize fulfilment · KYC · state
  geofencing · tax reporting.
- **Cost:** months, most of it not code. **Risk:** banned in roughly nine US states and the map moves;
  separate Israeli exposure.
- **What must be true first:** a US entity, gaming counsel, and an AMOE that is real rather than
  decorative. Until those exist this is not a decision.

### Route C — real money in, real money out — **CLOSED**

Three blockers, taken as established: Skillz holds US patent **9,649,564**; it won **$42.9M** against
AviaGames, settling at **$80M**; ~12 US states prohibit it outright; and it is **illegal in Israel for
both operator and player**. Roye is in Israel. **This is not a cost question and I will not price it.**

### What the existing engine actually shortens — and this is counter-intuitive

- **Shortens B and C a lot.** Server settlement, zero-sum payout, rake, idempotent ledger and identity
  binding *are* the hard parts of a wagering system, and they ship today.
- **Shortens A almost not at all.** Route A's remaining work is receipt verification and a payment
  webhook, which share nothing with the wagering engine.

**So the thing that is built helps the routes that are legally hard, and does not help the route that
is legally easy. Do not let "the engine is done" argue for B.**

### Ranked by what Roye can actually do next

1. **Route A, web first, via Stripe.** Cheapest, no licensing, no platform tax, and CAPS already ships
   a web build — testable with real money without an app-review cycle. ~3 days.
2. **Route A, in-app.** Reuses the RevenueCat wiring that exists; pay the 30%; requires the App Store
   Connect products that `iapEnabled`'s own comment says were never confirmed.
3. **Route B.** Only once a US entity and counsel exist. Months, mostly non-engineering.
4. **Route C. Closed.**

**In every case, first:** replace the client-trusted grant with server-side receipt verification. That
is one piece of work Route A needs on both platforms, and nothing else can proceed without it.

**Nothing was built in sections 2 or 3** — no IAP library added, no payment SDK, no product
identifier, no schema change, no flag flipped. `iap_enabled` is still `false`.

## Cleanup

14 devices, all machine-paced (11s–3m41s). Zero leftovers across every table. Back to baseline
exactly: leaderboard **1,049** · 0 rows updated today · 0 `test-` devices · `purchases` 0 · real
bindings 3 · `achievements` 47 · `hand_history` 243 · `room_players` 0 · 6 waiting human tables.
**No `game_rooms` or `room_players` row was edited or deleted.** Real player `6956-24d1-5ee4`
untouched, 59 events intact.

**Nothing else changed:** `record_reward`, its clamp and every economy guard untouched · the outbox's
existing behaviour unchanged (only a second caller added, keyed to the same id) · no C5, stake tiers,
stakes UI or tournaments · MP sign-in prompt, DEVELOPER and the 7-tap gate untouched ·
`delete_user_account` grant not restored · battle-pass untouched · `gameover:116` untouched.

*(handoff: `vamos_handoffs` id 97 · shipped `main ddf73a8`, `1c15c5a`)*
