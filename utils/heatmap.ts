/**
 * Heatmap event collection (D7)
 * Fire-and-forget — never blocks UI.
 */

import { getSupabase } from './supabase';

// App version from app.json (expo config) — read at runtime to avoid static import issues
function getAppVersion(): string {
  try {
    const Constants = require('expo-constants').default;
    return Constants.expoConfig?.version ?? '1.9.4';
  } catch {
    return '1.9.4';
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
