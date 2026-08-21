# CAPS — Shop ownership: the entitlement spine (2026-08-21)

Buying a cosmetic used to debit the chips and grant nothing. `spend_chips` wrote no entitlement,
`purchases` had **zero rows in its entire history**, and three cosmetic purchases sit in the ledger
whose buyers own nothing. A tester buying a card back and receiving nothing was a certainty.

**Roye's ruling, followed: spine only.** Every catalogue item is already free and universal, so
"make it apply" would mean inventing content or taking something away from testers. Neither was
decided, so this sprint built the machinery and **removed nothing from anyone**.

> **Designated first unlock, next sprint: the card back.** The only family where adding is
> *addition* — exactly one back exists in code — and it closes C5. **Carry forward: any new back
> must be neutral/charcoal, never gold, never mint.** Gold means *won* and nothing else; mint is the
> field. That colour map cost a week.

## The entitlement write

`purchase_item(p_device_id, p_item_type)` — migration `shop_ownership_entitlement_spine`.

- **Same transaction as the debit.** Debit and grant are two statements inside one plpgsql
  invocation. **Proven, not asserted:** a QA twin that forced the grant to fail (NOT NULL violation)
  *after* the debit left the balance unchanged at 1499, with **0 debit rows and 0 purchase rows**.
- **Idempotency key:** partial unique index `uq_purchase_device_item` on
  `purchases (device_id, item_id) WHERE device_id IS NOT NULL` — the `uq_hand_net_ref` shape.
  `item_id` is the owned thing, `item_type` the catalogue entry selling it; equal until a family
  gains a second variant, so the grain is already right for the card back.
- **Guards:** `econ_authz_probe` → `econ_rate_ok` → `econ_bind_ok`, identical shape and refusal keys
  to the eight already wired.
- **Device-keyed** throughout — no uuid, so it does not repeat the `claim_emergency_chips` mistake.
- **Read path:** `get_poker_shop` returns `owned` per item. No new RPC, no new control — the shop
  already calls it on every load and older clients ignore the field.

## Two holes found and closed on the way

1. **The price was client-supplied.** `spend_chips` takes an optional `p_amount` that *overrides* the
   catalogue, and `app/shop.tsx` passed the client's own `item.cost`. Measured on the wire: a
   500-chip table theme bought for **1 chip** — and, being the old path, it granted nothing either.
   `purchase_item` takes no amount at all.
