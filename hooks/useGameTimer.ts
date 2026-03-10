import { useState, useRef, useEffect, useCallback } from 'react';

interface UseGameTimerProps {
  initialSeconds: number;
  onExpire: () => void;
  autoStart?: boolean;
}

interface UseGameTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: (seconds?: number) => void;
}

export function useGameTimer({
  initialSeconds,
  onExpire,
  autoStart = false,
}: UseGameTimerProps): UseGameTimerReturn {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);

  // Keep onExpire ref current to avoid stale closures
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Clear interval helper
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Run the interval when isRunning
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(
    (seconds?: number) => {
      clearTimer();
      setTimeLeft(seconds ?? initialSeconds);
      setIsRunning(false);
    },
    [initialSeconds, clearTimer]
  );

  return { timeLeft, isRunning, start, stop, reset };
}
