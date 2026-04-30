// CardFlip3D — 3D flip animation for reveal phase
// Pure reanimated (already installed). No new native deps.
//
// Usage:
//   <CardFlip3D
//     isFlipped={revealActive}
//     delay={index * 80}
//     Front={<Card faceDown />}
//     Back={<Card />}
//   />

import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface CardFlip3DProps {
  isFlipped: boolean;
  delay?: number;
  duration?: number;
  Front: React.ReactNode;  // Face down side
  Back: React.ReactNode;   // Face up side
  containerStyle?: ViewStyle;
}

export default function CardFlip3D({
  isFlipped,
  delay = 0,
  duration = 500,
  Front,
  Back,
  containerStyle,
}: CardFlip3DProps) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(isFlipped ? 1 : 0, {
        duration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );
  }, [isFlipped, delay, duration]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(progress.value, [0, 1], [0, 180]);
    const opacity = progress.value < 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(progress.value, [0, 1], [180, 360]);
    const opacity = progress.value >= 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.face, frontStyle]}>{Front}</Animated.View>
      <Animated.View style={[styles.face, styles.faceBack, backStyle]}>{Back}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  face: {
    backfaceVisibility: "hidden",
  },
  faceBack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
