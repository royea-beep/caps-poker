/**
 * S93 — Console Log Buffer
 * Intercepts console.log/error/warn and keeps separate ring buffers:
 *   GAME_LOG_BUFFER — real game events ([BANKROLL], [GAME], errors, etc.)
 *   PIPE_LOG_BUFFER — pipeline/infrastructure noise ([BUG-PIPE], etc.)
 *
 * S101B: Split buffers so pipeline logs can't displace game logs.
 * The AI triage only needs game logs. The DB record gets both (labeled).
 */

const GAME_LOG_BUFFER: string[] = [];
const PIPE_LOG_BUFFER: string[] = [];
const MAX_GAME = 50;
const MAX_PIPE = 30;
let initialized = false;

const PIPELINE_PREFIXES = ['[BUG-PIPE]', '[FILE-READER]', '[TIMEOUT]', '[PIPE-TEST]', '[CRASH]', '[BUG-AUDIO]', '[BUG-WA]'];

function isPipeline(msg: string): boolean {
  return PIPELINE_PREFIXES.some((p) => msg.includes(p));
}

function pushLine(prefix: string, args: unknown[]): void {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const line = `${prefix} ${msg}`;
  if (isPipeline(line)) {
    PIPE_LOG_BUFFER.push(line);
    if (PIPE_LOG_BUFFER.length > MAX_PIPE) PIPE_LOG_BUFFER.shift();
  } else {
    GAME_LOG_BUFFER.push(line);
    if (GAME_LOG_BUFFER.length > MAX_GAME) GAME_LOG_BUFFER.shift();
  }
}

export function initLogBuffer(): void {
  if (initialized || typeof console === 'undefined') return;
  initialized = true;

  const oLog   = console.log.bind(console);
  const oError = console.error.bind(console);
  const oWarn  = console.warn.bind(console);

  console.log = (...args: unknown[]) => {
    pushLine('[LOG]', args);
    oLog(...args);
  };
  console.error = (...args: unknown[]) => {
    pushLine('[ERR]', args);
    oError(...args);
  };
  console.warn = (...args: unknown[]) => {
    // Suppress expo-file-system deprecation spam
    if (typeof args[0] === 'string' && args[0].includes('expo-file-system') && args[0].includes('deprecated')) {
      oWarn(...args);
      return;
    }
    pushLine('[WRN]', args);
    oWarn(...args);
  };
}

/** Game-relevant logs only — for AI triage (no pipeline noise). */
export function getGameLogs(): string[] {
  return [...GAME_LOG_BUFFER];
}

/** All logs with section header — for full DB record. */
export function getAllLogs(): string[] {
  const out: string[] = [...GAME_LOG_BUFFER];
  if (PIPE_LOG_BUFFER.length > 0) {
    out.push('--- PIPELINE LOGS ---');
    out.push(...PIPE_LOG_BUFFER);
  }
  return out;
}

/** Backward-compatible alias — returns all logs for the DB record. */
export function getConsoleLogs(): string[] {
  return getAllLogs();
}
