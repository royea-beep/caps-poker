/**
 * S97 — withTimeout unit tests
 */

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('withTimeout', () => {
  it('resolves with the promise result when it completes in time', async () => {
    const { withTimeout } = require('../withTimeout');
    const fast = Promise.resolve('done');
    const result = await withTimeout(fast, 5000, 'fallback', 'test');
    expect(result).toBe('done');
  });

  it('resolves with fallback when promise exceeds timeout', async () => {
    const { withTimeout } = require('../withTimeout');
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 10000));
    const promise = withTimeout(slow, 1000, 'fallback', 'test');
    jest.advanceTimersByTime(1001);
    const result = await promise;
    expect(result).toBe('fallback');
  });

  it('resolves with fallback when promise rejects', async () => {
    const { withTimeout } = require('../withTimeout');
    const failing = Promise.reject(new Error('boom'));
    const result = await withTimeout(failing, 5000, null, 'test');
    expect(result).toBeNull();
  });

  it('logs timeout message with label when timed out', async () => {
    const { withTimeout } = require('../withTimeout');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 10000));
    const promise = withTimeout(slow, 500, 'fb', 'my-operation');
    jest.advanceTimersByTime(501);
    await promise;
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TIMEOUT]'),
    );
  });

  it('does not call fallback if promise resolves before timeout', async () => {
    const { withTimeout } = require('../withTimeout');
    const fast = Promise.resolve(42);
    const result = await withTimeout(fast, 5000, -1, 'test');
    expect(result).toBe(42);
    jest.advanceTimersByTime(5001); // timer fires but settled already
    expect(result).toBe(42); // unchanged
  });

  it('works with null fallback', async () => {
    const { withTimeout } = require('../withTimeout');
    const failing = Promise.reject(new Error('err'));
    const result = await withTimeout(failing, 5000, null as string | null, 'test');
    expect(result).toBeNull();
  });

  it('works with complex object fallback', async () => {
    const { withTimeout } = require('../withTimeout');
    const slow = new Promise<{ id: string }>((resolve) => setTimeout(() => resolve({ id: '1' }), 10000));
    const fallback = { id: 'fallback' };
    const promise = withTimeout(slow, 100, fallback, 'test');
    jest.advanceTimersByTime(101);
    const result = await promise;
    expect(result).toEqual({ id: 'fallback' });
  });
});
