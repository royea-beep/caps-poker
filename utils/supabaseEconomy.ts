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