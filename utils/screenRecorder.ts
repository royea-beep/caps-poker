/**
 * Screen Recorder — uses react-native-view-shot (captureScreen) as a fallback
 * since expo-screen-recorder and react-native-record-screen require native builds.
 *
 * Captures a screenshot every 500ms → keeps the last 20 frames (10s window).
 * stopRecording() returns the last captured frame URI.
 */
import { Platform } from 'react-native';
import { debugLog, setDebugRecording } from '../components/DebugOverlay';

let captureScreen: ((opts: { format: string; quality: number }) => Promise<string>) | null = null;

try {
  captureScreen = require('react-native-view-shot').captureScreen;
  debugLog('🎥 screenRecorder: react-native-view-shot captureScreen loaded ✅');
} catch {
  debugLog('🎥 screenRecorder: no capture package available — video disabled', 'warn');
}

let screenshotInterval: ReturnType<typeof setInterval> | null = null;
const screenshots: string[] = [];
let isCapturing = false;
let isRecording = false;
let recordingStartTime = 0;

export async function startRecording(): Promise<boolean> {
  if (!captureScreen || Platform.OS === 'web') {
    debugLog('🎥 REC start: skipped (no captureScreen or web)');
    return false;
  }
  if (isRecording) return true;

  screenshots.length = 0;
  isRecording = true;
  recordingStartTime = Date.now();
  setDebugRecording(true);
  debugLog('🎥 REC start: screenshot mode (2fps)');

  screenshotInterval = setInterval(async () => {
    if (isCapturing || !isRecording) return;
    isCapturing = true;
    try {
      const uri = await captureScreen!({ format: 'jpg', quality: 0.5 });
      screenshots.push(uri);
      if (screenshots.length > 20) screenshots.shift(); // keep last 10s
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
  debugLog(`🎥 REC stop (${duration}s) — ${screenshots.length} frames`);

  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
  isRecording = false;
  setDebugRecording(false);

  const lastFrame = screenshots[screenshots.length - 1] ?? null;
  if (lastFrame) debugLog(`🎥 REC last frame: ${lastFrame.slice(-30)}`);
  return lastFrame;
}

export function isCurrentlyRecording(): boolean { return isRecording; }
export function getRecordingDuration(): number {
  return isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
}
