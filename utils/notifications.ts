import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import { getDeviceId } from './leaderboard';
import { debugLog } from '../components/DebugOverlay';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  debugLog('[push] expo-notifications not available', 'warn');
}

/** Request notification permissions. Returns true if granted. */
export async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Schedule a local notification after `seconds` delay */
export async function scheduleLocal(
  title: string,
  body: string,
  seconds: number,
  identifier?: string,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { seconds, channelId: 'default' },
      identifier,
    });
    return id;
  } catch {
    return null;
  }
}

/** Cancel all pending notifications */
export async function cancelAll(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // silent
  }
}

/** Cancel a specific notification by identifier */
export async function cancelNotification(identifier: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // silent
  }
}

/** Get Expo push token for remote notifications */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;
    // projectId required on iOS for managed Expo workflow
    let projectId: string | undefined;
    try {
      const Constants = require('expo-constants').default;
      projectId = Constants.expoConfig?.extra?.eas?.projectId;
    } catch {}
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token?.data || null;
  } catch (err) {
    debugLog(`[push] getExpoPushToken failed: ${err}`, 'warn');
    return null;
  }
}

/** Send a push notification via Expo Push API */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
): Promise<boolean> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        sound: 'default',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Schedule re-engagement notification (24h from now). Cancels previous one. */
export async function scheduleReengagement(): Promise<void> {
  if (!Notifications) return;
  try {
    // Cancel any existing re-engagement notification
    await cancelNotification('reengagement');
    await scheduleLocal(
      'CAPS Poker',
      'Your chips are waiting! Come play CAPS',
      24 * 60 * 60, // 24 hours
      'reengagement',
    );
  } catch {
    // silent
  }
}

/** Cancel re-engagement notification (call when app opens) */
export async function cancelReengagement(): Promise<void> {
  await cancelNotification('reengagement');
}

// VAMOS PHASE-A 2026-09-02 — the two return reminders that matter (day 1 + day 3), and permission
// asked at a GOOD MOMENT (after the player has played a hand), never on first launch. Copy is TRUE
// on arrival: the daily-reward faucet resets each day and the player's chips persist, so "your daily
// reward is ready / your chips are waiting" holds whenever these fire. No streak claim (that is only
// true for some players). Bilingual — the notification shows in the language the player chose.
const DAY = 24 * 60 * 60;
const RETURN_COPY = {
  day1: {
    en: { title: 'Your daily reward is ready 🎁', body: 'A fresh stack of chips is waiting at CAPS Poker.' },
    he: { title: 'הפרס היומי שלך מוכן 🎁', body: 'ערימת צ׳יפים טרייה מחכה לך ב-CAPS Poker.' },
  },
  day3: {
    en: { title: 'Still dealt in? 🃏', body: 'Your chips — and a fresh daily reward — are waiting.' },
    he: { title: 'עוד בפנים? 🃏', body: 'הצ׳יפים שלך — ופרס יומי טרי — מחכים לך.' },
  },
};

/**
 * Schedule the day-1 (24h) and day-3 (72h) return reminders, cancelling any prior pair first so
 * each session pushes them out. Requires notification permission; if it is not granted the OS
 * scheduling silently no-ops (scheduleLocal returns null), which is fine — no prompt happens here.
 * `he` picks the Hebrew copy.
 */
export async function scheduleReturnReminders(he: boolean): Promise<void> {
  if (!Notifications) return;
  const lang = he ? 'he' : 'en';
  await cancelNotification('return_day1');
  await cancelNotification('return_day3');
  await scheduleLocal(RETURN_COPY.day1[lang].title, RETURN_COPY.day1[lang].body, DAY, 'return_day1');
  await scheduleLocal(RETURN_COPY.day3[lang].title, RETURN_COPY.day3[lang].body, 3 * DAY, 'return_day3');
}

/** Cancel the day-1/day-3 return reminders (call when the app opens — they came back). */
export async function cancelReturnReminders(): Promise<void> {
  await cancelNotification('return_day1');
  await cancelNotification('return_day3');
}

/**
 * Launch-safe token registration: register the push token ONLY if permission is already granted.
 * NEVER prompts — so the OS permission dialog cannot appear on first launch. Use
 * `promptAndScheduleReturns()` to ask at a good moment instead.
 */
