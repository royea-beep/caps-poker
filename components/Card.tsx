import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { getTheme } from '../constants/visualThemes';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Card as CardType } from '../constants/gameConfig';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  flipDuration?: number;
  cardWidth?: number;
  cardHeight?: number;
  themeOverride?: string; // kept for prop compatibility
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

// 5-0 Poker colors
const RED_COLOR = '#E8192C';   // hearts + diamonds
const BLACK_COLOR = '#000000'; // spades + clubs
const CARD_FACE_BG = '#FFFFFF';
const CARD_BACK_BG = '#0f1a3e';
const CARD_BACK_BORDER = '#c9a84c';

// 4-color suit system
const SUIT_COLORS_4: Record<string, string> = {
  hearts:   '#E8192C',
  diamonds: '#1E90FF',
  spades:   '#1a1a2e',
  clubs:    '#228B22',
};

export default function CardComponent({
  card,
  faceDown = false,
  small,
  highlighted,
  dimmed,
  flipDuration = 800,
  cardWidth,
  cardHeight,
}: CardProps) {
  const width = cardWidth ?? (small ? 52 : 58);
  const height = cardHeight ?? (small ? 74 : 82);
  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);

  const cornerRankSize = Math.floor(height * 0.14);
  const cornerSuitSize = Math.floor(height * 0.11);
  const centerRankSize = Math.floor(height * 0.42);
  const centerSuitSize = Math.floor(height * 0.32);

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

  // Gold glow when selected/highlighted
  const highlightAnimStyle = useAnimatedStyle(() => ({
    borderWidth: glowOpacity.value > 0.01 ? 2.5 : 1,
    borderColor: glowOpacity.value > 0.01 ? '#c9a84c' : 'rgba(0,0,0,0.15)',
    shadowColor: '#c9a84c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.9,
    shadowRadius: glowOpacity.value * 14,
    elevation: glowOpacity.value * 10,
    transform: [
      { scale: 1 + glowOpacity.value * 0.03 },
      { translateY: glowOpacity.value * -6 },
    ],
  }));

  // Face-down back card — diamond lattice pattern
  const renderBack = () => {
    const cardStyle = [
      styles.card,
      {
        width,
        height,
        backgroundColor: CARD_BACK_BG,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: CARD_BACK_BORDER,
        overflow: 'hidden' as const,
      },
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
        },
        android: { elevation: 5 },
        default: {
          boxShadow: '2px 3px 10px rgba(0,0,0,0.45)',
        } as any,
      }),
    ];

    if (Platform.OS === 'web') {
      const svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect x='4.5' y='0' width='3' height='3' fill='%23c9a84c' opacity='0.22' transform='rotate(45 6 1.5)'/></svg>`;
      return (
        <View style={cardStyle}>
          <View style={[StyleSheet.absoluteFillObject, {
            backgroundImage: `url("data:image/svg+xml,${svgStr}")`,
            backgroundRepeat: 'repeat',
          } as any]} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a1e', opacity: 0.3, bottom: 0, top: '55%' }]} />
          <View style={styles.backCenter}>
            <Text style={[styles.backDiamond, { fontSize: Math.floor(height * 0.3) }]}>{'\u2666'}</Text>
          </View>
        </View>
      );
    }

    // Native: grid of small rotated diamonds
    const cols = Math.ceil(width / 12);
    const rows = Math.ceil(height / 12);
    const dots: React.ReactElement[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push(
          <View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              backgroundColor: '#c9a84c',
              opacity: 0.18,
              left: c * 12 + (r % 2 === 0 ? 0 : 6) - 2,
              top: r * 10 - 2,
              transform: [{ rotate: '45deg' }],
            }}
          />
        );
      }
    }

    return (
      <View style={cardStyle}>
        <View style={StyleSheet.absoluteFillObject}>{dots}</View>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a1e', opacity: 0.25, bottom: 0, top: '55%' }]} />
        <View style={styles.backCenter}>
          <Text style={[styles.backDiamond, { fontSize: Math.floor(height * 0.3) }]}>{'\u2666'}</Text>
        </View>
      </View>
    );
  };

  if (!card) {
    return renderBack();
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = fourColorSuits ? (SUIT_COLORS_4[card.suit] ?? BLACK_COLOR) : (isRed ? RED_COLOR : BLACK_COLOR);

  const faceUpShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    } as any,
    android: { elevation: 6 } as any,
    default: {
      boxShadow: '2px 3px 10px rgba(0,0,0,0.45)',
    } as any,
  });

  return (
    <View style={{ width, height }}>
      {/* Back face */}
      <Animated.View style={[{ width, height }, backAnimStyle]}>
        {renderBack()}
      </Animated.View>

      {/* Front face — 5-0 poker style */}
      <Animated.View
        style={[
          styles.card,
          {
            width,
            height,
            backgroundColor: theme.cardFace,
            borderRadius: 8,
          },
          faceUpShadow,
          highlightAnimStyle,
          dimmed && styles.dimmed,
          frontAnimStyle,
        ]}
      >
        {/* Top-left corner: small rank + suit */}
        <View style={styles.cornerTL}>
          <Text style={[styles.rankText, { color: suitColor, fontSize: cornerRankSize }]}>
            {card.rank}
          </Text>
          <Text style={[styles.suitText, { color: suitColor, fontSize: cornerSuitSize }]}>
            {SUIT_SYMBOLS[card.suit]}
          </Text>
        </View>

        {/* Center: large rank + suit below */}
        <View style={styles.centerDisplay}>
          <Text style={[styles.centerRankText, { color: suitColor, fontSize: centerRankSize }]}>
            {card.rank}
          </Text>
          <Text style={[styles.centerSuitText, { color: suitColor, fontSize: centerSuitSize }]}>
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
  cornerTL: {
    position: 'absolute',
    top: 2,
    left: 4,
    alignItems: 'center',
  },
  centerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRankText: {
    fontWeight: '900',
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Arial Black, Arial, sans-serif' } as any,
      default: {},
    }),
  },
  centerSuitText: {
    fontWeight: '700',
    marginTop: -6,
  },
  rankText: {
    fontWeight: '900',
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Arial Black, Arial, sans-serif' } as any,
      default: {},
    }),
  },
  suitText: {
    fontWeight: '700',
    marginTop: -4,
    lineHeight: undefined,
  },
  backCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backDiamond: {
    color: '#c9a84c',
    opacity: 0.3,
  },
  dimmed: {
    opacity: 0.35,
  },
});
