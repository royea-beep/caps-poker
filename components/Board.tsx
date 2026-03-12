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
  cardHeight?: number;
}

function EmptySlotAnimated({ isArrangement, onPress, slotWidth, slotHeight }: { isArrangement?: boolean; onPress?: () => void; slotWidth: number; slotHeight: number }) {
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
      <Animated.View style={[styles.emptySlot, { width: slotWidth, height: slotHeight }, isArrangement && styles.dropTarget, animStyle]}>
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

  const text = winner === 'tie' ? '\u00b10' : winner === 'player' ? `+${amount}` : `-${amount}`;
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
  cardHeight: cardHeightProp,
}: BoardProps) {
  const ch = cardHeightProp ?? 46;
  const cw = Math.round(ch * 0.7);

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

  const showBotRow = botCards.length > 0;

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.boardLabel}>B{index + 1}</Text>
            {winner && (
              <Badge
                label={winner === 'player' ? 'W' : winner === 'bot' ? 'L' : 'T'}
                variant={winner === 'player' ? 'win' : winner === 'bot' ? 'lose' : 'tie'}
                small
              />
            )}
            {revealed && playerHandName && (
              <Text style={[styles.handName, winner === 'player' && styles.winnerHandName]}>{playerHandName}</Text>
            )}
          </View>
          <View style={styles.potArea}>
            <Text style={styles.potLabel}>{potAmount} \ud83e\ude99</Text>
            {winner && <FloatingChips amount={potAmount} winner={winner} />}
          </View>
        </View>

        {/* Bot cards — only shown when bot has placed cards */}
        {showBotRow && (
          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>BOT</Text>
            {botCards.map((c) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={!revealed}
                cardWidth={cw}
                cardHeight={ch}
                highlighted={revealed && botHighlightIds.includes(c.id)}
                dimmed={revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
                flipDuration={flipDuration}
              />
            ))}
            {revealed && botHandName && (
              <Text style={[styles.handName, winner === 'bot' && styles.winnerHandName, { marginLeft: 4 }]}>{botHandName}</Text>
            )}
          </View>
        )}

        {/* Community cards: flop + turn/river */}
        <View style={styles.cardRow}>
          {openCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              cardWidth={cw}
              cardHeight={ch}
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
              cardWidth={cw}
              cardHeight={ch}
              highlighted={revealed && boardHighlightIds.includes(c.id)}
              dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
              flipDuration={flipDuration}
            />
          ))}
        </View>

        {/* Player cards */}
        <View style={styles.cardRow}>
          {playerCards.length > 0 ? (
            playerCards.map((c) => (
              isArrangement && onRemoveCard ? (
                <Pressable key={c.id} onPress={() => onRemoveCard(c)}>
                  <CardComponent
                    card={c}
                    faceDown={false}
                    cardWidth={cw}
                    cardHeight={ch}
                    highlighted={revealed && playerHighlightIds.includes(c.id)}
                    dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
                  />
                </Pressable>
              ) : (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={false}
                  cardWidth={cw}
                  cardHeight={ch}
                  highlighted={revealed && playerHighlightIds.includes(c.id)}
                  dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
                />
              )
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={cw} slotHeight={ch} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-fill-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={cw} slotHeight={ch} />
            ))
          }
          {isArrangement && playerCards.length === CARDS_PER_BOARD && (
            <Text style={styles.hintText}>{getHandHint(playerCards)}</Text>
          )}
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
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
  },
  pressableInner: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    justifyContent: 'center',
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
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  boardLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rowLabel: {
    color: COLORS.textDim,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 20,
    textAlign: 'center',
  },
  potArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '700',
  },
  floatingChips: {
    fontSize: 11,
    fontWeight: '800',
    position: 'absolute',
    right: -4,
    top: -2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 1,
  },
  communitySeparator: {
    width: 3,
  },
  emptySlot: {
    borderRadius: 4,
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
    fontSize: 14,
  },
  handName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
  },
  winnerHandName: {
    color: COLORS.goldLight,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 7,
    fontWeight: '600',
    marginLeft: 4,
    opacity: 0.7,
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
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