2. **`purchases` was wide open.** `anon` held INSERT/UPDATE/DELETE/**TRUNCATE** and the RLS policy
   qual was `true`. Storing entitlements there unchanged would have let any client grant itself every
   cosmetic free, delete everyone else's, and read every row — device_id enumeration of the same
   shape already closed on the leaderboard. **Revoked all** from `anon`/`authenticated`, dropped
   every policy. Verified after: grants NONE, policies NONE.

## A regression I introduced, caught by watching it run

The first real UI purchase bought `rebuy_500` — a 500-chip **top-up** — and the new entitlement
marked it permanently *Owned*. A player could have rebought exactly once, ever. **Three of the seven
shop rows are consumables**, not cosmetics. Reading the code would not have caught it; clicking the
button did.

**Fix:** the distinction lives in **data**, not a hardcoded list — new column
`chip_config.is_permanent`, default `false`, true for exactly the four cosmetics. The existing
`category` column nearly separates them but files `rebuy_500` with the cosmetics, and nothing in the
codebase reads it, so reinterpreting an unused field would have been guessing.

## Proof

**RPC level** (QA copy first per Rule 11, then live, copies dropped):

| case | result |
|---|---|
| buy card back | ok, price 300, 2000 → 1700, one `purchases` row |
| double buy | `already_owned`, no second debit |
| insufficient (10 chips) | `insufficient_chips` — and in the DB, **0 debit rows, 0 purchase rows** |
| unknown item | `unknown_item` |
| foreign session on a **bound** device | `identity_mismatch` |
| atomicity (forced grant failure) | balance unchanged, nothing written |

**UI level, both engines** (WebKit + Chromium), identical, fresh mounts, no page errors:

| step | Buy | Owned | balance |
|---|---:|---:|---:|
| start | 7 | 0 | 2,000 |
| consumable bought | 7 | 0 | 1,900 |
| consumable **again** | 7 | 0 | 1,800 |
| cosmetic bought | 6 | **1** | 1,650 |
| **after full reload** | 6 | **1** | 1,650 |

## The four families — reported, not changed

| item | mechanism today | reads from |
|---|---|---|
| Table theme 500 | `VisualThemePicker`, `app/settings.tsx:678` | static list, free |
| Card back 300 | **none** — one back, `components/Card.tsx:103-107` | n/a |
| Avatar 200 | `AvatarPicker`, `app/settings.tsx:174` | static list, free |
| Emote pack 150 | `EMOTES`, `components/ChatOverlay.tsx:36`, MP-only | static list, free |

None reads ownership; all four are free today. **Nothing was gated, so no tester loses anything.**

**Card back information leak / winner cue:** not applicable this sprint — no purchasable back exists,
so nothing on the card surface changed. The constraint is recorded above for the sprint that adds one.

## Deferred, stated not hidden

The brief's fifth positive-control criterion — *"the cosmetic visibly applies in the game"* — is
**not met**, because there is no purchasable variant to apply. Four of five are proven. The fifth
ships with the card back. This is not being called done.

**Cleanup:** 7 `purchases` rows, 22 `chip_transactions`, 9 leaderboard rows, 2 bindings, 19
analytics events and 19 rate counters deleted across 9 test devices. `purchases` is back to **zero
rows**; 0 test devices and 0 QA functions remain.

**Nothing else changed:** no price altered · no catalogue item added · no faucet trimmed · no stake
tiers, stakes UI or tournaments · MP prompt untouched · visual audit not resumed · no keys.

*(handoff: `vamos_handoffs` id 83)*

---

# Addendum — the second card back (same day)

The fifth criterion is now **met**, and the shop's loop is complete for one family.

## SLATE

`constants/cardBacks.ts`. The five constants hardcoded in `Card.tsx` became the **CLASSIC** entry,
byte-identical and still free — nobody lost the back they had. SLATE is unlocked by the **existing**
`buy_card_back` row: no catalogue item added, no price changed.

`bg #4A5058` · glyph `rgba(255,255,255,0.66)` · ring `rgba(255,255,255,0.24)` · edge
`rgba(255,255,255,0.30)` · glow `rgba(255,255,255,0.26)` · **two** concentric rings.
**Neutral/charcoal confirmed:** every value is a grey or a white alpha. No gold, no mint, anywhere.

**Information leak — ruled out by construction:** `renderBack()` never receives the card. It takes
width, height and the resolved palette, nothing else, so a back cannot correlate with rank, suit or
value.

## Winner cue — re-measured, and one part honestly not

| pair (greyscale, hue removed) | ratio |
|---|---:|
| SLATE vs CLASSIC back | 2.175 : 1 |
| winner **GOLD vs SLATE** back | **3.562 : 1** |
| winner GOLD vs CLASSIC back | 7.746 : 1 |
| field MINT vs SLATE back | 4.465 : 1 |
| SLATE back vs card **FACE** | 8.057 : 1 |
| SLATE back vs felt | 1.924 : 1 |
| **CLASSIC back vs felt — the shipped baseline** | **1.130 : 1** |

The new back is ~1.7× **more** legible against the felt than the one shipping today. The ring
**count** adds a hue-free second channel on top of luminance.

**Diff scope** (`git diff 74e7a97..c405c66 -- components/Card.tsx`): every changed line sits inside
the card-back block. **Zero winner-cue lines touched** — no `v2Border`, no highlight, no gold
constant. **Live:** 4 gold-bordered elements render alongside 27 slate backs in a real hand.

**Not achieved, stated plainly:** the 3px WON border was **not** captured live during a reveal —
auto-sim runs past it to `/results`, and 40 dense samples across a hand never landed on it. The cue
is verified by diff scope + colour separation + gold-still-renders, **not** by a live measurement of
the 3px border. That one is still owed.

## Mechanism

[Card.tsx:222](components/Card.tsx:222) reads `cardBack`; [:324](components/Card.tsx:324) resolves
the palette — the same pattern the face already uses at [:219](components/Card.tsx:219). No prop
threading. [settings.tsx:732](app/settings.tsx:732) `CardBackPicker` is the same tile row as VISUAL
STYLE above it, reusing its styles — **no new setting, no new control**.

**Reads ownership, not a static list:** the owned set comes from `get_poker_shop`. The row **hides
entirely** until a second back is owned, and a persisted selection that is no longer owned falls
back to the default — a selection must never outlive its entitlement.

## The fifth criterion — all five

**webkit/430, chromium/393, webkit/375 — identical:**

| step | result |
|---|---|
| unowned settings | 0 tiles, no heading — cannot select what you don't own |
| before buy, in a hand | 27 classic, 0 slate |
| purchase | 2,530 → 2,230 = **exactly 300**, Buy 7→6, Owned 1 |
| owned settings | 2 tiles |
| select SLATE | persisted `cardBack: 'slate'` |
| **in a real hand** | **0 classic, 27 SLATE — it visibly renders** |
| **after a full reload** | **0 classic, 27 SLATE — the selection is durable** |

Console clean on webkit/430; the other runs logged one benign pre-existing message each (a Chromium
audio-autoplay block, a WebKit AbortError from a cancelled fetch on navigation) — reported rather
than glossed as "no errors".

## ⚠️ C5 is **not** closed

C5 is *"מונוטוניות 5 גבים זהים ברצף"* — **five identical backs in a row**, i.e. **card-level**
monotony within one hand. What shipped is a **player-level** choice: which back *you* use. Every back
in a hand is still byte-identical to its neighbours — the 27 above are 27 identical slates.

The brief described this as closing C5. It does not, and marking it closed would have buried a live
item behind a sprint that looked like it addressed it. The backlog now says so explicitly. What did
change is the **cost**: the back is a resolved palette instead of five constants, so the filed
options A–D apply inside `renderBack()` over `back.*` and are cheaper than when priced.

## Shop end to end: **yes, with one qualifier**

For the **card back** the loop is complete and proven: catalogue → guarded atomic purchase → durable
entitlement → owned state → a picker that reads ownership → visibly renders → survives a reload.

**The other three families are not there.** Table theme, avatar and emotes still have no purchasable
variant, so buying them writes an entitlement nothing reads. They are no longer *broken* — the chips
aren't taken for nothing, the row is written, the shop shows Owned — but nothing changes on screen.
One variant each is the honest remaining work.

**Cleanup:** 4 purchases, 12 chip_transactions, 4 leaderboard rows, 1 binding, 104 analytics events,
13 counters, 2 hand_history rows across 4 browser test devices. `purchases` back to **zero**; 0 test
devices, 0 QA functions.

*(handoff: `vamos_handoffs` id 84)*
