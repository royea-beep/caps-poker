import React, { useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import CardComponent from './Card';
import { COLORS, Card } from '../constants/gameConfig';
import { RevealBoardData } from '../types/gameTypes';
import { playSound } from '../utils/sounds';
import { useSimpleReveal } from '../hooks/useSimpleReveal';

// Lazy haptics — never crash on web
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {}
}

function haptic() {
  if (!Haptics) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
}

// ─── Main component ────────────────────────────────────────────────────────────
interface RevealSequenceProps {
  boards: RevealBoardData[];
  visible: boolean;
  onDone: () => void;
}

export default function RevealSequence({ boards, visible, onDone }: RevealSequenceProps) {
  const { width: screenW } = useWindowDimensions();
  const contentW = Math.min(screenW, 680) - 40;
  const commCardW = Math.min(76, Math.floor((contentW - 4 * 6) / 5));
  const commCardH = Math.round(commCardW / 0.7);
  const handCardW = Math.min(60, Math.floor((contentW - 3 * 4) / 4.5));
  const handCardH = Math.round(handCardW / 0.7);

  const { boardIdx, phase, startReveal, skipAll, goNext } = useSimpleReveal(
    boards.length,
    onDone,
  );

  // Shared values for winner banner only — no complex animation chain
  const winnerScale   = useSharedValue(0);
  const winnerOpacity = useSharedValue(0);
  const ctaOpacity    = useSharedValue(0);

  const winnerAnimStyle = useAnimatedStyle(() => ({
    opacity:   winnerOpacity.value,
    transform: [{ scale: winnerScale.value }],
  }));
  const ctaAnimStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  // Start reveal when modal becomes visible
  useEffect(() => {
    if (visible && boards.length > 0) {
      startReveal();
    }
  }, [visible]);

  // Sound + haptic on phase transitions
  useEffect(() => {
    if (phase === 'turn' || phase === 'river') {
      haptic();
      try { playSound('cardFlip'); } catch {}
    }
  }, [phase]);

  // Winner banner animation
  useEffect(() => {
    if (phase === 'winner') {
      winnerScale.value = 0;
      winnerOpacity.value = 0;
      winnerScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      winnerOpacity.value = withTiming(1, { duration: 200 });
      ctaOpacity.value = withTiming(1, { duration: 400 });
    } else {
      winnerScale.value = 0;
      winnerOpacity.value = 0;
      ctaOpacity.value = 0;
    }
  }, [phase]);

  // Reset banner on board change
  useEffect(() => {
    winnerScale.value   = 0;
    winnerOpacity.value = 0;
    ctaOpacity.value    = 0;
  }, [boardIdx]);

  if (!visible || boards.length === 0) return null;

  // Safe board access
  const board: RevealBoardData | undefined = boards[boardIdx];
  if (!board) return null;

  const closedCards  = board.closedCards ?? [];
  const turnCard     = closedCards[0] as Card | undefined;
  const riverCard    = closedCards[1] as Card | undefined;
  const turnRevealed  = phase === 'turn' || phase === 'river' || phase === 'winner';
  const riverRevealed = phase === 'river' || phase === 'winner';
  const allRevealed   = riverRevealed || (turnRevealed && !riverCard);
  const showWinner    = phase === 'winner';
  const canTap        = showWinner;

  const winnerColor = board.winner === 'player' ? COLORS.neonGreen
    : board.winner === 'bot' ? COLORS.neonRed
    : COLORS.textSecondary;
  const winnerLabel = board.winner === 'player' ? 'YOU WIN'
    : board.winner === 'bot' ? 'BOT WINS'
    : 'TIE';

  const allBotCards = board.allBotCards ?? [];
  const multiBot    = allBotCards.length > 1;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={canTap ? goNext : undefined}>
        <View style={styles.screen}>

          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <Text style={styles.boardTitle}>
              BOARD {boardIdx + 1}{' '}
              <Text style={styles.boardSub}>of {boards.length}</Text>
            </Text>
            <Pressable style={styles.skipBtn} onPress={skipAll} hitSlop={16}>
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          </View>

          {/* ── Table layout: bot top / community middle / player bottom ── */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>

              {/* BOT section */}
              <View style={styles.botSection}>
                <Text style={[
                  styles.sectionLabel,
                  board.winner === 'bot' ? styles.winnerLabel : null,
                ]}>
                  {multiBot ? 'BOTS' : 'BOT'}
                </Text>
                {allBotCards.map((botCards, botIdx) =>
                  botCards && botCards.length > 0 ? (
                    <View key={`bot-${botIdx}`} style={styles.handRow}>
                      {botCards.map((c) => (
                        <CardComponent
                          key={c.id}
                          card={c}
                          faceDown={false}
                          cardWidth={handCardW}
                          cardHeight={handCardH}
                          highlighted={allRevealed && (board.botHighlightIds ?? []).includes(c.id)}
                          dimmed={allRevealed && !(board.botHighlightIds ?? []).includes(c.id) && (board.botHighlightIds ?? []).length > 0}
                        />
                      ))}
                      {allRevealed && ((board.allBotHandNames ?? [])[botIdx] || (botIdx === 0 && board.botHandName)) && (
                        <Text style={styles.handName}>
                          {(board.allBotHandNames ?? [])[botIdx] || board.botHandName}
                        </Text>
                      )}
                    </View>
                  ) : null
                )}
              </View>

              <View style={styles.divider} />

              {/* Community cards */}
              <View style={styles.communitySection}>
                <Text style={styles.communityLabel}>
                  {!turnRevealed ? 'FLOP' : !riverRevealed ? 'TURN' : 'RIVER'}
                </Text>
                <View style={styles.communityRow}>
                  {(board.openCards ?? []).map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={commCardW}
                      cardHeight={commCardH}
                      highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(c.id)}
                      dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
                    />
                  ))}
                  {turnCard && (
                    <CardComponent
                      card={turnCard}
                      faceDown={!turnRevealed}
                      cardWidth={commCardW}
                      cardHeight={commCardH}
                      flipDuration={350}
                      highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(turnCard.id)}
                      dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(turnCard.id) && (board.boardHighlightIds ?? []).length > 0}
                    />
                  )}
                  {riverCard && (
                    <CardComponent
                      card={riverCard}
                      faceDown={!riverRevealed}
                      cardWidth={commCardW}
                      cardHeight={commCardH}
                      flipDuration={350}
                      highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(riverCard.id)}
                      dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(riverCard.id) && (board.boardHighlightIds ?? []).length > 0}
                    />
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              {/* YOU section */}
              <View style={styles.playerSection}>
                <Text style={[
                  styles.sectionLabel,
                  board.winner === 'player' ? styles.winnerLabel : null,
                ]}>
                  YOU
                </Text>
                <View style={styles.handRow}>
                  {(board.playerCards ?? []).map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={handCardW}
                      cardHeight={handCardH}
                      highlighted={allRevealed && (board.playerHighlightIds ?? []).includes(c.id)}
                      dimmed={allRevealed && !(board.playerHighlightIds ?? []).includes(c.id) && (board.playerHighlightIds ?? []).length > 0}
                    />
                  ))}
                  {board.playerHandName && allRevealed && (
                    <Text style={styles.handName}>{board.playerHandName}</Text>
                  )}
                </View>
              </View>

            </View>
          </View>

          {/* ── Footer: winner banner + CTA ── */}
          <View style={styles.footer}>
            {showWinner && (
              <Animated.View style={[styles.winnerBanner, { borderColor: winnerColor }, winnerAnimStyle]}>
                <Text style={[styles.winnerText, { color: winnerColor }]}>{winnerLabel}</Text>
              </Animated.View>
            )}
            <Animated.View style={ctaAnimStyle}>
              <Text style={styles.ctaText}>
                {boardIdx + 1 < boards.length ? 'TAP TO CONTINUE →' : 'TAP TO SEE RESULTS →'}
              </Text>
            </Animated.View>
          </View>

        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boardTitle: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  boardSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skipText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 680,
  },
  botSection: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  communitySection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playerSection: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 6,
    width: '100%',
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  winnerLabel: { color: COLORS.neonGreen },
  communityLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: 100,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    minHeight: 80,
  },
  winnerBanner: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  winnerText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
  },
  ctaText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.8,
  },
});
