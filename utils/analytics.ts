/**
 * Supabase-based analytics. Uses track_event RPC — no external SDK.
 * Fire-and-forget: never blocks UI, never throws.
 *
 * VAMOS-CAPS-PRE-FRIENDS-READINESS 2026-06-24 — RE-ACTIVATED.
 * track() was a no-op since 2026-06-17 because the track_event RPC 404'd. That RPC
 * now exists (track_event(p_event, p_user_id, p_device_id, p_data, p_screen) ->
 * analytics_events), so tracking is restored: every screen_view / mode_start /
 * game_start / game_end / purchase / cup_earned / error callsite across the app
 * lights up again. session_id + app_version ride along in properties (the RPC has
 * no dedicated session_id arg), and every event also feeds a per-session breadcrumb
 * trail that the crash/error reporters attach so a bug arrives with its last steps.
 */
import { getDeviceId } from './leaderboard';
import { addBreadcrumb } from './breadcrumbs';
import { getCurrentScreen } from './crash-evidence';

let cachedDeviceId: string | null = null;
let cachedUserId: string | null = null;
let cachedSessionId: string | null = null;
let cachedAppVersion = 'unknown';
let supabaseRef: any = null;

function generateSessionId(): string {
  // RFC 4122 v4 — adequate for in-memory analytics session IDs (not used for security).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getSessionId(): string | null {
  return cachedSessionId;
}

export function getAppVersion(): string {
  return cachedAppVersion;
}

export async function initAnalytics(): Promise<void> {
  try {
    cachedDeviceId = await getDeviceId();
    cachedSessionId = generateSessionId();
    try {
      cachedAppVersion = require('expo-constants').default?.expoConfig?.version ?? 'unknown';
    } catch {}
    const { getSupabase } = require('./supabase');
    supabaseRef = getSupabase();
    const { data } = await supabaseRef.auth.getUser();
    cachedUserId = data?.user?.id ?? null;
  } catch {}
}

/**
 * Fire an analytics event (fire-and-forget). Writes to analytics_events via the
 * track_event RPC and records a breadcrumb. Never throws, never blocks the UI.
 */
export function track(event: string, properties?: Record<string, unknown>, screen?: string): void {
  // Feed the shared breadcrumb trail (utils/breadcrumbs) that crash/bug reports
  // already attach — record even if the network call below later fails.
  addBreadcrumb(screen ? `${event} @${screen}` : event);
  try {
    const sb = supabaseRef ?? (() => { try { return require('./supabase').getSupabase(); } catch { return null; } })();
    if (!sb) return;
    sb.rpc('track_event', {
      p_event: event,
      p_user_id: cachedUserId,
      p_device_id: cachedDeviceId,
      p_data: {
        ...(properties ?? {}),
        // session_id/app_version travel in properties: the RPC has no dedicated args.
        session_id: cachedSessionId,
        app_version: cachedAppVersion,
      },
      // FRICTION-NULL-SCREEN 2026-07-25 — never transmit a null/empty screen. When a caller omits it
      // (the cold-start window before the route tag initialises), fall back to the globally-maintained
      // route (crash-evidence, kept current per-route since f7a66f7). getCurrentScreen() defaults to
      // 'unknown' — never null/empty — so p_screen is ALWAYS a real screen. Guarantees every
      // stuck_dwell/rage_tap/any event carries a screen, at the transmission boundary itself.
      p_screen: screen || getCurrentScreen(),
    }).then(() => {}).catch(() => {});
  } catch {
    // never throw from analytics
  }
}

export function trackPushOpen(templateType: string): void {
  if (!supabaseRef || !cachedUserId) return;
  supabaseRef.rpc('track_push_open', {
    p_user_id: cachedUserId,
    p_template_type: templateType,
  }).then(() => {}).catch(() => {});
}
