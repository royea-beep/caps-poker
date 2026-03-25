/**
 * @caps/debugger — Dirty Shutdown Detector
 *
 * Detects when the app was killed mid-game (native crash, OOM, Hermes watchdog, etc.)
 *
 * Flow:
 *   game start: markAppActive() — writes timestamp to AsyncStorage
 *   clean exit:  clearAppActive() on component UNMOUNT (not mount)
 *   app open:    checkDirtyShutdown() — if flag found → crash occurred
 *
 * Iron rule: clear on UNMOUNT not mount.
 * If cleared on mount, the flag disappears before the crash can be detected.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDebuggerReady, getConfig } from './config';

function getKey(): string {
  const appName = isDebuggerReady() ? getConfig().appName : 'app';
  return `@caps_debugger/${appName}_active`;
}

export async function markAppActive(): Promise<void> {
  try {
    await AsyncStorage.setItem(getKey(), String(Date.now()));
  } catch {}
}

export async function clearAppActive(): Promise<void> {
  try {
    await AsyncStorage.removeItem(getKey());
  } catch {}
}

/**
 * Returns timestamp (ms) of when app was marked active, or null if clean shutdown.
 * Clears the flag before returning so it doesn't fire twice.
 */
export async function checkDirtyShutdown(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(getKey());
    if (!val) return null;
    await AsyncStorage.removeItem(getKey());
    return parseInt(val, 10);
  } catch {
    return null;
  }
}
