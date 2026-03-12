import { Platform } from 'react-native';

// expo-notifications is part of Expo SDK but may not be installed
// Import dynamically to avoid crash if missing
let Notifications: any = null;

try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
  }
} catch {
  // expo-notifications not available — all functions gracefully no-op
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
    const token = await Notifications.getExpoPushTokenAsync();
    return token?.data || null;
  } catch {
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

/** Check if notifications module is available */
export function isNotificationsAvailable(): boolean {
  return Notifications !== null;
}
