/**
 * Supabase-based analytics. Uses track_event RPC — no external SDK.
 * Fire-and-forget: never blocks UI, never throws.
 */
import { getDeviceId } from './leaderboard';

let cachedDeviceId: string | null = null;
let cachedUserId: string | null = null;
let cachedSessionId: string | null = null;
let supabaseRef: any = null;

function generateSessionId(): string {
  // RFC 4122 v4 — adequate for in-memory analytics session IDs (not used for security).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function initAnalytics(): Promise<void> {
  try {
    cachedDeviceId = await getDeviceId();
    cachedSessionId = generateSessionId();
    const { getSupabase } = require('./supabase');
    supabaseRef = getSupabase();
    const { data } = await supabaseRef.auth.getUser();
    cachedUserId = data?.user?.id ?? null;
  } catch {}
}

export function track(event: string, properties?: Record<string, unknown>, screen?: string): void {
  if (!supabaseRef || !cachedDeviceId) return;
  supabaseRef.rpc('track_event', {
    p_event: event,
    p_user_id: cachedUserId,
    p_device_id: cachedDeviceId,
    p_session_id: cachedSessionId,
    p_data: properties ?? {},
    p_screen: screen ?? null,
  }).then(() => {}).catch(() => {});
}

export function trackPushOpen(templateType: string): void {
  if (!supabaseRef || !cachedUserId) return;
  supabaseRef.rpc('track_push_open', {
    p_user_id: cachedUserId,
    p_template_type: templateType,
  }).then(() => {}).catch(() => {});
}
