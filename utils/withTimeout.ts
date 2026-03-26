/**
 * withTimeout — Wraps any promise with a deadline.
 *
 * If the promise doesn't resolve/reject within `ms` milliseconds,
 * resolves with `fallback` instead of hanging forever.
 *
 * Used throughout BugReporter to prevent the submit flow from freezing
 * when File.bytes(), Supabase upload, or INSERT hangs on the device.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label = 'operation',
): Promise<T> => {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.error(`[TIMEOUT] ⏱ ${label} timed out after ${ms}ms — using fallback`);
        resolve(fallback);
      }
    }, ms);

    promise
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((err: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.error(`[TIMEOUT] ${label} failed:`, err?.message || JSON.stringify(err));
          resolve(fallback);
        }
      });
  });
};
