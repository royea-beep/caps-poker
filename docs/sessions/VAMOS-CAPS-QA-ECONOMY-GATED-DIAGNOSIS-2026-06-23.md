# VAMOS CAPS QA-ECONOMY-GATED — Diagnosis & Fix

**Date:** 2026-06-23 · **Branch:** `fix/economy-spend-contract` · **Author:** PM session
**Verdict:** Both findings are **REAL BUGS**, not test-context artifacts. Single shared root cause.

---

## Root cause (one bug, two symptoms)

The LIVE economy RPCs return a different contract than the client reads, and ignore the real cost.

`spend_chips(p_device_id text, p_event_type text, p_amount integer DEFAULT 50)` (and the
twin `earn_chips`) — the overload the app actually hits (`sb.rpc('spend_chips', { p_device_id, p_event_type })`):

```sql
-- LIVE (buggy)
INSERT INTO chip_transactions (...) VALUES (v_user_id, p_device_id, -p_amount, ...);  -- p_amount = 50 default
UPDATE leaderboard SET total_chips = total_chips - p_amount WHERE device_id = p_device_id;
RETURN jsonb_build_object('ok', true, 'chips_spent', p_amount);                        -- NO success, NO new_balance
```

Three defects in that one function:
1. **Returns `{ ok: true }`, not `{ success: true, new_balance }`.** The client gates on `result.success`
   (`utils/supabaseEconomy.ts` typed `SpendResult.success`). `success` is always `undefined` →
   the client treats a **successful, already-charged** spend as a failure.
2. **Charges a flat `50`.** The app calls with only 2 args, so `p_amount` defaults to 50 — it never reads
   the real cost from `chip_config`. Buy-in (should be 200) and every shop item (rebuy 100, avatar 200, …)
   all debit 50.
3. **No balance check, no `new_balance` returned.** Can drive a balance negative; client can't refresh.

`earn_chips` has the same `{ ok, chips_earned }` shape — but earn callers
(`app/(tabs)/index.tsx:1060`, `app/results.tsx:376/383/923`) read `result.chips_earned` (which **is**
present), so earning *appears* to work. Only spend callers + `quick-poker` win
(`app/quick-poker.tsx:141`) gate on `.success`, so only those break. This asymmetry is why the strategist
saw "all non-economy flows pass."

---

## Finding 1 — Quick Poker entry → REAL BUG

- `app/quick-poker.tsx:97` `spendChips(id, 'quick_poker_buy_in')` → server returns `{ ok:true, chips_spent:50 }`.
- `:102` `if (!result || !result.success)` → `result.success` undefined → **error shown**: "Couldn't enter the game".
- The buy-in **was charged on the server** (chip_transactions debit + leaderboard decrement) before the screen
  denied entry — a double penalty: charged *and* blocked.
- **Live evidence (chip_transactions):** `quick_poker_buy_in` `debit` **-50** ×18, 2026-05-10 → **2026-06-23 (today)**.
  Contrast the pre-regression `quick_poker_buyin` `debit` **-200** ×22 (through 2026-04-19) — the amount used
  to be correct. Real users have been hit since May 10.
- Local "700 chips in storage" is the client `gameStore`; entry is gated by the **server** balance/RPC, not local.

## Finding 2 — Shop purchase → REAL BUG

- `app/shop.tsx:135` `spendChips(deviceId, item.event_type)` → `{ ok:true, chips_spent:50 }`.
- `:136` `if (result?.success)` → undefined → **entire block skipped**: no `addChips`, no `setShopData`, no toast.
- Result: client balance unchanged (1000 → 1000), no feedback — **while the server actually debited 50**.
- **Live evidence:** `rebuy_500` `debit` **-50** ×1 on **2026-06-23** (the strategist's own click: server charged 50,
  client showed nothing). Pre-regression `rebuy_500` `spend` **-100** ×3 (Mar–Apr) — correct cost back then.
- `chip_config` cost for `rebuy_500` = **-100** (not 50).

## Authenticated live test (throwaway device, cleaned up)

