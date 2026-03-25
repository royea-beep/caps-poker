/**
 * @caps/debugger — Screen Recorder
 * Captures screenshots at ~2fps and saves to disk (survives native crashes).
 * Keeps last N frames (~5s window). Uses react-native-view-shot.
 */
import { Platform } from 'react-native';
import { debugLog, setDebugRecording } from './debugLog';
import { isDebuggerReady, getConfig } from './config';

let captureScreenFn: ((opts: { format: string; quality: number }) => Promise<string>) | null = null;
let FileSystem: typeof import('expo-file-system') | null = null;

try {
  captureScreenFn = require('react-native-view-shot').captureScreen;
} catch {
  // react-native-view-shot not available
}

try {
  FileSystem = require('expo-file-system');
} catch {
  // expo-file-system not available
}

function getScreenshotDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return `${(FileSystem as any)?.documentDirectory ?? ''}caps-debugger-screenshots/`;
}

function getMaxFrames(): number {
  return isDebuggerReady() ? getConfig().maxScreenshots : 10;
}

async function ensureDir(): Promise<void> {
  if (!FileSystem) return;
  try {
    const info = await FileSystem.getInfoAsync(getScreenshotDir());
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(getScreenshotDir(), { intermediates: true });
    }
  } catch {}
}

let screenshotInterval: ReturnType<typeof setInterval> | null = null;
let isCapturing = false;
let isRecording = false;
let recordingStartTime = 0;

export async function startRecording(): Promise<boolean> {
  if (!captureScreenFn || Platform.OS === 'web') {
    debugLog('🎥 REC start: skipped (no captureScreen or web)');
    return false;
  }
  if (isRecording) return true;

  await ensureDir();
  isRecording = true;
  recordingStartTime = Date.now();
  setDebugRecording(true);

  const fpsInterval = isDebuggerReady() ? Math.round(1000 / getConfig().screenshotFps) : 500;
  debugLog(`🎥 REC start: ${getConfig().screenshotFps ?? 2}fps → caps-debugger-screenshots/`);

  screenshotInterval = setInterval(async () => {
    if (isCapturing || !isRecording || !FileSystem) return;
    isCapturing = true;
    try {
      const uri = await captureScreenFn!({ format: 'jpg', quality: 0.3 });
      const fileName = `frame-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: getScreenshotDir() + fileName });

      const files = await FileSystem.readDirectoryAsync(getScreenshotDir());
      const maxFrames = getMaxFrames();
      if (files.length > maxFrames) {
        const sorted = files.sort();
        for (let i = 0; i < files.length - maxFrames; i++) {
          await FileSystem.deleteAsync(getScreenshotDir() + sorted[i], { idempotent: true });
        }
      }
    } catch {
      // silent — capture can fail during transitions
    } finally {
      isCapturing = false;
    }
  }, fpsInterval);

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
    const files = await FileSystem.readDirectoryAsync(getScreenshotDir());
    const sorted = files.sort();
    const lastFrame = sorted.length > 0 ? getScreenshotDir() + sorted[sorted.length - 1] : null;
    debugLog(`🎥 REC stop (${duration}s) — ${sorted.length} frames`);
    return lastFrame;
  } catch {
    debugLog(`🎥 REC stop (${duration}s) — could not read dir`);
    return null;
  }
}

/** Read saved crash screenshots — called after dirty shutdown detected */
export async function getScreenshots(): Promise<string[]> {
  if (!FileSystem) return [];
  try {
    await ensureDir();
    const files = await FileSystem.readDirectoryAsync(getScreenshotDir());
    return files.sort().map((f: string) => getScreenshotDir() + f);
  } catch {
    return [];
  }
}

/** Delete all crash screenshots — call after crash report is uploaded */
export async function clearScreenshots(): Promise<void> {
  if (!FileSystem) return;
  try {
    await FileSystem.deleteAsync(getScreenshotDir(), { idempotent: true });
    await ensureDir();
  } catch {}
}

export function isCurrentlyRecording(): boolean { return isRecording; }
