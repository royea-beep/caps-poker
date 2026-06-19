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

// VAMOS-FIX-RESULTS-TRANSITION 2026-06-17 — no-op until the track_event RPC
// is provisioned on Supabase. It was 404ing on every call (~6 per game) and
// adding network noise to the trace. The function signature is preserved so
// callsites stay unchanged; restoring tracking is a one-line revert.
export function track(_event: string, _properties?: Record<string, unknown>, _screen?: string): void {
  // intentionally a no-op
}

export function trackPushOpen(templateType: string): void {
  if (!supabaseRef || !cachedUserId) return;
  supabaseRef.rpc('track_push_open', {
    p_user_id: cachedUserId,
    p_template_type: templateType,
  }).then(() => {}).catch(() => {});
}
