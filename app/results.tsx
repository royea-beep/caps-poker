import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, Alert, Pressable, ActionSheetIOS } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
  useDerivedValue,
  FadeIn,
  FadeInDown,
  FadeInUp,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import CardComponent from '../components/Card';
import { Badge } from '../components/Badge';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
import RevealSequence from '../components/RevealSequence';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, getBoardCount } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { CardsDealtPayload } from '../constants/networkConfig';
import { playSound } from '../utils/sounds';
import { submitScore } from '../utils/leaderboard';
import { WEB_MAX_WIDTH } from '../components/WebContainer';
import { WAITING_STATE_TIMEOUT_MS } from '../utils/realtimeMultiplayer';
import { getMatchCost, canAffordMatch } from '../utils/economy';
import { CapsHooks } from '../utils/learning';
import { FriendsBg } from '../components/FriendsBg';
import ProQuoteBanner from '../components/ProQuoteBanner';
import { analyzeEfficiency, EfficiencyResult } from '../utils/efficiencyAnalysis';
import { saveHandToHistory, HandRecord, HandBoardRecord } from '../utils/handHistory';
import { SingleBoardShareCard, FullGameShareCard, StoryShareCard } from '../components/ShareCard';
import { captureAndShare, saveHandForWebReplay, generateShareText, copyToClipboard, ShareData } from '../utils/shareHand';
import { rf, rs, rb, rv, UI } from '../utils/responsive';
import { KILL_results } from '../utils/animationKill';
import { getSupabase } from '../utils/supabase';
import { debugLog } from '../components/DebugOverlay';
import { useLocalSearchParams } from 'expo-router';

async function logResultsStep(step: string, extra?: string) {
  console.log(`[RESULTS-STEP] ${step}${extra ? ` — ${extra}` : ''}`);
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('bug_reports').insert({
      title: `[CRASH-STEP] results/${step}`,
      description: extra ?? null,
      url: 'results/mount',
      report_type: 'text',
    });
  } catch {}
}

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

