/**
 * Heatmap event collection (D7)
 * Fire-and-forget — never blocks UI.
 */

import { getSupabase } from './supabase';

// App version from app.json (expo config) — read at runtime to avoid static import issues
function getAppVersion(): string {
  try {
    const Constants = require('expo-constants').default;
    // '1.9.4' was a hand-maintained fallback, months stale, and it is what wrote the wrong
    // version into telemetry on web where expoConfig.version is unavailable. '?' is an honest
    // unknown; a stale number reads as fact and misdirects triage.
    return Constants.expoConfig?.version ?? '?';
  } catch {
    return '?';
  }
}

export function trackEvent(screen: string, element: string, deviceId: string): void {
  const supabase = getSupabase();
  if (!supabase) return;
  // Wrap in Promise.resolve to get a full Promise (Supabase returns PromiseLike)
  Promise.resolve(
    supabase
      .from('heatmap_events')
      .insert({
        device_id: deviceId,
        screen,
        element,
        tap_count: 1,
        app_version: getAppVersion(),
        date: new Date().toISOString().split('T')[0],
      })
  ).then(() => {}).catch(() => {}); // fire and forget, never block UI
}
