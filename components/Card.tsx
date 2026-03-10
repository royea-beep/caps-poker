import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Card as CardType, COLORS } from '../constants/gameConfig';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export default function CardComponent({ card, faceDown, small, highlighted, dimmed }: CardProps) {
  const width = small ? 32 : 48;
  const height = small ? 46 : 70;

  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    glowOpacity.value = highlighted
      ? withSpring(1, { damping: 12, stiffness: 120 })
      : withTiming(0, { duration: 200 });
  }, [highlighted]);

  const highlightAnimStyle = useAnimatedStyle(() => ({
    borderWidth: glowOpacity.value * 2,
    borderColor: COLORS.goldBright,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value * 0.8,
    shadowRadius: glowOpacity.value * 8,
    elevation: glowOpacity.value * 8,
  }));

  if (faceDown || !card) {
    return (
      <View style={[styles.card, styles.faceDown, { width, height }]}>
        <View style={styles.backPattern}>
          <Text style={styles.backText}>♠</Text>
        </View>
      </View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? COLORS.red : COLORS.black;

  return (
    <Animated.View
      style={[
        styles.card,
        styles.faceUp,
        { width, height },
        highlightAnimStyle,
        dimmed && styles.dimmed,
      ]}
    >
      <Text style={[styles.rank, { color: suitColor, fontSize: small ? 11 : 16 }]}>
        {card.rank}
      </Text>
      <Text style={[styles.suit, { color: suitColor, fontSize: small ? 12 : 18 }]}>
        {SUIT_SYMBOLS[card.suit]}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  faceUp: {
    backgroundColor: COLORS.cardWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  faceDown: {
    backgroundColor: COLORS.cardBack,
    borderWidth: 1,
    borderColor: COLORS.cardBackPattern,
  },
  backPattern: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.cardBackPattern,
    fontSize: 20,
    opacity: 0.5,
  },
  rank: {
    fontWeight: '800',
    marginBottom: -4,
  },
  suit: {
    marginTop: -2,
  },
  dimmed: {
    opacity: 0.4,
  },
});
