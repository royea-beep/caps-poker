/**
 * Supabase economy helpers — earn_chips, card config, shop.
 * All calls are fire-and-forget safe. Never throw to callers.
 */

import { getSupabase } from './supabase';
import { Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Shared RPC wrapper
// ---------------------------------------------------------------------------

export async function callRPC<T = unknown>(
  rpcName: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc(rpcName, params);
    if (error) throw error;
    const d = data as any;
    if (d && d.success === false) {
      if (d.error_code === 'INSUFFICIENT_BALANCE') {
        // Alert.alert is a native-only no-op on web (see CLAUDE.md). Callers must
        // surface the error themselves on web — that's why PR-G changed this to
        // return the failed response (with success:false, balance, error_code)
        // instead of null. Caller can read result.balance and show a real message.
        Alert.alert('לא מספיק צ׳יפים', d.balance != null ? `יש לך ${d.balance}` : undefined);
      }
      // PR-G Bug 2: return the failed response so callers can read error_code/balance.
      // Caller-side `if (!result || !result.success)` checks still work the same way.
      return data as T;
    }
    return data as T;
  } catch (err) {
    console.error(`[Economy] RPC ${rpcName} failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// earn_chips
// ---------------------------------------------------------------------------

export type EarnEvent =
  | 'hand_won'
  | 'share_hand'
  | 'streak_5_wins'
  | 'daily_login'
  | 'daily_reward'
  | 'quick_poker_win';

export interface EarnResult {
  chips_earned: number;
  new_balance?: number;
  success: boolean;
}

/**
 * Call earn_chips RPC and NORMALIZE the response.
 *
 * VAMOS-CAPS-QA-ECONOMY-GATED: the live earn_chips RPC returns
 * `{ ok: true, chips_earned }` (no `success`, no `new_balance`); a fixed/older
 * server returns `{ success, chips_earned, new_balance }`. We coerce `success`
 * from either `success===true` OR `ok===true` so callers that gate on `.success`
 * (e.g. quick-poker win) credit chips instead of silently dropping them.
 * Optional `amount` is forwarded as p_amount so the credit matches the intended
 * value instead of the server's flat default.
 * deviceId — pass result of getDeviceId().
 */
export async function earnChips(
  deviceId: string,
  event: EarnEvent,
  amount?: number,
): Promise<EarnResult | null> {
  const params: Record<string, unknown> = { p_device_id: deviceId, p_event_type: event };
  if (typeof amount === 'number') params.p_amount = amount;
  const raw = await callRPC<any>('earn_chips', params);
  if (!raw) return null;
  return {
    success: raw.success === true || raw.ok === true,
    chips_earned: raw.chips_earned ?? raw.earned ?? (typeof amount === 'number' ? amount : 0),
    new_balance: raw.new_balance,
  };
}

// ---------------------------------------------------------------------------
// claim_share_reward — guarded share_hand reward (cap + per-share idempotency)
// ---------------------------------------------------------------------------
export interface ShareRewardResult {
  ok: boolean;
  granted: number;
  new_balance?: number;
  already_claimed?: boolean;
  capped?: boolean;
}

/**
 * Claim the share_hand reward via the guarded `claim_share_reward` RPC. Controls live server-side
 * (daily cap via app_config.share_reward_max_daily + partial-unique idempotency on the shared_hands
 * id). Pass the shared_hands row id as shareId (required — the no-id case uses the legacy fallback
 * path in the caller, not this wrapper). Returns null on RPC failure; granted>0 means chips moved.
 */
export async function claimShareReward(deviceId: string, shareId: string): Promise<ShareRewardResult | null> {
  const raw = await callRPC<any>('claim_share_reward', { p_device_id: deviceId, p_share_id: shareId });
  if (!raw) return null;
  return {
    ok: raw.ok === true,
    granted: Number(raw.granted) || 0,
    new_balance: raw.new_balance,
    already_claimed: raw.already_claimed === true,
    capped: raw.capped === true,
  };
}

// ---------------------------------------------------------------------------
// record_hand_net — ECON-SINGLEWRITER Phase 1 (S59)
// ---------------------------------------------------------------------------

export interface HandNetResult {
  ok: boolean;
  net: number;
  new_balance?: number;
  clamped?: boolean;
  /** ECON-SW P1.1 (S62) — true when the server deduped this (device_id, hand_id) → no balance change. */
  duplicate?: boolean;
}

/**
 * Persist a REAL-chip hand's NET (= gross winnings − buy-in, i.e. revealData.netChips) as a
 * single LEDGERED server delta via the strategist-owned `record_hand_net` RPC. This RPC is the
 * SOLE per-hand balance-mover: it moves leaderboard.total_chips by exactly the net once, writes a
 * `chip_transactions` row with event_type 'hand_net', and returns the post-delta `new_balance` so
 * the caller can feed it to submit_score as a stats-only read-back (no double-count). NEVER call
 * for practice hands. Contract (server clamps net to ±10000):
 *   record_hand_net(p_device_id, p_net) -> { ok, new_balance, net, clamped }
 */
export async function recordHandNet(deviceId: string, net: number, handId?: string): Promise<HandNetResult | null> {
  // ECON-SW P1.1 (S62) — pass a STABLE per-hand id as p_hand_id when available; the server
  // dedups on (device_id, hand_id) via a partial unique index, so a results re-mount for the
  // same hand returns { duplicate:true, net:0 } instead of double-counting. Omitting it (2-arg
  // call) keeps the old no-dedup behavior.
  const params: Record<string, unknown> = { p_device_id: deviceId, p_net: net };
  if (handId) params.p_hand_id = handId;
  const raw = await callRPC<any>('record_hand_net', params);
  if (!raw) return null;
  return {
    ok: raw.ok === true,
    net: raw.net ?? net,
    new_balance: raw.new_balance,
    clamped: raw.clamped,
    duplicate: raw.duplicate,
  };
}

// ---------------------------------------------------------------------------
// record_reward — ECON-ACHIEVEMENT-LEDGER (S60)
// ---------------------------------------------------------------------------

export interface RewardResult {
  ok: boolean;
  granted: number;
  new_balance?: number;
  already_granted?: boolean;
  clamped?: boolean;
}

/**
 * Grant a one-off / achievement chip reward as a LEDGERED server delta via the
 * strategist-owned `record_reward` RPC — restoring server persistence for grants that used
 * to ride on submit_score's absolute write (broken by ECON-SW-P1's read-back). The amount is
 * CLIENT-SENT (server clamps to [0, 2000]); pass `once=true` for grants that must fire at most
 * once per (device, eventType) EVER (server-side idempotency — reinstall-farm safe). Returns
 * the post-grant `new_balance`. NEVER call for practice. Contract:
 *   record_reward(p_device_id, p_amount, p_event_type, p_once) -> { ok, granted, new_balance, already_granted, clamped }
 */
export async function recordReward(
  deviceId: string,
  amount: number,
  eventType: string,
  once: boolean = false,
): Promise<RewardResult | null> {
  const raw = await callRPC<any>('record_reward', {
    p_device_id: deviceId,
    p_amount: amount,
    p_event_type: eventType,
    p_once: once,
  });
  if (!raw) return null;
  return {
    ok: raw.ok === true,
    granted: raw.granted ?? 0,
    new_balance: raw.new_balance,
    already_granted: raw.already_granted,
    clamped: raw.clamped,
  };
}

// ---------------------------------------------------------------------------
// Card display config
// ---------------------------------------------------------------------------

export interface CardDisplayConfig {
  show_corner_indicator: boolean;
  main_rank_size_ratio: number;
  main_suit_size_ratio: number;
  board_card_width_ratio: number;
  hole_card_width_ratio: number;
  card_layout: 'v1' | 'v2';
}

const DEFAULT_CARD_DISPLAY_CONFIG: CardDisplayConfig = {
  show_corner_indicator: true,
  main_rank_size_ratio: 0.42,
  main_suit_size_ratio: 0.32,
  board_card_width_ratio: 0,
  hole_card_width_ratio: 0,
  card_layout: 'v1',
};

/**
 * Fetch card_display config from app_config table.
 * Returns defaults on any error so the game always works.
 */
export async function fetchCardDisplayConfig(): Promise<CardDisplayConfig> {
  try {
    const sb = getSupabase();
    if (!sb) return DEFAULT_CARD_DISPLAY_CONFIG;
    const { data, error } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'card_display')
      .single();
    if (error || !data?.value) return DEFAULT_CARD_DISPLAY_CONFIG;
    return { ...DEFAULT_CARD_DISPLAY_CONFIG, ...(data.value as Partial<CardDisplayConfig>) };
  } catch {
    return DEFAULT_CARD_DISPLAY_CONFIG;
  }
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export interface ShopItem {
  event_type: string;
  /** SHOP-OWNERSHIP: server-computed from `purchases`. Absent on older server builds. */
  owned?: boolean;
  cost: number;
  description: string;
  description_he: string;
  can_afford: boolean;
}

export interface ShopData {
  balance: number;
  items: ShopItem[];
}

export async function fetchPokerShop(deviceId: string): Promise<ShopData | null> {
  return callRPC<ShopData>('get_poker_shop', { p_device_id: deviceId });
}

export interface SpendResult {
  success: boolean;
  chips_spent: number;
  new_balance?: number;
  error_code?: string;
  balance?: number;
}

/**
 * Call spend_chips RPC and NORMALIZE the response.
 *
 * VAMOS-CAPS-QA-ECONOMY-GATED — root cause of the two economy-gated failures:
 * the live spend_chips(text,text,int DEFAULT 50) RPC returns
 * `{ ok: true, chips_spent }` (NO `success`, NO `new_balance`) and, when called
 * with only 2 args, charges a flat 50 regardless of the real cost. The client
 * gated entry/purchase on `result.success` — always undefined — so a buy-in that
 * the server actually charged was shown as "Couldn't enter the game" and a shop
 * purchase silently no-op'd (balance unchanged, no toast).
 *
 * Fix here (forward + backward compatible):
 *  - forward the real `amount` as p_amount so the charge is correct (200 / cost),
 *  - coerce `success` from `success===true` OR `ok===true`,
 *  - pass through new_balance/error_code/balance when present.
 * A matching server-side fix (returns success+new_balance, looks up cost, checks
 * balance) is the LIVE remediation — see VAMOS report — and is owner-applied.
 */
export interface PurchaseResult {
  ok: boolean;
  reason?: string;
  item_id?: string;
  price?: number;
  new_balance?: number;
  already_owned?: boolean;
  /** false for consumables (chip top-ups, buy-ins) — they stay buyable and grant no entitlement. */
  permanent?: boolean;
  required?: number;
}

/**
 * SHOP-OWNERSHIP — buy a cosmetic and actually receive it.
 *
 * Deliberately takes NO amount. spend_chips accepts an optional p_amount that overrides the
 * catalogue price, and this screen used to pass the client's own item.cost: a 500-chip table theme
 * was bought for 1 chip on the wire, and (being the old path) granted nothing either. purchase_item
 * reads the price from chip_config itself, so underpaying is impossible from here.
 *
 * The debit and the entitlement are one transaction server-side — a failed grant rolls the chips
 * back rather than leaving a player who paid and owns nothing.
 */
export async function purchaseItem(deviceId: string, eventType: string): Promise<PurchaseResult | null> {
  const raw = await callRPC<any>('purchase_item', { p_device_id: deviceId, p_item_type: eventType });
  if (!raw) return null;
  return {
    ok: raw.ok === true,
    reason: raw.reason,
    item_id: raw.item_id,
    price: raw.price,
    new_balance: raw.new_balance,
    already_owned: raw.already_owned === true,
    permanent: raw.permanent === true,
    required: raw.required,
  };
}

export async function spendChips(
  deviceId: string,
  eventType: string,
  amount?: number,
): Promise<SpendResult | null> {
  const params: Record<string, unknown> = { p_device_id: deviceId, p_event_type: eventType };
  if (typeof amount === 'number') params.p_amount = amount;
  const raw = await callRPC<any>('spend_chips', params);
  if (!raw) return null;
  return {
    success: raw.success === true || raw.ok === true,
    chips_spent: raw.chips_spent ?? raw.spent ?? (typeof amount === 'number' ? amount : 0),
    new_balance: raw.new_balance,
    error_code: raw.error_code,
    balance: raw.balance,
  };
}