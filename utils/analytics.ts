/**
 * Supabase-based analytics. Uses track_event RPC — no external SDK.
 * Fire-and-forget: never blocks UI, never throws.
 */
import { getDeviceId } from './leaderboard';

let cachedDeviceId: string | null = null;
let supabaseRef: any = null;

export async function initAnalytics(): Promise<void> {
  try {
    cachedDeviceId = await getDeviceId();
    const { getSupabase } = require('./supabase');
    supabaseRef = getSupabase();
  } catch {}
}

export function track(event: string, properties?: Record<string, unknown>, screen?: string): void {
  if (!supabaseRef || !cachedDeviceId) return;
  supabaseRef.rpc('track_event', {
    p_event: event,
    p_device_id: cachedDeviceId,
    p_properties: properties ?? {},
    p_screen: screen ?? null,
  }).then(() => {}).catch(() => {});
}
