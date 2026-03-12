import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
  cardWidth?: number;
  cardHeight?: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export default function CardComponent({ card, faceDown = false, small, highlighted, dimmed, flipDuration = 800, cardWidth, cardHeight }: CardProps) {
  const width = cardWidth ?? (small ? 37 : 55);
  const height = cardHeight ?? (small ? 53 : 80);
  const rankSize = cardHeight ? Math.max(10, Math.floor(height * 0.30)) : (small ? 13 : 20);
  const suitSize = cardHeight ? Math.max(11, Math.floor(height * 0.34)) : (small ? 14 : 22);
  const backTextSize = cardHeight ? Math.max(14, Math.floor(height * 0.45)) : 24;

  const prevFaceDownRef = useRef(faceDown);
  const flipProgress = useSharedValue(faceDown ? 0 : 1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (prevFaceDownRef.current === true && faceDown === false && card) {
      flipProgress.value = 0;
      flipProgress.value = withTiming(1, { duration: flipDuration });
    } else {
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
    borderWidth: glowOpacity.value * 2.5,
    borderColor: COLORS.goldBright,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.9,
    shadowRadius: glowOpacity.value * 10,
    elevation: glowOpacity.value * 10,
  }));

  // No card data — static back
  if (!card) {
    return (
      <View style={[styles.card, styles.faceDown, { width, height }]}>
        <View style={styles.backPattern}>
          <Text style={[styles.backText, { fontSize: backTextSize }]}>{'\u2660'}</Text>
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
          <Text style={[styles.backText, { fontSize: backTextSize }]}>{'\u2660'}</Text>
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
        <Text style={[styles.rank, { color: suitColor, fontSize: rankSize }]}>
          {card.rank}
        </Text>
        <Text style={[styles.suit, { color: suitColor, fontSize: suitSize }]}>
          {SUIT_SYMBOLS[card.suit]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  faceUp: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  faceDown: {
    backgroundColor: COLORS.cardBack,
    borderWidth: 1.5,
    borderColor: COLORS.cardBackPattern,
  },
  backPattern: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.cardBackPattern,
    opacity: 0.5,
  },
  rank: {
    fontWeight: '900',
    marginBottom: -4,
  },
  suit: {
    marginTop: -2,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.35,
  },
});
