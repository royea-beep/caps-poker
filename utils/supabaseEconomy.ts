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
        Alert.alert('לא מספיק צ׳יפים', d.balance != null ? `יש לך ${d.balance}` : undefined);
      }
      return null;
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
  | 'quick_poker_win';

export interface EarnResult {
  chips_earned: number;
  new_balance: number;
  success: boolean;
}

/**
 * Call earn_chips RPC. Returns { chips_earned, new_balance } or null on failure.
 * deviceId — pass result of getDeviceId().
 */
export async function earnChips(
  deviceId: string,
  event: EarnEvent,
): Promise<EarnResult | null> {
  return callRPC<EarnResult>('earn_chips', {
    p_device_id: deviceId,
    p_event_type: event,
  });
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
  new_balance: number;
  error_code?: string;
  balance?: number;
}

export async function spendChips(
  deviceId: string,
  eventType: string,
): Promise<SpendResult | null> {
  return callRPC<SpendResult>('spend_chips', {
    p_device_id: deviceId,
    p_event_type: eventType,
  });
}