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
import { Card as CardType } from '../constants/gameConfig';
import { CARD_THEMES, CardThemeId } from '../constants/cardThemes';
import { useGameStore } from '../store/gameStore';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  flipDuration?: number;
  cardWidth?: number;
  cardHeight?: number;
  themeOverride?: CardThemeId;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export default function CardComponent({ card, faceDown = false, small, highlighted, dimmed, flipDuration = 800, cardWidth, cardHeight, themeOverride }: CardProps) {
  const storedTheme = useGameStore((s) => s.cardTheme);
  const theme = CARD_THEMES[themeOverride ?? storedTheme];

  const width = cardWidth ?? (small ? 46 : 68);
  const height = cardHeight ?? (small ? 64 : 98);
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

  // Selected card: theme-colored border + glow + lift
  const highlightAnimStyle = useAnimatedStyle(() => ({
    borderWidth: theme.faceBorderWidth + glowOpacity.value * 2,
    borderColor: glowOpacity.value > 0.01 ? theme.selectedBorderColor : theme.faceBorderColor,
    shadowColor: theme.selectedGlowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.9,
    shadowRadius: glowOpacity.value * 12,
    elevation: glowOpacity.value * 10,
    transform: [
      { scale: 1 + glowOpacity.value * 0.03 },
      { translateY: glowOpacity.value * theme.selectedTranslateY },
    ],
  }));

  // Card back
  const renderBack = () => (
    <View style={[
      styles.card,
      {
        width,
        height,
        backgroundColor: theme.backBg,
        borderRadius: theme.faceRadius,
        borderWidth: theme.backBorderWidth,
        borderColor: theme.backBorderColor,
        overflow: 'hidden' as const,
      },
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        android: { elevation: 5 },
        default: {},
      }),
    ]}>
      <View style={styles.backInner}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.backRow}>
            {[0, 1, 2].map((col) => (
              <Text
                key={col}
                style={[styles.backDiamond, { fontSize: backDiamondSize, color: theme.backDiamond }]}
              >
                {'\u2666'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  if (!card) {
    return renderBack();
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? theme.redSuit : theme.blackSuit;

  const faceUpStaticStyle = Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.faceBorderWidth === 0 ? 0.35 : 0.28,
      shadowRadius: theme.faceBorderWidth === 0 ? 10 : 8,
    } as any,
    android: { elevation: theme.faceBorderWidth === 0 ? 8 : 6 } as any,
    default: {} as any,
  });

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
          {
            width,
            height,
            backgroundColor: theme.faceBg,
            borderRadius: theme.faceRadius,
          },
          faceUpStaticStyle,
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
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  backInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    opacity: 0.65,
  },
  backRow: {
    flexDirection: 'row',
    gap: 4,
  },
  backDiamond: {
    // color set inline
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
    opacity: 1.0,
  },
  dimmed: {
    opacity: 0.35,
  },
});
