import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { WEB_MAX_WIDTH } from './WebContainer';

interface PlayerHandProps {
  cards: Card[];
  selectedCardId?: string;
  onSelectCard: (card: Card) => void;
}

export default function PlayerHand({ cards, selectedCardId, onSelectCard }: PlayerHandProps) {
  const { width: rawW } = useWindowDimensions();
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;

  const isWeb = Platform.OS === 'web';

  // Dynamic card sizing: fit 8 cards per row with gaps and padding
  const availableW = SCREEN_W - 16; // paddingHorizontal 8 each side
  const maxCardW = Math.floor((availableW - 7 * 3) / 8); // 8 cards, 7 gaps of 3px
  const cardW = isWeb
    ? Math.min(80, Math.max(64, maxCardW))
    : Math.min(44, Math.max(36, maxCardW));  // smaller on native: must fit 8 per row on iPhone SE
  const cardH = Math.round(cardW * 1.4);

  const midpoint = Math.ceil(cards.length / 2);
  const topRow = cards.slice(0, midpoint);
  const bottomRow = cards.slice(midpoint);

  const renderCard = (card: Card) => {
    const isSelected = selectedCardId === card.id;
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
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        YOUR HAND ({cards.length} remaining)
      </Text>
      {cards.length > 0 ? (
        <View style={styles.grid}>
          {isWeb ? (
            <View style={styles.webRow}>
              {cards.map(renderCard)}
            </View>
          ) : (
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
    paddingVertical: 3,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
  },
  label: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginLeft: 12,
    marginBottom: 3,
    textTransform: 'uppercase',
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
});
