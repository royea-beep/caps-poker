/**
 * @caps/debugger — Debug Logger
 * Global log store shared between DebugOverlay and screenRecorder.
 * Self-contained — no circular imports.
 */

const MAX_LOGS = 50;

export interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

// Global state — accessible without React context
let globalLogs: LogEntry[] = [];
let globalListener: ((logs: LogEntry[]) => void) | null = null;

// Recording state — set by screenRecorder, read by DebugOverlay
let _isRecording = false;
let _recordingStart = 0;

export function setDebugRecording(recording: boolean): void {
  _isRecording = recording;
  _recordingStart = recording ? Date.now() : _recordingStart;
  if (globalListener) globalListener([...globalLogs]); // force re-render
}

export function getIsRecording(): boolean { return _isRecording; }
export function getRecordingStart(): number { return _recordingStart; }

export function getGlobalLogs(): LogEntry[] { return [...globalLogs]; }

export function setGlobalListener(fn: ((logs: LogEntry[]) => void) | null): void {
  globalListener = fn;
  if (fn) fn([...globalLogs]);
}

export function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDev = typeof __DEV__ !== 'undefined' && (__DEV__ as any);
  if (!isDev && !globalListener) return; // Silent in production without overlay
  const now = new Date();
  const time = [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join(':') + '.' + now.getMilliseconds().toString().padStart(3, '0');
  const entry: LogEntry = { time, message, level };
  globalLogs = [...globalLogs.slice(-(MAX_LOGS - 1)), entry];
  if (globalListener) globalListener([...globalLogs]);
  console.log(`[DBG ${time}] ${message}`);
}
