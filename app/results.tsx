import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, Alert, Pressable, ActionSheetIOS, Animated } from 'react-native';
// ZERO Reanimated on results screen — game.tsx has 7 active shared values during transition
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardComponent from '../components/Card';
import { Badge } from '../components/Badge';
import ChipsDisplay from '../components/ChipsDisplay';
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
import { analyzeEfficiency, EfficiencyResult } from '../utils/efficiencyAnalysis';
import { saveHandToHistory, HandRecord, HandBoardRecord } from '../utils/handHistory';
import { SingleBoardShareCard, FullGameShareCard, StoryShareCard } from '../components/ShareCard';
import { captureAndShare, saveHandForWebReplay, generateShareText, copyToClipboard, ShareData } from '../utils/shareHand';
import { rf, rs, rb, rv, UI } from '../utils/responsive';
import { clearGameActive } from '../utils/dirtyShutdown';
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

function DealMeInButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={dealMeInStyles.btn}>
      <Pressable onPress={onPress} style={dealMeInStyles.inner}>
        <Text style={dealMeInStyles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}
const dealMeInStyles = StyleSheet.create({
  btn: {
    borderRadius: rv(16),
    backgroundColor: '#FFD700',
    marginHorizontal: rs(16),
    height: rb(64),
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, shadowOpacity: 0.5 },
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
const BOARD_STAGGER_MS = 200;  // ms between each board appearing
const DEAL_BTN_DELAY_MS = 800; // ms after last board before DEAL ME IN fades in

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

  const [showButtons, setShowButtons] = useState(true); // show immediately — no delayed timer
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

  const scrollRef = useRef<any>(null);

  // RN Animated values — JS thread only, zero Reanimated (iron rule: results.tsx = no reanimated)
  // Board stagger via pure state — no Animated.Value per board (stays under 4 total values)
  const [visibleBoardCount, setVisibleBoardCount] = useState(0);
  // Chip roll-up via pure state
  const [displayChips, setDisplayChips] = useState(chips);
  // Win boards glow — 1 shared value for all win boards simultaneously
  const glowAnim = useRef(new Animated.Value(0)).current;
  // COMPLETE banner spring
  const completeScale = useRef(new Animated.Value(0)).current;
  // DEAL ME IN fade (2 values = 4 total — under 5 limit)
  const dealBtnOpacity = useRef(new Animated.Value(0)).current;
  const dealBtnScale = useRef(new Animated.Value(0.9)).current;
  // Timer refs for cleanup
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animIntervals = useRef<ReturnType<typeof setInterval>[]>([]);

  // Dynamic card sizing: compact — fit boards + buttons on screen without excessive scrolling
  // Available = screenWidth - container padding (32) - board padding (20) - separator (4)
  const availableW = SCREEN_W - 32 - 20 - 4;
  const CARD_W = Math.min(Platform.OS === 'web' ? 56 : 36, Math.max(24, Math.floor(availableW / 6.5)));
  const CARD_H = Math.round(CARD_W * 1.4);

  // Debug: log on mount — Supabase log so we see it even after native crash
  useEffect(() => {
    debugLog('R1 results.tsx mounted');
    debugLog(`R2 revealData: ${revealData ? `boards=${revealData.boards.length} isComplete=${revealData.isComplete}` : 'NULL'}`);
    debugLog(`R3 chips: ${chips}`);
    debugLog(`R4 isComplete=${revealData?.isComplete}`);
    console.log('[RESULTS] mounted — revealData:', revealData ? `boards=${revealData.boards.length}` : 'NULL');
    void logResultsStep('H:results_mounted', revealData ? `boards=${revealData.boards.length}` : 'NULL');
    debugLog('🎮 results mounted — game flag still active (cleared on unmount)');
    // NOTE: clearGameActive() is NOT called here — called on unmount.
    // If crash happens inside results screen, the flag survives and triggers WhatsApp alert on next open.
    return () => {
      debugLog('🎮 results unmounting — clearing game active flag (clean exit)');
      void clearGameActive();
    };
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

    debugLog('A9 stats done');
  }, []);

  // Animations — RN Animated only (JS thread, safe on results screen — no Reanimated ever)
  useEffect(() => {
    if (!revealData) return;
    const boardLen = revealData.boards.length;

    // 1. Board stagger — pure state, no Animated.Value needed
    for (let i = 0; i < boardLen; i++) {
      const t = setTimeout(() => setVisibleBoardCount(i + 1), i * BOARD_STAGGER_MS);
      animTimers.current.push(t);
    }

    // 2. Chip roll-up — count from "before hand" balance up to current
    const chipTarget = useGameStore.getState().chips;
    const chipStart = chipTarget - revealData.netChips;
    const chipSteps = 20;
    const chipDuration = 800;
    let chipStep = 0;
    setDisplayChips(chipStart);
    const chipTimer = setInterval(() => {
      chipStep++;
      if (chipStep >= chipSteps) {
        setDisplayChips(chipTarget);
        clearInterval(chipTimer);
      } else {
        setDisplayChips(Math.round(chipStart + (chipTarget - chipStart) * (chipStep / chipSteps)));
      }
    }, chipDuration / chipSteps);
    animIntervals.current.push(chipTimer);

    // 3. Win glow — pulse once after all boards are visible
    if (revealData.boards.some((b) => b.winner === 'player')) {
      const glowDelay = (boardLen - 1) * BOARD_STAGGER_MS + 300;
      const glowTimer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
        ]).start();
      }, glowDelay);
      animTimers.current.push(glowTimer);
    }

    // 4. COMPLETE banner spring
    if (revealData.isComplete) {
      const completeTimer = setTimeout(() => {
        Animated.spring(completeScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }).start();
      }, 400);
      animTimers.current.push(completeTimer);
    }

    // 5. DEAL ME IN fade after stagger completes
    const dealDelay = (boardLen - 1) * BOARD_STAGGER_MS + DEAL_BTN_DELAY_MS;
    const dealTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(dealBtnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(dealBtnScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    }, dealDelay);
    animTimers.current.push(dealTimer);

    return () => {
      animTimers.current.forEach(clearTimeout);
      animIntervals.current.forEach(clearInterval);
      glowAnim.stopAnimation();
      completeScale.stopAnimation();
      dealBtnOpacity.stopAnimation();
      dealBtnScale.stopAnimation();
    };
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

  // Win glow color interpolation (useNativeDriver: false — needed for borderColor)
  const winBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(76,175,80,0.3)', 'rgba(76,175,80,0.9)'],
  });

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
      <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title + score */}
        <View style={styles.titleSection}>
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
        </View>

        {/* Board results — staggered fade-in (pure state, no Animated.Value per board) */}
        {boards.map((board, i) => {
          // Stagger: boards appear one at a time, 200ms apart
          if (i >= visibleBoardCount) return null;

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
            <View
              key={i}
              style={{ width: '100%' }}
            >
              <View style={[
                styles.boardCard,
                { backgroundColor: theme.surface, borderColor: theme.boardBorder },
                board.winner === 'player' && styles.boardCardWin,
                board.winner === 'bot' && styles.boardCardLose,
              ]}>
                {/* Win glow overlay — absolute border that pulses green for won boards */}
                {board.winner === 'player' && (
                  <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, {
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: winBorderColor,
                    }]}
                  />
                )}
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
              </View>
            </View>
          );
        })}

        {/* Share Game button + offscreen FullGameShareCard */}
        {Platform.OS !== 'web' && (
          <View style={{ width: '100%', gap: 8 }}>
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
          </View>
        )}

        {/* Efficiency analysis */}
        {efficiency && (
          <View style={{ width: '100%' }}>
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
          </View>
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
            <View style={styles.bestHandRow}>
              <Text style={styles.bestHandText}>⭐ Best hand: {bestName} on Board {bestBoard}</Text>
            </View>
          );
        })()}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Text style={styles.statItem}>Boards: {playerWins}/{boards.length}</Text>
          <Text style={styles.statSep}>|</Text>
          <Text style={[styles.statItem, { color: netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>
            Net: {netChips >= 0 ? '+' : ''}{netChips}
          </Text>
          <Text style={styles.statSep}>|</Text>
          <Text style={styles.statItem}>Games: {useGameStore.getState().handsPlayed}</Text>
        </View>

        {/* Complete bonus — spring scale entrance */}
        {isComplete && completeBonusAmount > 0 && (
          <Animated.View style={[styles.completeRow, { transform: [{ scale: completeScale }] }]}>
            <Text style={styles.completeLabel}>🏆 COMPLETE! +50% BONUS</Text>
            <Text style={styles.completeAmount}>+{completeBonusAmount} bonus chips!</Text>
          </Animated.View>
        )}

        {/* Net result */}
        <View style={styles.netSection}>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Result</Text>
            <Text style={[styles.netAmount, { color: netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>
              {netChips >= 0 ? '+' : ''}{netChips}
            </Text>
          </View>
        </View>

        {/* Current balance — rolls up from pre-hand value */}
        <ChipsDisplay amount={displayChips} label="Current Balance" size="large" />

        {/* Buttons — always visible, no delay */}
        <View style={styles.buttons}>
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
                <Animated.View style={{ opacity: dealBtnOpacity, transform: [{ scale: dealBtnScale }] }}>
                  <DealMeInButton
                    label={chips >= config.potPerBoard * revealData.boardCount ? 'DEAL ME IN' : 'GAME OVER'}
                    onPress={handleNextHand}
                  />
                </Animated.View>
                <View style={styles.rematchRow}>
                  {!isMultiplayer && (
                    <Button title="REMATCH" variant="secondary" onPress={handleRematch} style={{ flex: 1 }} />
                  )}
                  <Button title="HOME" variant="secondary" onPress={handleHome} style={!isMultiplayer ? { flex: 1 } : {}} />
                </View>
              </>
            )}
          </View>
      </ScrollView>
      </View>
    </SafeAreaView>
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
