import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  useDerivedValue,
  FadeIn,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import CardComponent from '../components/Card';
import { Badge } from '../components/Badge';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, getBoardCount } from '../constants/gameConfig';
import { CardsDealtPayload } from '../constants/networkConfig';
import { playSound } from '../utils/sounds';

// Animation timing
const BOARD_STAGGER = 250;
const BOARD_FADE = 350;
const CHIPS_DELAY = 300;
const CHIPS_DURATION = 1000;
const BUTTONS_DELAY = 400;

export default function ResultsScreen() {
  const router = useRouter();
  const { width: SCREEN_W } = useWindowDimensions();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const revealData = useGameStore((s) => s.revealData);
  const clearRevealData = useGameStore((s) => s.clearRevealData);
  const incrementHandsPlayed = useGameStore((s) => s.incrementHandsPlayed);
  const updateBestChips = useGameStore((s) => s.updateBestChips);

  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const isMultiplayer = mpServer !== null || mpClient !== null;

  const [showButtons, setShowButtons] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [waitingForNextHand, setWaitingForNextHand] = useState(false);

  const chipCountProgress = useSharedValue(0);

  // Dynamic card sizing: fit 5 community cards + separator in available width
  // Available = screenWidth - container padding (32) - board padding (20) - separator (6)
  const availableW = SCREEN_W - 32 - 20 - 6;
  const CARD_W = Math.min(42, Math.max(28, Math.floor(availableW / 5.5)));
  const CARD_H = Math.round(CARD_W * 1.4);

  // Guard: no data → go home
  useEffect(() => {
    if (!revealData) {
      router.replace('/');
    }
  }, [revealData, router]);

  // Track stats + start animations
  useEffect(() => {
    if (!revealData) return;
    incrementHandsPlayed();
    updateBestChips();

    const lastBoardDelay = revealData.boardCount * BOARD_STAGGER;
    const chipsStart = lastBoardDelay + BOARD_FADE + CHIPS_DELAY;
    const buttonsShow = chipsStart + CHIPS_DURATION + BUTTONS_DELAY;

    chipCountProgress.value = withDelay(
      chipsStart,
      withTiming(1, { duration: CHIPS_DURATION, easing: Easing.out(Easing.cubic) })
    );

    const playerWon = revealData.netChips >= 0;
    const soundTimer = setTimeout(() => playSound(playerWon ? 'chipsWin' : 'lose'), chipsStart);
    const btnTimer = setTimeout(() => {
      if (revealData.isComplete && revealData.completeWinner) {
        setShowComplete(true);
      } else {
        setShowButtons(true);
      }
    }, buttonsShow);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(btnTimer);
    };
  }, []);

  const handleCompleteDone = useCallback(() => {
    setShowComplete(false);
    setShowButtons(true);
  }, []);

  const handleNextHand = useCallback(() => {
    if (!revealData) return;
    const boardCount = revealData.boardCount;

    // Multiplayer: request next hand via server/client
    if (isMultiplayer) {
      setWaitingForNextHand(true);

      const navigateToMpGame = (
        isHost: boolean,
        pIndex: number,
        pCount: number,
        yourCards: any[],
        boards: any[]
      ) => {
        clearRevealData();
        router.replace({
          pathname: '/multiplayer-game',
          params: {
            isHost: isHost ? 'true' : 'false',
            playerIndex: String(pIndex),
            playerCount: String(pCount),
            yourCards: JSON.stringify(yourCards),
            boards: JSON.stringify(boards),
          },
        } as any);
      };

      if (mpServer) {
        // Host: update callback, then request
        mpServer.updateCallbacks({
          onNewHandDealt: () => {
            const { boards: newBoards, playerHands } = mpServer.getDealtCards();
            const boardsData = newBoards.map((b: any, i: number) => ({
              boardIndex: i,
              openCards: b.openCards,
              closedCardCount: b.closedCards.length,
            }));
            const pCount = mpServer.getClients().filter((c: any) => c.connected).length;
            navigateToMpGame(true, 0, pCount, playerHands[0], boardsData);
          },
        });
        mpServer.requestNextHand(config);
      } else if (mpClient) {
        // Guest: update callback, then request
        const myId = mpClient.getPlayerId();
        const mySeat = connectedPlayers.find((p) => p.id === myId)?.seat ?? 1;
        mpClient.updateCallbacks({
          onCardsDealt: (data: CardsDealtPayload) => {
            navigateToMpGame(false, mySeat, data.playerCount, data.yourCards, data.boards);
          },
        });
        mpClient.sendNextHandRequest();
      }
      return;
    }

    // Single-player: navigate directly
    clearRevealData();
    if (chips >= config.potPerBoard * boardCount) {
      router.replace('/game');
    } else {
      router.replace('/gameover');
    }
  }, [revealData, chips, config, clearRevealData, router, isMultiplayer, mpServer, mpClient, connectedPlayers]);

  const handleHome = useCallback(() => {
    clearRevealData();
    router.replace('/');
  }, [clearRevealData, router]);

  const chipCountStyle = useAnimatedStyle(() => {
    const scale = chipCountProgress.value >= 0.95
      ? withTiming(1, { duration: 150 })
      : 0.9 + chipCountProgress.value * 0.1;
    return {
      transform: [{ scale }],
      opacity: chipCountProgress.value > 0 ? 1 : 0,
    };
  });

  if (!revealData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { boards, netChips, isComplete, completeBonusAmount, numberOfPlayers } = revealData;
  const playerWins = boards.filter((b) => b.winner === 'player').length;
  const botWins = boards.filter((b) => b.winner === 'bot').length;
  const potPerBoardTotal = revealData.potPerBoard * numberOfPlayers;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title + score */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.titleSection}>
          <Text style={styles.title}>RESULTS</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>YOU</Text>
              <Text style={[styles.scoreNum, { color: COLORS.neonGreen }]}>{playerWins}</Text>
            </View>
            <Text style={styles.scoreDivider}>{'\u2014'}</Text>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>{numberOfPlayers > 2 ? 'BOTS' : 'BOT'}</Text>
              <Text style={[styles.scoreNum, { color: COLORS.neonRed }]}>{botWins}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Board results — stacked vertically */}
        {boards.map((board, i) => {
          const chipResult = board.winner === 'player'
            ? `+${potPerBoardTotal}`
            : board.winner === 'bot'
            ? `-${potPerBoardTotal}`
            : '\u00b10';
          const chipColor = board.winner === 'player'
            ? COLORS.neonGreen
            : board.winner === 'bot'
            ? COLORS.neonRed
            : COLORS.textDim;
          const multiBot = board.allBotCards.length > 1;

          return (
            <Animated.View
              key={i}
              entering={FadeIn.duration(BOARD_FADE).delay(BOARD_STAGGER * (i + 1))}
              style={{ width: '100%' }}
            >
              <View style={[
                styles.boardCard,
                board.winner === 'player' && styles.boardCardWin,
                board.winner === 'bot' && styles.boardCardLose,
              ]}>
                {/* Header: BOARD X + badge + chip amount */}
                <View style={styles.boardHeader}>
                  <View style={styles.boardHeaderLeft}>
                    <Text style={styles.boardLabel}>BOARD {i + 1}</Text>
                    <Badge
                      label={board.winner === 'player' ? 'WIN' : board.winner === 'bot' ? 'LOSS' : 'TIE'}
                      variant={board.winner === 'player' ? 'win' : board.winner === 'bot' ? 'lose' : 'tie'}
                      small
                    />
                  </View>
                  <Text style={[styles.chipAmount, { color: chipColor }]}>{chipResult}</Text>
                </View>

                {/* Community cards — single centered row */}
                <View style={styles.cardsRow}>
                  {board.openCards.map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={CARD_W}
                      cardHeight={CARD_H}
                      highlighted={board.boardHighlightIds.includes(c.id)}
                      dimmed={!board.boardHighlightIds.includes(c.id) && board.boardHighlightIds.length > 0}
                    />
                  ))}
                  <View style={styles.cardSeparator} />
                  {board.closedCards.map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={CARD_W}
                      cardHeight={CARD_H}
                      highlighted={board.boardHighlightIds.includes(c.id)}
                      dimmed={!board.boardHighlightIds.includes(c.id) && board.boardHighlightIds.length > 0}
                    />
                  ))}
                </View>

                {/* Player hand row */}
                <View style={styles.handRowVertical}>
                  <Text style={[styles.handLabel, board.winner === 'player' && styles.handLabelWin]}>YOU</Text>
                  <View style={styles.cardsRow}>
                    {board.playerCards.map((c) => (
                      <CardComponent
                        key={c.id}
                        card={c}
                        faceDown={false}
                        cardWidth={CARD_W}
                        cardHeight={CARD_H}
                        highlighted={board.playerHighlightIds.includes(c.id)}
                        dimmed={!board.playerHighlightIds.includes(c.id) && board.playerHighlightIds.length > 0}
                      />
                    ))}
                    <Text style={[styles.handName, board.winner === 'player' && styles.handNameWin]}>
                      {board.playerHandName}
                    </Text>
                  </View>
                </View>

                {/* Bot hand rows — one per bot, stacked vertically */}
                {board.allBotCards.map((botCards, botIdx) =>
                  botCards.length > 0 ? (
                    <View key={`bot-${botIdx}`} style={styles.handRowVertical}>
                      <Text style={[styles.handLabel, board.winner === 'bot' && styles.handLabelLose]}>
                        {multiBot ? `BOT ${botIdx + 1}` : 'BOT'}
                      </Text>
                      <View style={styles.cardsRow}>
                        {botCards.map((c) => (
                          <CardComponent
                            key={c.id}
                            card={c}
                            faceDown={false}
                            cardWidth={CARD_W}
                            cardHeight={CARD_H}
                            highlighted={botIdx === 0 && board.botHighlightIds.includes(c.id)}
                            dimmed={botIdx === 0 && !board.botHighlightIds.includes(c.id) && board.botHighlightIds.length > 0}
                          />
                        ))}
                        <Text style={[styles.handName, board.winner === 'bot' && styles.handNameWin]}>
                          {board.allBotHandNames[botIdx] || board.botHandName}
                        </Text>
                      </View>
                    </View>
                  ) : null
                )}
              </View>
            </Animated.View>
          );
        })}

        {/* Complete bonus */}
        {isComplete && completeBonusAmount > 0 && (
          <Animated.View
            entering={FadeIn.duration(400).delay(boards.length * BOARD_STAGGER + BOARD_FADE)}
            style={styles.completeRow}
          >
            <Text style={styles.completeLabel}>COMPLETE BONUS!</Text>
            <Text style={styles.completeAmount}>+{completeBonusAmount}</Text>
          </Animated.View>
        )}

        {/* Net result */}
        <Animated.View
          style={styles.netSection}
          entering={FadeIn.duration(300).delay(boards.length * BOARD_STAGGER + BOARD_FADE + CHIPS_DELAY - 200)}
        >
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Result</Text>
            <Animated.View style={chipCountStyle}>
              <AnimatedChipCount profit={netChips} progress={chipCountProgress} />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Current balance */}
        <Animated.View
          entering={FadeIn.duration(300).delay(boards.length * BOARD_STAGGER + BOARD_FADE + CHIPS_DELAY)}
        >
          <ChipsDisplay amount={chips} label="Current Balance" size="large" />
        </Animated.View>

        {/* Buttons */}
        {showButtons && (
          <Animated.View style={styles.buttons} entering={FadeIn.duration(400)}>
            {waitingForNextHand ? (
              <View style={styles.waitingNextHand}>
                <Text style={styles.waitingNextHandText}>Waiting for other players...</Text>
              </View>
            ) : (
              <>
                <Button
                  title={chips >= config.potPerBoard * revealData.boardCount ? 'NEXT HAND' : 'GAME OVER'}
                  variant="gold"
                  onPress={handleNextHand}
                />
                <Button title="HOME" variant="secondary" onPress={handleHome} />
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Complete overlay */}
      {showComplete && revealData.completeWinner && (
        <CompleteOverlay
          winner={revealData.completeWinner}
          bonusAmount={revealData.completeBonusAmount}
          duration={revealData.completeBonusDisplay}
          onDone={handleCompleteDone}
        />
      )}
    </SafeAreaView>
  );
}

function AnimatedChipCount({
  profit,
  progress,
}: {
  profit: number;
  progress: SharedValue<number>;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  const updateDisplay = (val: number) => {
    setDisplayValue(val);
  };

  useDerivedValue(() => {
    const current = Math.round(progress.value * profit);
    runOnJS(updateDisplay)(current);
    return current;
  });

  const prefix = displayValue >= 0 ? '+' : '';
  const color = displayValue >= 0 ? COLORS.neonGreen : COLORS.neonRed;

  return (
    <Text style={[styles.netAmount, { color }]}>
      {prefix}{displayValue}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    alignItems: 'center',
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center' as const, width: '100%' },
      default: {},
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '800',
  },
  titleSection: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  scoreNum: {
    fontSize: 32,
    fontWeight: '900',
  },
  scoreDivider: {
    color: COLORS.textDim,
    fontSize: 18,
    marginTop: 10,
  },

  // Board card — vertical layout
  boardCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: 4,
  },
  boardCardWin: {
    borderColor: COLORS.neonGreen,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.neonGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  boardCardLose: {
    borderColor: COLORS.neonRed,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.neonRed,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  chipAmount: {
    fontSize: 15,
    fontWeight: '900',
  },

  // Cards row — centered, used for community + each hand
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  cardSeparator: {
    width: 4,
  },

  // Hand rows — stacked vertically (label + cards per row)
  handRowVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handLabel: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    width: 28,
  },
  handLabelWin: {
    color: COLORS.neonGreen,
  },
  handLabelLose: {
    color: COLORS.neonRed,
  },
  handName: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 4,
  },
  handNameWin: {
    color: COLORS.goldLight,
    fontWeight: '800',
  },

  // Complete bonus
  completeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 192, 64, 0.12)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  completeLabel: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  completeAmount: {
    color: COLORS.goldLight,
    fontSize: 20,
    fontWeight: '900',
  },

  // Net result
  netSection: {
    width: '100%',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  netLabel: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  netAmount: {
    fontSize: 28,
    fontWeight: '900',
  },

  // Buttons
  buttons: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  waitingNextHand: {
    backgroundColor: COLORS.feltLight,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    alignItems: 'center',
  },
  waitingNextHandText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
