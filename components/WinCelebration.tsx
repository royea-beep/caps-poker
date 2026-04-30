// WinCelebration: triggers when player wins boards in reveal phase
// Uses: react-native-fast-confetti (Skia), expo-haptics, optional Lottie
//
// Logic:
// - 1-2 boards won = subtle confetti + medium haptic
// - 3 boards won = strong confetti + heavy haptic
// - 4 boards won (sweep) = continuous confetti + drum roll haptic + Lottie crown

import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

// Lazy-load to keep app startup fast and degrade gracefully if missing
let _Confetti: any = null;
let _ConfettiMethods: any = null;
function getConfetti() {
  if (_Confetti === null) {
    try {
      const mod = require("react-native-fast-confetti");
      _Confetti = mod.Confetti;
    } catch (e) {
      _Confetti = false; // mark as unavailable
    }
  }
  return _Confetti || null;
}

interface WinCelebrationProps {
  boardsWon: number; // 0-4
  active: boolean;   // when true, fire celebration
  onComplete?: () => void;
}

export default function WinCelebration({ boardsWon, active, onComplete }: WinCelebrationProps) {
  const confettiRef = useRef<any>(null);
  const Confetti = getConfetti();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!active || boardsWon === 0) return;
    if (hasFired.current) return;
    hasFired.current = true;

    // Trigger haptics by intensity
    const triggerHaptics = async () => {
      try {
        if (boardsWon === 4) {
          // Sweep — drum roll
          for (let i = 0; i < 3; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await new Promise((r) => setTimeout(r, 80));
          }
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (boardsWon >= 3) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await new Promise((r) => setTimeout(r, 100));
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (boardsWon >= 1) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (e) {
        // Haptics not available, ignore
      }
    };

    // Trigger confetti
    if (confettiRef.current?.restart) {
      confettiRef.current.restart();
    }

    triggerHaptics();
    
    if (onComplete) {
      const duration = boardsWon === 4 ? 4000 : boardsWon >= 3 ? 3000 : 2000;
      setTimeout(onComplete, duration);
    }
  }, [active, boardsWon, onComplete]);

  // Reset hasFired when active goes false
  useEffect(() => {
    if (!active) hasFired.current = false;
  }, [active]);

  if (!Confetti || !active || boardsWon === 0) return null;

  // Confetti config by intensity
  const confettiCount = boardsWon === 4 ? 200 : boardsWon === 3 ? 120 : boardsWon === 2 ? 80 : 50;
  const colors = boardsWon === 4 
    ? ["#FFD700", "#FFA500", "#FF6347", "#FFFFFF", "#9370DB"]
    : ["#D4A547", "#FFD700", "#B8902C"];

  return (
    <View style={styles.container} pointerEvents="none">
      <Confetti
        ref={confettiRef}
        count={confettiCount}
        colors={colors}
        fadeOutOnEnd
        autoplay
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
