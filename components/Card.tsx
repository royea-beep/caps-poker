import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { rs } from '../utils/responsive';
import { useGameStore } from '../store/gameStore';
import { Card as CardType } from '../constants/gameConfig';

// Card Display Bible (S81 — PERMANENT — never change without "UNLOCK CARD BIBLE"):
// - Every card shows ONLY: large centered rank + large centered suit
// - NO corner indicators anywhere
// - Font formula: Math.max(cardWidth * 0.38, 16) rank, Math.max(cardWidth * 0.28, 12) suit
// - ALL card types use identical formula (board, hand, community, revealed)
// - 3D flip: RN Animated only — ZERO Reanimated

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
  suitsOnly?: boolean;
  isCommunityCard?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const RED_COLOR = '#E8192C';
const BLACK_COLOR = '#000000';
const CARD_BACK_BG = '#0f1a3e';
const CARD_BACK_BORDER = '#c9a84c';

const SUIT_COLORS_4: Record<string, string> = {
  hearts:   '#E8192C',
  diamonds: '#1565C0',
  spades:   '#1a1a2e',
  clubs:    '#228B22',
};

const SUIT_COLORS_4_FIVEO: Record<string, string> = {
  hearts:   '#E8192C',
  diamonds: '#1565C0',
  spades:   '#1a1a2e',
  clubs:    '#006644',
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
  suitsOnly = false,
  isCommunityCard = false,
}: CardProps) {
  const width = cardWidth ?? (small ? rs(52) : rs(58));
  const height = cardHeight ?? (small ? rs(74) : rs(82));
  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const cardConfig = useGameStore((s) => s.cardConfig);

  // Card sizing — width-based (S80/S81 Card Bible)
  const mainRankRatio = cardConfig?.main_rank_size_ratio ?? 0.38;
  const mainSuitRatio = cardConfig?.main_suit_size_ratio ?? 0.28;
  const centerRankSize = Math.max(16, Math.floor(width * mainRankRatio));
  const centerSuitSize = Math.max(12, Math.floor(width * mainSuitRatio));

  // 3D flip — RN Animated only, ZERO Reanimated (S81)
  // flipAnim: 0 = face-down (back visible), 1 = face-up (front visible)
  const flipAnim = useRef(new Animated.Value(faceDown ? 0 : 1)).current;
  // Glow lift — native driver (transform only)
  const glowAnim = useRef(new Animated.Value(highlighted ? 1 : 0)).current;
  // Float idle animation (S96) — community: -10px/3s, player: -5px/2s
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatDistance = isCommunityCard ? -10 : -5;
  const floatDuration = isCommunityCard ? 3000 : 2000;

  const prevFaceDownRef = useRef(faceDown);

  useEffect(() => {
    if (prevFaceDownRef.current === true && !faceDown && card) {
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: flipDuration,
        useNativeDriver: true,
      }).start();
    } else {
      flipAnim.setValue(faceDown ? 0 : 1);
    }
    prevFaceDownRef.current = faceDown;
  }, [faceDown]);

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: highlighted ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [highlighted]);

  useEffect(() => {
    // Float loop — native only (Animated.loop is safe for Hermes)
    if (Platform.OS === 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: floatDuration / 2, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: floatDuration / 2, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); };
  }, []);

  // Back face: rotates 0deg to 90deg during first half, then opacity 0
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  // Front face: hidden first half, rotates -90deg to 0deg during second half
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  // Glow: scale up + lift (native driver)
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const glowTranslateY = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  // Float idle (S96)
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, floatDistance] });

  // Face-down back card — diamond lattice pattern
  const renderBack = () => {
    const cardStyle: any[] = [
      {
        width,
        height,
        backgroundColor: CARD_BACK_BG,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: CARD_BACK_BORDER,
        overflow: 'hidden' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
        android: { elevation: 5 },
        default: { boxShadow: '2px 3px 10px rgba(0,0,0,0.45)' } as any,
      }),
      Platform.OS === 'web' && { background: 'linear-gradient(180deg, #142244 0%, #0a1230 100%)' } as any,
    ];

    if (Platform.OS === 'web') {
      const svgStr = "<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect x='4.5' y='0' width='3' height='3' fill='%23c9a84c' opacity='0.22' transform='rotate(45 6 1.5)'/></svg>";
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

  const faceUpShadow = isCommunityCard
    ? Platform.select({
        ios: {} as any, // iOS shadow handled by highlightShadow for community
        android: { elevation: 10 } as any,
        default: { boxShadow: '0 0 12px rgba(201,168,76,0.4)' } as any,
      })
    : visualTheme === 'fiveo'
    ? Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.65, shadowRadius: 10 } as any,
        android: { elevation: 10 } as any,
        default: { boxShadow: '2px 4px 14px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.15)' } as any,
      })
    : Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12 } as any,
        android: { elevation: 14 } as any,
        default: { boxShadow: '0 8px 24px rgba(0,0,0,0.55)' } as any,
      });

  if (!card) {
    return (
      <Animated.View
        style={[
          { width, height },
          { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
        ]}
      >
        {renderBack()}
      </Animated.View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const activeSuitColors4 = visualTheme === 'fiveo' ? SUIT_COLORS_4_FIVEO : SUIT_COLORS_4;
  const suitColor = fourColorSuits ? (activeSuitColors4[card.suit] ?? BLACK_COLOR) : (isRed ? RED_COLOR : BLACK_COLOR);
  const suitBorderColor = isRed ? 'rgba(211,47,47,0.28)' : 'rgba(80,80,80,0.22)';
  const isFaceCard = ['J', 'Q', 'K', 'A'].includes(card.rank);

  // Highlight border — static conditional (instant feedback for card selection)
  // Face cards (J/Q/K/A) get subtle gold border for prestige
  // Community cards get gold frame for visual hierarchy (S105)
  const highlightBorder = highlighted
    ? { borderWidth: 2.5, borderColor: '#c9a84c' as const }
    : isCommunityCard
    ? { borderWidth: rs(2.5), borderColor: '#c9a84c' as const }
    : isFaceCard
    ? { borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.45)' as const }
    : { borderWidth: 1, borderColor: suitBorderColor };
  const highlightShadow = highlighted && Platform.OS === 'ios'
    ? { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 14 }
    : isCommunityCard && Platform.OS === 'ios'
    ? { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8 }
    : {};

  return (
    <View style={{ width, height }}>
      {/* Back face — 3D flip */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, width, height },
          { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
          { opacity: backOpacity },
        ]}
      >
        {renderBack()}
      </Animated.View>

      {/* Front face — 3D flip + glow lift */}
      <Animated.View
        style={[
          styles.card,
          {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: '#FFFFFF',
            borderRadius: 9,
          },
          Platform.OS === 'web' && { background: 'linear-gradient(160deg, #ffffff 0%, #f6f6f2 100%)' } as any,
          faceUpShadow,
          highlightBorder,
          highlightShadow,
          dimmed && styles.dimmed,
          {
            transform: [
              { perspective: 1000 },
              { rotateY: frontRotateY },
              { scale: glowScale },
              { translateY: glowTranslateY },
              { translateY: floatY },
            ],
            opacity: frontOpacity,
          },
        ]}
      >
        {/* Subtle bottom shadow for depth — native only (web uses CSS gradient) */}
        {Platform.OS !== 'web' && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.03, top: '60%' }]} pointerEvents="none" />
        )}
        {suitsOnly ? (
          <View style={styles.suitBottomLeft}>
            <Text style={[styles.suitOnlyText, {
              color: suitColor,
              fontSize: Math.floor(height * 0.44),
              textShadowColor: isRed ? 'rgba(211,47,47,0.35)' : 'rgba(255,255,255,0.2)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 4,
            }]}>
              {SUIT_SYMBOLS[card.suit]}
            </Text>
          </View>
        ) : (
          <View style={styles.centerDisplay}>
            <Text style={[styles.centerRankText, { color: suitColor, fontSize: centerRankSize }]}>
              {card.rank}
            </Text>
            <Text style={[styles.centerSuitText, {
              color: suitColor,
              fontSize: centerSuitSize,
              textShadowColor: isRed ? 'rgba(211,47,47,0.35)' : 'rgba(255,255,255,0.2)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            }]}>
              {SUIT_SYMBOLS[card.suit]}
            </Text>
          </View>
        )}
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
  suitBottomLeft: {
    position: 'absolute',
    bottom: 4,
    left: 6,
  },
  suitOnlyText: {
    fontWeight: '700',
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Arial Black, Arial, sans-serif' } as any,
      default: {},
    }),
  },
});
