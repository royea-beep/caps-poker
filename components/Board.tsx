// v-red-boards
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
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
import { rv } from '../constants/deviceBreakpoints';
import { getHandHint } from '../utils/handHint';

interface BoardProps {
  index: number;
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  allBotCards?: Card[][];
  revealed: boolean;
  active: boolean;
  potAmount: number;
  winner?: 'player' | 'bot' | 'tie';
  playerHighlightIds?: string[];
  botHighlightIds?: string[];
  boardHighlightIds?: string[];
  playerHandName?: string;
  botHandName?: string;
  allBotHandNames?: string[];
  onPress?: () => void;
  onRemoveCard?: (card: Card) => void;
  onAutoFill?: () => void;
  isArrangement?: boolean;
  selected?: boolean;
  flipDuration?: number;
  cardHeight?: number;
  isWinner?: boolean;
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
  allBotCards,
  allBotHandNames,
  onPress,
  onRemoveCard,
  onAutoFill,
  isArrangement,
  selected,
  flipDuration,
  cardHeight: cardHeightProp,
  isWinner,
}: BoardProps) {
  const { width: screenW } = useWindowDimensions();
  const ch = cardHeightProp ?? rv(screenW, 56, 72, 90, 64);
  const cw = Math.round(ch * 0.7);
  // Empty slots are ~30% smaller during arrangement
  const slotH = isArrangement ? Math.round(ch * 0.7) : ch;
  const slotW = Math.round(slotH * 0.7);

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
      borderColor: COLORS.gold,
      shadowColor: COLORS.gold,
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

  // WIN banner — animate in when winner is set
  const bannerProgress = useSharedValue(0);
  useEffect(() => {
    if (winner) {
      bannerProgress.value = withDelay(350, withTiming(1, { duration: 350 }));
    } else {
      bannerProgress.value = 0;
    }
  }, [winner]);

  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerProgress.value,
    transform: [{ scale: 0.7 + bannerProgress.value * 0.3 }],
  }));

  // Winner gold pulse — 2s repeating glow when isWinner is true
  const winnerPulse = useSharedValue(0);
  useEffect(() => {
    if (isWinner) {
      winnerPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 }),
        ),
        -1,
        false,
      );
    } else {
      winnerPulse.value = withTiming(0, { duration: 200 });
    }
  }, [isWinner]);

  const winnerPulseStyle = useAnimatedStyle(() => {
    if (winnerPulse.value === 0) return {};
    return {
      borderColor: COLORS.gold,
      shadowColor: COLORS.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: winnerPulse.value * 0.8,
      shadowRadius: winnerPulse.value * 14,
      elevation: winnerPulse.value * 10,
    };
  });

  // Build bot card sets: use allBotCards if provided, otherwise fall back to single botCards
  const botCardSets = allBotCards && allBotCards.some((bc) => bc.length > 0) ? allBotCards : botCards.length > 0 ? [botCards] : [];
  const multiBot = botCardSets.length > 1;

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
        isWinner && winnerPulseStyle,
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
            <View style={styles.potRow}>
              <Text style={styles.potLabel}>{potAmount}</Text>
              <View style={styles.potDot} />
            </View>
            {winner && <FloatingChips amount={potAmount} winner={winner} />}
          </View>
        </View>

        {/* Bot card rows — hidden during arrangement, shown during reveal */}
        {!isArrangement && botCardSets.map((botCardSet, botIdx) =>
          botCardSet.length > 0 ? (
            <View key={`bot-${botIdx}`} style={styles.cardRow}>
              <Text style={styles.rowLabel}>{multiBot ? `BOT${botIdx + 1}` : 'BOT'}</Text>
              {botCardSet.map((c) => (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={!revealed}
                  cardWidth={cw}
                  cardHeight={ch}
                  highlighted={botIdx === 0 && revealed && botHighlightIds.includes(c.id)}
                  dimmed={botIdx === 0 && revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
                  flipDuration={flipDuration}
                />
              ))}
              {revealed && (allBotHandNames?.[botIdx] || (botIdx === 0 && botHandName)) && (
                <Text style={[styles.handName, winner === 'bot' && styles.winnerHandName, { marginLeft: 4 }]}>
                  {allBotHandNames?.[botIdx] || botHandName}
                </Text>
              )}
            </View>
          ) : null
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
          {isArrangement && playerCards.length === 0 && onAutoFill && (
            <Pressable style={styles.autoBtn} onPress={onAutoFill}>
              <Text style={styles.autoBtnText}>AUTO</Text>
            </Pressable>
          )}
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
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={slotW} slotHeight={slotH} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-fill-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={slotW} slotHeight={slotH} />
            ))
          }
          {isArrangement && playerCards.length === CARDS_PER_BOARD && (
            <Text style={styles.hintText}>{getHandHint(playerCards)}</Text>
          )}
        </View>

        {winner && (
          <Animated.View style={[styles.winnerBadge, winner === 'player' ? styles.playerBadge : winner === 'bot' ? styles.botBadge : styles.tieBadge, bannerAnimStyle]}>
            <Text style={styles.winnerText}>
              {winner === 'player' ? 'WIN' : winner === 'bot' ? 'LOSE' : 'TIE'}
            </Text>
            {winner === 'player' && playerHandName ? (
              <Text style={styles.bannerHandName}>{playerHandName}</Text>
            ) : winner === 'bot' && botHandName ? (
              <Text style={styles.bannerHandName}>{botHandName}</Text>
            ) : null}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.boardBg,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  pressableInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  active: {
    borderColor: COLORS.gold,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  selected: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
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
    color: '#c8a84b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
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
  potRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '700',
  },
  potDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
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
    gap: 6,
    paddingVertical: 1,
  },
  communitySeparator: {
    width: 1,
    height: '80%',
    backgroundColor: COLORS.gold,
    opacity: 0.3,
    marginHorizontal: 3,
    alignSelf: 'center',
  },
  emptySlot: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#c8a84b55',
    borderStyle: 'dashed',
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dropTarget: {
    borderColor: '#c8a84b',
    borderWidth: 2,
  },
  plusText: {
    color: '#c8a84b88',
    fontSize: 16,
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
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: { elevation: 4 },
      default: {},
    }),
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  bannerHandName: {
    color: COLORS.background,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  autoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderWidth: 1,
    borderColor: '#c8a84b',
    marginRight: 4,
  },
  autoBtnText: {
    color: '#c8a84b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
