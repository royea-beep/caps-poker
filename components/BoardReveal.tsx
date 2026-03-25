/**
 * BoardReveal — full-screen dramatic board-by-board reveal.
 * ZERO Reanimated — uses RN Animated only (Card.tsx handles its own rotateY).
 * S53 sprint — replaces SafeRevealOverlay.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as AnimatedRN,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { playSound } from '../utils/sounds';
import { rf, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';
import { useGameStore } from '../store/gameStore';

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

interface RevealBoard {
  winner: 'player' | 'bot' | 'tie';
  playerHandName: string;
  botHandName: string;
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  potAmount: number;
}

interface Props {
  boards: RevealBoard[];
  onDone: () => void;
}

export default function BoardReveal({ boards, onDone }: Props) {
  const { width: screenW } = useWindowDimensions();
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Card face-down states — flop always visible, turn+river+bot start face-down
  const [turnFaceDown, setTurnFaceDown] = useState(true);
  const [riverFaceDown, setRiverFaceDown] = useState(true);
  const [botFaceDown, setBotFaceDown] = useState([true, true, true, true]);
  const [showHandNames, setShowHandNames] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // RN Animated — zero Reanimated
  const handNameOpacity = useRef(new AnimatedRN.Value(0)).current;
  const resultScale = useRef(new AnimatedRN.Value(0)).current;
  const hintOpacity = useRef(new AnimatedRN.Value(1)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const anims = useRef<AnimatedRN.CompositeAnimation[]>([]);

  const doAdvance = useCallback(() => {
    if (currentIdxRef.current + 1 >= boards.length) {
      onDoneRef.current();
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  }, [boards.length]);

  const handleSkip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    anims.current.forEach(a => a.stop());
    anims.current = [];
    setTurnFaceDown(false);
    setRiverFaceDown(false);
    setBotFaceDown([false, false, false, false]);
    setShowHandNames(true);
    setShowResult(true);
    handNameOpacity.setValue(1);
    resultScale.setValue(1);
    hintOpacity.setValue(0);
    Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    // Auto-advance after brief reading time
    timers.current.push(setTimeout(doAdvance, 800));
  }, [doAdvance]);

  useEffect(() => {
    // Reset for new board
    timers.current.forEach(clearTimeout);
    timers.current = [];
    anims.current.forEach(a => a.stop());
    anims.current = [];
    setTurnFaceDown(true);
    setRiverFaceDown(true);
    setBotFaceDown([true, true, true, true]);
    setShowHandNames(false);
    setShowResult(false);
    handNameOpacity.setValue(0);
    resultScale.setValue(0);
    hintOpacity.setValue(1);

    // 0ms — board appears: play tension sound
    playSound('revealStart');

    // 600ms — flip turn card
    timers.current.push(setTimeout(() => {
      setTurnFaceDown(false);
      playSound('cardFlip');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    }, 600));

    // 900ms — flip river card
    timers.current.push(setTimeout(() => {
      setRiverFaceDown(false);
      playSound('cardFlip');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    }, 900));

    // 1300ms — flip all bot cards + medium haptic
    timers.current.push(setTimeout(() => {
      setBotFaceDown([false, false, false, false]);
      playSound('cardFlip');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
    }, 1300));

    // 1500ms — fade out hint
    timers.current.push(setTimeout(() => {
      const a = AnimatedRN.timing(hintOpacity, { toValue: 0, duration: 400, useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, 1500));

    // 1600ms — show hand names (fade in)
    timers.current.push(setTimeout(() => {
      setShowHandNames(true);
      const a = AnimatedRN.timing(handNameOpacity, { toValue: 1, duration: 300, useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, 1600));

    // 2000ms — show win/lose result (scale in)
    timers.current.push(setTimeout(() => {
      setShowResult(true);
      const a = AnimatedRN.spring(resultScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true });
      anims.current.push(a);
      a.start();
      // Play win/lose sound at the same moment result appears
      const boardForSound = boards[currentIdxRef.current];
      if (boardForSound?.winner === 'player') {
        playSound('boardWin');
        Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Success)?.catch?.(() => {});
      } else if (boardForSound?.winner === 'bot') {
        playSound('boardLose');
      }
    }, 2000));

    // 3200ms — auto-advance
    timers.current.push(setTimeout(doAdvance, 3200));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      anims.current.forEach(a => a.stop());
      handNameOpacity.stopAnimation();
      resultScale.stopAnimation();
      hintOpacity.stopAnimation();
    };
  }, [currentIdx]);

  const board = boards[currentIdx];
  if (!board) return null;

  const allCommunity = [...board.openCards, ...board.closedCards];
  const totalBoards = boards.length;

  // Card sizing — maximize use of screen width
  const pad = 32;
  const commGap = 6;
  const commCardW = Math.min(62, Math.floor((screenW - pad - commGap * 4) / 5));
  const commCardH = Math.round(commCardW * 1.4);
  const handGap = 8;
  const handCardW = Math.min(70, Math.floor((screenW - pad - handGap * 3) / 4));
  const handCardH = Math.round(handCardW * 1.4);

  const resultColor = board.winner === 'player' ? '#4CAF50' : board.winner === 'bot' ? '#F44336' : '#fff';
  const tx = t();
  const resultText = board.winner === 'player' ? tx.youWin : board.winner === 'bot' ? tx.youLose : tx.tie;
  const chipDelta = board.winner === 'player'
    ? `+${board.potAmount}`
    : board.winner === 'bot'
    ? `-${board.potAmount}`
    : '±0';
  const chipColor = board.winner === 'player' ? COLORS.goldBright : board.winner === 'bot' ? '#F44336' : '#aaa';

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          style={styles.container}
          onPress={() => (showResult ? doAdvance() : handleSkip())}
        >
          {/* Header — board title + progress dots */}
          <View style={styles.header}>
            <Text style={styles.boardTitle}>{t().boardN(currentIdx + 1, totalBoards)}</Text>
            <View style={styles.dotsRow}>
              {Array.from({ length: totalBoards }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < currentIdx ? styles.dotDone : i === currentIdx ? styles.dotCurrent : styles.dotFuture,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Bot cards — face-down until revealed (top) */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelBot]}>BOT</Text>
            <View style={[styles.cardRow, { gap: handGap }]}>
              {board.botCards.map((c, i) => (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={botFaceDown[i] ?? false}
                  flipDuration={300}
                  cardWidth={handCardW}
                  cardHeight={handCardH}
                />
              ))}
            </View>
            {showHandNames && board.botHandName ? (
              <AnimatedRN.Text style={[styles.handNameBadge, { opacity: handNameOpacity }]}>
                {board.botHandName}
              </AnimatedRN.Text>
            ) : null}
          </View>

          {/* Community cards — flop face-up, turn+river flip in sequence (middle) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COMMUNITY</Text>
            <View style={[styles.cardRow, { gap: commGap }]}>
              {allCommunity.map((c, i) => (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={i === 3 ? turnFaceDown : i === 4 ? riverFaceDown : false}
                  flipDuration={400}
                  cardWidth={commCardW}
                  cardHeight={commCardH}
                />
              ))}
            </View>
          </View>

          {/* Player cards — always face-up (player knows them) (bottom) */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelPlayer]}>{playerAvatar} {playerDisplayName.toUpperCase()}</Text>
            <View style={[styles.cardRow, { gap: handGap }]}>
              {board.playerCards.map((c) => (
                <CardComponent
                  key={c.id}
                  card={c}
                  faceDown={false}
                  flipDuration={300}
                  cardWidth={handCardW}
                  cardHeight={handCardH}
                />
              ))}
            </View>
            {showHandNames && (
              <AnimatedRN.Text style={[styles.handNameBadge, styles.handNamePlayer, { opacity: handNameOpacity }]}>
                {board.playerHandName}
              </AnimatedRN.Text>
            )}
          </View>

          {/* Win/lose result — scale in after hand names */}
          {showResult ? (
            <AnimatedRN.View style={[styles.resultRow, { transform: [{ scale: resultScale }] }]}>
              <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
              <Text style={[styles.chipDelta, { color: chipColor }]}>{chipDelta}</Text>
            </AnimatedRN.View>
          ) : (
            <View style={styles.resultRowPlaceholder} />
          )}

          {/* Hint text */}
          {!showResult ? (
            <AnimatedRN.Text style={[styles.hint, { opacity: hintOpacity }]}>
              {t().tapToReveal}
            </AnimatedRN.Text>
          ) : (
            <Text style={styles.hint}>
              {currentIdx + 1 < totalBoards ? t().tapForNextBoard : '▶ TAP FOR RESULTS'}
            </Text>
          )}
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(16),
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: rs(10),
    paddingBottom: rs(4),
  },
  boardTitle: {
    color: COLORS.goldLight,
    fontSize: rf(22),
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: rs(10),
    alignItems: 'center',
  },
  dot: {
    width: rv(9),
    height: rv(9),
    borderRadius: rv(5),
  },
  dotDone: {
    backgroundColor: '#4CAF50',
  },
  dotCurrent: {
    backgroundColor: COLORS.gold,
    width: rv(11),
    height: rv(11),
    borderRadius: rv(6),
  },
  dotFuture: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    alignItems: 'center',
    gap: rs(6),
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionLabelPlayer: {
    color: 'rgba(76,175,80,0.7)',
  },
  sectionLabelBot: {
    color: 'rgba(244,67,54,0.6)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handNameBadge: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: rs(16),
    paddingVertical: rs(4),
    borderRadius: rv(8),
    overflow: 'hidden',
  },
  handNamePlayer: {
    color: COLORS.goldLight,
  },
  resultRow: {
    alignItems: 'center',
    gap: rs(4),
  },
  resultRowPlaceholder: {
    height: rs(56),
  },
  resultText: {
    fontSize: rf(24),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  chipDelta: {
    fontSize: rf(32),
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(11),
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
