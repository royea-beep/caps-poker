import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Card as CardType, COLORS } from '../constants/gameConfig';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  flipDuration?: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export default function CardComponent({ card, faceDown = false, small, highlighted, dimmed, flipDuration = 800 }: CardProps) {
  const width = small ? 32 : 48;
  const height = small ? 46 : 70;

  const prevFaceDownRef = useRef(faceDown);
  // 0 = showing back, 1 = showing front
  const flipProgress = useSharedValue(faceDown ? 0 : 1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (prevFaceDownRef.current === true && faceDown === false && card) {
      // Animate flip: back → front
      flipProgress.value = 0;
      flipProgress.value = withTiming(1, { duration: flipDuration });
    } else {
      // Instant (initial render or going back to faceDown)
      flipProgress.value = faceDown ? 0 : 1;
    }
    prevFaceDownRef.current = faceDown;
  }, [faceDown]);

  useEffect(() => {
    glowOpacity.value = highlighted
      ? withSpring(1, { damping: 12, stiffness: 120 })
      : withTiming(0, { duration: 200 });
  }, [highlighted]);

  const backAnimStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5], [0, 90], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 800 }, { rotateY: `${rotateY}deg` }],
      opacity: flipProgress.value <= 0.5 ? 1 : 0,
    };
  });

  const frontAnimStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0.5, 1], [-90, 0], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 800 }, { rotateY: `${rotateY}deg` }],
      opacity: flipProgress.value > 0.5 ? 1 : 0,
      position: 'absolute' as const,
      top: 0,
      left: 0,
    };
  });

  const highlightAnimStyle = useAnimatedStyle(() => ({
    borderWidth: glowOpacity.value * 2,
    borderColor: COLORS.goldBright,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.8,
    shadowRadius: glowOpacity.value * 8,
    elevation: glowOpacity.value * 8,
  }));

  // No card data — static back
  if (!card) {
    return (
      <View style={[styles.card, styles.faceDown, { width, height }]}>
        <View style={styles.backPattern}>
          <Text style={styles.backText}>♠</Text>
        </View>
      </View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? COLORS.cardRed : COLORS.cardBlack;

  return (
    <View style={{ width, height }}>
      {/* Back face */}
      <Animated.View style={[styles.card, styles.faceDown, { width, height }, backAnimStyle]}>
        <View style={styles.backPattern}>
          <Text style={styles.backText}>♠</Text>
        </View>
      </Animated.View>

      {/* Front face */}
      <Animated.View
        style={[
          styles.card,
          styles.faceUp,
          { width, height },
          highlightAnimStyle,
          dimmed && styles.dimmed,
          frontAnimStyle,
        ]}
      >
        <Text style={[styles.rank, { color: suitColor, fontSize: small ? 11 : 16 }]}>
          {card.rank}
        </Text>
        <Text style={[styles.suit, { color: suitColor, fontSize: small ? 12 : 18 }]}>
          {SUIT_SYMBOLS[card.suit]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  faceUp: {
    backgroundColor: COLORS.cardWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  faceDown: {
    backgroundColor: COLORS.cardBack,
    borderWidth: 1,
    borderColor: COLORS.cardBackPattern,
  },
  backPattern: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.cardBackPattern,
    fontSize: 20,
    opacity: 0.5,
  },
  rank: {
    fontWeight: '800',
    marginBottom: -4,
  },
  suit: {
    marginTop: -2,
  },
  dimmed: {
    opacity: 0.4,
  },
});
