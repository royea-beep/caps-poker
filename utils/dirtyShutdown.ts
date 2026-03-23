/**
 * Dirty Shutdown Detector
 * Detects when the app was killed mid-game (native crash, OOM, Hermes watchdog, etc.)
 *
 * Flow:
 *   game.tsx: markGameActive() before navigating to results → flag written to AsyncStorage
 *   results.tsx: clearGameActive() on UNMOUNT (normal exit) — NOT on mount
 *   _layout.tsx: checkPreviousCrash() on app open → if flag found = crash happened → WhatsApp alert
 *
 * Why unmount and not mount:
 *   If cleared on mount, the flag disappears BEFORE the COMPLETE crash can be detected.
 *   If cleared on unmount, the flag survives any crash that happens inside results screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'caps_game_active';

export async function markGameActive(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch {}
}

export async function clearGameActive(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

/**
 * Returns timestamp (ms) of when game was marked active, or null if clean shutdown.
 * Clears the flag before returning so it doesn't fire twice.
 */
export async function checkPreviousCrash(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    if (!val) return null;
    await AsyncStorage.removeItem(KEY);
    return parseInt(val, 10);
  } catch {
    return null;
  }
}
