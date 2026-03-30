/**
 * BoardReveal — full-screen dramatic board-by-board reveal.
 * ZERO Reanimated — uses RN Animated only (Card.tsx handles its own rotateY).
 * S53 sprint — replaces SafeRevealOverlay.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as AnimatedRN,
  Easing,
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
import { t, getLanguage } from '../utils/i18n';
import { useGameStore } from '../store/gameStore';
import { getTheme } from '../constants/visualThemes';
import GuidedTooltip from './GuidedTooltip';

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
  playerHighlightIds: string[];
  botHighlightIds: string[];
  boardHighlightIds: string[];
}

const SPEED_MULTIPLIER: Record<'fast' | 'normal' | 'cinematic', number> = {
  fast: 0.4,
  normal: 1.0,
  cinematic: 1.8,
};

const TIP = (en: string, he: string) => getLanguage() === 'he' ? he : en;
const REVEAL_TIPS = [
  () => TIP('Now see what your opponent has on each board.', 'עכשיו רואים מה יש ליריב על כל בורד.'),
  () => TIP('Each card changes the winning hand!', 'כל קלף יכול לשנות את התוצאה!'),
  () => TIP('Green = win, Red = loss. Watch for COMPLETE bonus!', 'ירוק = ניצחון, אדום = הפסד.'),
];

interface Props {
  boards: RevealBoard[];
  onDone: () => void;
  revealSpeed?: 'fast' | 'normal' | 'cinematic';
  isFirstGame?: boolean;
}

export default function BoardReveal({ boards, onDone, revealSpeed = 'normal', isFirstGame = false }: Props) {
  const { width: screenW } = useWindowDimensions();
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const visualTheme = useGameStore((s) => s.visualTheme);
  const revealBg = getTheme(visualTheme).background; // #1C0508 for Five-O, #0a0a0a for Classic
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Card face-down states — flop always visible, bot always visible (already revealed in game screen)
  // Only turn + river start hidden and flip during the dramatic reveal
  const [turnFaceDown, setTurnFaceDown] = useState(true);
  const [riverFaceDown, setRiverFaceDown] = useState(true);
  const [botFaceDown] = useState([false, false, false, false]); // S86: always open
  const [showHandNames, setShowHandNames] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // RN Animated — zero Reanimated
  const handNameOpacity = useRef(new AnimatedRN.Value(0)).current;
  const resultScale = useRef(new AnimatedRN.Value(0)).current;
  const hintOpacity = useRef(new AnimatedRN.Value(1)).current;
  // Per-bot-card scale for impact bounce on reveal (Hearthstone principle)
  const botCardScales = useRef([
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
  ]).current;

  // Chip counter — animates 0→potAmount on result reveal (useNativeDriver:false — text interp)
  const chipCounterAnim = useRef(new AnimatedRN.Value(0)).current;

  // Pre-flip pulse — group scale on bot cards before they flip (iterations:2)
  const botPulseScale = useRef(new AnimatedRN.Value(1)).current;

  // Community spotlight opacity — dims non-highlighted community cards after hand name
  const communitySpotlightOpacities = useRef([
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
  ]).current;

  // Player spotlight opacity — dims non-highlighted player cards
  const playerSpotlightOpacities = useRef([
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
  ]).current;

  // Bot spotlight opacity — dims non-highlighted bot cards
  const botSpotlightOpacities = useRef([
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
    new AnimatedRN.Value(1),
  ]).current;

  // Guided tooltip (tips 6-8) — only shown once per tip during first game on board 0
  const [revealTipText, setRevealTipText] = useState('');
  const [revealTipVisible, setRevealTipVisible] = useState(false);
  const revealTipShownRef = useRef<Set<number>>(new Set());

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
    setRevealTipVisible(false);
    setTurnFaceDown(false);
    setRiverFaceDown(false);
    // S86: botFaceDown is always [false,false,false,false] — no setter needed
    setShowHandNames(true);
    setShowResult(true);
    handNameOpacity.setValue(1);
    resultScale.setValue(1);
    hintOpacity.setValue(0);
    botCardScales.forEach(s => s.setValue(1));
    chipCounterAnim.setValue(0);
    botPulseScale.setValue(1);
    communitySpotlightOpacities.forEach(s => s.setValue(1));
    playerSpotlightOpacities.forEach(s => s.setValue(1));
    botSpotlightOpacities.forEach(s => s.setValue(1));
    // Skip: animate chip counter to final immediately
    const skipBoard = boards[currentIdxRef.current];
    if (skipBoard) chipCounterAnim.setValue(skipBoard.potAmount);
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
    // S86: bot cards NEVER reset to face-down — they're always visible in BoardReveal
    setShowHandNames(false);
    setShowResult(false);
    handNameOpacity.setValue(0);
    resultScale.setValue(0);
    hintOpacity.setValue(1);
    chipCounterAnim.setValue(0);
    botPulseScale.setValue(1);
    communitySpotlightOpacities.forEach(s => s.setValue(1));
    playerSpotlightOpacities.forEach(s => s.setValue(1));
    botSpotlightOpacities.forEach(s => s.setValue(1));
    botCardScales.forEach(s => s.setValue(1));

    // Speed multiplier — applied to all timeouts
    const sm = SPEED_MULTIPLIER[revealSpeed];
    const t = (ms: number) => Math.round(ms * sm);

    // 0ms — board appears: play tension sound
    playSound('revealStart');

    // S86: Bot cards already face-up. Only turn + river reveal with drama.
    // 800ms — flip turn card
    timers.current.push(setTimeout(() => {
      setTurnFaceDown(false);
      playSound('cardFlip');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    }, t(600)));   // S78: tighter turn flip (was 800ms)

    // 2300ms — flip river card (800ms turn + 1500ms dramatic pause)
    timers.current.push(setTimeout(() => {
      setRiverFaceDown(false);
      playSound('cardFlip');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    }, t(1100)));  // S78: tighter river (was 2300ms, 500ms gap after turn)

    // 2450ms — fade out hint
    timers.current.push(setTimeout(() => {
      const a = AnimatedRN.timing(hintOpacity, { toValue: 0, duration: t(400), useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, t(1200)));  // S78: hint fade after river (was 2450ms)

    // 2750ms — show hand names (fade in, both simultaneously)
    timers.current.push(setTimeout(() => {
      setShowHandNames(true);
      const a = AnimatedRN.timing(handNameOpacity, { toValue: 1, duration: t(300), useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, t(2400)));  // S78: hand names (was 2750ms)

    // 2950ms — community spotlight: dim non-highlighted cards
    timers.current.push(setTimeout(() => {
      const b = boards[currentIdxRef.current];
      if (!b) return;
      const allComm = [...b.openCards, ...b.closedCards];
      // Community: dim cards not in boardHighlightIds
      allComm.forEach((c, i) => {
        if (!b.boardHighlightIds.includes(c.id)) {
          const a = AnimatedRN.timing(communitySpotlightOpacities[i], {
            toValue: 0.35, duration: t(300), useNativeDriver: true,
          });
          anims.current.push(a);
          a.start();
        }
      });
      // Player: dim cards not in playerHighlightIds
      b.playerCards.forEach((c, i) => {
        if (!b.playerHighlightIds.includes(c.id)) {
          const a = AnimatedRN.timing(playerSpotlightOpacities[i], {
            toValue: 0.35, duration: t(300), useNativeDriver: true,
          });
          anims.current.push(a);
          a.start();
        }
      });
      // Bot: dim cards not in botHighlightIds
      b.botCards.forEach((c, i) => {
        if (!b.botHighlightIds.includes(c.id)) {
          const a = AnimatedRN.timing(botSpotlightOpacities[i], {
            toValue: 0.35, duration: t(300), useNativeDriver: true,
          });
          anims.current.push(a);
          a.start();
        }
      });
    }, t(2600)));  // S78: spotlight (was 2950ms)

    // 3350ms — show win/lose result (scale in) + chip counter animation
    timers.current.push(setTimeout(() => {
      setShowResult(true);
      const scaleAnim = AnimatedRN.spring(resultScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true });
      anims.current.push(scaleAnim);
      scaleAnim.start();
      // Chip counter: animate 0 → potAmount (useNativeDriver:false — text interpolation)
      const boardForResult = boards[currentIdxRef.current];
      if (boardForResult && boardForResult.winner !== 'tie') {
        const counterAnim = AnimatedRN.timing(chipCounterAnim, {
          toValue: boardForResult.potAmount,
          duration: t(800),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        anims.current.push(counterAnim);
        counterAnim.start();
      }
      // Play win/lose sound
      if (boardForResult?.winner === 'player') {
        playSound('boardWin');
        Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Success)?.catch?.(() => {});
      } else if (boardForResult?.winner === 'bot') {
        playSound('boardLose');
      }
    }, t(3000)));  // S78: result (was 3350ms)

    // WIN/LOSE badge visible from 3350ms; auto-advance at 12s (S86: was 5s — badge unreadable)
    timers.current.push(setTimeout(doAdvance, t(12000)));

    // S89: Show 'Tap to continue' hint after 4s of result showing (result at 3s, hint at 7s)
    timers.current.push(setTimeout(() => { setShowTapHint(true); }, t(7000)));

    // Guided first-game tooltips (tips 6-8) — only on board 0, only once each
    if (isFirstGame && currentIdxRef.current === 0) {
      if (!revealTipShownRef.current.has(6)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(6);
          setRevealTipText(REVEAL_TIPS[0]());
          setRevealTipVisible(true);
        }, t(400)));
      }
      if (!revealTipShownRef.current.has(7)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(7);
          setRevealTipVisible(false);
          setTimeout(() => { setRevealTipText(REVEAL_TIPS[1]()); setRevealTipVisible(true); }, 300);
        }, t(1000)));
      }
      if (!revealTipShownRef.current.has(8)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(8);
          setRevealTipVisible(false);
          setTimeout(() => { setRevealTipText(REVEAL_TIPS[2]()); setRevealTipVisible(true); }, 300);
        }, t(3550)));
      }
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      anims.current.forEach(a => a.stop());
      handNameOpacity.stopAnimation();
      resultScale.stopAnimation();
      hintOpacity.stopAnimation();
      botCardScales.forEach(s => s.stopAnimation());
      chipCounterAnim.stopAnimation();
      botPulseScale.stopAnimation();
      communitySpotlightOpacities.forEach(s => s.stopAnimation());
      playerSpotlightOpacities.forEach(s => s.stopAnimation());
      botSpotlightOpacities.forEach(s => s.stopAnimation());
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

  const resultColor = board.winner === 'player' ? '#2ecc71' : board.winner === 'bot' ? '#F44336' : '#fff';
  const tx = t();
  const resultText = board.winner === 'player' ? tx.youWin : board.winner === 'bot' ? tx.youLose : tx.tie;
  const chipSign = board.winner === 'player' ? '+' : board.winner === 'bot' ? '-' : '±';
  const chipColor = board.winner === 'player' ? COLORS.goldBright : board.winner === 'bot' ? '#F44336' : '#aaa';

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: revealBg }]}>
        <Pressable
          style={[styles.container, { backgroundColor: revealBg }]}
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
            {/* Pulse wrapper — group scale on all bot cards before flip (iterations:2) */}
            <AnimatedRN.View style={[styles.cardRow, { gap: handGap, transform: [{ scale: botPulseScale }] }]}>
              {board.botCards.map((c, i) => (
                <AnimatedRN.View
                  key={c.id}
                  style={{ transform: [{ scale: botCardScales[i] }], opacity: botSpotlightOpacities[i] }}
                >
                  <CardComponent
                    card={c}
                    faceDown={botFaceDown[i] ?? false}
                    flipDuration={300}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                  />
                </AnimatedRN.View>
              ))}
            </AnimatedRN.View>
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
                <AnimatedRN.View key={c.id} style={{ opacity: communitySpotlightOpacities[i] }}>
                  <CardComponent
                    card={c}
                    faceDown={i === 3 ? turnFaceDown : i === 4 ? riverFaceDown : false}
                    flipDuration={400}
                    cardWidth={commCardW}
                    cardHeight={commCardH}
                  />
                </AnimatedRN.View>
              ))}
            </View>
          </View>

          {/* Player cards — always face-up (player knows them) (bottom) */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelPlayer]}>{playerAvatar} {playerDisplayName.toUpperCase()}</Text>
            <View style={[styles.cardRow, { gap: handGap }]}>
              {board.playerCards.map((c, i) => (
                <AnimatedRN.View key={c.id} style={{ opacity: playerSpotlightOpacities[i] }}>
                  <CardComponent
                    card={c}
                    faceDown={false}
                    flipDuration={300}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                  />
                </AnimatedRN.View>
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
              {board.winner === 'tie' ? (
                <Text style={[styles.chipDelta, { color: chipColor }]}>±0</Text>
              ) : (
                <AnimatedRN.Text style={[styles.chipDelta, { color: chipColor }]}>
                  {chipCounterAnim.interpolate({
                    inputRange: [0, board.potAmount],
                    outputRange: [`${chipSign}0`, `${chipSign}${board.potAmount}`],
                    extrapolate: 'clamp',
                  })}
                </AnimatedRN.Text>
              )}
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

        {/* Guided first-game tooltips (tips 6-8) */}
        {isFirstGame && (
          <GuidedTooltip
            text={revealTipText}
            visible={revealTipVisible}
            onDismiss={() => setRevealTipVisible(false)}
            position="bottom"
          />
        )}
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
    backgroundColor: '#2ecc71',
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
