/**
 * useResultsAnimations — all RN Animated logic for the results screen.
 * ZERO Reanimated — JS thread only (iron rule: results screen = no Reanimated).
 */
import { useRef, useState, useEffect } from 'react';
import { Animated, InteractionManager } from 'react-native';
import { useGameStore } from '../store/gameStore';

const CHIP_COUNT = 6;

const DEAL_BTN_DELAY_MS = 300;

interface RevealDataShape {
  boards: { winner: string }[];
  netChips: number;
  isComplete: boolean;
}

export function useResultsAnimations(revealData: RevealDataShape | null) {
  // All Animated.Value refs — JS thread only
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0)).current;
  const dealBtnOpacity = useRef(new Animated.Value(0)).current;
  const dealBtnScale = useRef(new Animated.Value(0.9)).current;
  const winBadgeAnim = useRef(new Animated.Value(1)).current;
  const chipsFlashAnim = useRef(new Animated.Value(0)).current;
  const dealPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const boardTranslates = useRef<Animated.Value[]>([]);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const boardsInteractionRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  // COMPLETE celebration — RN Animated only
  const completeFlashOpacity = useRef(new Animated.Value(0)).current;
  const completeTitleScale = useRef(new Animated.Value(0)).current;
  const chipTranslates = useRef<Animated.Value[]>(
    Array.from({ length: CHIP_COUNT }, () => new Animated.Value(-100))
  ).current;
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);

  const [visibleBoardCount, setVisibleBoardCount] = useState(0);
  const [displayChips, setDisplayChips] = useState(() => useGameStore.getState().chips);

  useEffect(() => {
    if (!revealData) return;
    const boardLen = revealData.boards.length;

    // Full screen fade-in
    Animated.timing(screenOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // VAMOS-FIX-RESULTS-RENDER-2 2026-06-17 — board stagger is deferred to
    // AFTER first paint via InteractionManager.runAfterInteractions. The header
    // / score / DEAL ME IN / HOME mount immediately; the heavy 36-card board
    // breakdown follows on the next idle window. Per-board delay widened to
    // 180ms (was 80ms) so each board has time to mount on a mid phone under
    // CPU throttle without piling up on the JS thread.
    const ih = InteractionManager.runAfterInteractions(() => {
      for (let i = 0; i < boardLen; i++) {
        if (!boardTranslates.current[i]) {
          boardTranslates.current[i] = new Animated.Value(30);
        }
        const slideVal = boardTranslates.current[i];
        const t = setTimeout(() => {
          setVisibleBoardCount(i + 1);
          Animated.timing(slideVal, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }, i * 180);
        animTimers.current.push(t);
      }
    });
    boardsInteractionRef.current = ih;

    // Chip roll-up
    const chipTarget = useGameStore.getState().chips;
    const chipStart = chipTarget - revealData.netChips;
    const chipSteps = 20;
    let chipStep = 0;
    setDisplayChips(chipStart);
    const chipTimer = setInterval(() => {
      chipStep++;
      if (chipStep >= chipSteps) {
        setDisplayChips(chipTarget);
        clearInterval(chipTimer);
      } else {
        setDisplayChips(Math.round(chipStart + (chipTarget - chipStart) * (chipStep / chipSteps)));
      }
    }, 800 / chipSteps);
    animIntervals.current.push(chipTimer);

    // Win glow + badge pulse
    if (revealData.boards.some((b) => b.winner === 'player')) {
      const glowDelay = (boardLen - 1) * 80 + 500;
      animTimers.current.push(setTimeout(() => {
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
        ]).start();
      }, glowDelay));

      animTimers.current.push(setTimeout(() => {
        Animated.sequence([
          Animated.timing(winBadgeAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
          Animated.timing(winBadgeAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
        ]).start();
      }, (boardLen - 1) * 80 + 700));
    }

    // Net chips flash (positive only)
    if (revealData.netChips > 0) {
      animTimers.current.push(setTimeout(() => {
        Animated.timing(chipsFlashAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
      }, 600));
    }

    // COMPLETE banner spring
    if (revealData.isComplete) {
      animTimers.current.push(setTimeout(() => {
        Animated.spring(completeScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
      }, 400));

      // COMPLETE celebration: screen flash + chip shower + title scale
      animTimers.current.push(setTimeout(() => {
        setShowCompleteOverlay(true);

        // Screen flash: fade in then out
        Animated.sequence([
          Animated.timing(completeFlashOpacity, { toValue: 0.4, duration: 200, useNativeDriver: true }),
          Animated.timing(completeFlashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();

        // COMPLETE title scale: 0 → 1.2 → 1.0
        Animated.sequence([
          Animated.timing(completeTitleScale, { toValue: 1.2, duration: 300, useNativeDriver: true }),
          Animated.timing(completeTitleScale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        ]).start();

        // Chip shower: 6 chips fall from top with staggered delays
        chipTranslates.forEach((chipVal, idx) => {
          chipVal.setValue(-100);
          const delay = idx * 100;
          animTimers.current.push(setTimeout(() => {
            Animated.timing(chipVal, { toValue: 900, duration: 1200, useNativeDriver: true }).start();
          }, delay));
        });
      }, 350));
    }

    // DEAL ME IN fade + pulse loop (999 iterations, not -1)
    const dealDelay = (boardLen - 1) * 80 + 200 + DEAL_BTN_DELAY_MS;
    animTimers.current.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(dealBtnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(dealBtnScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start(() => {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(dealBtnScale, { toValue: 1.04, duration: 600, useNativeDriver: true }),
            Animated.timing(dealBtnScale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
          ]),
          { iterations: 999 }
        );
        dealPulseLoopRef.current = pulse;
        pulse.start();
      });
    }, dealDelay));

    return () => {
      boardsInteractionRef.current?.cancel();
      boardsInteractionRef.current = null;
      animTimers.current.forEach(clearTimeout);
      animIntervals.current.forEach(clearInterval);
      screenOpacity.stopAnimation();
      glowAnim.stopAnimation();
      completeScale.stopAnimation();
      dealBtnOpacity.stopAnimation();
      dealBtnScale.stopAnimation();
      dealPulseLoopRef.current?.stop();
      winBadgeAnim.stopAnimation();
      chipsFlashAnim.stopAnimation();
      boardTranslates.current.forEach((v) => v.stopAnimation());
      completeFlashOpacity.stopAnimation();
      completeTitleScale.stopAnimation();
      chipTranslates.forEach((v) => v.stopAnimation());
    };
  }, []);

  return {
    screenOpacity,
    glowAnim,
    completeScale,
    dealBtnOpacity,
    dealBtnScale,
    winBadgeAnim,
    chipsFlashAnim,
    boardTranslates,
    visibleBoardCount,
    displayChips,
    completeFlashOpacity,
    completeTitleScale,
    chipTranslates,
    showCompleteOverlay,
  };
}
