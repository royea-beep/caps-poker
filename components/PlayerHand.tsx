import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';

interface PlayerHandProps {
  cards: Card[];
  selectedCardId?: string;
  onSelectCard: (card: Card) => void;
}

export default function PlayerHand({ cards, selectedCardId, onSelectCard }: PlayerHandProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>YOUR HAND ({cards.length} cards)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => onSelectCard(card)}
            style={[
              styles.cardWrapper,
              selectedCardId === card.id && styles.selected,
            ]}
          >
            <CardComponent card={card} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginLeft: 16,
    marginBottom: 6,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 2,
  },
  cardWrapper: {
    borderRadius: 8,
    padding: 2,
  },
  selected: {
    backgroundColor: COLORS.gold,
    transform: [{ translateY: -8 }],
    borderRadius: 8,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
});
