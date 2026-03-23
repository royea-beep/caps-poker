/**
 * Dirty Shutdown Detector
 * Detects when the app was killed mid-game (native crash, OOM, etc.)
 *
 * Flow:
 *   game.tsx: markGameActive() before navigating to results
 *   results.tsx: clearGameActive() on mount
 *   _layout.tsx: checkPreviousCrash() on app open → sends WhatsApp alert if flag set
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
 * Clears the flag before returning.
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
