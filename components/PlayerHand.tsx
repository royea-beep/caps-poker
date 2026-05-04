import React, { useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';
import { playSound } from '../utils/sounds';
import { tapCard } from '../lib/haptics';

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
  const pressScale = useSharedValue(1);

  useEffect(() => {
    const delay = index * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }, (finished) => {
      if (finished && index % 4 === 0) runOnJS(playSound)('cardPlace');
    }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: pressScale.value }],
  }));

  const isSelected = selIndex >= 0;
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => { tapCard(); onSelectCard(card); }}
        onPressIn={() => { pressScale.value = withTiming(0.92, { duration: 80 }); }}
        onPressOut={() => { pressScale.value = withTiming(1, { duration: 120 }); }}
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
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);

  const HAND_CARD_H = 80;
  const HAND_CARD_W = 56;

  const safeCards = cards ?? [];
  const row1 = safeCards.slice(0, 8);
  const row2 = safeCards.slice(8, 16);

  const renderCard = (card: Card, globalIndex: number) => (
    <AnimatedCardSlot
      key={card.id}
      card={card}
      index={globalIndex}
      selIndex={selectedCardIds.indexOf(card.id)}
      onSelectCard={onSelectCard}
      cardW={HAND_CARD_W}
      cardH={HAND_CARD_H}
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
          <View style={styles.row}>
            {row1.map((card, i) => renderCard(card, i))}
          </View>
          <View style={styles.row}>
            {row2.map((card, i) => renderCard(card, 8 + i))}
          </View>
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
    height: 180,
    paddingTop: rs(3),
    paddingBottom: Platform.OS === 'ios' ? rs(12) : rs(6),
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: 'rgba(255,255,255,0.85)',
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
