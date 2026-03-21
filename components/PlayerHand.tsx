import React, { useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { getDevice } from '../constants/deviceBreakpoints';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { WEB_MAX_WIDTH } from './WebContainer';
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';

interface PlayerHandProps {
  cards: Card[];
  selectedCardIds?: string[];
  onSelectCard: (card: Card) => void;
}

export default function PlayerHand({ cards, selectedCardIds = [], onSelectCard }: PlayerHandProps) {
  const { width: rawW } = useWindowDimensions();
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const device = getDevice(SCREEN_W, 0);

  // Dynamic card sizing: fit 8 cards per row with gaps and padding
  const availableW = SCREEN_W - 16; // paddingHorizontal 8 each side
  const maxCardW = Math.floor((availableW - 7 * 3) / 8); // 8 cards, 7 gaps of 3px
  const cardW = (() => {
    // Hand cards are ~1.3x board card size for better readability
    if (Platform.OS !== 'web') return Math.min(44, Math.max(34, maxCardW));
    if (device.isMobileWeb)  return Math.min(60, Math.max(46, maxCardW));
    if (device.isTabletWeb)  return Math.min(72, Math.max(58, maxCardW));
    return Math.min(88, Math.max(70, maxCardW));
  })();
  const cardH = Math.round(cardW * 1.4);

  // Mobile web uses 2-row layout like native (single row overflows on narrow screen)
  const useTwoRows = Platform.OS !== 'web' || device.isMobileWeb;

  // Deal animation: cards slide up + fade in on mount
  const dealOpacity = useSharedValue(0);
  const dealTranslateY = useSharedValue(12);
  useEffect(() => {
    dealOpacity.value = withTiming(1, { duration: 350 });
    dealTranslateY.value = withTiming(0, { duration: 280 });
  }, []);
  const dealStyle = useAnimatedStyle(() => ({
    opacity: dealOpacity.value,
    transform: [{ translateY: dealTranslateY.value }],
  }));

  const midpoint = Math.ceil(cards.length / 2);
  const topRow = cards.slice(0, midpoint);
  const bottomRow = cards.slice(midpoint);

  const renderCard = (card: Card) => {
    const selIndex = selectedCardIds.indexOf(card.id);
    const isSelected = selIndex >= 0;
    return (
      <Pressable
        key={card.id}
        onPress={() => onSelectCard(card)}
        style={[
          styles.cardWrapper,
          isSelected && styles.selected,
        ]}
      >
        <CardComponent card={card} faceDown={false} cardWidth={cardW} cardHeight={cardH} />
        {isSelected && (
          <View style={styles.selBadge}>
            <Text style={styles.selBadgeText}>{selIndex + 1}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.boardBorder }]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>YOUR HAND</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{cards.length}</Text>
        </View>
      </View>
      {cards.length > 0 ? (
        <Animated.View style={[styles.grid, dealStyle]}>
          {useTwoRows ? (
            <>
              <View style={styles.row}>
                {topRow.map(renderCard)}
              </View>
              {bottomRow.length > 0 && (
                <View style={styles.row}>
                  {bottomRow.map(renderCard)}
                </View>
              )}
            </>
          ) : (
            <View style={styles.webRow}>
              {cards.map(renderCard)}
            </View>
          )}
        </Animated.View>
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
    paddingVertical: 3,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 3,
    gap: 6,
  },
  label: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  countBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  grid: {
    paddingHorizontal: 8,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  webRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  cardWrapper: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 1,
    paddingHorizontal: 4,
  },
  selected: {
    borderColor: COLORS.gold,
    transform: [{ translateY: -4 }, { scale: 1.06 }],
    borderRadius: 6,
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
    paddingVertical: 10,
  },
  emptyText: {
    color: COLORS.neonGreen,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  selBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
});
