// VAMOS-FIX-RESULTS-RENDER-2 2026-06-17 — static face-up card for the results
// screen. Cards there are already revealed and never animate; the in-game
// CardComponent allocates an Animated.Value + 6 interpolations + 2 useEffects
// per card, which is ~1s of sync work for 36 cards on a mid phone (6× throttle).
// This variant: plain View + Text, NO Animated, NO flip/glow init, NO back face.
// One useGameStore subscription (theme/color config) is kept since the visual
// must match Card.tsx exactly.
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { rs } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { useGameStore } from '../store/gameStore';
import { Card as CardType } from '../constants/gameConfig';
import { OBSIDIAN, OBSIDIAN_GEOM, cardLiftShadow, cardLiftShadowSmall } from '../constants/obsidianTheme';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const V2_RED = '#c41e3a';
const V2_BLACK = '#18181b';

const SUIT_COLORS_4: Record<string, string> = {
  hearts: '#E8192C', diamonds: '#1565C0', spades: '#1a1a2e', clubs: '#228B22',
};
const SUIT_COLORS_4_FIVEO: Record<string, string> = {
  hearts: '#E8192C', diamonds: '#1565C0', spades: '#1a1a2e', clubs: '#006644',
};

interface Props {
  card: CardType;
  cardWidth: number;
  cardHeight: number;
  highlighted?: boolean;
  dimmed?: boolean;
  isCommunityCard?: boolean;
}

function StaticCard({ card, cardWidth, cardHeight, highlighted, dimmed, isCommunityCard }: Props) {
  const _explicitFloorW = isCommunityCard ? 24 : 16;
  const _explicitFloorH = isCommunityCard ? 34 : 22;
  const width = Math.max(_explicitFloorW, cardWidth);
  const height = Math.max(_explicitFloorH, cardHeight);

  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const visualTheme = useGameStore((s) => s.visualTheme);

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const activeSuitColors4 = visualTheme === 'fiveo' ? SUIT_COLORS_4_FIVEO : SUIT_COLORS_4;
  const v2SuitColor = fourColorSuits
    ? (activeSuitColors4[card.suit] ?? V2_BLACK)
    : (isRed ? V2_RED : V2_BLACK);

  const v2Shadow = width < 40 ? cardLiftShadowSmall : cardLiftShadow;
  const v2Border = highlighted
    // VAMOS-ONE-GOLD 2026-08-16 — the /results winner border, the second of the two mechanisms
    // that mean "you won". Moved to #FFD700 with Card.tsx:456 so the cue is one metal on both
    // surfaces. Width left at 2.5 — this is StaticCard, not the 3px game-screen border that
    // 694565f pinned against Chromium's device-pixel rounding.
    ? { borderWidth: 2.5, borderColor: '#FFD700' as const }
    : { borderWidth: 0 };

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: OBSIDIAN.cardFaceFallback,
          borderRadius: OBSIDIAN_GEOM.cardRadius,
        },
        v2Shadow,
        v2Border,
        dimmed && styles.dimmed,
      ]}
    >
      <LinearGradient
        colors={[OBSIDIAN.cardFaceTop, OBSIDIAN.cardFaceBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: OBSIDIAN_GEOM.cardRadius }]}
        pointerEvents="none"
      />
      {Platform.OS !== 'web' && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.025, top: '65%', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]} pointerEvents="none" />
      )}
      {/* 1px inset top highlight — DELETED 2026-08-10, together with the identical element in
          Card.tsx:531-547. This is the copy /results renders, and it is why the bar survived
          the round where only Card.tsx was changed. See Card.tsx for the full reasoning:
          recolouring failed twice, the second time because the design token #FFFEF8 is not what
          the card actually paints (253,252,246). Deleted rather than calibrated a third time. */}
      <View style={styles.cornerTopLeft} pointerEvents="none">
        <Text allowFontScaling={false} style={[styles.v2CornerRank, { color: v2SuitColor, fontSize: PRD.card.cornerRank(width), lineHeight: Math.round(PRD.card.cornerRank(width) * 1.1) }]}>{card.rank}</Text>
        <Text allowFontScaling={false} style={[styles.v2CornerSuit, { color: v2SuitColor, fontSize: PRD.card.cornerSuit(width), lineHeight: Math.round(PRD.card.cornerSuit(width) * 1.1) }]}>{SUIT_SYMBOLS[card.suit]}</Text>
      </View>
      <View style={styles.centerDisplay}>
        <Text allowFontScaling={false} style={[styles.v2CenterSuit, { color: v2SuitColor, fontSize: PRD.card.centerSuit(width) }]}>
          {SUIT_SYMBOLS[card.suit]}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(StaticCard);

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dimmed: { opacity: 0.45 },
  cornerTopLeft: {
    position: 'absolute',
    top: rs(3),
    left: rs(4),
    alignItems: 'flex-start',
  },
  centerDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  v2CornerRank: {
    fontWeight: '700' as const,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CornerSuit: {
    fontWeight: '600' as const,
    marginTop: 2,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CenterSuit: {
    fontWeight: '700' as const,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
});
