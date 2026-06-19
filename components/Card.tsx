import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { rs } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { useGameStore } from '../store/gameStore';
import { Card as CardType } from '../constants/gameConfig';
import { OBSIDIAN, OBSIDIAN_GEOM, cardLiftShadow, cardLiftShadowSmall, cardBackShadow } from '../constants/obsidianTheme';
import { LinearGradient } from 'expo-linear-gradient';

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

const RED_COLOR = '#CC0000';
const BLACK_COLOR = '#111111';
const CARD_BACK_BG = '#1A1A2E';
const CARD_BACK_BORDER = '#C5A028';

// V2 Minimalist palette
const V2_RED = '#c41e3a';
const V2_BLACK = '#18181b';

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

function CardComponent({
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
  // VAMOS-HAND-FIX-FINAL 2026-06-15 — when an EXPLICIT cardWidth is provided
  // (placement hand path: PlayerHand passes a measure-then-size value), it is
  // authoritative. Only a tiny absolute safety floor (16) applies. This unblocks
  // the bc=4 16-card hand from clipping at narrow viewports without changing
  // other Card usages (Card-default path keeps the original 44/62 tap-target
  // floor; community-card path keeps 24/34).
  const _minW = isCommunityCard ? 24 : 44;
  const _minH = isCommunityCard ? 34 : 62;
  const _explicitFloorW = isCommunityCard ? 24 : 16;
  const _explicitFloorH = isCommunityCard ? 34 : 22;
  const width = cardWidth != null
    ? Math.max(_explicitFloorW, cardWidth)
    : Math.max(small ? rs(52) : rs(58), _minW);
  const height = cardHeight != null
    ? Math.max(_explicitFloorH, cardHeight)
    : Math.max(small ? rs(74) : rs(82), _minH);
  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const cardConfig = useGameStore((s) => s.cardConfig);

  // Card sizing — width-based (S80/S81 Card Bible)
  const mainRankRatio = cardConfig?.main_rank_size_ratio ?? 0.46;
  const mainSuitRatio = cardConfig?.main_suit_size_ratio ?? 0.34;
  // PR-N 2026-06-02 — font floor relaxed for community cards (rank 20->10, suit 14->8)
  // so they fit inside the smaller 24x34 card box without overflowing the rank text.
  const _rankFloor = isCommunityCard ? 10 : 20;
  const _suitFloor = isCommunityCard ? 8  : 14;
  const centerRankSize = Math.max(_rankFloor, Math.floor(width * mainRankRatio));
  const centerSuitSize = Math.max(_suitFloor, Math.floor(width * mainSuitRatio));

  // 3D flip — RN Animated only, ZERO Reanimated (S81)
  // flipAnim: 0 = face-down (back visible), 1 = face-up (front visible)
  const flipAnim = useRef(new Animated.Value(faceDown ? 0 : 1)).current;
  // Glow lift — native driver (transform only)
  const glowAnim = useRef(new Animated.Value(highlighted ? 1 : 0)).current;
  // Float idle animation REMOVED 2026-05-22 — see KILL_Card in utils/animationKill.ts.
  // Was: infinite Animated.loop on translateY making every card bob up/down forever.
  // Iron rule (per battle-pass.tsx comment): never Animated.loop without finite iterations.

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

  // Float loop useEffect REMOVED 2026-05-22 — see KILL_Card.

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
  // floatY interpolation REMOVED 2026-05-22 — see KILL_Card.

  // VAMOS-VISUAL-C — geometric mint card-back (rotated <View>s, no svg dep).
  const renderBack = () => {
    const emblemSize = Math.max(10, Math.floor(Math.min(width, height) * 0.34));
    const emblemCore = Math.max(4, Math.floor(emblemSize * 0.35));
    const emblemStroke = Math.max(1, Math.floor(emblemSize * 0.07));
    const cardStyle: any[] = [
      {
        width,
        height,
        backgroundColor: OBSIDIAN.backTop,
        borderRadius: OBSIDIAN_GEOM.cardBackRadius,
        borderWidth: 1,
        borderColor: OBSIDIAN.backBorder,
        overflow: 'hidden' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      cardBackShadow,
    ];

    return (
      <View style={cardStyle}>
        {/* VAMOS-VISUAL-C-FINISH — true back gradient (native + web), tokenized */}
        <LinearGradient
          colors={[OBSIDIAN.backTop, OBSIDIAN.backBottom]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Subtle bottom darkening for depth */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: OBSIDIAN.backBottom, opacity: 0.45, top: '55%' }]} pointerEvents="none" />
        {/* Outline diamond \u2014 rotated square outline in mint */}
        <View
          style={{
            position: 'absolute',
            width: emblemSize,
            height: emblemSize,
            borderWidth: emblemStroke,
            borderColor: OBSIDIAN.backEmblemOutline,
            transform: [{ rotate: '45deg' }],
          }}
          pointerEvents="none"
        />
        {/* Filled mint core \u2014 small filled square at center */}
        <View
          style={{
            position: 'absolute',
            width: emblemCore,
            height: emblemCore,
            backgroundColor: OBSIDIAN.backEmblemCore,
            transform: [{ rotate: '45deg' }],
          }}
          pointerEvents="none"
        />
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

  // VAMOS-VISUAL-C — lifted face-up: cardLiftShadow for normal/hand/slot cards,
  // cardLiftShadowSmall for community/bc=4 cards (legibility+perf gate D1/D2).
  const v2Shadow = width < 40 ? cardLiftShadowSmall : cardLiftShadow;
  const v2Border = highlighted
    ? { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' as const }
    : { borderWidth: 0 };

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

  // 2026-05-23: V2 layout (corner pip + dominant center suit, no center rank) is
  // now the only path — the legacy "3-corner-pip + center-rank+center-suit overlap"
  // branch was producing a cluttered card where the small corner suit was visually
  // hidden behind the large center suit. Force isV2=true; the legacy `: ( … )` else
  // branch below is removed.
  const isV2 = true;
  const v2SuitColor = isRed ? V2_RED : V2_BLACK;

  // VAMOS-THEME-PROPAGATION C2/C3 — Gold KEPT only for the winning-card highlight.
  // Community frame → MINT (obsidian inner-detail rule). Face-card prestige border
  // → mint hairline. Highlighted (winning) stays #c9a84c gold.
  const highlightBorder = highlighted
    ? { borderWidth: 2.5, borderColor: '#c9a84c' as const }                   // WINNING — gold
    : isCommunityCard
    ? { borderWidth: rs(2.5), borderColor: OBSIDIAN.mint }                    // community frame — mint
    : isFaceCard
    ? { borderWidth: 1.5, borderColor: OBSIDIAN.mintHairline }                // face-card prestige — mint hairline
    : { borderWidth: 1, borderColor: suitBorderColor };
  const highlightShadow = highlighted && Platform.OS === 'ios'
    ? { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 14 }
    : isCommunityCard && Platform.OS === 'ios'
    ? { shadowColor: OBSIDIAN.mint, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8 }
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
            // VAMOS-VISUAL-C — near-white with faint cream undertone, sharper radius (8 vs 10).
            backgroundColor: isV2 ? OBSIDIAN.cardFaceFallback : '#FFFEF8',
            borderRadius: isV2 ? OBSIDIAN_GEOM.cardRadius : 8,
          },
          // VAMOS-VISUAL-C-FINISH — solid bg kept as fallback; the LinearGradient child
          // below renders the true cream gradient on native AND web.
          !isV2 && Platform.OS === 'web' && { background: 'linear-gradient(160deg, #ffffff 0%, #f5f5f0 100%)' } as any,
          isV2 ? v2Shadow : faceUpShadow,
          isV2 ? v2Border : highlightBorder,
          !isV2 && highlightShadow,
          dimmed && styles.dimmed,
          {
            transform: [
              { perspective: 1000 },
              { rotateY: frontRotateY },
              { scale: glowScale },
              { translateY: glowTranslateY },
              // { translateY: floatY } removed 2026-05-22 — see KILL_Card
            ],
            opacity: frontOpacity,
          },
        ]}
      >
        {/* VAMOS-VISUAL-C-FINISH — true cream gradient (native + web), borderRadius on the
            gradient itself so we don't need overflow:hidden on the shadowed Animated.View. */}
        {isV2 && (
          <LinearGradient
            colors={[OBSIDIAN.cardFaceTop, OBSIDIAN.cardFaceBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: OBSIDIAN_GEOM.cardRadius }]}
            pointerEvents="none"
          />
        )}
        {/* Subtle depth gradient — native only */}
        {Platform.OS !== 'web' && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.025, top: '65%', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]} pointerEvents="none" />
        )}
        {/* VAMOS-VISUAL-C — 1px inset top highlight for lift cue */}
        {isV2 && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 1,
              right: 1,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderTopLeftRadius: OBSIDIAN_GEOM.cardRadius,
              borderTopRightRadius: OBSIDIAN_GEOM.cardRadius,
              opacity: 0.7,
            }}
            pointerEvents="none"
          />
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
        ) : isV2 ? (
          <>
            {/* V2 Minimalist: top-left corner only */}
            <View style={styles.cornerTopLeft} pointerEvents="none">
              <Text allowFontScaling={false} style={[styles.v2CornerRank, { color: v2SuitColor, fontSize: PRD.card.cornerRank(width), lineHeight: Math.round(PRD.card.cornerRank(width) * 1.1) }]}>{card.rank}</Text>
              <Text allowFontScaling={false} style={[styles.v2CornerSuit, { color: v2SuitColor, fontSize: PRD.card.cornerSuit(width), lineHeight: Math.round(PRD.card.cornerSuit(width) * 1.1) }]}>{SUIT_SYMBOLS[card.suit]}</Text>
            </View>
            {/* V2 Minimalist: large center suit only — sized to ~55% of card width */}
            <View style={styles.centerDisplay}>
              <Text allowFontScaling={false} style={[styles.v2CenterSuit, { color: v2SuitColor, fontSize: PRD.card.centerSuit(width) }]}>
                {SUIT_SYMBOLS[card.suit]}
              </Text>
            </View>
          </>
        ) : null /* Legacy non-V2 branch removed 2026-05-23 — isV2 is now always true */}
      </Animated.View>
    </View>
  );
}

// VAMOS-FIX-RESULTS-RENDER 2026-06-17 — memo'd so 36 cards on the results
// screen don't re-render on every parent state update (chip roll-up, board
// stagger, achievement toasts).
export default React.memo(CardComponent);

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: rs(3),
    left: rs(4),
    alignItems: 'center',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 4,
    right: 5,
    alignItems: 'center',
  },
  cornerRank: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  cornerSuit: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: -1,
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
  // V2 Minimalist styles
  v2CornerRank: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 22,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CornerSuit: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 16,
    marginTop: 2,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CenterSuit: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
});
