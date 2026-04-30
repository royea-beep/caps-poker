import React, { useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import { getDevice } from '../constants/deviceBreakpoints';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { WEB_MAX_WIDTH } from './WebContainer';
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';
import { playSound } from '../utils/sounds';

interface PlayerHandProps {
  cards: Card[];
  selectedCardIds?: string[];
  onSelectCard: (card: Card) => void;
}

// Per-card animated slot — each mounts with its own deal animation
function AnimatedCardSlot({
  card,
  index,
  selIndex,
  onSelectCard,
  cardW,
  cardH,
}: {
  card: Card;
  index: number;
  selIndex: number;
  onSelectCard: (card: Card) => void;
  cardW: number;
  cardH: number;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }, (finished) => {
      if (finished && index % 4 === 0) runOnJS(playSound)('cardPlace');
    }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const isSelected = selIndex >= 0;
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => onSelectCard(card)}
        style={[styles.cardWrapper, isSelected && styles.selected]}
      >
        <CardComponent card={card} faceDown={false} cardWidth={cardW} cardHeight={cardH} />
        {isSelected && (
          <View style={styles.selBadge}>
            <Text style={styles.selBadgeText}>{selIndex + 1}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function PlayerHand({ cards, selectedCardIds = [], onSelectCard }: PlayerHandProps) {
  const { width: rawW } = useWindowDimensions();
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const device = getDevice(SCREEN_W, 0);

  // Mobile web uses 2-row layout like native (single row overflows on narrow screen)
  const useTwoRows = Platform.OS !== 'web' || device.isMobileWeb;

  // Dynamic card sizing: always size as if full 8-card hand (4 per row) — prevents giant cards when few remain
  const availableW = SCREEN_W - 16; // paddingHorizontal 8 each side from styles.grid
  const safeCards = cards ?? [];
  const useQuadRows = useTwoRows && safeCards.length > 12;
  const cardsPerRow = useTwoRows ? Math.max(4, Math.ceil(safeCards.length / (useQuadRows ? 4 : 2))) : Math.max(1, safeCards.length);
  // cardWrapper: paddingHorizontal(4)*2 + borderWidth(2)*2 = 12px overhead per card
  const CARD_WRAPPER_OVERHEAD = 12;
  const maxCardW = Math.floor((availableW - (cardsPerRow - 1) * 3 - cardsPerRow * CARD_WRAPPER_OVERHEAD) / cardsPerRow);
  const cardW = (() => {
    if (Platform.OS !== 'web') return Math.min(30, Math.max(22, maxCardW));
    if (device.isMobileWeb)  return Math.min(60, Math.max(26, maxCardW));
    if (device.isTabletWeb)  return Math.min(72, Math.max(58, maxCardW));
    return Math.min(88, Math.max(70, maxCardW));
  })();
  const cardH = Math.round(cardW / 0.72);

  const rowSize = useQuadRows ? 4 : Math.ceil(safeCards.length / 2);
  const topRow = safeCards.slice(0, rowSize);
  const row2 = useQuadRows ? safeCards.slice(rowSize, rowSize * 2) : [];
  const row3 = useQuadRows ? safeCards.slice(rowSize * 2, rowSize * 3) : [];
  const bottomRow = safeCards.slice(useQuadRows ? rowSize * 3 : rowSize);

  const renderCard = (card: Card, globalIndex: number) => (
    <AnimatedCardSlot
      key={card.id}
      card={card}
      index={globalIndex}
      selIndex={selectedCardIds.indexOf(card.id)}
      onSelectCard={onSelectCard}
      cardW={cardW}
      cardH={cardH}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.boardBorder }]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t().yourHand}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{safeCards.length}</Text>
        </View>
      </View>
      {safeCards.length > 0 ? (
        <View style={styles.grid}>
          {useTwoRows ? (
            <>
              <View style={styles.row}>
                {topRow.map((card, i) => renderCard(card, i))}
              </View>
              {row2.length > 0 && (
                <View style={styles.row}>
                  {row2.map((card, i) => renderCard(card, rowSize + i))}
                </View>
              )}
              {row3.length > 0 && (
                <View style={styles.row}>
                  {row3.map((card, i) => renderCard(card, rowSize * 2 + i))}
                </View>
              )}
              {bottomRow.length > 0 && (
                <View style={styles.row}>
                  {bottomRow.map((card, i) => renderCard(card, (useQuadRows ? rowSize * 3 : rowSize) + i))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.webRow}>
              {safeCards.map((card, i) => renderCard(card, i))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>All cards placed!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: rs(3),
    backgroundColor: COLORS.surface,
    borderTopWidth: 2,
    borderTopColor: COLORS.boardBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: rs(12),
    marginBottom: rs(3),
    gap: rs(6),
  },
  label: {
    color: '#c9a84c',
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  countBadge: {
    width: rv(20),
    height: rv(20),
    borderRadius: rv(10),
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#000',
    fontSize: rf(10),
    fontWeight: '900',
  },
  grid: {
    paddingHorizontal: rs(8),
    gap: rs(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(3),
  },
  webRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: rs(4),
  },
  cardWrapper: {
    borderRadius: rv(6),
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 1,
    paddingHorizontal: rs(4),
  },
  selected: {
    borderColor: COLORS.gold,
    transform: [{ translateY: -8 }, { rotate: '-3deg' }, { scale: 1.08 }],
    borderRadius: rv(6),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: rs(10),
  },
  emptyText: {
    color: COLORS.neonGreen,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  selBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: rv(16),
    height: rv(16),
    borderRadius: rv(8),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selBadgeText: {
    color: '#000',
    fontSize: rf(9),
    fontWeight: '900',
  },
});
