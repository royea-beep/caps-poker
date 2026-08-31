# CAPS — the payment trust boundary (2026-08-22)

Handoff 97 found the hole: after a purchase resolves *on the device*, the **client** calls
`earn_chips`, with no proof a payment happened. This builds the server side of a real payment flow.
**Nothing is enabled, no provider is integrated, and no real money moved.**

> ⚠️ **BEFORE `iap_enabled` IS EVER FLIPPED, WORK [`docs/PAYMENTS-GO-LIVE.md`](PAYMENTS-GO-LIVE.md).**
> Added 2026-08-31. The blocker it leads with is that `credit_purchase` has no package for either
> starter pack, so the verified path answers `unknown_package` — after the money has already left
> the provider. That failure only appears at the moment payments are switched on, which is the
> worst moment to find it.

---

## 1. The webhook

**Where:** [supabase/functions/verify-purchase/](supabase/functions/verify-purchase/) — `index.ts`
(the gate) and `adapters.ts` (the interface). Deployed, version 3, ACTIVE.

**Signature verified before any side effect — proven, not asserted.** The order in `index.ts` is:
read the raw body → pick the adapter → **verify** → only then call `credit_purchase`. There is no
path from step 1 to step 4 that skips step 3.

| call | result |
|---|---|
| no signature | **401** `missing_signature` |
| wrong signature | **401** `bad_signature` |
| **tampered body** (signature over a *different* body than sent) | **401** `bad_signature` |
| unknown provider | 400 |
| no secret configured | **401** `stub_secret_not_configured` |

The tampered-body case is the one that matters: it proves the signature is bound to the exact bytes
received, which is the classic way a webhook ends up "verifying" nothing.

**Provider-swappable:** one `PaymentAdapter` interface —
`{ name, verify(req, rawBody) → VerifiedPayment }`. **The credit path never learns which provider
paid.**

**What is stubbed, precisely:** the **PayPlus** adapter returns
`{ok:false, reason:'payplus_adapter_not_implemented'}` — verified live, 401. It is stubbed because
the terminal is approved for a **different domain**, and using it for CAPS before that is updated is
what the signed declaration forbids. When approval lands it needs exactly three things: PayPlus's
HMAC scheme and header name, the secret in `PAYPLUS_WEBHOOK_SECRET`, and a mapping from their body to
`VerifiedPayment`. **Nothing else moves** — not the Edge Function, not `credit_purchase`, not the
client.

The **stub adapter is not a fake check**: HMAC-SHA256 over the raw body, constant-time compared. The
*provider* is simulated; the *verification* is real. That is what let the whole boundary be tested
end to end while approval is pending.

**An adapter can never name a chip amount.** It returns a package id; chips come from `app_config`.
An adapter that could state an amount would put the provider — and anyone who forges to it — in
charge of the economy.

## 2. Idempotency

`reference_id` = **the provider's transaction id**, stored as `purchases.receipt_id`.

I made the unique key **`(provider, receipt_id)`** rather than the briefed
`(device_id, reference_id)`, and the reason is an attack rather than a preference: with the device in
the key, the *same receipt* replayed against a *different* `device_id` is a different row and credits
twice. Signature verification already blocks that (device_id is inside the signed payload), but a
receipt is globally unique per provider and keying on it is strictly stronger for free. Same
partial-unique **shape** proven three times here — `uq_hand_net_ref`, `uq_share_reward_ref`,
`uq_hand_history_client_ref`.

**Replay credits nothing — proven.** The identical signed callback sent twice returned
`{credited:false, result:{ok:true, granted:0, duplicate:true, new_balance:2000}}`. One purchases row,
one chip transaction, balance unchanged.

## 3. The browser cannot assert a payment — the point of the sprint

`credit_purchase` is **revoked from `anon`**, **revoked from `authenticated`**, and **granted only to
`service_role`**. Measured: `anon=false`, `authenticated=false`, `service_role=true`.

**Proven on the wire** — a page calling the credit path directly with the anon key:

```
HTTP 401  {"code":"42501","message":"permission denied for function credit_purchase"}
```

**Two independent locks, not one:** a forged webhook fails the signature, and a direct call fails the
grant.

## 4. The clamp — options and the argument, not a decision

`record_reward` clamps a single grant at 2,000; the top pack is 200,000. **`record_reward` is not
touched and its clamp is not raised.**

| option | note |
|---|---|
| **(a) separate purchase-credit path** | what exists now — `credit_purchase` never calls `record_reward` |
| **(b) raise the clamp** | one constant, but it widens *every* reward path at once, and the clamp is the only thing between a compromised reward event and an arbitrary grant |
| **(c) reprice the packs** under 2,000 | cheapest, and destroys the top three tiers |

