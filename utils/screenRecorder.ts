/**
 * Screen Recorder — wraps expo-screen-recorder with graceful fallback.
 * Works via OTA only if package is in the native build.
 * Install: npx expo install expo-screen-recorder
 */
import { Platform } from 'react-native';
import { debugLog, setDebugRecording } from '../components/DebugOverlay';

let ScreenRecorder: any = null;

if (Platform.OS === 'ios') {
  try {
    ScreenRecorder = require('expo-screen-recorder');
    debugLog('🎥 Screen recorder: expo-screen-recorder loaded');
  } catch {
    try {
      ScreenRecorder = require('react-native-record-screen');
      debugLog('🎥 Screen recorder: react-native-record-screen loaded');
    } catch {
      debugLog('🎥 Screen recorder: no package available — video disabled', 'warn');
    }
  }
}

let isRecording = false;
let recordingStartTime = 0;

export async function startRecording(): Promise<boolean> {
  if (!ScreenRecorder || isRecording || Platform.OS !== 'ios') return false;
  try {
    debugLog('🎥 REC start');
    if (ScreenRecorder.startRecording) {
      await ScreenRecorder.startRecording(false);
    } else if (ScreenRecorder.RecordScreen?.startRecording) {
      await ScreenRecorder.RecordScreen.startRecording({ mic: false, fps: 30 });
    }
    isRecording = true;
    recordingStartTime = Date.now();
    setDebugRecording(true);
    return true;
  } catch (e) {
    debugLog(`🎥 REC start failed: ${e}`, 'error');
    return false;
  }
}

export async function stopRecording(): Promise<string | null> {
  if (!ScreenRecorder || !isRecording) return null;
  try {
    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    debugLog(`🎥 REC stop (${duration}s)`);
    let videoUri: string | null = null;
    if (ScreenRecorder.stopRecording) {
      videoUri = await ScreenRecorder.stopRecording();
    } else if (ScreenRecorder.RecordScreen?.stopRecording) {
      const result = await ScreenRecorder.RecordScreen.stopRecording();
      videoUri = result?.result?.outputURL ?? null;
    }
    isRecording = false;
    setDebugRecording(false);
    if (videoUri) debugLog(`🎥 REC saved: ${videoUri.slice(-20)}`);
    return videoUri;
  } catch (e) {
    debugLog(`🎥 REC stop failed: ${e}`, 'error');
    isRecording = false;
    return null;
  }
}

export function isCurrentlyRecording(): boolean { return isRecording; }
export function getRecordingDuration(): number {
  return isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
}
