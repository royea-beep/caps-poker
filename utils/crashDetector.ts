/**
 * Crash Detector — ties together recording, upload, and alert.
 * Call onGameStart() when game begins, onGameEnd() when it ends normally,
 * onCrashDetected() from ErrorBoundary or global error handler.
 */
import { Platform } from 'react-native';
import { startRecording, stopRecording, isCurrentlyRecording } from './screenRecorder';
import { uploadCrashReport } from './crashUploader';
import { sendCrashAlert } from './crashAlert';
import { debugLog, getGlobalLogs } from '../components/DebugOverlay';

// Read build info lazily
function getBuildInfo() {
  try {
    const Constants = require('expo-constants').default;
    const cfg = Constants.expoConfig;
    return {
      build: cfg?.ios?.buildNumber ?? cfg?.android?.versionCode?.toString() ?? 'unknown',
      version: cfg?.version ?? 'unknown',
    };
  } catch { return { build: 'unknown', version: 'unknown' }; }
}

function getDeviceInfo(): string {
  try {
    const Device = require('expo-device');
    return `${Device.modelName ?? 'unknown'} (iOS ${Device.osVersion ?? '?'})`;
  } catch { return Platform.OS; }
}

export async function onGameStart() {
  debugLog('🎮 game started — crash detection ON');
  await startRecording();
}

export async function onGameEnd() {
  if (!isCurrentlyRecording()) return;
  debugLog('🎮 game ended normally — discarding recording');
  await stopRecording(); // discard — no crash
}

export async function onCrashDetected(error?: Error) {
  const logs = getGlobalLogs().map(l => `${l.time} ${l.message}`);
  const lastLine = logs[logs.length - 1] ?? 'unknown';
  debugLog(`💀 CRASH: ${error?.message ?? 'unknown'}`, 'error');

  let videoUri: string | null = null;
  if (isCurrentlyRecording()) {
    videoUri = await stopRecording();
  }

  const { build, version } = getBuildInfo();
  const device = getDeviceInfo();

  // Fire and forget — don't await, never block
  uploadCrashReport(videoUri, logs, {
    build, version, device,
    lastStep: lastLine,
    crashError: error?.message,
  }).then((videoUrl) => {
    sendCrashAlert(videoUrl, lastLine, { build, version, device }).catch(() => {});
  }).catch(() => {});
}
