/**
 * S93 — Log Buffer tests
 */

// Reset module between tests
function loadFresh() {
  jest.resetModules();
  return require('../logBuffer');
}

describe('logBuffer', () => {
  beforeEach(() => { jest.resetModules(); });

  it('getConsoleLogs returns empty array before init', () => {
    const { getConsoleLogs } = loadFresh();
    expect(getConsoleLogs()).toEqual([]);
  });

  it('initLogBuffer intercepts console.log', () => {
    const { initLogBuffer, getConsoleLogs } = loadFresh();
    initLogBuffer();
    console.log('test message S93');
    const logs = getConsoleLogs();
    expect(logs.some((l: string) => l.includes('test message S93'))).toBe(true);
  });

  it('initLogBuffer is idempotent — calling twice is safe', () => {
    const { initLogBuffer, getConsoleLogs } = loadFresh();
    initLogBuffer();
    initLogBuffer();
    console.log('idempotent check');
    const logs = getConsoleLogs();
    expect(logs.some((l: string) => l.includes('idempotent check'))).toBe(true);
  });

  it('getConsoleLogs prefixes log level', () => {
    const { initLogBuffer, getConsoleLogs } = loadFresh();
    initLogBuffer();
    console.log('log entry');
    console.error('error entry');
    console.warn('warn entry');
    const logs = getConsoleLogs();
    expect(logs.some((l: string) => l.startsWith('[LOG]'))).toBe(true);
    expect(logs.some((l: string) => l.startsWith('[ERR]'))).toBe(true);
    expect(logs.some((l: string) => l.startsWith('[WRN]'))).toBe(true);
  });

  it('ring buffer does not exceed MAX (50 entries)', () => {
    const { initLogBuffer, getConsoleLogs } = loadFresh();
    initLogBuffer();
    for (let i = 0; i < 60; i++) console.log(`line ${i}`);
    const logs = getConsoleLogs();
    expect(logs.length).toBeLessThanOrEqual(50);
  });

  it('getConsoleLogs returns a copy — mutations do not affect buffer', () => {
    const { initLogBuffer, getConsoleLogs } = loadFresh();
    initLogBuffer();
    console.log('immutable check');
    const copy = getConsoleLogs();
    copy.push('[INJECTED]');
    expect(getConsoleLogs()).not.toContain('[INJECTED]');
  });
});
