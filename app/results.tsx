import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, Alert, Pressable, Animated } from 'react-native';
// ZERO Reanimated on results screen — game.tsx has 7 active shared values during transition
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DealMeInButton } from '../components/DealMeInButton';
import { BoardResultCard } from '../components/BoardResultCard';
import { CompleteBanner } from '../components/CompleteBanner';
import { ShareSection } from '../components/ShareSection';
import { EfficiencyCard } from '../components/EfficiencyCard';
import ChipsDisplay from '../components/ChipsDisplay';
import { FriendsBg } from '../components/FriendsBg';
import { useResultsAnimations } from '../hooks/useResultsAnimations';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { CardsDealtPayload } from '../constants/networkConfig';
import { submitScore } from '../utils/leaderboard';
import { WEB_MAX_WIDTH } from '../components/WebContainer';
import { WAITING_STATE_TIMEOUT_MS } from '../utils/realtimeMultiplayer';
import { getMatchCost, canAffordMatch } from '../utils/economy';
import { CapsHooks } from '../utils/learning';
import { saveHandToHistory, HandRecord, HandBoardRecord } from '../utils/handHistory';
import { saveHandForWebReplay, ShareData } from '../utils/shareHand';
import { rf, rs, rb, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAchievements, getAchievement, Achievement } from '../utils/achievements';
import AchievementToast from '../components/AchievementToast';
import { clearGameActive } from '../utils/dirtyShutdown';
import { getSupabase } from '../utils/supabase';
import { debugLog } from '../components/DebugOverlay';
// @ts-ignore — parallel agent file, exists at deploy time
import { useBattlePassStore } from '../stores/battlePassStore';
// @ts-ignore — parallel agent file, exists at deploy time
import { BATTLE_PASS_CONFIG } from '../constants/battlePassConfig';
// @ts-ignore — parallel agent file, exists at deploy time
import { getProgressToNextTier } from '../utils/battlePass';
// @ts-ignore — parallel agent file, exists at deploy time
import XPBar from '../components/XPBar';

