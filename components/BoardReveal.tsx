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
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardComponent from './Card';
import { WEB_MAX_WIDTH } from './WebContainer';
import { Card, COLORS } from '../constants/gameConfig';
import { playSound } from '../utils/sounds';
import { rf, rs, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import { getHandName, getSpecificHandName, getComparisonText } from '../utils/handNames';
import { useGameStore } from '../store/gameStore';
import { useGameColors } from '../utils/useGameColors';
import { getTheme } from '../constants/visualThemes';
import GuidedTooltip from './GuidedTooltip';
import { FloatingChips } from './FloatingChips';
import { HandBadge } from './HandBadge';
import { HAND_RANK, BIG_HANDS } from '../utils/handColors';

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

interface RevealBoard {
  winner: 'player' | 'bot' | 'tie';
  playerHandName: string;
  botHandName: string;
  allBotHandNames?: string[];
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  allBotCards?: Card[][];
  potAmount: number;
  playerHighlightIds: string[];
  botHighlightIds: string[];
  boardHighlightIds: string[];
  playerBestCards?: Card[];
  botBestCards?: Card[];
}

const SPEED_MULTIPLIER: Record<'fast' | 'normal' | 'cinematic', number> = {
  fast: 0.4,
  normal: 1.0,
  cinematic: 1.8,
};

// VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — English-only.
const REVEAL_TIPS = [
  () => 'Now see what your opponent has on each board.',
  () => 'Each card changes the winning hand!',
  () => 'Green = win, Red = loss. Watch for COMPLETE bonus!',
];

function getScoreText(pWins: number, bWins: number, idx: number, total: number): string {
  const remaining = total - idx;
  if (pWins > bWins) return `Leading ${pWins}-${bWins} · ${remaining} left`;
  if (bWins > pWins) return `Trailing ${pWins}-${bWins} · ${remaining} left`;
  if (pWins === 0 && bWins === 0) return `${remaining} boards`;
  return `Tied ${pWins}-${bWins} · ${remaining} left`;
}

interface Props {
  boards: RevealBoard[];
  onDone: () => void;
  revealSpeed?: 'fast' | 'normal' | 'cinematic';
  isFirstGame?: boolean;
  /** OTA-COSMETIC-FIXES — practice is XP-only, no chips actually move; hide the coin/± chip UI. */
  isPractice?: boolean;
}

export default function BoardReveal({ boards, onDone, revealSpeed = 'normal', isFirstGame = false, isPractice = false }: Props) {
  // BB1 — the app renders inside WebContainer, hard-capped at WEB_MAX_WIDTH (430) on web.
  // useWindowDimensions() reports the RAW browser window, so on desktop every size derived from
  // it was computed for a column that does not exist: the `commOverlap` term below asks whether
  // 5 cards exceed the WINDOW when they actually have to fit the 430px COLUMN, so it collapsed
  // to 0 and the cards rendered at full size with no fan-compression — measured 261x330 spanning
  // 1193px inside a 430px column at a 1706px window (~70% of the screen). Clamping the SOURCE is
  // identity below 430, so it cannot change anything on phones. Same clamp as results.tsx,
  // PlayerHand.tsx and both lobbies. NOT a scale cap — do not "improve" it into one.
  const { width: rawW } = useWindowDimensions();
  const screenW = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '👤';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const opponentName = useGameStore((s) => s.opponentName);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const revealBg = getTheme(visualTheme).background; // #161922 for Five-O, #0a0a0a for Classic
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Card face-down states — S110: flop starts hidden, reveals dramatically at t(300)
  const [flopFaceDown, setFlopFaceDown] = useState(true);
  const [turnFaceDown, setTurnFaceDown] = useState(true);
  const [riverFaceDown, setRiverFaceDown] = useState(true);
  const [botFaceDown] = useState([false, false, false, false]); // S86: always open
  const [showHandNames, setShowHandNames] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const [showChipsAnim, setShowChipsAnim] = useState(false);
  const [showCompleteFlash, setShowCompleteFlash] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [showWinHighlight, setShowWinHighlight] = useState(false);
  const [showIntermission, setShowIntermission] = useState(false);
  // Progress bar: 1→0 over remaining time after result (useNativeDriver:false — width)
  const advanceProgress = useRef(new AnimatedRN.Value(1)).current;
  // River squeeze: scaleY 1→0.08→1 (useNativeDriver:true)
  const riverSqueezeAnim = useRef(new AnimatedRN.Value(1)).current;

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
  // Chip fade-in — fades in chip amount after counter animation starts (useNativeDriver:true)
  const chipFadeIn = useRef(new AnimatedRN.Value(0)).current;
  // Screen flash — gold overlay on COMPLETE (useNativeDriver:true)
  const screenFlashAnim = useRef(new AnimatedRN.Value(0)).current;
  // VAMOS-FIX-REVEAL-TRANSITION 2026-06-17 — was a translateX slide that took
  // the outgoing board fully OFF screen (toValue: -screenW, 260ms) before the
  // incoming board sprang in from +screenW → entire screen was empty/black
  // mid-transition. Replaced with a crossfade in place. Content swap happens
  // at opacity≈0, total ~360ms, never empty for more than a single frame.
  const boardOpacity = useRef(new AnimatedRN.Value(1)).current;

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
      return;
    }
    playSound('boardTransition');
    // VAMOS-FIX-REVEAL-TRANSITION-V2 2026-06-17 — INSTANT swap (option B).
    // The prior crossfade still passed through opacity 0 → user perceived
    // a blank/black flash. No animation = no possible blank frame. Board
    // header text alone signals the change. boardOpacity stays at 1 always.
    setCurrentIdx(prev => prev + 1);
  }, [boards.length, screenW]);

  const handleSkip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    anims.current.forEach(a => a.stop());
    anims.current = [];
    setRevealTipVisible(false);
    setFlopFaceDown(false);
    setTurnFaceDown(false);
    setRiverFaceDown(false);
    boardOpacity.setValue(1);
    // S86: botFaceDown is always [false,false,false,false] — no setter needed
    setShowHandNames(true);
    setShowResult(true);
    setShowTapHint(true); // Skip: show hint immediately
    handNameOpacity.setValue(1);
    resultScale.setValue(1);
    hintOpacity.setValue(0);
    botCardScales.forEach(s => s.setValue(1));
    chipCounterAnim.setValue(0);
    chipFadeIn.setValue(0);
    screenFlashAnim.setValue(0);
    setShowChipsAnim(false);
    setShowCompleteFlash(false);
    setShowWinHighlight(true);
    setShowIntermission(false);
    riverSqueezeAnim.setValue(1);
    botPulseScale.setValue(1);
    communitySpotlightOpacities.forEach(s => s.setValue(1));
    playerSpotlightOpacities.forEach(s => s.setValue(1));
    botSpotlightOpacities.forEach(s => s.setValue(1));
    // Skip: animate chip counter to final immediately
    const skipBoard = boards[currentIdxRef.current];
    if (skipBoard) {
      chipCounterAnim.setValue(skipBoard.potAmount);
      if (skipBoard.potAmount > 0 && skipBoard.winner !== 'tie') chipFadeIn.setValue(1);
    }
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
    setFlopFaceDown(true);
    setTurnFaceDown(true);
    setRiverFaceDown(true);
    // S86: bot cards NEVER reset to face-down — they're always visible in BoardReveal
    setShowHandNames(false);
    setShowResult(false);
    setShowTapHint(false);
    setShowChipsAnim(false);
    setShowCompleteFlash(false);
    setShowProgressBar(false);
    setShowWinHighlight(false);
    setShowIntermission(false);
    advanceProgress.setValue(1);
    riverSqueezeAnim.setValue(1);
    handNameOpacity.setValue(0);
    resultScale.setValue(0);
    hintOpacity.setValue(1);
    chipCounterAnim.setValue(0);
    chipFadeIn.setValue(0);
    screenFlashAnim.setValue(0);
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

    // S110: Staged community reveal — Flop → Turn → River with dramatic pauses
    // t(300)  — Flop: flip cards 0,1,2 together (3 rapid sounds, 50ms apart)
    timers.current.push(setTimeout(() => {
      setFlopFaceDown(false);
      playSound('cardFlip');
      setTimeout(() => playSound('cardFlip'), 50);
      setTimeout(() => playSound('cardFlip'), 100);
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    }, t(300)));

    // t(1600) — Turn: flip card 3 with distinct turnReveal sound
    timers.current.push(setTimeout(() => {
      setTurnFaceDown(false);
      playSound('turnReveal');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
    }, t(1600)));

    // t(2800) — River SQUEEZE: scaleY 1→0.08→1 (dramatic peel before flip)
    timers.current.push(setTimeout(() => {
      const squeezeAnim = AnimatedRN.sequence([
        AnimatedRN.timing(riverSqueezeAnim, {
          toValue: 0.08, duration: t(250), easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
        AnimatedRN.spring(riverSqueezeAnim, {
          toValue: 1, tension: 120, friction: 7, useNativeDriver: true,
        }),
      ]);
      anims.current.push(squeezeAnim);
      squeezeAnim.start();
    }, t(2800)));

    // t(3000) — fade out hint
    timers.current.push(setTimeout(() => {
      const a = AnimatedRN.timing(hintOpacity, { toValue: 0, duration: t(400), useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, t(3000)));

    // t(3300) — River FLIP reveal (after squeeze completes)
    timers.current.push(setTimeout(() => {
      setRiverFaceDown(false);
      playSound('riverReveal');
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
    }, t(3300)));

    // t(3600) — show hand names + win highlight (gold glow on winning cards)
    timers.current.push(setTimeout(() => {
      setShowHandNames(true);
      setShowWinHighlight(true);
      const a = AnimatedRN.timing(handNameOpacity, { toValue: 1, duration: t(300), useNativeDriver: true });
      anims.current.push(a);
      a.start();
    }, t(3600)));

    // t(3700) — community spotlight: dim non-highlighted cards
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
      // Bot: dim cards not in botHighlightIds — 0.55 for legibility
      b.botCards.forEach((c, i) => {
        if (!b.botHighlightIds.includes(c.id)) {
          const a = AnimatedRN.timing(botSpotlightOpacities[i], {
            toValue: 0.55, duration: t(300), useNativeDriver: true,
          });
          anims.current.push(a);
          a.start();
        }
      });
    }, t(3700)));

    // t(4100) — show win/lose result (scale in) + chip counter animation
    timers.current.push(setTimeout(() => {
      setShowResult(true);
      const scaleAnim = AnimatedRN.spring(resultScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true });
      anims.current.push(scaleAnim);
      scaleAnim.start();
      // Chip counter: animate 0 → potAmount (useNativeDriver:false — text interpolation)
      const boardForResult = boards[currentIdxRef.current];
      if (boardForResult && boardForResult.winner !== 'tie' && boardForResult.potAmount > 0) {
        const counterAnim = AnimatedRN.timing(chipCounterAnim, {
          toValue: boardForResult.potAmount,
          duration: t(800),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        anims.current.push(counterAnim);
        counterAnim.start();
        // Fade in chip amount alongside counter
        const fadeAnim = AnimatedRN.timing(chipFadeIn, {
          toValue: 1,
          duration: t(500),
          useNativeDriver: true,
        });
        anims.current.push(fadeAnim);
        fadeAnim.start();
      }
      // Play win/lose sound
      if (boardForResult?.winner === 'player') {
        playSound('boardWin');
        Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Success)?.catch?.(() => {});
      } else if (boardForResult?.winner === 'bot') {
        playSound('boardLose');
      }
      // COMPLETE moment — last board + all boards won by player
      const isLastBoard = currentIdxRef.current === boards.length - 1;
      const wasComplete = boards.every(b => b.winner === 'player');
      if (isLastBoard && wasComplete) {
        setTimeout(() => {
          playSound('complete');
          Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Success)?.catch?.(() => {});
          setShowCompleteFlash(true);
          const flashAnim = AnimatedRN.sequence([
            AnimatedRN.timing(screenFlashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            AnimatedRN.timing(screenFlashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]);
          anims.current.push(flashAnim);
          flashAnim.start(() => setShowCompleteFlash(false));
        }, 300);
      }
    }, t(4100)));

    // VAMOS-FIX-PREREPORT-DELAY 2026-06-17 — the LAST board's auto-advance
    // used to fire at t(14000) like every other board, leaving ~9.9s of
    // dead wait after the result was visible (at t(4100)) before the
    // results screen rendered. User perceived "stuck after last board."
    // Per-board pacing for non-last boards is intentional (read result,
    // tap or wait). For the LAST board we collapse the wait — result is
    // visible at t(4100), then onDone fires ~1.5s later. The user sees the
    // result, the COMPLETE flash if any, then the report.
    const isLastBoard = currentIdxRef.current === boards.length - 1;
    const advanceMs = isLastBoard ? t(5600) : t(14000);
    const progressMs = advanceMs - t(4100);

    // S114: Progress bar — starts with result at t(4100), depletes over remaining time to auto-advance
    timers.current.push(setTimeout(() => {
      setShowProgressBar(true);
      const progressAnim = AnimatedRN.timing(advanceProgress, {
        toValue: 0,
        duration: progressMs,
        useNativeDriver: false,
      });
      anims.current.push(progressAnim);
      progressAnim.start();
    }, t(4100)));

    // t(4500) — Board Score Intermission overlay (shows for 1.5s) — skip on last board (no next board to preview)
    if (!isLastBoard) {
      timers.current.push(setTimeout(() => {
        setShowIntermission(true);
        timers.current.push(setTimeout(() => setShowIntermission(false), t(1500)));
      }, t(4500)));
    }

    // FloatingChips — 800ms after result reveal
    timers.current.push(setTimeout(() => {
      const b = boards[currentIdxRef.current];
      if (b && b.potAmount > 0 && b.winner !== 'tie') {
        setShowChipsAnim(true);
      }
    }, t(4900)));

    // Auto-advance — 14s for normal boards, ~5.6s for the last board (see comment above)
    timers.current.push(setTimeout(doAdvance, advanceMs));

    // Show 'Tap to continue' hint after intermission clears — only when there's room before auto-advance
    if (!isLastBoard) {
      timers.current.push(setTimeout(() => { setShowTapHint(true); }, t(6200)));
    }

    // Guided first-game tooltips (tips 6-8) — only on board 0, only once each
    if (isFirstGame && currentIdxRef.current === 0) {
      if (!revealTipShownRef.current.has(6)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(6);
          setRevealTipText(REVEAL_TIPS[0]());
          setRevealTipVisible(true);
        }, t(500)));
      }
      if (!revealTipShownRef.current.has(7)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(7);
          setRevealTipVisible(false);
          setTimeout(() => { setRevealTipText(REVEAL_TIPS[1]()); setRevealTipVisible(true); }, 300);
        }, t(1800)));
      }
      if (!revealTipShownRef.current.has(8)) {
        timers.current.push(setTimeout(() => {
          revealTipShownRef.current.add(8);
          setRevealTipVisible(false);
          setTimeout(() => { setRevealTipText(REVEAL_TIPS[2]()); setRevealTipVisible(true); }, 300);
        }, t(4600)));
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
      chipFadeIn.stopAnimation();
      screenFlashAnim.stopAnimation();
      boardOpacity.stopAnimation();
      botPulseScale.stopAnimation();
      communitySpotlightOpacities.forEach(s => s.stopAnimation());
      playerSpotlightOpacities.forEach(s => s.stopAnimation());
      botSpotlightOpacities.forEach(s => s.stopAnimation());
      riverSqueezeAnim.stopAnimation();
    };
  }, [currentIdx]);

  const gameColors = useGameColors();
  const board = boards[currentIdx];
  if (!board) return null;

  const allCommunity = [...board.openCards, ...board.closedCards];
  const totalBoards = boards.length;

  // S110: Running score from completed boards
  const playerWins = boards.slice(0, currentIdx).filter(b => b.winner === 'player').length;
  const botWins = boards.slice(0, currentIdx).filter(b => b.winner === 'bot').length;

  // Card sizing — maximize use of screen width
  const pad = 32;
  const handGap = 8;
  const handCardW = Math.min(70, Math.floor((screenW - pad - handGap * 3) / 4));
  const handCardH = Math.round(handCardW * 1.4);

  // MP-PARITY-DEEP 2026-07-09 — owner design call: community cards are the visual focus
  // of the reveal moment, so they render deliberately LARGER than hand cards (+10pt)
  // rather than smaller. 5 community cards can't out-size 4 hand cards side-by-side in
  // the same width without shrinking below hand size on narrow phones (the old 62-vs-70
  // cap did exactly that) — so instead of a gap, community cards OVERLAP like a fanned
  // hand. The frame border (styles.commCardFrame, added at the wrapper below) keeps each
  // card visually distinct even where it overlaps its neighbor. On wide screens the
  // overlap shrinks toward 0 automatically; it never goes negative-into-overflow since
  // it's clamped at 0.
  const commCardW = handCardW + 10;
  const commCardH = Math.round(commCardW * 1.4);
  // RN's flexbox `gap` can't go negative, so overlap is applied per-card via marginLeft
  // (see the community card map below) instead of a row-level gap.
  const commOverlap = Math.max(0, Math.round((commCardW * 5 - (screenW - pad)) / 4));

  const resultColor = board.winner === 'player' ? gameColors.win : board.winner === 'bot' ? gameColors.lose : '#fff';
  const tx = t();
  const lang = getLanguage() === 'he' ? 'he' : 'en';
  const resultText = board.winner === 'player' ? tx.youWin : board.winner === 'bot' ? tx.youLose : tx.tie;
  const chipSign = board.winner === 'player' ? '+' : board.winner === 'bot' ? '-' : '±';
  const chipColor = board.winner === 'player' ? COLORS.goldBright : board.winner === 'bot' ? gameColors.lose : '#aaa';
  // S114: narrow loss detection (rank diff ≤1)
  const playerRank = HAND_RANK[board.playerHandName] ?? 0;
  const botRank = HAND_RANK[board.botHandName] ?? 0;
  const isNarrowLoss = board.winner === 'bot' && botRank - playerRank <= 1;
  // S114: big win triggers Share button
  const isBigWin = board.winner === 'player' && BIG_HANDS.includes(board.playerHandName);
  const isComplete = boards.every(b => b.winner === 'player') && currentIdx === boards.length - 1;
  const showShare = isBigWin || isComplete;

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: revealBg }]}>
        <Pressable
          style={[styles.container, { backgroundColor: revealBg }]}
          onPress={() => (showResult ? doAdvance() : handleSkip())}
        >
          {/* S110: Animated content wrapper — slides on board transition */}
          <AnimatedRN.View style={[styles.boardContent, { opacity: boardOpacity }]}>

          {/* Header — board number (BIG) + score indicator + smart dots */}
          <View style={styles.header}>
            <Text style={styles.scoreIndicator}>{getScoreText(playerWins, botWins, currentIdx, totalBoards)}</Text>
            <Text style={styles.boardNumber}>Board {currentIdx + 1}</Text>
            <View style={styles.dotsRow}>
              {Array.from({ length: totalBoards }).map((_, i) => {
                const isDone = i < currentIdx;
                const isCurrent = i === currentIdx;
                const dotColor = isCurrent ? '#fff'
                  : isDone && boards[i].winner === 'player' ? gameColors.win
                  : isDone && boards[i].winner === 'bot' ? gameColors.lose
                  : isDone ? '#aaa'
                  : 'rgba(255,255,255,0.2)';
                const dotSize = isCurrent ? rv(11) : rv(8);
                return (
                  <View key={i} style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor }]} />
                );
              })}
            </View>
          </View>

          {/* Bot cards — show all bots if allBotCards available, else fall back to single botCards */}
          {(board.allBotCards && board.allBotCards.length > 1 ? board.allBotCards : [board.botCards]).map((botHand, botIdx) => {
            const isFirstBot = botIdx === 0;
            // FIX-MP-REVEAL-ANIMATION 2026-07-06 — this label rendered "🤖 Bot" even for a
            // real human opponent in MP (opponentName is already threaded through for the
            // winner banner below, just never reached this per-board section header). Scoped
            // to the primary opponent slot since that covers 2P MP (the only mode verified on
            // real devices); 3P/4P MP would need per-seat names, which RevealBoardData doesn't
            // carry today.
            const botLabel = board.allBotCards && board.allBotCards.length > 1
              ? `🤖 Bot ${botIdx + 1}`
              : (isFirstBot && opponentName ? opponentName : '🤖 Bot');
            const rawBotHandName = board.allBotHandNames?.[botIdx] ?? (isFirstBot ? board.botHandName : '');
            const botHandName = getHandName(rawBotHandName, lang);
            return (
              <View key={`bot-${botIdx}`} style={styles.section}>
                <Text style={[styles.sectionLabel, styles.sectionLabelBot]}>{botLabel}</Text>
                {/* First bot uses animated pulse; additional bots rendered without animation */}
                {isFirstBot ? (
                  <AnimatedRN.View style={[styles.cardRow, { gap: handGap, transform: [{ scale: botPulseScale }] }]}>
                    {botHand.map((c, i) => (
                      <AnimatedRN.View
                        key={c.id}
                        style={{ transform: [{ scale: botCardScales[i] }], opacity: botSpotlightOpacities[i] }}
                      >
                        <CardComponent card={c} owner="bot" faceDown={botFaceDown[i] ?? false} flipDuration={300} cardWidth={handCardW} cardHeight={handCardH} />
                      </AnimatedRN.View>
                    ))}
                  </AnimatedRN.View>
                ) : (
                  <View style={[styles.cardRow, { gap: handGap }]}>
                    {botHand.map((c, i) => (
                      <CardComponent key={c.id} card={c} owner="bot" faceDown={false} flipDuration={300} cardWidth={handCardW} cardHeight={handCardH} />
                    ))}
                  </View>
                )}
                {showHandNames && rawBotHandName ? (
                  isFirstBot ? (
                    <AnimatedRN.View style={{ opacity: handNameOpacity }}>
                      <HandBadge handName={rawBotHandName} />
                    </AnimatedRN.View>
                  ) : (
                    <HandBadge handName={rawBotHandName} size="small" />
                  )
                ) : null}
              </View>
            );
          })}

          {/* Community cards — flop face-up, turn+river flip in sequence (middle) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Community</Text>
            <View style={styles.cardRow}>
              {allCommunity.map((c, i) => {
                const isHighlighted = showWinHighlight && board.boardHighlightIds.includes(c.id);
                const isRiver = i === 4;
                return (
                  <AnimatedRN.View
                    key={c.id}
                    style={[
                      styles.commCardFrame,
                      { opacity: communitySpotlightOpacities[i], marginLeft: i === 0 ? 0 : -commOverlap, zIndex: i },
                      isRiver && { transform: [{ scaleY: riverSqueezeAnim }] },
                      isHighlighted && styles.winGlow,
                    ]}
                  >
                    <CardComponent
                      card={c}
                      faceDown={i < 3 ? flopFaceDown : i === 3 ? turnFaceDown : riverFaceDown}
                      flipDuration={400}
                      cardWidth={commCardW}
                      cardHeight={commCardH}
                    />
                  </AnimatedRN.View>
                );
              })}
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
                    owner="player"
                    zone="reveal"
                    faceDown={false}
                    flipDuration={300}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                  />
                </AnimatedRN.View>
              ))}
            </View>
            {showHandNames && (
              <AnimatedRN.View style={{ opacity: handNameOpacity }}>
                <HandBadge handName={board.playerHandName} />
              </AnimatedRN.View>
            )}
          </View>

          {/* Win/lose result — scale in after hand names */}
          {showResult ? (
            <AnimatedRN.View style={[styles.resultRow, { transform: [{ scale: resultScale }] }]}>
              <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
              {isPractice ? null : board.winner === 'tie' ? (
                <Text style={styles.chipTie}>Tie board</Text>
              ) : board.potAmount === 0 ? (
                <Text style={[styles.chipDelta, { color: chipColor }]}>—</Text>
              ) : (
                <AnimatedRN.View style={{ opacity: chipFadeIn }}>
                  <AnimatedRN.Text style={[styles.chipDelta, { color: chipColor }]}>
                    {chipCounterAnim.interpolate({
                      // VAMOS-FIX-RESULTS-CRASH 2026-06-17 — outputRange entries
                      // MUST have identical non-numeric structure for RN's pattern
                      // interpolation. Was: "-0" vs "-100 🪙" (mismatched suffix)
                      // → "invalid pattern -0 and -100 🪙" ErrorBoundary on every
                      // loss (negative chipSign). Both entries now carry the 🪙
                      // suffix → same pattern → no crash.
                      inputRange: [0, board.potAmount],
                      outputRange: [`${chipSign}0 🪙`, `${chipSign}${board.potAmount} 🪙`],
                      extrapolate: 'clamp',
                    })}
                  </AnimatedRN.Text>
                </AnimatedRN.View>
              )}
              {/* VAMOS-HAND-TIEBREAK 2026-06-22 — show the SPECIFIC hand matchup on EVERY
                  board outcome (win/loss/tie), not just player wins. The reveal previously
                  showed only the generic TYPE badge ("ONE PAIR") for both sides, so the user
                  could not tell which pair each player held or why a board resolved
                  ("a pair doesn't beat a pair"). The board WINNER logic is correct (verified:
                  same-type boards are 95.8% decided by kicker) — this was purely a display gap. */}
              {board.playerHandName && board.botHandName && (
                <Text style={styles.handComparison}>
                  {getComparisonText(board.playerHandName, board.botHandName, board.winner, 'en', board.playerBestCards, board.botBestCards)}
                </Text>
              )}
              {isNarrowLoss && (
                <Text style={styles.soClose}>So close! 😬</Text>
              )}
              {boards.every(b => b.winner === 'player') && currentIdx === boards.length - 1 && (
                <View style={styles.completeBanner}>
                  <Text style={styles.completeBannerText}>COMPLETE!</Text>
                  <Text style={styles.completeBannerSub}>You won ALL boards! +50% bonus 🏆</Text>
                </View>
              )}
              {showShare && (
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => {
                    const label = board.playerHandName || 'big hand';
                    Share.share({ message: `I just hit a ${label} in CAPS Poker! 🃏` });
                  }}
                >
                  <Text style={styles.shareBtnText}>Share 📤</Text>
                </Pressable>
              )}
            </AnimatedRN.View>
          ) : (
            <View style={styles.resultRowPlaceholder} />
          )}

          {/* Hint text — inside slide wrapper */}
          {!showResult ? (
            <AnimatedRN.Text style={[styles.hint, { opacity: hintOpacity }]}>
              {t().tapToReveal}
            </AnimatedRN.Text>
          ) : showTapHint ? (
            <Text style={[styles.hint, styles.hintContinue]}>
              {currentIdx + 1 < totalBoards ? 'Tap to continue →' : '▶ TAP FOR RESULTS'}
            </Text>
          ) : (
            <Text style={styles.hint}>{' '}</Text>
          )}

          </AnimatedRN.View>

          {/* FloatingChips — outside slide wrapper, position absolute. Hidden in practice
              (OTA-COSMETIC-FIXES) — no real chips move, so a flying coin animation is misleading. */}
          {!isPractice && (
            <FloatingChips
              amount={board.winner === 'player' ? board.potAmount : -board.potAmount}
              visible={showChipsAnim}
              onDone={() => setShowChipsAnim(false)}
            />
          )}
        </Pressable>

        {/* S113: Auto-advance progress bar — gold depleting bar at bottom */}
        {showProgressBar && (
          <View style={styles.progressWrap} pointerEvents="none">
            <AnimatedRN.View style={[
              styles.progressBar,
              { width: advanceProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
            ]} />
          </View>
        )}

        {/* COMPLETE screen flash — gold overlay */}
        {showCompleteFlash && (
          <AnimatedRN.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,215,0,0.12)', opacity: screenFlashAnim }]}
          />
        )}

        {/* S114: Board Score Intermission overlay */}
        {showIntermission && (
          <View style={styles.intermissionOverlay} pointerEvents="none">
            <Text style={styles.intermissionBoard}>Board {currentIdx + 1} of {boards.length}</Text>
            <Text style={[styles.intermissionResult, { color: resultColor }]}>
              {opponentName
                ? (board.winner === 'player'
                    ? `YOU WIN vs ${opponentName}!`
                    : board.winner === 'bot'
                    ? `${opponentName} wins this board`
                    : resultText)
                : resultText}
            </Text>
            {!isPractice && board.potAmount > 0 && board.winner !== 'tie' && (
              <Text style={[styles.intermissionChip, { color: chipColor }]}>
                {chipSign}{board.potAmount} chips
              </Text>
            )}
          </View>
        )}

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
    overflow: 'hidden',
  },
  boardContent: {
    flex: 1,
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(16),
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: rs(6),
    paddingBottom: rs(4),
  },
  scoreIndicator: {
    color: COLORS.textSecondary,
    fontSize: rf(12),
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
  },
  boardNumber: {
    color: COLORS.goldBright,
    fontSize: rf(28),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: rs(10),
    alignItems: 'center',
  },
  dot: {
    borderRadius: rv(6),
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
  // MP-PARITY-DEEP 2026-07-09 — frame border for community cards at the reveal; keeps
  // each card visually distinct where it overlaps its neighbor (see commOverlap).
  commCardFrame: {
    borderWidth: 2,
    borderColor: COLORS.goldBright,
    borderRadius: rs(10), // >= Card.tsx's own cardRadius(8) so the frame fully encloses the card's rounded corners
  },
  handNameBadge: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
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
  chipTie: {
    color: '#aaa',
    fontSize: rf(16),
    fontWeight: '600',
    textAlign: 'center',
  },
  handComparison: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(12),
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: rs(2),
  },
  completeBanner: {
    alignItems: 'center',
    marginTop: rs(8),
    backgroundColor: 'rgba(201,168,76,0.12)',
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  completeBannerText: {
    color: COLORS.goldBright,
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 3,
  },
  completeBannerSub: {
    color: COLORS.goldLight,
    fontSize: rf(12),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: rs(2),
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(11),
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
  hintContinue: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  progressWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: rs(3),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressBar: {
    height: rs(3),
    backgroundColor: '#c9a84c',
  },
  // S114: winning card gold glow
  winGlow: {
    borderRadius: rs(4),
    shadowColor: '#FFD700',
    shadowOpacity: 0.9,
    shadowRadius: rs(8),
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  // S114: "So close!" narrow loss
  soClose: {
    color: 'rgba(255,152,0,0.85)',
    fontSize: rf(13),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: rs(2),
  },
  // S114: Share button
  shareBtn: {
    marginTop: rs(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: rv(8),
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: rf(13),
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // S114: Board Score Intermission overlay
  intermissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6),
  },
  intermissionBoard: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  intermissionResult: {
    fontSize: rf(40),
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  intermissionChip: {
    fontSize: rf(24),
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
