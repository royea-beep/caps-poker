import { useState, useCallback, useRef, useEffect } from 'react';

export type RevealPhase = 'idle' | 'turn' | 'river' | 'winner';

// Timing constants (ms)
const TURN_MS    = 3000;  // idle → show turn card
const RIVER_MS   = 2500;  // after turn → show river card
const WINNER_MS  = 3000;  // after river → show winner banner
const ADVANCE_MS = 3500;  // after winner → advance to next board

interface UseSimpleRevealReturn {
  boardIdx: number;
  phase: RevealPhase;
  startReveal: () => void;
  skipAll: () => void;
  goNext: () => void;  // manually advance (when winner is showing)
}

/**
 * Crash-proof reveal orchestrator.
 * Pre-schedules ALL timers upfront — no recursive closures, no Reanimated.
 * All evaluation happens BEFORE reveal starts (in game.tsx via revealData).
 */
export function useSimpleReveal(
  boardCount: number,
  onComplete: () => void,
): UseSimpleRevealReturn {
  const [boardIdx, setBoardIdx] = useState(0);
  const [phase, setPhase] = useState<RevealPhase>('idle');

  const mountedRef    = useRef(true);
  const timersRef     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boardIdxRef   = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(t);
  }, []);

  /**
   * Pre-schedule all remaining boards starting from startIdx.
   * Call AFTER setting boardIdx/phase state for startIdx.
   */
  const scheduleFrom = useCallback((startIdx: number) => {
    clearTimers();
    let t = 0;

    for (let i = startIdx; i < boardCount; i++) {
      const idx = i;

      if (idx > startIdx) {
        // Advance state to next board at time t
        addTimer(() => {
          setBoardIdx(idx);
          boardIdxRef.current = idx;
          setPhase('idle');
        }, t);
      }

      addTimer(() => setPhase('turn'),   t + TURN_MS);
      addTimer(() => setPhase('river'),  t + TURN_MS + RIVER_MS);
      addTimer(() => setPhase('winner'), t + TURN_MS + RIVER_MS + WINNER_MS);

      t += TURN_MS + RIVER_MS + WINNER_MS + ADVANCE_MS;
    }

    // Fire complete after all boards
    addTimer(() => {
      if (mountedRef.current) onCompleteRef.current();
    }, t);
  }, [boardCount, clearTimers, addTimer]);

  const startReveal = useCallback(() => {
    setBoardIdx(0);
    boardIdxRef.current = 0;
    setPhase('idle');
    scheduleFrom(0);
  }, [scheduleFrom]);

  const goNext = useCallback(() => {
    const next = boardIdxRef.current + 1;
    if (next >= boardCount) {
      clearTimers();
      onCompleteRef.current();
      return;
    }
    clearTimers();
    setBoardIdx(next);
    boardIdxRef.current = next;
    setPhase('idle');
    scheduleFrom(next);
  }, [boardCount, clearTimers, scheduleFrom]);

  const skipAll = useCallback(() => {
    clearTimers();
    if (mountedRef.current) onCompleteRef.current();
  }, [clearTimers]);

  return { boardIdx, phase, startReveal, skipAll, goNext };
}