**The argument, offered as an argument:** a purchase is categorically different from a reward. The
clamp exists to stop *unearned* grants inflating a 157:1 economy; a paid purchase is not unearned —
it is the one inflow with a cost attached. That reasoning favours **(a)**. But sizing the packs
against the float is an economy decision and it is Roye's.

**What I did instead of deciding:** the amount is not the caller's to choose at all. It is read from
`app_config.chip_store_packages` by package id, so the path is **self-limiting by construction** — it
can never grant more than the largest package Roye has priced, whatever that is. The policy question
stays open; the implementation cannot be abused while it is open.

**Guards kept, not bypassed:** `econ_authz_probe` + `econ_rate_ok` + `econ_bind_ok` all run first,
plus the idempotency key. Bypassing the clamp did not mean bypassing everything.

## 5. Schema and the five packages

`purchases` gained **provider, receipt_id, currency, amount_minor, platform, chips_granted**. 0 rows
at the time, so no migration risk. `price` was left alone — it is *chips*, and `purchase_item` still
uses it.

**Prices from `app_config`, never the client** — confirmed: the client sends a package id and nothing
else. An unknown package is refused (`unknown_package`), proven live.

**Five packages wired:** `chip-store.tsx handleBuy` was a "Coming Soon" `Alert` (also a no-op on
web). It now calls `startCheckout(pkg.id)` behind the flag, with honest copy per refusal reason. New
[utils/webPayments.ts](utils/webPayments.ts) follows `utils/iapEnabled.ts` exactly.

**Both flags OFF:** `iap_enabled` = false (untouched), `web_payments_enabled` = false (new row,
ships false). Separate flags on purpose — web and in-app are different rails with different rules,
and flipping one must never flip the other.

## 6. The proofs

**Positive control first.** A correctly-signed stub callback returned
`{ok:true, credited:true, granted:2000, package:"small", new_balance:2000}` and wrote a purchases row
carrying `provider=stub`, `receipt_id`, `currency=ILS`, `amount_minor=399`, `platform=web`,
`chips_granted=2000` — plus **exactly one** chip transaction of 2,000 with the receipt as
`reference_id`. Repeated on a second device with the same result.

**Then the negatives:** replay → credits nothing · missing/wrong/tampered signature → 401 · status
`failed` → `{credited:false, reason:'status_failed'}` · `cancelled` → same · unknown package →
refused · payplus adapter → refused · direct anon call → permission denied.

> **A defect in my own code, found and fixed mid-sprint.** The first deployment returned
> `{credited:true, result:{ok:false}}` when the RPC refused an unknown package — an envelope that
> makes a payment look settled when nothing moved. The envelope now reflects the RPC's verdict, and
> the re-run shows `{ok:false, credited:false}`.

## 7. Honesty on what I touched

A **throwaway HMAC test secret** was generated and set as `PURCHASE_STUB_SECRET` so the positive
control could run. It is **not a provider credential** — it signs a simulated provider no real
payment system uses. It has been **unset** and the local copy deleted; re-verified afterwards, a
well-formed call now returns `401 stub_secret_not_configured`. **The deployment fails closed.**

**No live credential was used and no real payment was taken, at any amount.**

> ⚠️ `verify_jwt` is **true** on this deployment, so a Supabase key is currently needed even to reach
> the function — an extra lock today. **A real provider webhook will not carry one, so when PayPlus is
> wired, `verify_jwt` must be turned off — and at that moment the signature becomes the only gate.**
> Flagged now because it is the single easiest thing to get wrong later.

## 8. Cleanup

`purchases` back to **0** · `purchase_chips` transactions **0** · 0 `test-` devices · real bindings 3
· `iap_enabled` false · `web_payments_enabled` false · anon EXECUTE on `credit_purchase` **false** ·
real player `6956-24d1-5ee4` untouched, 59 events.

**Noted, not deleted:** three devices (`e80a-196b-b48a`, `c776-68ab-88ef`, `ccbf-5920-fa84`) first
appeared 09:27–09:32 with machine-paced spans and **zero card placements**. I ran **no browser this
sprint**, so I cannot attribute them to anything I did. I would rather report three rows than delete
something I cannot account for — they show no play, so they are not real players either. Leaderboard
therefore reads **1,052** rather than 1,049.

**Nothing else changed:** no IAP library added · no payment SDK · no product identifier · RevenueCat
wiring and `iap_enabled` untouched · `record_reward`, its clamp and every economy guard untouched ·
the outbox untouched · no `game_rooms` or `room_players` row edited · no C5, stake tiers, stakes UI
or tournaments · MP sign-in prompt, DEVELOPER and the 7-tap gate untouched · `delete_user_account`
grant not restored.

*(handoff: `vamos_handoffs` id 98 · shipped `main 13e294f`)*
