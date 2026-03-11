import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';

interface BoardProps {
  index: number;
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  revealed: boolean;
  active: boolean;
  potAmount: number;
  winner?: 'player' | 'bot' | 'tie';
  playerHighlightIds?: string[];
  botHighlightIds?: string[];
  boardHighlightIds?: string[];
  playerHandName?: string;
  botHandName?: string;
  onPress?: () => void;
  onRemoveCard?: (card: Card) => void;
  isArrangement?: boolean;
  selected?: boolean;
}

function EmptySlotAnimated({ isArrangement, onPress }: { isArrangement?: boolean; onPress?: () => void }) {
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (isArrangement) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 }),
        ),
        -1,
      );
    } else {
      pulseOpacity.value = withTiming(0.6, { duration: 200 });
    }
  }, [isArrangement]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.emptySlot, isArrangement && styles.dropTarget, animStyle]}>
        <Text style={styles.plusText}>+</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function Board({
  index,
  openCards,
  closedCards,
  playerCards,
  botCards,
  revealed,
  active,
  potAmount,
  winner,
  playerHighlightIds = [],
  botHighlightIds = [],
  boardHighlightIds = [],
  playerHandName,
  botHandName,
  onPress,
  onRemoveCard,
  isArrangement,
  selected,
}: BoardProps) {
  const pulseValue = useSharedValue(0.4);

  useEffect(() => {
    if (active) {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 }),
        ),
        -1,
      );
    } else {
      pulseValue.value = withTiming(0, { duration: 200 });
    }
  }, [active]);

  const pulseStyle = useAnimatedStyle(() => {
    if (pulseValue.value === 0) {
      return {};
    }
    return {
      borderColor: COLORS.boardActive,
      shadowColor: COLORS.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: pulseValue.value * 0.6,
      shadowRadius: pulseValue.value * 10,
      elevation: pulseValue.value * 8,
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        active && styles.active,
        selected && styles.selected,
        winner === 'player' && styles.playerWon,
        winner === 'bot' && styles.botWon,
        active && pulseStyle,
      ]}
    >
      <Pressable onPress={onPress} style={styles.pressableInner}>
        <View style={styles.header}>
          <Text style={styles.boardLabel}>Board {index + 1}</Text>
          <Text style={styles.potLabel}>{potAmount} 🪙</Text>
        </View>

        {/* Bot cards */}
        <View style={styles.playerRow}>
          {botCards.length > 0 ? (
            botCards.map((c, i) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={!revealed}
                small
                highlighted={revealed && botHighlightIds.includes(c.id)}
                dimmed={revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
              />
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <View key={`bot-empty-${i}`} style={styles.emptySlot} />
            ))
          )}
        </View>
        {revealed && botHandName && (
          <Text style={[styles.handName, winner === 'bot' && styles.winnerHandName]}>{botHandName}</Text>
        )}

        {/* Community cards: 3 open (flop) + 2 closed (turn/river) */}
        <View style={styles.communityRow}>
          {openCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              small
              highlighted={revealed && boardHighlightIds.includes(c.id)}
              dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
            />
          ))}
          <View style={styles.communitySeparator} />
          {revealed
            ? closedCards.map((c) => (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={false}
                  small
                  highlighted={boardHighlightIds.includes(c.id)}
                  dimmed={!boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
                />
              ))
            : closedCards.map((_, i) => (
                <CardComponent key={`closed-${i}`} faceDown small />
              ))}
        </View>

        {/* Player cards */}
        {revealed && playerHandName && (
          <Text style={[styles.handName, winner === 'player' && styles.winnerHandName]}>{playerHandName}</Text>
        )}
        <View style={styles.playerRow}>
          {playerCards.length > 0 ? (
            playerCards.map((c) => (
              isArrangement && onRemoveCard ? (
                <Pressable key={c.id} onPress={() => onRemoveCard(c)}>
                  <CardComponent
                    card={c}
                    faceDown={false}
                    small
                    highlighted={revealed && playerHighlightIds.includes(c.id)}
                    dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
                  />
                </Pressable>
              ) : (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={false}
                  small
                  highlighted={revealed && playerHighlightIds.includes(c.id)}
                  dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
                />
              )
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} onPress={onPress} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-fill-${i}`} isArrangement={isArrangement} onPress={onPress} />
            ))
          }
        </View>

        {winner && (
          <View style={[styles.winnerBadge, winner === 'player' ? styles.playerBadge : winner === 'bot' ? styles.botBadge : styles.tieBadge]}>
            <Text style={styles.winnerText}>
              {winner === 'player' ? 'YOU WIN' : winner === 'bot' ? 'BOT WINS' : 'TIE'}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.boardBorder,
    padding: 0,
    width: '48%',
    marginBottom: 4,
    overflow: 'hidden',
  },
  pressableInner: {
    padding: 4,
  },
  active: {
    borderColor: COLORS.boardActive,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  selected: {
    borderColor: COLORS.gold,
    borderWidth: 2.5,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  playerWon: {
    borderColor: COLORS.success,
  },
  botWon: {
    borderColor: COLORS.danger,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  boardLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 2,
    alignItems: 'center',
  },
  communitySeparator: {
    width: 4,
  },
  emptySlot: {
    width: 32,
    height: 46,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    borderStyle: 'dashed',
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropTarget: {
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },
  plusText: {
    color: COLORS.gold,
    fontSize: 16,
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '600',
  },
  winnerHandName: {
    color: COLORS.goldBright,
  },
  winnerBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playerBadge: {
    backgroundColor: COLORS.success,
  },
  botBadge: {
    backgroundColor: COLORS.danger,
  },
  tieBadge: {
    backgroundColor: COLORS.goldDim,
  },
  winnerText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
