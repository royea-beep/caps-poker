# PAYMENTS — the go-live checklist

**This is the list that must be worked before `app_config.iap_enabled` is flipped to `true`.**
It exists because a blocker was found that only bites at the moment payments are turned on, and a
finding recorded in a sprint report is a finding nobody reads eighteen months later.

> **Where this is cross-referenced**, so it cannot be missed from any direction:
> `docs/PAYMENT-VERIFICATION-2026-08-22.md` (the trust-boundary design),
> `supabase/migrations/20260831130000_earn_chips_stops_paying_for_purchases.sql` (the migration
> that closed the old credit path), and this file. Nothing here is urgent while both payment flags
> are `false` — and nothing here is optional once either is `true`.

Last verified against production **2026-08-31**.

---

## ⚠️ 1 · `credit_purchase` has no package for either starter pack — THE BLOCKER

`credit_purchase` resolves what to credit from `app_config.chip_store_packages`, and **never from
the caller** — that is the whole point of it, and it must stay that way.

| | |
|---|---|
| package ids that exist today | `small`, `medium`, `large`, `premium`, `mega` |
| ids the client actually buys | **`starter_pack`** (`app/shop.tsx:74`) · **`starter_pack_2x`** (`components/StarterOfferModal.tsx:40`) |
| what happens if flipped as-is | `credit_purchase` returns `{"ok": false, "reason": "unknown_package"}` |

**It is two missing packages, not one.** The shop's starter pack and the starter-offer modal's 2×
pack are different RevenueCat products and both are absent.

**The failure is quiet in the worst way.** `verify-purchase` returns HTTP 200 with
`credited: false`, and the client shows *"Purchase received — chips did not arrive. Contact
support."* The money has already left the provider. A refusal here is a support ticket per sale.

**Adding the entries is a pricing decision — Roye's, not an engineer's.** Each needs an `id`, a
`chips` count and a `price_usd` consistent with the existing ladder. The old amounts are still in
`app_config` as `starter_pack_chips` (5,000) and `starter_pack_2x_chips` (10,000); they are what
the retired path used to pay and are a starting point for the conversation, not an answer to it.

**Exit test:** call `credit_purchase` with each id and a throwaway receipt on a branch, and see
`{"ok": true, "granted": <chips>}`. Then delete the rows.

---

## 2 · The signing secret is not configured

`verify-purchase` refuses every call today with `stub_secret_not_configured` — verified live. A
verifier with no secret **must** fail closed, so this is correct behaviour, not a fault; but it
means the path has never carried a real payment.

- **`PURCHASE_STUB_SECRET`** — set it to exercise the whole boundary end to end before a provider
  is live. This is the cheapest full-path test that exists.
- **`PAYPLUS_WEBHOOK_SECRET`** — needed only once PayPlus is real; see §3.

---

## 3 · The PayPlus adapter is deliberately unimplemented

`supabase/functions/verify-purchase/adapters.ts` returns `payplus_adapter_not_implemented` on
purpose. Roye holds a live, approved PayPlus/Isracard terminal, but **that approval names a
different domain**, and using it for CAPS before they update it is what the signed declaration
forbids.

When approval lands, three things are needed and **nothing else in the system changes** — not the
Edge Function, not `credit_purchase`, not the client:

1. PayPlus's documented HMAC scheme and header name.
2. The secret in `PAYPLUS_WEBHOOK_SECRET`.
3. A mapping from their callback body to `VerifiedPayment`.

---

## 4 · The client still calls the retired credit path

`app/shop.tsx:95 handleBuyStarterPack` calls `earn_chips('iap_starter_pack')`. **That RPC no longer
pays it** — migration `20260831130000` made it return `purchase_not_verified`, because a device
resolving a purchase and then telling the server it happened is not proof of anything.

It is harmless today: the button is behind `Platform.OS !== 'web' && isIapEnabled()`
(`app/shop.tsx:233`) and `iap_enabled` is `false`. **It is not harmless the moment the flag flips**
— every starter-pack purchase would take the money and credit nothing.

**The client must be rewired so the provider calls `verify-purchase` server-to-server**, and the
app simply refreshes the balance afterwards. The device stops being the source of truth. That is a
client change and needs a build.

---

## 5 · Both flags, and the order to flip them

| flag | today | notes |
|---|---|---|
| `app_config.iap_enabled` | `false` | hides every native IAP entry point; defaults to `false` even if the config fetch fails, which is the safe direction |
| `app_config.web_payments_enabled` | `false` | the web purchase surface |

Flip **nothing** until §1 and §4 are done. §1 without §4 takes money and credits nothing; §4
without §1 shows a buy button that always fails.

---

## What is already proven, and does not need re-testing

From the VERIFY-EVERYTHING and CLOSE-THE-SIX audits, measured live against production with the
public anon key:

- `verify-purchase` is deployed with **`verify_jwt: true`**; a call with no key gets 401 before the
  function body runs.
- Signature verification happens **before any side effect** — no signature, a forged signature and
  a tampered body all return 401 and touch nothing.
- `credit_purchase` and `record_chip_purchase` are granted to **`postgres` and `service_role`
  only**; both refuse an anon call with `42501`.
- The `purchases` table refuses an anon INSERT, and is **still 0 rows**.
- `credit_purchase` is **idempotent on `(provider, receipt_id)`** and gates the credit on the
  receipt row actually inserting, so a provider retry credits once.
- Eight separate attacks from outside were refused, eight times.