```
spend_chips('TESTDEV…','rebuy_500')      -> { ok:true, chips_spent:50 }   # buggy default
spend_chips('TESTDEV…','rebuy_500',100)  -> { ok:true, chips_spent:100 }  # explicit amount = correct cost
leaderboard 1000 -> 950 -> 850 (server debits as returned); test rows deleted, 0 leftover.
```

Confirms: (a) the flat-50 + `{ok}` contract is real on prod, and (b) passing the explicit amount produces the
correct charge.

---

## Fix landed on this branch (client — ships with 506)

`utils/supabaseEconomy.ts` — `spendChips`/`earnChips` now:
- forward an optional `amount` as `p_amount` (correct cost: 200 buy-in, item.cost shop, 100 win),
- normalize `success = (success === true) || (ok === true)` so a charged spend isn't shown as failure,
- pass through `new_balance`/`error_code`/`balance` when present (forward-compatible with the server fix).

`app/quick-poker.tsx` — pass `BUY_IN` (200) and `WIN_CHIPS` (100). `app/shop.tsx` — pass `item.cost`;
derive `new_balance` from `prev.balance - chips_spent` when the server omits it.

**Verify:** `tsc` 0 · `jest` 2505/2505.

This makes the client correct against the *current* live DB (entry succeeds, purchase deducts the right
amount, balance updates) and against the fixed server. **But it only reaches users with build 506** — so the
live remediation below is the higher priority.

---

## Recommended server fix (LIVE remediation — OWNER-APPLIED, not applied here)

Fixes every already-shipped client with no app release. **This is a production DB change → owner authorizes.**
`DEFAULT NULL` so an explicit client amount wins; otherwise look up `chip_config`; add a balance check;
return the contract the client expects.

```sql
CREATE OR REPLACE FUNCTION public.spend_chips(p_device_id text, p_event_type text, p_amount integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user_id uuid; v_amount int; v_balance int; v_new int;
BEGIN
  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;
  v_amount := COALESCE(
    p_amount,
    (SELECT ABS(chips) FROM chip_config WHERE event_type = p_event_type AND is_active LIMIT 1),
    50);
  IF NOT EXISTS (SELECT 1 FROM leaderboard WHERE device_id = p_device_id) THEN
    INSERT INTO leaderboard (device_id) VALUES (p_device_id);
  END IF;
  SELECT COALESCE(total_chips,0) INTO v_balance FROM leaderboard WHERE device_id = p_device_id LIMIT 1;
  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('success',false,'ok',false,'error_code','INSUFFICIENT_BALANCE',
                              'balance',v_balance,'chips_spent',0,'new_balance',v_balance);
  END IF;
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description)
  VALUES (v_user_id, p_device_id, -v_amount, p_event_type, 'debit', p_event_type);
  UPDATE leaderboard SET total_chips = total_chips - v_amount WHERE device_id = p_device_id
    RETURNING total_chips INTO v_new;
  RETURN jsonb_build_object('success',true,'ok',true,'chips_spent',v_amount,
                            'new_balance',v_new,'balance',v_new);
END; $$;
```

(Mirror the same `success`/`new_balance` return on `earn_chips(text,text,int)` so earned chips reflect
immediately instead of self-healing on the next home refresh. Optional: add a `quick_poker_buy_in` row to
`chip_config` (cost 200) so even un-updated clients are charged correctly via the lookup path.)

Once the server returns `success`+`new_balance`, the **existing live client works with no change** — the
client fix above is then belt-and-suspenders for 506.

---

## Real-user impact

- **Quick Poker:** broken for all users since 2026-05-10 (18 charged-but-blocked entries through today). High.
- **Shop:** every purchase silently no-ops on the client while charging 50 server-side. High (and a chip
  ledger / fairness issue).
- Not a launch blocker for 506 *if* the server fix is applied (resolves live immediately); the client fix
  rides along in 506.

## Constraints honored
No deploy / OTA / build / submit / INSERT-lock performed. Server SQL provided, **not** applied. Client fix is
contained to the two screens + their economy helper, on branch `fix/economy-spend-contract`. Test device data
created and deleted (0 leftover).
