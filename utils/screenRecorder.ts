/**
 * Screen Recorder — uses react-native-view-shot (captureScreen) as a fallback
 * since expo-screen-recorder and react-native-record-screen require native builds.
 *
 * Captures a screenshot every 2000ms → saves to disk (survives native crashes).
 * Keeps the last 10 frames to avoid storage bloat.
 *
 * SDK 55 NOTE: All FileSystem.* legacy functions (copyAsync, readDirectoryAsync,
 * makeDirectoryAsync, getInfoAsync, deleteAsync) throw at runtime via
 * errorOnLegacyMethodUse(). This file uses the SDK 55 File/Directory API.
 */
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { debugLog, setDebugRecording } from '../components/DebugOverlay';

let captureScreen: ((opts: { format: string; quality: number; result?: string }) => Promise<string>) | null = null;

try {
  captureScreen = require('react-native-view-shot').captureScreen;
  debugLog('🎥 screenRecorder: react-native-view-shot loaded ✅ type=' + typeof captureScreen);
  console.log('[SCREEN-REC] captureScreen loaded, type:', typeof captureScreen);
} catch (e: any) {
  debugLog('🎥 screenRecorder: no capture package — video disabled', 'warn');
  console.error('[SCREEN-REC] react-native-view-shot load failed:', e?.message);
}

// SDK 55: Use Paths.document for persistent storage
const SCREENSHOTS_SUBDIR = 'crash-screenshots';
export const SCREENSHOT_DIR = (() => {
  try {
    return new Directory(Paths.document, SCREENSHOTS_SUBDIR).uri;
  } catch {
    return '';
  }
})();

function getScreenshotDir(): Directory {
  return new Directory(Paths.document, SCREENSHOTS_SUBDIR);
}

async function ensureScreenshotDir(): Promise<void> {
  try {
    const dir = getScreenshotDir();
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }
  } catch (e: any) {
    console.error('[SCREEN-REC] ensureScreenshotDir failed:', e?.message);
  }
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
  debugLog('🎥 REC start: disk mode (0.5fps → crash-screenshots/)');

  let _tickCount = 0;
  screenshotInterval = setInterval(async () => {
    if (isCapturing || !isRecording) return;
    isCapturing = true;
    _tickCount++;
    console.log('[BUG-PIPE] 2a: Interval tick #' + _tickCount);
    try {
      const uri = await captureScreen!({ format: 'jpg', quality: 0.3, result: 'tmpfile' });
      console.log('[BUG-PIPE] 2a: captureScreen returned URI:', uri ? uri.slice(-40) : 'NULL');

      if (!uri) {
        console.warn('[BUG-PIPE] 2a: captureScreen returned falsy URI');
        return;
      }

      const fileName = `frame-${Date.now()}.jpg`;
      const dir = getScreenshotDir();

      // SDK 55: use File.copy() instead of FileSystem.copyAsync()
      const src = new File(uri);
      const dest = new File(dir, fileName);
      src.copy(dest);

      // Keep only last MAX_FRAMES files
      const allFiles = dir.list()
        .filter((f): f is File => f instanceof File)
        .map((f) => f.uri)
        .sort();

      if (allFiles.length > MAX_FRAMES) {
        for (let i = 0; i < allFiles.length - MAX_FRAMES; i++) {
          try { new File(allFiles[i]).delete(); } catch {}
        }
      }
      console.log('[BUG-PIPE] 2a: ✅ Frame', allFiles.length, fileName);
    } catch (err: any) {
      console.error('[BUG-PIPE] 2a: ❌ Capture failed:', err?.message || JSON.stringify(err));
    } finally {
      isCapturing = false;
    }
  }, 2000);

  console.log('[SCREEN-REC] interval started, ID:', screenshotInterval);
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

  try {
    const dir = getScreenshotDir();
    if (!dir.exists) {
      debugLog(`🎥 REC stop (${duration}s) — screenshot dir does not exist`);
      return null;
    }
    const files = dir.list()
      .filter((f): f is File => f instanceof File)
      .map((f) => f.uri)
      .sort();

    const lastFrame = files.length > 0 ? files[files.length - 1] : null;
    debugLog(`🎥 REC stop (${duration}s) — ${files.length} frames on disk`);
    if (lastFrame) debugLog(`🎥 last frame: ...${lastFrame.slice(-40)}`);
    return lastFrame;
  } catch (e: any) {
    debugLog(`🎥 REC stop (${duration}s) — could not read dir: ${e?.message}`);
    return null;
  }
}

/** Read saved crash screenshots from disk — called after dirty shutdown detected */
export async function getLastCrashScreenshots(): Promise<string[]> {
  try {
    const dir = getScreenshotDir();
    if (!dir.exists) return [];
    return dir.list()
      .filter((f): f is File => f instanceof File)
      .map((f) => f.uri)
      .sort();
  } catch {
    return [];
  }
}

/** Delete all crash screenshots from disk — call after crash report is uploaded */
export async function clearCrashScreenshots(): Promise<void> {
  try {
    const dir = getScreenshotDir();
    if (dir.exists) {
      dir.delete();
    }
    dir.create({ intermediates: true });
  } catch {}
}

export function isCurrentlyRecording(): boolean { return isRecording; }
export function getRecordingDuration(): number {
  return isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
}
