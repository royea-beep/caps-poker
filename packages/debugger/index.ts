/**
 * @caps/debugger
 * Reusable debug pipeline for React Native / Expo apps.
 *
 * Usage:
 *   import { initDebugger, debugLog, markAppActive } from '@caps/debugger';
 */

// Config
export { initDebugger, getConfig, isDebuggerReady } from './src/config';
export type { DebuggerConfig } from './src/config';

// Logging
export { debugLog, getGlobalLogs, setDebugRecording } from './src/debugLog';
export type { LogEntry } from './src/debugLog';

// Dirty shutdown detection
export { markAppActive, clearAppActive, checkDirtyShutdown } from './src/dirtyShutdown';

// Screen recording
export { startRecording, stopRecording, getScreenshots, clearScreenshots, isCurrentlyRecording } from './src/screenRecorder';

// Crash reporting
export { reportCrash } from './src/crashReporter';
export type { CrashReport } from './src/crashReporter';

// WhatsApp alert
export { sendCrashAlert } from './src/whatsappAlert';

// UI component
export { DebugOverlay } from './components/DebugOverlay';
