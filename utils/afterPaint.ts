/**
 * BX2.4 — run work off the critical path, on BOTH platforms.
 *
 * THE TRAP THIS EXISTS TO AVOID, recorded in MEMORY.md (S54 DEAD-RENDER):
 * `InteractionManager.runAfterInteractions` NEVER RESOLVES ON WEB in this app. A previous
 * feature deferred with it verbatim and `visibleBoardCount` stayed 0 forever - the web build
 * showed a skeleton that never filled, and it looked like a data bug for a whole sprint.
 *
 * So the native pattern cannot simply be copied. What runs instead:
 *   web    - `requestIdleCallback` when the browser has it (Chrome, Firefox, Edge), which
 *            yields until the main thread is genuinely free. Safari still ships without it,
 *            so the fallback is a double rAF followed by setTimeout(0): the first frame
 *            commits, the second confirms paint, and the timeout lands after it. That is
 *            "after first paint" without depending on a Safari-missing API.
 *   native - `InteractionManager.runAfterInteractions`, which is correct there and is what
 *            keeps the work off the animation thread during a transition.
 *
 * Returns a cancel function. Every caller must use it: the reveal unmounts on skip, and a
 * 120ms enumeration resolving into a dead component sets state on an unmounted tree.
 */

import { InteractionManager, Platform } from 'react-native';

type Cancel = () => void;

export function afterPaint(fn: () => void): Cancel {
  if (Platform.OS !== 'web') {
    const handle = InteractionManager.runAfterInteractions(fn);
    return () => handle.cancel();
  }

  const w = globalThis as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof w.requestIdleCallback === 'function') {
    // Timeout caps the wait so a busy thread cannot starve the work indefinitely.
    // MEASURED: at 400ms the first board's percentage landed at 1292ms on live - the bar
    // sat on its skeleton for 1.3s, well past the t(350) wipe-in the spec asks for. The
    // enumeration itself is only ~130ms, so the wait was almost entirely this timeout.
    // 120ms puts the number up around t(250), inside the wipe-in, and still yields to any
    // genuinely busy frame first.
    const id = w.requestIdleCallback(fn, { timeout: 120 });
    return () => w.cancelIdleCallback?.(id);
  }

  // Safari path.
  let raf1 = 0, raf2 = 0, timer: ReturnType<typeof setTimeout> | undefined;
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      timer = setTimeout(fn, 0);
    });
  });
  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    if (timer) clearTimeout(timer);
  };
}
