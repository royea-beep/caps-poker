/**
 * S93 — Console Log Buffer
 * Intercepts console.log/error/warn and keeps a 50-entry ring buffer.
 * Call initLogBuffer() once at app start (module level in _layout.tsx).
 * Call getConsoleLogs() from BugReporter to attach logs to every report.
 */

const BUFFER: string[] = [];
const MAX = 50;
let initialized = false;

export function initLogBuffer(): void {
  if (initialized || typeof console === 'undefined') return;
  initialized = true;

  const oLog = console.log.bind(console);
  const oError = console.error.bind(console);
  const oWarn = console.warn.bind(console);

  const push = (prefix: string, args: unknown[]): void => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    BUFFER.push(`${prefix} ${msg}`);
    if (BUFFER.length > MAX) BUFFER.shift();
  };

  console.log = (...args: unknown[]) => {
    push('[LOG]', args);
    oLog(...args);
  };
  console.error = (...args: unknown[]) => {
    push('[ERR]', args);
    oError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push('[WRN]', args);
    oWarn(...args);
  };
}

export function getConsoleLogs(): string[] {
  return [...BUFFER];
}
