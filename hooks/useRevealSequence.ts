import { useState, useRef, useEffect, useCallback } from 'react';

interface UseRevealSequenceProps {
  boardCount: number;
  revealDuration: number;
  onBoardRevealed: (index: number) => void;
  onAllRevealed: () => void;
}

interface UseRevealSequenceReturn {
  currentBoardIndex: number;
  isRevealing: boolean;
  startReveal: () => void;
}

export function useRevealSequence({
  boardCount,
  revealDuration,
  onBoardRevealed,
  onAllRevealed,
}: UseRevealSequenceProps): UseRevealSequenceReturn {
  const [currentBoardIndex, setCurrentBoardIndex] = useState(-1);
  const [isRevealing, setIsRevealing] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onBoardRevealedRef = useRef(onBoardRevealed);
  const onAllRevealedRef = useRef(onAllRevealed);

  // Keep refs current
  useEffect(() => {
    onBoardRevealedRef.current = onBoardRevealed;
  }, [onBoardRevealed]);

  useEffect(() => {
    onAllRevealedRef.current = onAllRevealed;
  }, [onAllRevealed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  const startReveal = useCallback(() => {
    // Clear any existing timeouts
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];

    setIsRevealing(true);
    setCurrentBoardIndex(0);

    // Schedule reveals: first board at 500ms, subsequent boards at revealDuration intervals
    let delay = 500;
    for (let i = 0; i < boardCount; i++) {
      const t = setTimeout(() => {
        setCurrentBoardIndex(i);
        onBoardRevealedRef.current(i);
      }, delay);
      timeoutsRef.current.push(t);
      delay += revealDuration * 1000;
    }

    // After all boards revealed
    const finalT = setTimeout(() => {
      setIsRevealing(false);
      onAllRevealedRef.current();
    }, delay);
    timeoutsRef.current.push(finalT);
  }, [boardCount, revealDuration]);

  return { currentBoardIndex, isRevealing, startReveal };
}
