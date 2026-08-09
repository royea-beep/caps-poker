/**
 * Haptics — one gated entry point.
 *
 * WHY THIS EXISTS. Haptics had no off switch. Settings owns `soundEnabled` and a
 * `soundVolume` stepper, and neither has ever covered vibration, so haptics fired with sound
 * fully muted. On mobile — where most people play muted — that made haptics simultaneously the
 * only feedback channel and the only unmutable one.
 *
 * Every haptic call in the app routes through here so the gate cannot drift. Adding a call
 * site that requires `expo-haptics` directly is how you get an ungatable buzz.
 *
 * Mirrors utils/sounds.ts's shape deliberately: lazily required, web-guarded, and every call
 * swallowed — a missing haptics module must never break a render.
 */
import { Platform } from 'react-native';

let Haptics: any = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch { /* not available — haptics disabled */ }
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

function hapticsAllowed(): boolean {
  try {
    // Required lazily, like utils/sounds.ts:105 — importing the store at module scope from a
    // util pulls a cycle (store -> utils -> store) that has bitten this project before.
    const { useGameStore } = require('../store/gameStore');
    const config = useGameStore.getState().config;
    return config.hapticsEnabled !== false;   // undefined (pre-migration persisted state) = on
  } catch {
    return true;   // if the store is unreadable, behave as before rather than going silent
  }
}

/** Fire a haptic, if the platform supports it and the user has not turned haptics off. */
export function playHaptic(style: HapticStyle): void {
  if (!Haptics) return;
  if (!hapticsAllowed()) return;
  try {
    if (style === 'success' || style === 'warning' || style === 'error') {
      const map: Record<string, any> = {
        success: Haptics.NotificationFeedbackType?.Success,
        warning: Haptics.NotificationFeedbackType?.Warning,
        error: Haptics.NotificationFeedbackType?.Error,
      };
      Haptics.notificationAsync?.(map[style])?.catch?.(() => {});
      return;
    }
    const map: Record<string, any> = {
      light: Haptics.ImpactFeedbackStyle?.Light,
      medium: Haptics.ImpactFeedbackStyle?.Medium,
      heavy: Haptics.ImpactFeedbackStyle?.Heavy,
    };
    Haptics.impactAsync?.(map[style])?.catch?.(() => {});
  } catch { /* never let feedback break a render */ }
}