export async function registerPushIfGranted(): Promise<void> {
  if (!Notifications) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await registerAndSavePushToken();
    }
  } catch {
    // silent — never block launch
  }
}

/**
 * Ask for notification permission at a GOOD MOMENT — call this only after the player has had a
 * positive experience (e.g. finished a hand), never on first launch. Prompts at most once (guarded
 * by an AsyncStorage flag); on grant, schedules the day-1/day-3 return reminders in `he`/en.
 * `hasPlayed` must be true (the caller's proof the player has already played) — a guard so this can
 * never fire before the first hand.
 */
export async function promptAndScheduleReturns(hasPlayed: boolean, he: boolean): Promise<void> {
  if (!Notifications || !hasPlayed) return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const KEY = 'notif_return_prompted_v1';
    const already = await AsyncStorage.getItem(KEY).catch(() => null);
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      // Already allowed — just (re)schedule, no prompt.
      await scheduleReturnReminders(he);
      return;
    }
    if (already) return; // asked once already and not granted — do not nag
    await AsyncStorage.setItem(KEY, '1').catch(() => {});
    const granted = await requestPermissions();
    if (granted) await scheduleReturnReminders(he);
  } catch {
    // silent
  }
}

/** Check if notifications module is available */
export function isNotificationsAvailable(): boolean {
  return Notifications !== null;
}

/** Insert a push registration failure into crash_reports for monitoring. */
async function logPushFailure(reason: string, detail?: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from('crash_reports').insert({
      // AU2.1 — attribute the crash to a device so it can be joined to analytics_events.
      device_id: await getDeviceId().catch(() => null),
      project: 'caps',
      crash_code: 'push_registration_failed',
      error_message: reason,
      error_stack: detail ?? null,
      last_screen: 'App._layout',
      status: 'open',
    });
  } catch {
    // non-blocking
  }
}

/**
 * Register for push notifications and save the token to Supabase.
 * On any failure, logs to crash_reports so push coverage can be monitored.
 */
export async function registerAndSavePushToken(): Promise<string | null> {
  if (!Notifications) {
    await logPushFailure('expo-notifications not available');
    return null;
  }

  const token = await getExpoPushToken();
  if (!token) {
    // Distinguish between denied permissions vs. token fetch failure
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await logPushFailure('permission_denied', `status=${status}`);
      } else {
        await logPushFailure('token_fetch_failed', 'getExpoPushToken returned null despite granted permission');
      }
    } catch (e) {
      await logPushFailure('permission_check_threw', String(e));
    }
    return null;
  }

  const deviceId = await getDeviceId();
  const client = getSupabase();
  if (!client) return token;

  // Get authenticated user — required for push targeting
  const { data: { user } } = await client.auth.getUser();
  const userId = user?.id ?? null;

  // Call register_push_token RPC — upserts token + platform + user_id
  client
    .rpc('register_push_token', {
      p_device_id: deviceId,
      p_token: token,
      p_platform: Platform.OS,
      p_user_id: userId,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        // Fallback: direct upsert if RPC not available yet
        debugLog(`[push_tokens] RPC failed (${error.message}), falling back to direct upsert`, 'warn');
        client
          .from('push_tokens')
          .upsert(
            {
              device_id: deviceId,
              token,
              platform: Platform.OS,
              user_id: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'device_id,token' },
          )
          .then(({ error: e2 }: { error: { message: string } | null }) => {
            if (e2) {
              debugLog(`[push_tokens] upsert fallback failed: ${e2.message}`, 'warn');
              logPushFailure('upsert_fallback_failed', e2.message);
            }
          });
      } else {
        debugLog('[push] token registered successfully');
      }
    });

  return token;
}

/**
 * Retry push registration — call from Settings when user taps "Enable Notifications".
 * Opens OS settings if previously denied; otherwise re-runs registration.
 * Returns true if a token was successfully obtained.
 */
export async function retryPushRegistration(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'denied') {
      // User previously denied — send them to OS settings (iOS 16+)
      const Linking = require('expo-linking');
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
      }
      return false;
    }
    const token = await registerAndSavePushToken();
    return token !== null;
  } catch {
    return false;
  }
}
