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

// Premium card colors
const CARD_FACE_BG = '#f5e6c8';
const CARD_RED = '#c0392b';
const CARD_BLACK = '#1a1a1a';
const CARD_BACK_BG = '#2a1810';
const CARD_BACK_PATTERN = '#3d2a1a';
const CARD_BACK_DIAMOND = '#e8762b';
const GOLD_BORDER = '#c8a84b';

export default function CardComponent({ card, faceDown = false, small, highlighted, dimmed, flipDuration = 800, cardWidth, cardHeight }: CardProps) {
  const width = cardWidth ?? (small ? 40 : 58);
  const height = cardHeight ?? (small ? 56 : 84);
  const cornerRankSize = cardHeight ? Math.max(9, Math.floor(height * 0.18)) : (small ? 10 : 13);
  const cornerSuitSize = cardHeight ? Math.max(8, Math.floor(height * 0.14)) : (small ? 9 : 11);
  const centerSuitSize = cardHeight ? Math.max(16, Math.floor(height * 0.38)) : (small ? 18 : 28);
  const backDiamondSize = cardHeight ? Math.max(10, Math.floor(height * 0.22)) : 14;

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
    borderWidth: 1.5 + glowOpacity.value * 1.5,
    borderColor: glowOpacity.value > 0.01 ? GOLD_BORDER : 'rgba(0,0,0,0.08)',
    shadowColor: GOLD_BORDER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.8,
    shadowRadius: glowOpacity.value * 8,
    elevation: glowOpacity.value * 8,
    transform: [{ scale: 1 + glowOpacity.value * 0.04 }],
  }));

  // Card back with diamond pattern
  const renderBack = () => (
    <View style={[styles.card, styles.faceDown, { width, height }]}>
      <View style={styles.backInner}>
        {/* 3x3 diamond grid */}
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.backRow}>
            {[0, 1, 2].map((col) => (
              <Text
                key={col}
                style={[styles.backDiamond, { fontSize: backDiamondSize }]}
              >
                {'\u2666'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  // No card data — static back
  if (!card) {
    return renderBack();
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? CARD_RED : CARD_BLACK;

  return (
    <View style={{ width, height }}>
      {/* Back face */}
      <Animated.View style={[{ width, height }, backAnimStyle]}>
        {renderBack()}
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
        {/* Top-left corner: rank + suit */}
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerRank, { color: suitColor, fontSize: cornerRankSize }]}>
            {card.rank}
          </Text>
          <Text style={[styles.cornerSuit, { color: suitColor, fontSize: cornerSuitSize }]}>
            {SUIT_SYMBOLS[card.suit]}
          </Text>
        </View>

        {/* Center suit symbol */}
        <Text style={[styles.centerSuit, { color: suitColor, fontSize: centerSuitSize }]}>
          {SUIT_SYMBOLS[card.suit]}
        </Text>

        {/* Bottom-right corner: rank + suit (rotated) */}
        <View style={styles.cornerBR}>
          <Text style={[styles.cornerRank, { color: suitColor, fontSize: cornerRankSize }]}>
            {card.rank}
          </Text>
          <Text style={[styles.cornerSuit, { color: suitColor, fontSize: cornerSuitSize }]}>
            {SUIT_SYMBOLS[card.suit]}
          </Text>
        </View>
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
    backgroundColor: CARD_FACE_BG,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: { elevation: 5 },
      default: {
        // Web shadow via boxShadow is not supported in RN StyleSheet,
        // but elevation works as a fallback
      },
    }),
  },
  faceDown: {
    backgroundColor: CARD_BACK_BG,
    borderWidth: 1.5,
    borderColor: CARD_BACK_PATTERN,
    overflow: 'hidden',
  },
  backInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    opacity: 0.4,
  },
  backRow: {
    flexDirection: 'row',
    gap: 4,
  },
  backDiamond: {
    color: CARD_BACK_DIAMOND,
  },
  cornerTL: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontWeight: '800',
    lineHeight: 14,
  },
  cornerSuit: {
    fontWeight: '600',
    lineHeight: 12,
    marginTop: -2,
  },
  centerSuit: {
    fontWeight: '400',
    opacity: 0.85,
  },
  dimmed: {
    opacity: 0.35,
  },
});