// DEAL ME IN button with idle gold glow pulse
function DealMeInButton({ label, onPress }: { label: string; onPress: () => void }) {
  const glow = useSharedValue(0.15);
  useEffect(() => {
    if (!KILL_results) {
      glow.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 900 }),
          withTiming(0.15, { duration: 900 }),
        ),
        -1,
        false,
      );
    }
    return () => { cancelAnimation(glow); };
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
    ...Platform.select({
      web: { boxShadow: `0px 0px 20px rgba(255,215,0,${glow.value})` } as any,
      default: {},
    }),
  }));
  return (
    <Animated.View style={[dealMeInStyles.btn, glowStyle]}>
      <Pressable onPress={onPress} style={dealMeInStyles.inner}>
        <Text style={dealMeInStyles.text}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
const dealMeInStyles = StyleSheet.create({
  btn: {
    borderRadius: rv(16),
    backgroundColor: '#FFD700',
    marginHorizontal: rs(16),
    height: rb(64),
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(16),
  },
  text: {
    color: '#000',
    fontSize: rf(20),
    fontWeight: '700',
    letterSpacing: 2,
  },
});

// Animation timing
const BOARD_STAGGER = 250;
const BOARD_FADE = 350;
const CHIPS_DELAY = 300;
const CHIPS_DURATION = 1000;
const BUTTONS_DELAY = 400;

export default function ResultsScreen() {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string }>();
  const { width: rawW } = useWindowDimensions();
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const revealData = useGameStore((s) => s.revealData);
  const clearRevealData = useGameStore((s) => s.clearRevealData);
  const incrementHandsPlayed = useGameStore((s) => s.incrementHandsPlayed);
  const incrementHandsWon = useGameStore((s) => s.incrementHandsWon);
  const updateBestChips = useGameStore((s) => s.updateBestChips);
  const updateBiggestWin = useGameStore((s) => s.updateBiggestWin);

  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const storeRoomCode = useGameStore((s) => s.roomCode);
  const isMultiplayer = mpServer !== null || mpClient !== null;

  const [showReveal, setShowReveal] = useState(false); // BYPASSED — skip reveal entirely for crash isolation
  const [showButtons, setShowButtons] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [waitingForNextHand, setWaitingForNextHand] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const waitingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Share state
  const [sharingBoardIdx, setSharingBoardIdx] = useState<number | null>(null);
  const [sharingGame, setSharingGame] = useState(false);
  const boardShareRefs = useRef<React.RefObject<any>[]>([]);
  const boardStoryRefs = useRef<React.RefObject<any>[]>([]);
  const gameShareRef = useRef<any>(null);
  const gameStoryRef = useRef<any>(null);

  const chipCountProgress = useSharedValue(0);
  const goldPulse = useSharedValue(0); // 0=off, 1=gold border active
  const goldPulseStyle = useAnimatedStyle(() => ({
    borderColor: goldPulse.value > 0.5 ? '#FFD700' : undefined,
    borderWidth: goldPulse.value > 0.5 ? 3 : undefined,
  }));

  // Dynamic card sizing: fit 5 community cards + separator in available width
  // Available = screenWidth - container padding (32) - board padding (20) - separator (6)
  const availableW = SCREEN_W - 32 - 20 - 6;
  const CARD_W = Math.min(Platform.OS === 'web' ? 60 : 42, Math.max(28, Math.floor(availableW / 5.5)));
  const CARD_H = Math.round(CARD_W * 1.4);

  // Debug: log on mount — Supabase log so we see it even after native crash
  useEffect(() => {
    debugLog('R1 results.tsx mounted');
    debugLog(`R2 revealData: ${revealData ? `boards=${revealData.boards.length} isComplete=${revealData.isComplete}` : 'NULL'}`);
    debugLog(`R3 chips: ${chips}`);
    debugLog(`R4 showComplete=${showComplete} showConfetti=${showConfetti}`);
    console.log('[RESULTS] mounted — revealData:', revealData ? `boards=${revealData.boards.length}` : 'NULL');
    void logResultsStep('H:results_mounted', revealData ? `boards=${revealData.boards.length}` : 'NULL');
  }, []);

  // Auto-sim marathon: auto-start next hand after a brief pause
  useEffect(() => {
    if (autoSim !== 'true') return;
    const total = parseInt(autoSimCount ?? '1', 10);
    const current = parseInt(currentSimHand ?? '1', 10);
    if (current < total) {
      debugLog(`🤖 AUTO-SIM: hand ${current}/${total} done — next in 2s`);
      const t = setTimeout(() => {
        router.replace(`/game?autoSim=true&autoSimCount=${total}&currentSimHand=${current + 1}` as any);
      }, 2000);
      return () => clearTimeout(t);
    } else {
      debugLog(`🤖 AUTO-SIM: ✅ ${total}/${total} hands complete — NO CRASH!`);
    }
  }, [autoSim]);

  // Guard: no data → go home
  useEffect(() => {
    console.log('[RESULTS] revealData guard — revealData:', revealData ? 'present' : 'null');
    if (!revealData) {
      console.warn('[RESULTS] no revealData — redirecting to /');
      router.replace('/');
    }
  }, [revealData, router]);

  // Track stats + start animations
  useEffect(() => {
    debugLog('A1 stats useEffect START');
    if (!revealData) { debugLog('A1.1 no revealData — return'); return; }
    debugLog('A2 incrementHandsPlayed');
    incrementHandsPlayed();
    debugLog('A3 updateBestChips');
    updateBestChips();

    // Track wins and biggest win
    if (revealData.netChips > 0) {
      debugLog(`A4 incrementHandsWon netChips=${revealData.netChips}`);
      incrementHandsWon();
      updateBiggestWin(revealData.netChips);
    }

    // Track board results via learning hooks
    debugLog('A5 CapsHooks.boardCompleted loop');
    revealData.boards.forEach((board, i) => {
      CapsHooks.boardCompleted(i, board.playerHandName, board.winner === 'player');
    });
    if (revealData.isComplete && revealData.completeBonusAmount > 0) {
      debugLog('A6 CapsHooks.bonusAchieved');
      CapsHooks.bonusAchieved('complete', revealData.completeBonusAmount);
    }

    // Submit to leaderboard (async, silent fail)
    debugLog('A7 submitScore');
    const store = useGameStore.getState();
    submitScore(
      store.playerName || 'Player',
      store.chips,
      store.handsPlayed,
      store.handsWon,
      store.biggestWin,
    ).catch(() => {});

    // Save hand to history (async, silent fail)
    debugLog('A8 saveHandToHistory');
    const historyBoards: HandBoardRecord[] = revealData.boards.map((b, i) => ({
      boardIndex: i,
      winner: b.winner,
      playerHandName: b.playerHandName,
      botHandName: b.botHandName,
      playerCards: b.playerCards.map((c) => ({ rank: c.rank, suit: c.suit })),
      botCards: ((b.allBotCards ?? [])[0] ?? []).map((c) => ({ rank: c.rank, suit: c.suit })),
      communityCards: [...(b.openCards ?? []), ...(b.closedCards ?? [])].map((c) => ({ rank: c.rank, suit: c.suit })),
    }));
    const handRecord: HandRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      boards: historyBoards,
      netChips: revealData.netChips,
      potPerBoard: revealData.potPerBoard,
      numberOfPlayers: revealData.numberOfPlayers,
      boardCount: revealData.boardCount,
      isComplete: revealData.isComplete,
      completeBonusAmount: revealData.completeBonusAmount,
    };
    saveHandToHistory(handRecord).catch(() => {});

    debugLog('A9 computing delays');
    const lastBoardDelay = revealData.boardCount * BOARD_STAGGER;
    const chipsStart = lastBoardDelay + BOARD_FADE + CHIPS_DELAY;
    const buttonsShow = chipsStart + CHIPS_DURATION + BUTTONS_DELAY;
    debugLog(`A10 delays: chipsStart=${chipsStart} buttonsShow=${buttonsShow}`);

    debugLog('A11 chipCountProgress animation');
    chipCountProgress.value = withDelay(
      chipsStart,
      withTiming(1, { duration: CHIPS_DURATION, easing: Easing.out(Easing.cubic) })
    );

    debugLog('A12 soundTimer setup');
    const playerWon = revealData.netChips >= 0;
    const soundTimer = setTimeout(() => playSound(playerWon ? 'chipsWin' : 'lose'), chipsStart);
    const playerWinsCount = revealData.boards.filter((b) => b.winner === 'player').length;
    debugLog(`A13 btnTimer setup: buttonsShow=${buttonsShow} isComplete=${revealData.isComplete}`);
    const btnTimer = setTimeout(() => {
      debugLog('A14 btnTimer fired');
      if (revealData.isComplete && revealData.completeWinner) {
        debugLog('A15 isComplete=true — goldPulse + setShowComplete');
        if (!KILL_results) {
          debugLog('A15.1 goldPulse withRepeat(3)');
          goldPulse.value = withRepeat(
            withSequence(
              withTiming(1, { duration: 200 }),
              withTiming(0, { duration: 200 }),
            ),
            3,
            false,
          );
        }
        debugLog('A16 haptics sequence');
        setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 0);
        setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 400);
        setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 800);
        debugLog('A17 setShowComplete timer set (1200ms)');
        setTimeout(() => { debugLog('A18 setShowComplete(true)'); setShowComplete(true); }, 1200);
      } else {
        debugLog('A15.2 not complete — setShowButtons');
        setShowButtons(true);
      }
      // Skip confetti when isComplete — CompleteOverlay IS the celebration.
      // Abrupt unmount of 180 ConfettiCannon views when !showComplete flips → Reanimated cleanup crash.
      if (!revealData.isComplete && playerWinsCount === revealData.boards.length && revealData.boards.length > 0) {
        debugLog('A19 setShowConfetti(true)');
        setShowConfetti(true);
      }
      debugLog('A20 btnTimer done');
    }, buttonsShow);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(btnTimer);
      cancelAnimation(goldPulse);
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

      // Start waiting timeout (CAPS 10)
      waitingTimeoutRef.current = setTimeout(() => {
        Alert.alert(
          'Waiting Timed Out',
          'No response from other players.',
          [
            { text: 'Keep Waiting', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => {
              useGameStore.getState().resetMultiplayer();
              clearRevealData();
              router.replace('/');
            }},
          ]
        );
      }, WAITING_STATE_TIMEOUT_MS);

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
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
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
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            navigateToMpGame(false, mySeat, data.playerCount, data.yourCards, data.boards);
          },
          // Host-lost detection while waiting for next hand (CAPS 10)
          onHostLost: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Host disconnected');
            Alert.alert(
              'Host Disconnected',
              'The host has left the game.',
              [{ text: 'Leave', onPress: () => {
                useGameStore.getState().resetMultiplayer();
                clearRevealData();
                router.replace('/');
              }}]
            );
          },
          // Connection lost with rejoin option (CAPS 12)
          onDisconnected: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Connection lost');
            const code = storeRoomCode;
            Alert.alert(
              'Connection Lost',
              'Lost connection to the game room. You can try to rejoin.',
              [
                { text: 'Leave', style: 'cancel', onPress: () => {
                  useGameStore.getState().resetMultiplayer();
                  clearRevealData();
                  router.replace('/');
                }},
                { text: 'Rejoin', onPress: () => {
                  useGameStore.getState().resetMultiplayer();
                  clearRevealData();
                  router.replace({ pathname: '/lobby/internet-join', params: code ? { prefillCode: code } : {} } as any);
                }},
              ]
            );
          },
        });
        mpClient.sendNextHandRequest();
      }
      return;
    }

    // Single-player: navigate directly
    clearRevealData();
    const matchCost = getMatchCost(config.potPerBoard, boardCount);
    if (canAffordMatch(chips, matchCost)) {
      router.replace('/game');
    } else {
      router.replace('/gameover');
    }
  }, [revealData, chips, config, clearRevealData, router, isMultiplayer, mpServer, mpClient, connectedPlayers]);

  const handleHome = useCallback(() => {
    clearRevealData();
    router.replace('/');
  }, [clearRevealData, router]);

  const handleRematch = useCallback(() => {
    clearRevealData();
    router.replace('/game');
  }, [clearRevealData, router]);

  const chipCountStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 0.9 + chipCountProgress.value * 0.1 }],
      opacity: chipCountProgress.value > 0 ? 1 : 0,
    };
  });

  if (!revealData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { boards, netChips, isComplete, completeBonusAmount, numberOfPlayers, boardCount } = revealData;
  const playerWins = boards.filter((b) => b.winner === 'player').length;
  const botWins = boards.filter((b) => b.winner === 'bot').length;
  const isPerfectGame = playerWins === boards.length && boards.length > 0;
  const potPerBoardTotal = revealData.potPerBoard * numberOfPlayers;

  // Ensure board share refs are allocated
  while (boardShareRefs.current.length < boards.length) {
    boardShareRefs.current.push(React.createRef<any>());
  }
  while (boardStoryRefs.current.length < boards.length) {
    boardStoryRefs.current.push(React.createRef<any>());
  }

  const shareData: ShareData = {
    boards,
    netChips,
    isComplete,
    completeBonusAmount,
    boardsWon: playerWins,
    totalBoards: boards.length,
    potPerBoard: revealData.potPerBoard,
    numberOfPlayers,
  };

  const doShareBoard = async (idx: number, ref: React.RefObject<any>) => {
    setSharingBoardIdx(idx);
    await new Promise((r) => setTimeout(r, 150));
    if (!ref) { setSharingBoardIdx(null); return; }
    const url = await saveHandForWebReplay(shareData).catch(() => null);
    const text = generateShareText(shareData, url);
    await captureAndShare(ref, text);
    setSharingBoardIdx(null);
  };

  const handleShareBoard = (idx: number) => {
    const imageRef = boardShareRefs.current[idx];
    const storyRef = boardStoryRefs.current[idx];
    const doCopy = async () => {
      const url = await saveHandForWebReplay(shareData).catch(() => null);
      if (url) { await copyToClipboard(url); Alert.alert('Link copied!', url); }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Share Image', 'Share as Story', 'Copy Replay Link'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) doShareBoard(idx, imageRef);
          else if (i === 2) doShareBoard(idx, storyRef);
          else if (i === 3) doCopy();
        }
      );
    } else {
      Alert.alert('Share Board', undefined, [
        { text: 'Share Image', onPress: () => doShareBoard(idx, imageRef) },
        { text: 'Share as Story', onPress: () => doShareBoard(idx, storyRef) },
        { text: 'Copy Replay Link', onPress: doCopy },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const doShareGame = async (ref: React.RefObject<any> | React.MutableRefObject<any>) => {
    setSharingGame(true);
    await new Promise((r) => setTimeout(r, 150));
    const url = await saveHandForWebReplay(shareData).catch(() => null);
    const text = generateShareText(shareData, url);
    await captureAndShare(ref, text);
    setSharingGame(false);
  };

  const handleShareGame = () => {
    const doCopy = async () => {
      const url = await saveHandForWebReplay(shareData).catch(() => null);
      if (url) { await copyToClipboard(url); Alert.alert('Link copied!', url); }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Share Image', 'Share as Story', 'Copy Replay Link'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) doShareGame(gameShareRef);
          else if (i === 2) doShareGame(gameStoryRef);
          else if (i === 3) doCopy();
        }
      );
    } else {
      Alert.alert('Share Game', undefined, [
        { text: 'Share Image', onPress: () => doShareGame(gameShareRef) },
        { text: 'Share as Story', onPress: () => doShareGame(gameStoryRef) },
        { text: 'Copy Replay Link', onPress: doCopy },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleCopyReplayLink = async () => {
    const url = await saveHandForWebReplay(shareData).catch(() => null);
    if (url) {
      await copyToClipboard(url);
      if (Platform.OS !== 'web') {
        Alert.alert('Link copied!', url);
      }
    }
  };

  // Efficiency analysis — memoized so it runs once
  const efficiency = useMemo<EfficiencyResult | null>(() => {
    if (!revealData || boards.length === 0) return null;
    try {
      const playerCardsByBoard = boards.map((b) => b.playerCards);
      const boardCommunityCards = boards.map((b) => ({
        openCards: b.openCards,
        closedCards: b.closedCards,
      }));
      return analyzeEfficiency(playerCardsByBoard, boardCommunityCards);
    } catch {
      return null;
    }
  }, [revealData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FriendsBg />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title + score */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.titleSection}>
          <Text style={[styles.title, {
            color: isPerfectGame ? COLORS.gold : playerWins > botWins ? COLORS.neonGreen : playerWins < botWins ? COLORS.neonRed : COLORS.gold,
          }]}>
            {isPerfectGame ? 'PERFECT!' : playerWins > botWins ? 'YOU WIN' : playerWins < botWins ? 'YOU LOSE' : 'TIE GAME'}
          </Text>
          <Text style={[styles.scoreDisplay, { fontSize: Math.min(42, Math.floor(SCREEN_W * 0.105)) }]}>
            <Text style={{ color: COLORS.neonGreen }}>{playerWins}</Text>
            <Text style={[styles.scoreSep, { fontSize: Math.min(32, Math.floor(SCREEN_W * 0.08)) }]}> — </Text>
            <Text style={{ color: COLORS.neonRed }}>{botWins}</Text>
          </Text>
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
          const multiBot = (board.allBotCards ?? []).length > 1;

          return (
            <Animated.View
              key={i}
              entering={FadeInDown.duration(BOARD_FADE).delay(BOARD_STAGGER * (i + 1))}
              style={{ width: '100%' }}
            >
              <Animated.View style={[
                styles.boardCard,
                { backgroundColor: theme.surface, borderColor: theme.boardBorder },
                board.winner === 'player' && styles.boardCardWin,
                board.winner === 'bot' && styles.boardCardLose,
                revealData?.isComplete && goldPulseStyle,
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
                  <View style={styles.boardHeaderRight}>
                    <Text style={[styles.chipAmount, { color: chipColor }]}>{chipResult}</Text>
                    {Platform.OS !== 'web' && (
                      <Pressable
                        onPress={() => handleShareBoard(i)}
                        style={styles.shareBtn}
                        disabled={sharingBoardIdx === i}
                      >
                        <Text style={styles.shareBtnText}>{sharingBoardIdx === i ? '...' : '📸'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Offscreen share cards (image + story) */}
                {Platform.OS !== 'web' && (
                  <>
                    <View ref={boardShareRefs.current[i] as any} style={styles.offscreen} pointerEvents="none">
                      <SingleBoardShareCard board={board} boardIndex={i} potAmount={potPerBoardTotal} />
                    </View>
                    <View ref={boardStoryRefs.current[i] as any} style={styles.offscreen} pointerEvents="none">
                      <StoryShareCard board={board} boardIndex={i} potAmount={potPerBoardTotal} isComplete={isComplete} completeBonusAmount={completeBonusAmount} />
                    </View>
                  </>
                )}

                {/* Bot hand rows — top (opponent across the table) */}
                {(board.allBotCards ?? []).map((botCards, botIdx) =>
                  botCards && botCards.length > 0 ? (
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
                            highlighted={botIdx === 0 && (board.botHighlightIds ?? []).includes(c.id)}
                            dimmed={botIdx === 0 && !(board.botHighlightIds ?? []).includes(c.id) && (board.botHighlightIds ?? []).length > 0}
                          />
                        ))}
                        <Text style={[styles.handName, board.winner === 'bot' && styles.handNameWin]}>
                          {(board.allBotHandNames ?? [])[botIdx] || board.botHandName}
                        </Text>
                      </View>
                    </View>
                  ) : null
                )}

                {/* Community cards — center row */}
                <View style={styles.cardsRow}>
                  {(board.openCards ?? []).map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={CARD_W}
                      cardHeight={CARD_H}
                      highlighted={(board.boardHighlightIds ?? []).includes(c.id)}
                      dimmed={!(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
                    />
                  ))}
                  <View style={styles.cardSeparator} />
                  {(board.closedCards ?? []).map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={CARD_W}
                      cardHeight={CARD_H}
                      highlighted={(board.boardHighlightIds ?? []).includes(c.id)}
                      dimmed={!(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
                    />
                  ))}
                </View>

                {/* Player hand row — bottom (your side of the table) */}
                <View style={styles.handRowVertical}>
                  <Text style={[styles.handLabel, board.winner === 'player' && styles.handLabelWin]}>YOU</Text>
                  <View style={styles.cardsRow}>
                    {(board.playerCards ?? []).map((c) => (
                      <CardComponent
                        key={c.id}
                        card={c}
                        faceDown={false}
                        cardWidth={CARD_W}
                        cardHeight={CARD_H}
                        highlighted={(board.playerHighlightIds ?? []).includes(c.id)}
                        dimmed={!(board.playerHighlightIds ?? []).includes(c.id) && (board.playerHighlightIds ?? []).length > 0}
                      />
                    ))}
                    <Text style={[styles.handName, board.winner === 'player' && styles.handNameWin]}>
                      {board.playerHandName}
                    </Text>
                  </View>
                </View>

                {/* Result label at bottom */}
                <View style={styles.boardResultRow}>
                  <Text style={[
                    styles.boardResultLabel,
                    board.winner === 'player' ? styles.boardResultWin
                    : board.winner === 'bot' ? styles.boardResultLose
                    : styles.boardResultTie,
                  ]}>
                    {board.winner === 'player' ? '✅ YOU WIN' : board.winner === 'bot' ? '❌ YOU LOSE' : '🤝 TIE'}
                  </Text>
                </View>
              </Animated.View>
            </Animated.View>
          );
        })}

        {/* Share Game button + offscreen FullGameShareCard */}
        {Platform.OS !== 'web' && (
          <Animated.View
            entering={FadeIn.duration(300).delay(boards.length * BOARD_STAGGER + BOARD_FADE)}
            style={{ width: '100%', gap: 8 }}
          >
            <View style={styles.shareGameRow}>
              <Pressable
                onPress={handleShareGame}
                style={[styles.shareGameBtn, sharingGame && styles.shareBtnLoading]}
                disabled={sharingGame}
              >
                <Text style={styles.shareGameBtnText}>{sharingGame ? 'Generating...' : '📸 Share Game'}</Text>
              </Pressable>
              <Pressable onPress={handleCopyReplayLink} style={styles.copyLinkBtn}>
                <Text style={styles.copyLinkText}>📋 Copy Replay Link</Text>
              </Pressable>
            </View>
            <View ref={gameShareRef as any} style={styles.offscreen} pointerEvents="none">
              <FullGameShareCard boards={boards} netChips={netChips} isComplete={isComplete} completeBonusAmount={completeBonusAmount} potPerBoard={revealData.potPerBoard} numberOfPlayers={numberOfPlayers} />
            </View>
            <View ref={gameStoryRef as any} style={styles.offscreen} pointerEvents="none">
              <StoryShareCard boards={boards} netChips={netChips} isComplete={isComplete} completeBonusAmount={completeBonusAmount} potPerBoard={revealData.potPerBoard} numberOfPlayers={numberOfPlayers} />
            </View>
          </Animated.View>
        )}

        {/* Efficiency analysis */}
        {efficiency && (
          <Animated.View
            entering={FadeIn.duration(400).delay(boards.length * BOARD_STAGGER + BOARD_FADE)}
            style={{ width: '100%' }}
          >
            <View style={styles.efficiencyCard}>
              <Text style={styles.efficiencyTitle}>PLACEMENT EFFICIENCY</Text>
              <View style={styles.efficiencyScoreRow}>
                <Text style={styles.efficiencyEmoji}>{efficiency.gradeEmoji}</Text>
                <Text style={[
                  styles.efficiencyPercent,
                  { color: efficiency.percentage >= 90 ? '#4CAF50' : efficiency.percentage >= 75 ? '#c8a84b' : efficiency.percentage >= 60 ? '#FFC107' : COLORS.neonRed,
                    fontSize: Math.min(36, Math.floor(SCREEN_W * 0.09)) },
                ]}>
                  {efficiency.percentage}%
                </Text>
                <Text style={styles.efficiencyGrade}>{efficiency.grade}</Text>
              </View>
              {efficiency.percentage < 100 && (
                <View style={styles.optimalSection}>
                  <Text style={styles.optimalTitle}>Optimal arrangement:</Text>
                  {efficiency.optimalAssignment.map((boardCards, i) => (
                    <View key={i} style={styles.optimalRow}>
                      <Text style={styles.optimalBoardLabel}>B{i + 1}</Text>
                      <View style={styles.optimalCards}>
                        {boardCards.map((c) => (
                          <Text key={c.id} style={[
                            styles.optimalCardText,
                            { color: (c.suit === 'hearts' || c.suit === 'diamonds') ? '#c0392b' : '#f0dfc0' },
                          ]}>
                            {c.rank}{c.suit === 'hearts' ? '\u2665' : c.suit === 'diamonds' ? '\u2666' : c.suit === 'clubs' ? '\u2663' : '\u2660'}
                          </Text>
                        ))}
                      </View>
                      <Text style={styles.optimalHandName}>{efficiency.optimalHandNames[i]}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Best hand highlight */}
        {boards.length > 0 && (() => {
          const HAND_ORDER = ['Royal Flush','Straight Flush','Four of a Kind','Full House','Flush','Straight','Three of a Kind','Two Pair','One Pair','High Card'];
          let bestRank = 99; let bestName = ''; let bestBoard = 0;
          boards.forEach((b, i) => {
            if (!b.playerHandName) return;
            const r = HAND_ORDER.indexOf(b.playerHandName);
            if (r >= 0 && r < bestRank) { bestRank = r; bestName = b.playerHandName; bestBoard = i + 1; }
          });
          if (!bestName) return null;
          return (
            <Animated.View
              entering={FadeIn.duration(300).delay(boards.length * BOARD_STAGGER + BOARD_FADE + 50)}
              style={styles.bestHandRow}
            >
              <Text style={styles.bestHandText}>⭐ Best hand: {bestName} on Board {bestBoard}</Text>
            </Animated.View>
          );
        })()}

        {/* Stats row */}
        <Animated.View
          entering={FadeIn.duration(300).delay(boards.length * BOARD_STAGGER + BOARD_FADE + 100)}
          style={styles.statsRow}
        >
          <Text style={styles.statItem}>Boards: {playerWins}/{boards.length}</Text>
          <Text style={styles.statSep}>|</Text>
          <Text style={[styles.statItem, { color: netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>
            Net: {netChips >= 0 ? '+' : ''}{netChips}
          </Text>
          <Text style={styles.statSep}>|</Text>
          <Text style={styles.statItem}>Games: {useGameStore.getState().handsPlayed}</Text>
        </Animated.View>

        {/* Complete bonus */}
        {isComplete && completeBonusAmount > 0 && (
          <Animated.View
            entering={FadeIn.duration(400).delay(boards.length * BOARD_STAGGER + BOARD_FADE)}
            style={styles.completeRow}
          >
            <Text style={styles.completeLabel}>🏆 COMPLETE! +50% BONUS</Text>
            <Text style={styles.completeAmount}>+{completeBonusAmount} bonus chips</Text>
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

        {/* Pro quote */}
        {showButtons && <ProQuoteBanner context="summary" />}

        {/* Buttons */}
        {showButtons && (
          <Animated.View style={styles.buttons} entering={FadeInUp.duration(400).delay(boards.length * BOARD_STAGGER + BOARD_FADE + 200)}>
            {waitingForNextHand ? (
              <View style={styles.waitingNextHand}>
                <Text style={styles.waitingNextHandText}>
                  {disconnectMessage || 'Waiting for other players...'}
                </Text>
                {disconnectMessage && (
                  <Button
                    title="LEAVE"
                    variant="secondary"
                    onPress={() => {
                      useGameStore.getState().resetMultiplayer();
                      clearRevealData();
                      router.replace('/');
                    }}
                    style={{ marginTop: 8, width: '100%' }}
                  />
                )}
              </View>
            ) : (
              <>
                <DealMeInButton
                  label={chips >= config.potPerBoard * revealData.boardCount ? 'DEAL ME IN' : 'GAME OVER'}
                  onPress={handleNextHand}
                />
                <View style={styles.rematchRow}>
                  {!isMultiplayer && (
                    <Button title="REMATCH" variant="secondary" onPress={handleRematch} style={{ flex: 1 }} />
                  )}
                  <Button title="HOME" variant="secondary" onPress={handleHome} style={!isMultiplayer ? { flex: 1 } : {}} />
                </View>
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

      {/* REVEAL BYPASSED — crash isolation test. showReveal always false. */}
      {/* <RevealSequence boards={boards} visible={showReveal} onDone={() => setShowReveal(false)} /> */}

      {/* Confetti — fires once on perfect game (all boards won), skip when CompleteOverlay showing to avoid 180 animated views crash */}
      {showConfetti && !showComplete && (
        <ConfettiCannon
          count={180}
          origin={{ x: 0, y: 0 }}
          autoStart
          fadeOut
          onAnimationEnd={() => setShowConfetti(false)}
          colors={['#c9a84c', '#4ecdc4', '#e8192c', '#1E90FF', '#00c875', '#ff6b35']}
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

  const updateDisplay = useCallback((val: number) => {
    setDisplayValue(val);
  }, []);

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
    padding: rs(16),
    paddingBottom: rs(32),
    gap: rs(12),
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: rf(20),
    fontWeight: '800',
  },
  titleSection: {
    alignItems: 'center',
    gap: rs(8),
  },
  title: {
    fontSize: rf(24),
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 6,
  },
  scoreDisplay: {
    fontSize: rf(42),
    fontWeight: '900',
  },
  scoreSep: {
    color: COLORS.textDim,
    fontSize: rf(32),
    fontWeight: '300',
  },

  // Board card — vertical layout
  boardCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(4),
  },
  boardCardWin: {
    borderColor: 'rgba(255,215,0,0.4)',
    borderLeftColor: '#FFD700',
    borderLeftWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
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
    gap: rs(8),
  },
  boardLabel: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  chipAmount: {
    fontSize: rf(15),
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
    gap: rs(6),
  },
  handLabel: {
    color: COLORS.textDim,
    fontSize: rf(9),
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
    fontSize: rf(9),
    fontWeight: '600',
    marginLeft: rs(4),
  },
  handNameWin: {
    color: COLORS.goldLight,
    fontWeight: '800',
  },

  // Complete bonus
  completeRow: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.08)',
    padding: rs(16),
    borderRadius: rv(12),
    borderWidth: 2,
    borderColor: '#FFD700',
    gap: rs(4),
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: { boxShadow: '0px 0px 16px rgba(255,215,0,0.3)' } as any,
    }),
  },
  completeLabel: {
    color: '#FFD700',
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center' as any,
  },
  completeAmount: {
    color: COLORS.goldLight,
    fontSize: rf(16),
    fontWeight: '700',
    textAlign: 'center' as any,
  },

  // Net result
  netSection: {
    width: '100%',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(4),
  },
  netLabel: {
    color: COLORS.textMuted,
    fontSize: rf(16),
    fontWeight: '600',
  },
  netAmount: {
    fontSize: rf(28),
    fontWeight: '900',
  },

  // Buttons
  buttons: {
    width: '100%',
    gap: rs(10),
    marginTop: rs(4),
  },
  rematchRow: {
    flexDirection: 'row',
    gap: rs(10),
  },
  waitingNextHand: {
    backgroundColor: COLORS.feltLight,
    paddingVertical: rs(14),
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    alignItems: 'center',
  },
  waitingNextHandText: {
    color: COLORS.textSecondary,
    fontSize: rf(16),
    fontWeight: '600',
  },

  // Efficiency analysis
  efficiencyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(14),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(10),
  },
  efficiencyTitle: {
    color: COLORS.textMuted,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  efficiencyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10),
  },
  efficiencyEmoji: {
    fontSize: rf(24),
  },
  efficiencyPercent: {
    fontSize: rf(36),
    fontWeight: '900',
  },
  efficiencyGrade: {
    color: COLORS.textMuted,
    fontSize: rf(14),
    fontWeight: '700',
  },
  optimalSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
    paddingTop: rs(8),
    gap: rs(4),
  },
  optimalTitle: {
    color: COLORS.textMuted,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  optimalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  optimalBoardLabel: {
    color: '#c8a84b',
    fontSize: rf(11),
    fontWeight: '800',
    width: 22,
  },
  optimalCards: {
    flexDirection: 'row',
    gap: rs(4),
  },
  optimalCardText: {
    fontSize: rf(12),
    fontWeight: '700',
  },
  optimalHandName: {
    color: COLORS.textMuted,
    fontSize: rf(10),
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // Share buttons
  boardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  shareBtn: {
    paddingHorizontal: rs(8),
    paddingVertical: 3,
    borderRadius: rv(8),
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  shareBtnText: {
    fontSize: rf(13),
  },
  shareGameRow: {
    flexDirection: 'row',
    gap: rs(8),
    width: '100%',
  },
  shareGameBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    borderRadius: rv(10),
    paddingVertical: rs(10),
    alignItems: 'center',
  },
  shareBtnLoading: {
    opacity: 0.5,
  },
  shareGameBtnText: {
    color: '#FFD700',
    fontSize: rf(14),
    fontWeight: '700',
  },
  copyLinkBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rv(10),
    paddingVertical: rs(10),
    alignItems: 'center',
  },
  copyLinkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: rf(14),
    fontWeight: '600',
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },

  // Board result label
  boardResultRow: {
    alignItems: 'center',
    paddingTop: rs(6),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: rs(4),
  },
  boardResultLabel: {
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 1,
  },
  boardResultWin: { color: '#FFD700' },
  boardResultLose: { color: COLORS.neonRed },
  boardResultTie: { color: COLORS.textMuted },

  // Best hand highlight
  bestHandRow: {
    width: '100%',
    paddingHorizontal: rs(4),
    paddingVertical: rs(6),
  },
  bestHandText: {
    color: '#FFD700',
    fontSize: rf(13),
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Stats row
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(8),
    paddingVertical: rs(6),
  },
  statItem: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(12),
  },
  statSep: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: rf(12),
  },
});
