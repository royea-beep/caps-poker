import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';

interface PlayerHandProps {
  cards: Card[];
  selectedCardId?: string;
  onSelectCard: (card: Card) => void;
}

export default function PlayerHand({ cards, selectedCardId, onSelectCard }: PlayerHandProps) {
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
        <CardComponent card={card} faceDown={false} small />
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
          <View style={styles.row}>
            {topRow.map(renderCard)}
          </View>
          {bottomRow.length > 0 && (
            <View style={styles.row}>
              {bottomRow.map(renderCard)}
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
    paddingVertical: 4,
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
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  grid: {
    paddingHorizontal: 8,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  cardWrapper: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 1,
  },
  selected: {
    borderColor: COLORS.gold,
    transform: [{ translateY: -6 }, { scale: 1.08 }],
    borderRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    color: COLORS.neonGreen,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