async function logResultsStep(step: string, extra?: string) {
  debugLog(`[RESULTS-STEP] ${step}${extra ? ` — ${extra}` : ''}`);
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('bug_reports').insert({ title: `[CRASH-STEP] results/${step}`, description: extra ?? null, url: 'results/mount', report_type: 'text' });
  } catch {}
}

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

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

  const updateConfig = useGameStore((s) => s.updateConfig);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);
  const currentWinStreak = useGameStore((s) => s.currentWinStreak);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const [savedHandId, setSavedHandId] = useState<string | null>(null);
  const [xpGained, setXpGained] = useState(0);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [autoShareUrl, setAutoShareUrl] = useState<string | null>(null);
  const [waitingForNextHand, setWaitingForNextHand] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [showUpgradeNudge, setShowUpgradeNudge] = useState(false);
  const scrollRef = useRef<any>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    screenOpacity, glowAnim, completeScale, dealBtnOpacity, dealBtnScale,
    winBadgeAnim, chipsFlashAnim, boardTranslates, visibleBoardCount, displayChips,
  } = useResultsAnimations(revealData);

  const CARD_W = Math.min(Platform.OS === 'web' ? 56 : 36, Math.max(24, Math.floor((SCREEN_W - 56) / 6.5)));
  const CARD_H = Math.round(CARD_W * 1.4);

  // Mount: debug logging + dirty shutdown cleanup
  useEffect(() => {
    debugLog('R1 results.tsx mounted');
    debugLog(`R2 revealData: ${revealData ? `boards=${revealData.boards.length} isComplete=${revealData.isComplete}` : 'NULL'}`);
    void logResultsStep('H:results_mounted', revealData ? `boards=${revealData.boards.length}` : 'NULL');
    return () => { void clearGameActive(); };
  }, []);

  // Auto-sim marathon
  useEffect(() => {
    if (autoSim !== 'true') return;
    const total = parseInt(autoSimCount ?? '1', 10);
    const current = parseInt(currentSimHand ?? '1', 10);
    if (current < total) {
      const t = setTimeout(() => {
        router.replace(`/game?autoSim=true&autoSimCount=${total}&currentSimHand=${current + 1}` as any);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [autoSim]);

  // Guard: no data → go home
  useEffect(() => {
    if (!revealData) router.replace('/');
  }, [revealData, router]);

  // Stats tracking + auto-save
  useEffect(() => {
    if (!revealData) return;
    incrementHandsPlayed();
    updateBestChips();
    if (revealData.netChips > 0) { incrementHandsWon(); updateBiggestWin(revealData.netChips); }

    // [BANKROLL] Verify bankroll sync — logs in-memory vs persisted value
    console.log('[BANKROLL] chips in store:', chips, 'netChips:', revealData.netChips);
    AsyncStorage.getItem('caps-poker-storage').then(stored => {
      if (stored) {
        try { const p = JSON.parse(stored); console.log('[BANKROLL] persisted chips:', p?.state?.chips); } catch {}
      }
    }).catch(() => {});

    revealData.boards.forEach((board, i) => CapsHooks.boardCompleted(i, board.playerHandName, board.winner === 'player'));
    if (revealData.isComplete && revealData.completeBonusAmount > 0) CapsHooks.bonusAchieved('complete', revealData.completeBonusAmount);

    const store = useGameStore.getState();
    submitScore(store.playerName || 'Player', store.chips, store.handsPlayed, store.handsWon, store.biggestWin).catch(() => {});

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
    setSavedHandId(handRecord.id);

    // Auto-save to shared_hands (ensures rows exist even if user never taps share)
    const autoShareData: ShareData = {
      boards: revealData.boards,
      netChips: revealData.netChips,
      isComplete: revealData.isComplete,
      completeBonusAmount: revealData.completeBonusAmount,
      boardsWon: revealData.boards.filter((b) => b.winner === 'player').length,
      totalBoards: revealData.boards.length,
      potPerBoard: revealData.potPerBoard,
      numberOfPlayers: revealData.numberOfPlayers,
    };
    saveHandForWebReplay(autoShareData).then((url) => { if (url) setAutoShareUrl(url); }).catch(() => {});

    // "Try 4 boards" nudge — shown after first game (3-board intro)
    AsyncStorage.getItem('caps_games_played').then((val) => {
      const played = parseInt(val ?? '0', 10);
      if (played === 1 && revealData.boardCount === 3) setShowUpgradeNudge(true);
    }).catch(() => {});

    // Achievement checks — run after stats are incremented
    const gs = useGameStore.getState();
    const newWin = revealData.netChips > 0;
    if (newWin) gs.incrementWinStreak(); else gs.resetWinStreak();

    const newlyUnlocked = checkAchievements({
      revealData,
      config,
      handsPlayed: gs.handsPlayed,
      handsWon: gs.handsWon,
      currentWinStreak: newWin ? gs.currentWinStreak : 0,
      isMultiplayer,
      alreadyUnlocked: gs.unlockedAchievements,
    });

    if (newlyUnlocked.length > 0) {
      const toasts = newlyUnlocked
        .map((id) => getAchievement(id))
        .filter((a): a is Achievement => a !== undefined);
      toasts.forEach((a) => {
        gs.unlockAchievement(a.id);
        gs.addChips(a.reward);
        gs.trackChipsEarned(a.reward);
      });
      setPendingAchievements(toasts);
    }

    // Battle Pass XP + mission tracking
    try {
      const boardsWonByPlayer = revealData.boards.filter((b) => b.winner === 'player').length;
      const isWinner = revealData.netChips > 0;
      const isComplete = revealData.isComplete;
      const earned = BATTLE_PASS_CONFIG.xpPerGame
        + (boardsWonByPlayer * BATTLE_PASS_CONFIG.xpPerBoardWin)
        + (isWinner ? BATTLE_PASS_CONFIG.xpPerGameWin : 0)
        + (isComplete ? BATTLE_PASS_CONFIG.xpPerComplete : 0);
      const bpStore = useBattlePassStore.getState();
      bpStore.addXP(earned);
      bpStore.trackMissionProgress('games_played', 1);
      bpStore.trackMissionProgress('boards_won', boardsWonByPlayer);
      if (isWinner) bpStore.trackMissionProgress('games_won', 1);
      if (isComplete) bpStore.trackMissionProgress('complete', 1);
      setXpGained(earned);
    } catch {}
  }, []);

  const handleNextHand = useCallback(() => {
    if (!revealData) return;
    const boardCount = revealData.boardCount;

    if (isMultiplayer) {
      setWaitingForNextHand(true);
      waitingTimeoutRef.current = setTimeout(() => {
        Alert.alert('Waiting Timed Out', 'No response from other players.', [
          { text: 'Keep Waiting', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } },
        ]);
      }, WAITING_STATE_TIMEOUT_MS);

      const navigateToMpGame = (isHost: boolean, pIndex: number, pCount: number, yourCards: any[], boards: any[]) => {
        clearRevealData();
        router.replace({ pathname: '/multiplayer-game', params: { isHost: isHost ? 'true' : 'false', playerIndex: String(pIndex), playerCount: String(pCount), yourCards: JSON.stringify(yourCards), boards: JSON.stringify(boards) } } as any);
      };

      if (mpServer) {
        mpServer.updateCallbacks({
          onNewHandDealt: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            const { boards: newBoards, playerHands } = mpServer.getDealtCards();
            const boardsData = newBoards.map((b: any, i: number) => ({ boardIndex: i, openCards: b.openCards, closedCardCount: b.closedCards.length }));
            navigateToMpGame(true, 0, mpServer.getClients().filter((c: any) => c.connected).length, playerHands[0], boardsData);
          },
        });
        mpServer.requestNextHand(config);
      } else if (mpClient) {
        const myId = mpClient.getPlayerId();
        const mySeat = connectedPlayers.find((p) => p.id === myId)?.seat ?? 1;
        mpClient.updateCallbacks({
          onCardsDealt: (data: CardsDealtPayload) => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            navigateToMpGame(false, mySeat, data.playerCount, data.yourCards, data.boards);
          },
          onHostLost: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Host disconnected');
            Alert.alert('Host Disconnected', 'The host has left the game.', [{ text: 'Leave', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } }]);
          },
          onDisconnected: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Connection lost');
            const code = storeRoomCode;
            Alert.alert('Connection Lost', 'Lost connection to the game room. You can try to rejoin.', [
              { text: 'Leave', style: 'cancel', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } },
              { text: 'Rejoin', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace({ pathname: '/lobby/internet-join', params: code ? { prefillCode: code } : {} } as any); } },
            ]);
          },
        });
        mpClient.sendNextHandRequest();
      }
      return;
    }

    clearRevealData();
    if (canAffordMatch(chips, getMatchCost(config.potPerBoard, boardCount))) {
      router.replace('/game');
    } else {
      router.replace('/gameover');
    }
  }, [revealData, chips, config, clearRevealData, router, isMultiplayer, mpServer, mpClient, connectedPlayers]);

  const handleHome = useCallback(() => { clearRevealData(); router.replace('/'); }, [clearRevealData, router]);
  const handleRematch = useCallback(() => { clearRevealData(); router.replace('/game'); }, [clearRevealData, router]);

  if (!revealData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  const { boards, netChips, isComplete, completeBonusAmount, numberOfPlayers, boardCount } = revealData;
  const playerWins = boards.filter((b) => b.winner === 'player').length;
  const botWins = boards.filter((b) => b.winner === 'bot').length;
  const isPerfectGame = playerWins === boards.length && boards.length > 0;
  const potPerBoardTotal = revealData.potPerBoard * numberOfPlayers;

  const shareData: ShareData = {
    boards, netChips, isComplete, completeBonusAmount,
    boardsWon: playerWins, totalBoards: boards.length,
    potPerBoard: revealData.potPerBoard, numberOfPlayers,
  };

  const winBorderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(76,175,80,0.3)', 'rgba(76,175,80,0.9)'] });

  const HAND_ORDER = ['Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card'];
  let bestRank = 99; let bestName = ''; let bestBoard = 0;
  boards.forEach((b, i) => { const r = HAND_ORDER.indexOf(b.playerHandName); if (r >= 0 && r < bestRank) { bestRank = r; bestName = b.playerHandName; bestBoard = i + 1; } });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FriendsBg />
      {/* Achievement toasts — shown one at a time */}
      {pendingAchievements.length > 0 && (
        <AchievementToast
          achievement={pendingAchievements[0]}
          onDone={() => setPendingAchievements((prev) => prev.slice(1))}
        />
      )}
      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Title + score */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: isPerfectGame ? COLORS.gold : playerWins > botWins ? COLORS.neonGreen : playerWins < botWins ? COLORS.neonRed : COLORS.gold }]}>
              {isPerfectGame ? 'PERFECT!' : playerWins > botWins ? 'YOU WIN' : playerWins < botWins ? 'YOU LOSE' : 'TIE GAME'}
            </Text>
            <Text style={[styles.scoreDisplay, { fontSize: Math.min(42, Math.floor(SCREEN_W * 0.105)) }]}>
              <Text style={{ color: COLORS.neonGreen }}>{playerWins}</Text>
              <Text style={[styles.scoreSep, { fontSize: Math.min(32, Math.floor(SCREEN_W * 0.08)) }]}> — </Text>
              <Text style={{ color: COLORS.neonRed }}>{botWins}</Text>
            </Text>
          </View>

          {/* Battle Pass XP banner */}
          {xpGained > 0 && (() => {
            let bpCurrentXP = 0;
            let bpCurrentTier = 1;
            let bpProgress = 0;
            let bpXpInTier = 0;
            let bpXpNeeded = 100;
            try {
              const bpSnap = useBattlePassStore.getState();
              bpCurrentXP = bpSnap.currentXP;
              bpCurrentTier = bpSnap.currentTier;
              const prog = getProgressToNextTier(bpCurrentXP);
              bpProgress = prog.progress;
              bpXpInTier = prog.xpInTier;
              bpXpNeeded = prog.xpNeeded;
            } catch {}
            const boardsWonForBanner = boards.filter((b) => b.winner === 'player').length;
            const isWinnerForBanner = netChips > 0;
            return (
              <View style={styles.xpBanner}>
                <Text style={styles.xpBannerTitle}>⚔️ +{xpGained} XP</Text>
                <Text style={styles.xpBannerBreakdown}>
                  {'Game: ' + BATTLE_PASS_CONFIG.xpPerGame}
                  {boardsWonForBanner > 0 ? (' · Boards: +' + boardsWonForBanner * BATTLE_PASS_CONFIG.xpPerBoardWin) : ''}
                  {isWinnerForBanner ? (' · Win: +' + BATTLE_PASS_CONFIG.xpPerGameWin) : ''}
                  {isComplete ? (' · Complete: +' + BATTLE_PASS_CONFIG.xpPerComplete) : ''}
                </Text>
                <XPBar
                  currentXP={bpCurrentXP}
                  currentTier={bpCurrentTier}
                  progress={bpProgress}
                  xpInTier={bpXpInTier}
                  xpNeeded={bpXpNeeded}
                  compact={false}
                />
              </View>
            );
          })()}

          {/* Board result cards — staggered fade-in */}
          {boards.map((board, i) => {
            if (i >= visibleBoardCount) return null;
            if (!boardTranslates.current[i]) boardTranslates.current[i] = new Animated.Value(30);
            return (
              <BoardResultCard
                key={i}
                board={board as any}
                boardIndex={i}
                pot={potPerBoardTotal}
                cardW={CARD_W}
                cardH={CARD_H}
                translateY={boardTranslates.current[i]}
                winBorderColor={winBorderColor}
                winBadgeAnim={winBadgeAnim}
                shareData={shareData}
                autoShareUrl={autoShareUrl}
                isComplete={isComplete}
                completeBonusAmount={completeBonusAmount}
              />
            );
          })}

          {/* Game share section */}
          <ShareSection
            shareData={shareData}
            autoShareUrl={autoShareUrl}
            boards={boards}
            netChips={netChips}
            isComplete={isComplete}
            completeBonusAmount={completeBonusAmount}
            potPerBoard={revealData.potPerBoard}
            numberOfPlayers={numberOfPlayers}
          />

          {/* Placement efficiency */}
          <EfficiencyCard boards={boards as any} screenW={SCREEN_W} />

          {/* Best hand highlight */}
          {bestName ? (
            <View style={styles.bestHandRow}>
              <Text style={styles.bestHandText}>⭐ Best hand: {bestName} on Board {bestBoard}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>Boards: {playerWins}/{boards.length}</Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={[styles.statItem, { color: netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>Net: {netChips >= 0 ? '+' : ''}{netChips}</Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={styles.statItem}>Games: {useGameStore.getState().handsPlayed}</Text>
          </View>

          {/* Complete bonus banner */}
          <CompleteBanner visible={isComplete} bonusChips={completeBonusAmount} scale={completeScale} />

          {/* Net result */}
          <View style={styles.netSection}>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net Result</Text>
              {netChips > 0 ? (
                <Animated.Text style={[styles.netAmount, { color: chipsFlashAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['#FFD700', '#FFD700', '#4CAF50'] }) }]}>
                  +{netChips}
                </Animated.Text>
              ) : (
                <Text style={[styles.netAmount, { color: netChips === 0 ? COLORS.textDim : COLORS.neonRed }]}>{netChips === 0 ? '±0' : netChips}</Text>
              )}
            </View>
          </View>

          {/* Current balance */}
          <ChipsDisplay amount={displayChips} label="Current Balance" size="large" />

          {/* First game: upgrade nudge — "Try 4 boards next!" */}
          {showUpgradeNudge && (
            <View style={styles.upgradeNudge}>
              <Text style={styles.upgradeNudgeText}>
                {getLanguage() === 'he'
                  ? 'מוכן לאתגר המלא? נסה 4 בורדים!'
                  : 'Ready for the full challenge? Try 4 boards next!'}
              </Text>
              <View style={styles.upgradeNudgeRow}>
                <Pressable
                  style={styles.upgradeNudgeBtn}
                  onPress={() => { updateConfig({ numberOfPlayers: 2 }); setShowUpgradeNudge(false); }}
                >
                  <Text style={styles.upgradeNudgeBtnText}>4 BOARDS →</Text>
                </Pressable>
                <Pressable onPress={() => setShowUpgradeNudge(false)}>
                  <Text style={styles.upgradeNudgeDismiss}>Later</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.buttons}>
            {waitingForNextHand ? (
              <View style={styles.waitingNextHand}>
                <Text style={styles.waitingNextHandText}>{disconnectMessage || 'Waiting for other players...'}</Text>
                {disconnectMessage && (
                  <Button title="LEAVE" variant="secondary" onPress={() => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); }} style={{ marginTop: 8, width: '100%' }} />
                )}
              </View>
            ) : (
              <>
                <Animated.View style={{ opacity: dealBtnOpacity, transform: [{ scale: dealBtnScale }] }}>
                  <DealMeInButton
                    label={chips >= config.potPerBoard * revealData.boardCount ? t().dealMeIn : 'GAME OVER'}
                    onPress={handleNextHand}
                  />
                </Animated.View>
                {savedHandId && !isMultiplayer && (
                  <Animated.View style={{ opacity: dealBtnOpacity, alignItems: 'center', marginTop: rs(8) }}>
                    <Pressable style={styles.coachingBtn} onPress={() => router.push(`/coaching?handId=${savedHandId}`)}>
                      <Text style={styles.coachingBtnText}>💡 COACHING</Text>
                    </Pressable>
                  </Animated.View>
                )}
                <View style={styles.rematchRow}>
                  {!isMultiplayer && <Button title="REMATCH" variant="secondary" onPress={handleRematch} style={{ flex: 1 }} />}
                  <Button title="HOME" variant="secondary" onPress={handleHome} style={!isMultiplayer ? { flex: 1 } : {}} />
                </View>
              </>
            )}
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: rs(16), paddingBottom: rs(32), gap: rs(12), alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.gold, fontSize: rf(20), fontWeight: '800' },
  titleSection: { alignItems: 'center', gap: rs(8) },
  title: { fontSize: rf(24), fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  scoreDisplay: { fontSize: rf(42), fontWeight: '900' },
  scoreSep: { color: COLORS.textDim, fontSize: rf(32), fontWeight: '300' },
  netSection: { width: '100%' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: rs(4) },
  netLabel: { color: COLORS.textMuted, fontSize: rf(16), fontWeight: '600' },
  netAmount: { fontSize: rf(28), fontWeight: '900' },
  buttons: { width: '100%', gap: rs(10), marginTop: rs(4) },
  rematchRow: { flexDirection: 'row', gap: rs(10) },
  coachingBtn: { paddingVertical: rs(10), paddingHorizontal: rs(28), borderWidth: 1, borderColor: COLORS.gold, borderRadius: rv(16), backgroundColor: 'rgba(255,215,0,0.08)' },
  coachingBtnText: { color: COLORS.gold, fontSize: rf(14), fontWeight: '800', letterSpacing: 1.5 },
  waitingNextHand: { backgroundColor: COLORS.feltLight, paddingVertical: rs(14), borderRadius: rv(10), borderWidth: 1, borderColor: COLORS.boardBorder, alignItems: 'center' },
  waitingNextHandText: { color: COLORS.textSecondary, fontSize: rf(16), fontWeight: '600' },
  bestHandRow: { width: '100%', paddingHorizontal: rs(4), paddingVertical: rs(6) },
  bestHandText: { color: '#FFD700', fontSize: rf(13), fontStyle: 'italic', textAlign: 'center' },
  statsRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(8), paddingVertical: rs(6) },
  statItem: { color: 'rgba(255,255,255,0.5)', fontSize: rf(12) },
  statSep: { color: 'rgba(255,255,255,0.2)', fontSize: rf(12) },
  upgradeNudge: { width: '100%', backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', borderRadius: rv(10), padding: rs(14), gap: rs(10) },
  upgradeNudgeText: { color: COLORS.gold, fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  upgradeNudgeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(16) },
  upgradeNudgeBtn: { paddingVertical: rs(8), paddingHorizontal: rs(20), backgroundColor: COLORS.gold, borderRadius: rv(8) },
  upgradeNudgeBtnText: { color: '#1C0508', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  upgradeNudgeDismiss: { color: COLORS.textMuted, fontSize: rf(12) },
  xpBanner: { width: '100%', backgroundColor: 'rgba(201,168,76,0.10)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', borderRadius: rv(10), padding: rs(14), gap: rs(6) },
  xpBannerTitle: { color: '#FFD700', fontSize: rf(16), fontWeight: '800', letterSpacing: 1 },
  xpBannerBreakdown: { color: 'rgba(255,255,255,0.55)', fontSize: rf(12), fontWeight: '500' },
});
