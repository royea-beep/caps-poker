/**
 * Screen Recorder — uses react-native-view-shot (captureScreen) as a fallback
 * since expo-screen-recorder and react-native-record-screen require native builds.
 *
 * Captures a screenshot every 500ms → saves to disk (survives native crashes).
 * Keeps the last 10 frames (~5s window) to avoid storage bloat.
 * On clean exit: frames stay on disk until cleared after crash report.
 * On native crash: frames survive → read by checkPreviousCrash on next open.
 */
import { Platform } from 'react-native';
import { debugLog, setDebugRecording } from '../components/DebugOverlay';

let captureScreen: ((opts: { format: string; quality: number }) => Promise<string>) | null = null;
let FileSystem: any = null;

try {
  captureScreen = require('react-native-view-shot').captureScreen;
  debugLog('🎥 screenRecorder: react-native-view-shot loaded ✅');
} catch {
  debugLog('🎥 screenRecorder: no capture package — video disabled', 'warn');
}

try {
  FileSystem = require('expo-file-system');
} catch {
  debugLog('🎥 screenRecorder: expo-file-system not available', 'warn');
}

export const SCREENSHOT_DIR = `${FileSystem?.documentDirectory ?? ''}crash-screenshots/`;

async function ensureScreenshotDir(): Promise<void> {
  if (!FileSystem) return;
  try {
    const info = await FileSystem.getInfoAsync(SCREENSHOT_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(SCREENSHOT_DIR, { intermediates: true });
    }
  } catch {}
}

let screenshotInterval: ReturnType<typeof setInterval> | null = null;
let isCapturing = false;
let isRecording = false;
let recordingStartTime = 0;

const MAX_FRAMES = 10;

export async function startRecording(): Promise<boolean> {
  if (!captureScreen || Platform.OS === 'web') {
    debugLog('🎥 REC start: skipped (no captureScreen or web)');
    return false;
  }
  if (isRecording) return true;

  await ensureScreenshotDir();
  isRecording = true;
  recordingStartTime = Date.now();
  setDebugRecording(true);
  debugLog('🎥 REC start: disk mode (2fps → crash-screenshots/)');

  screenshotInterval = setInterval(async () => {
    if (isCapturing || !isRecording || !FileSystem) return;
    isCapturing = true;
    try {
      const uri = await captureScreen!({ format: 'jpg', quality: 0.3 });
      const fileName = `frame-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: SCREENSHOT_DIR + fileName });

      // Keep only last MAX_FRAMES files
      const files = await FileSystem.readDirectoryAsync(SCREENSHOT_DIR);
      if (files.length > MAX_FRAMES) {
        const sorted = files.sort();
        for (let i = 0; i < files.length - MAX_FRAMES; i++) {
          await FileSystem.deleteAsync(SCREENSHOT_DIR + sorted[i], { idempotent: true });
        }
      }
    } catch {
      // silent — capture can fail during transitions
    } finally {
      isCapturing = false;
    }
  }, 500);

  return true;
}

export async function stopRecording(): Promise<string | null> {
  if (!isRecording) return null;

  const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);

  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
  isRecording = false;
  setDebugRecording(false);

  if (!FileSystem) {
    debugLog(`🎥 REC stop (${duration}s) — no FileSystem`);
    return null;
  }

  try {
    const files = await FileSystem.readDirectoryAsync(SCREENSHOT_DIR);
    const sorted = files.sort();
    const lastFrame = sorted.length > 0 ? SCREENSHOT_DIR + sorted[sorted.length - 1] : null;
    debugLog(`🎥 REC stop (${duration}s) — ${sorted.length} frames on disk`);
    if (lastFrame) debugLog(`🎥 last frame: ...${lastFrame.slice(-40)}`);
    return lastFrame;
  } catch {
    debugLog(`🎥 REC stop (${duration}s) — could not read dir`);
    return null;
  }
}

/** Read saved crash screenshots from disk — called after dirty shutdown detected */
export async function getLastCrashScreenshots(): Promise<string[]> {
  if (!FileSystem) return [];
  try {
    await ensureScreenshotDir();
    const files = await FileSystem.readDirectoryAsync(SCREENSHOT_DIR);
    return files.sort().map((f: string) => SCREENSHOT_DIR + f);
  } catch {
    return [];
  }
}

/** Delete all crash screenshots from disk — call after crash report is uploaded */
export async function clearCrashScreenshots(): Promise<void> {
  if (!FileSystem) return;
  try {
    await FileSystem.deleteAsync(SCREENSHOT_DIR, { idempotent: true });
    await ensureScreenshotDir();
  } catch {}
}

export function isCurrentlyRecording(): boolean { return isRecording; }
export function getRecordingDuration(): number {
  return isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
}
