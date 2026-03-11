import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import CardComponent from './Card';
import { Badge } from './Badge';
import { Card, COLORS, CARDS_PER_BOARD } from '../constants/gameConfig';
import { getHandHint } from '../utils/handHint';

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
  flipDuration?: number;
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

function FloatingChips({ amount, winner }: { amount: number; winner: 'player' | 'bot' | 'tie' }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(-16, { duration: 1200 });
    opacity.value = withDelay(800, withTiming(0, { duration: 400 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const text = winner === 'tie' ? '±0' : winner === 'player' ? `+${amount}` : `-${amount}`;
  const color = winner === 'player' ? COLORS.neonGreen : winner === 'bot' ? COLORS.neonRed : COLORS.textSecondary;

  return (
    <Animated.Text style={[styles.floatingChips, { color }, animStyle]}>
      {text}
    </Animated.Text>
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
  flipDuration,
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
      shadowColor: COLORS.neonBlue,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: pulseValue.value * 0.6,
      shadowRadius: pulseValue.value * 10,
      elevation: pulseValue.value * 8,
    };
  });

  // Board-complete pulse: single green flash when board becomes full during arrangement
  const boardFull = isArrangement && playerCards.length === CARDS_PER_BOARD;
  const prevBoardFull = useRef(false);
  const completePulse = useSharedValue(0);

  useEffect(() => {
    if (boardFull && !prevBoardFull.current) {
      completePulse.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 500 }),
      );
    }
    prevBoardFull.current = !!boardFull;
  }, [boardFull]);

  const completePulseStyle = useAnimatedStyle(() => {
    if (completePulse.value === 0) return {};
    return {
      borderColor: COLORS.boardFull,
      shadowColor: COLORS.neonGreen,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: completePulse.value * 0.8,
      shadowRadius: completePulse.value * 12,
      elevation: completePulse.value * 10,
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
        completePulseStyle,
      ]}
    >
      <Pressable onPress={onPress} style={styles.pressableInner}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.boardLabel}>Board {index + 1}</Text>
            {winner && (
              <Badge
                label={winner === 'player' ? 'W' : winner === 'bot' ? 'L' : 'T'}
                variant={winner === 'player' ? 'win' : winner === 'bot' ? 'lose' : 'tie'}
                small
              />
            )}
          </View>
          <View style={styles.potArea}>
            <Text style={styles.potLabel}>{potAmount} 🪙</Text>
            {winner && <FloatingChips amount={potAmount} winner={winner} />}
          </View>
        </View>

        {/* Bot cards — single row */}
        <View style={styles.cardRow}>
          {botCards.length > 0 ? (
            botCards.map((c) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={!revealed}
                small
                highlighted={revealed && botHighlightIds.includes(c.id)}
                dimmed={revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
                flipDuration={flipDuration}
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

        {/* Community cards: 3 open (flop) + 2 closed (turn/river) in single row */}
        <Text style={styles.sectionLabel}>BOARD</Text>
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
          {closedCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={!revealed}
              small
              highlighted={revealed && boardHighlightIds.includes(c.id)}
              dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
              flipDuration={flipDuration}
            />
          ))}
        </View>

        {/* Player cards — single row */}
        <Text style={styles.sectionLabel}>YOUR CARDS</Text>
        {revealed && playerHandName && (
          <Text style={[styles.handName, winner === 'player' && styles.winnerHandName]}>{playerHandName}</Text>
        )}
        <View style={styles.cardRow}>
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
        {isArrangement && playerCards.length === CARDS_PER_BOARD && (
          <Text style={styles.hintText}>{getHandHint(playerCards)}</Text>
        )}

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
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 0,
    width: '48%',
    marginBottom: 4,
    overflow: 'hidden',
  },
  pressableInner: {
    padding: 6,
  },
  active: {
    borderColor: COLORS.boardActive,
    shadowColor: COLORS.neonBlue,
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
    borderColor: COLORS.neonGreen,
  },
  botWon: {
    borderColor: COLORS.neonRed,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boardLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  potArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  floatingChips: {
    fontSize: 12,
    fontWeight: '800',
    position: 'absolute',
    right: -4,
    top: -2,
  },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    alignItems: 'center',
    gap: 2,
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
    color: COLORS.textMuted,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '600',
  },
  winnerHandName: {
    color: COLORS.goldLight,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 1,
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
    backgroundColor: COLORS.neonGreen,
  },
  botBadge: {
    backgroundColor: COLORS.neonRed,
  },
  tieBadge: {
    backgroundColor: COLORS.goldDim,
  },
  winnerText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
