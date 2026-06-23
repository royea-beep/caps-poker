import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { playSound } from '../utils/sounds';
import { getDeviceId } from '../utils/leaderboard';
import { earnChips, spendChips } from '../utils/supabaseEconomy';
// @ts-ignore
import { useGameStore } from '../store/gameStore';
import { initializeGame, autoFillPlayerCards, placeBotCards, evaluateBoard } from '../utils/gameLogic';

const TOTAL_HANDS = 5;
const TIMER_SECONDS = 180;
const BUY_IN = 200;
const WIN_CHIPS = 100;
const WIN_PROBABILITY = 0.45;
const RESULT_DISPLAY_MS = 1500;

type HandResult = 'win' | 'loss' | 'tie';

interface HandRecord { handNumber: number; result: HandResult; chipsEarned: number; }

type GamePhase = 'loading' | 'playing' | 'ended';

function simulateHandResult(): HandResult {
  const roll = Math.random();
  if (roll < WIN_PROBABILITY) return 'win';
  if (roll < WIN_PROBABILITY + 0.08) return 'tie';
  return 'loss';
}

function tryRealHandResult(): HandResult {
  try {
    const { gameState } = initializeGame();
    const { boards: filledBoards } = autoFillPlayerCards(gameState.playerHand, gameState.boards);
    const boardsWithBot = placeBotCards(gameState.botHand, filledBoards, 'easy');
    const board = boardsWithBot[0];
    const result = evaluateBoard(board);
    if (!result) return simulateHandResult();
    if (result.winner === 'player') return 'win';
    if (result.winner === 'tie') return 'tie';
    return 'loss';
  } catch { return simulateHandResult(); }
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// PR-G Bug 2 — produce a real error message from a failed spend_chips response.
// The server returns { success: false, balance?: number, error_code?: string };
// callRPC (post-PR-G) now passes the failed response through to callers instead
// of returning null. Previously quick-poker hardcoded 'Not enough chips (200 required)'
// for every failure mode (network, RLS, unregistered device) which was misleading.
function formatBuyInError(
  result: { success?: boolean; balance?: number; error_code?: string; new_balance?: number } | null | undefined,
  needed: number,
): string {
  if (!result) return "Couldn't reach the chip server. Tap Go Back and try again.";
  const have = result.balance ?? result.new_balance;
  if (result.error_code === 'INSUFFICIENT_BALANCE' || (typeof have === 'number' && have < needed)) {
    return typeof have === 'number'
      ? `Not enough chips. You have ${have.toLocaleString()}; ${needed.toLocaleString()} needed.`
      : `Not enough chips (${needed.toLocaleString()} needed).`;
  }
  if (result.error_code) return `Couldn't enter the game (${result.error_code}). Try again.`;
  return "Couldn't enter the game. Try again.";
}

export default function QuickPokerScreen() {
  const router = useRouter();
  // @ts-ignore
  const setChips = useGameStore((s: any) => s.setChips);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [currentHand, setCurrentHand] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [handHistory, setHandHistory] = useState<HandRecord[]>([]);
  const [showingResult, setShowingResult] = useState(false);
  const [lastResult, setLastResult] = useState<HandResult | null>(null);
  const [totalChipsEarned, setTotalChipsEarned] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getDeviceId();
        if (cancelled) return;
        setDeviceId(id);
        const result = await spendChips(id, 'quick_poker_buy_in', BUY_IN);
        if (cancelled) return;
        // PR-G Bug 2: surface the real error reason. Pre-PR-G this hardcoded
        // 'Not enough chips (200 required)' for ANY failure mode (network, RLS,
        // unregistered device) which was misleading when the user had >200 chips.
        if (!result || !result.success) { setLoadError(formatBuyInError(result, BUY_IN)); return; }
        if (result.new_balance != null) setChips?.(result.new_balance);
        setPhase('playing');
      } catch { if (!cancelled) setLoadError('Error entering game'); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || showingResult) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); endGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, showingResult]);

  const endGame = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('ended');
  }, []);

  const playHand = useCallback(async () => {
    if (showingResult || phase !== 'playing') return;
    setShowingResult(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const handNum = currentHand + 1;
    const result = tryRealHandResult();
    setLastResult(result);
    let chipsEarned = 0;
    if (result === 'win') {
      playSound('chipsWin');
      try {
        const id = deviceId || await getDeviceId();
        const earnResult = await earnChips(id, 'quick_poker_win' as any, WIN_CHIPS);
        if (earnResult?.success) {
          chipsEarned = earnResult.chips_earned ?? WIN_CHIPS;
          setTotalChipsEarned((prev) => prev + chipsEarned);
          if (earnResult.new_balance != null) setChips?.(earnResult.new_balance);
        }
      } catch { /* ok */ }
    } else if (result === 'loss') {
      playSound('boardLose');
    }
    const record: HandRecord = { handNumber: handNum, result, chipsEarned };
    setHandHistory((prev) => [...prev, record]);
    setTimeout(() => {
      setLastResult(null); setShowingResult(false);
      if (handNum >= TOTAL_HANDS) { endGame(); } else { setCurrentHand(handNum); }
    }, RESULT_DISPLAY_MS);
  }, [showingResult, phase, currentHand, deviceId, endGame]);

  const playAgain = useCallback(() => {
    gameEndedRef.current = false;
    setPhase('loading');
    setCurrentHand(0); setTimeLeft(TIMER_SECONDS); setHandHistory([]);
    setShowingResult(false); setLastResult(null); setTotalChipsEarned(0); setLoadError(null);
    (async () => {
      try {
        const id = deviceId || await getDeviceId();
        const result = await spendChips(id, 'quick_poker_buy_in', BUY_IN);
        if (!result || !result.success) { setLoadError(formatBuyInError(result, BUY_IN)); return; }
        if (result.new_balance != null) setChips?.(result.new_balance);
        setPhase('playing');
      } catch { setLoadError('Error entering game'); }
    })();
  }, [deviceId]);

  const handsWon = handHistory.filter((h) => h.result === 'win').length;
  const timerDanger = timeLeft <= 30;

  if (phase === 'loading' && !loadError) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Preparing table...</Text>
          <Text style={styles.loadingSubtext}>Buy-in: {BUY_IN} chips</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{loadError}</Text>
          {/* PR-G Bug 2: give the user a way out other than Back. */}
          <Pressable style={styles.btnSecondary} onPress={() => router.push('/shop' as any)}>
            <Text style={styles.btnSecondaryText}>Go to Shop</Text>
          </Pressable>
          <Pressable style={[styles.btnSecondary, { marginTop: 12 }]} onPress={() => router.back()}>
            <Text style={styles.btnSecondaryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'ended') {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.endScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.endTitle}>Game Summary</Text>
          <Text style={styles.endSubtitle}>Quick Poker — {TOTAL_HANDS} hands</Text>
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}><Text style={styles.scoreLabel}>Hands Won</Text><Text style={styles.scoreValue}>{handsWon} / {handHistory.length}</Text></View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}><Text style={styles.scoreLabel}>Chips Earned</Text><Text style={[styles.scoreValue, totalChipsEarned > 0 && styles.scoreValueGold]}>+{totalChipsEarned}</Text></View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}><Text style={styles.scoreLabel}>Buy-in</Text><Text style={[styles.scoreValue, styles.scoreValueRed]}>-{BUY_IN}</Text></View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, styles.netLabel]}>Net</Text>
              <Text style={[styles.scoreValue, styles.netValue, totalChipsEarned - BUY_IN >= 0 ? styles.scoreValueGold : styles.scoreValueRed]}>
                {totalChipsEarned - BUY_IN >= 0 ? '+' : ''}{totalChipsEarned - BUY_IN}
              </Text>
            </View>
          </View>
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Hand Details</Text>
            {handHistory.map((h) => (
              <View key={h.handNumber} style={styles.historyRow}>
                <Text style={styles.historyHandLabel}>Hand {h.handNumber}</Text>
                <View style={[styles.historyBadge, h.result === 'win' ? styles.badgeWin : h.result === 'tie' ? styles.badgeTie : styles.badgeLoss]}>
                  <Text style={styles.historyBadgeText}>{h.result === 'win' ? `Win +${h.chipsEarned}` : h.result === 'tie' ? 'Tie' : 'Loss'}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable style={styles.btnPrimary} onPress={playAgain}><Text style={styles.btnPrimaryText}>Play Again — {BUY_IN} chips</Text></Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => router.back()}><Text style={styles.btnSecondaryText}>Home</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.modeLabel}>Quick Poker</Text>
        <View style={[styles.timerBadge, timerDanger && styles.timerBadgeDanger]}>
          <Text style={[styles.timerText, timerDanger && styles.timerTextDanger]}>{formatTime(timeLeft)}</Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <Text style={styles.handLabel}>Hand {Math.min(currentHand + 1, TOTAL_HANDS)} / {TOTAL_HANDS}</Text>
        <View style={styles.progressTrack}>
          {Array.from({ length: TOTAL_HANDS }).map((_, i) => {
            const rec = handHistory[i];
            return (<View key={i} style={[styles.progressDot, rec?.result === 'win' && styles.progressDotWin, rec?.result === 'loss' && styles.progressDotLoss, rec?.result === 'tie' && styles.progressDotTie, !rec && i === currentHand && styles.progressDotActive]} />);
          })}
        </View>
      </View>
      <View style={styles.playArea}>
        {showingResult && lastResult !== null && (
          <View style={[styles.resultCard, lastResult === 'win' ? styles.resultCardWin : lastResult === 'tie' ? styles.resultCardTie : styles.resultCardLoss]}>
            <Text style={styles.resultIcon}>{lastResult === 'win' ? 'WIN' : lastResult === 'tie' ? 'TIE' : 'LOSS'}</Text>
            <Text style={styles.resultLabel}>{lastResult === 'win' ? `+${WIN_CHIPS} chips` : lastResult === 'tie' ? 'Push' : 'Better luck next time'}</Text>
          </View>
        )}
        {!showingResult && (
          <View style={styles.tableGraphic}><View style={styles.tableOuter}><View style={styles.tableInner}><Text style={styles.tableEmoji}>&#x1F0CF;</Text><Text style={styles.tableText}>Tap to deal</Text></View></View></View>
        )}
        {!showingResult && (
          <Pressable style={({ pressed }) => [styles.dealBtn, pressed && styles.dealBtnPressed]} onPress={playHand}>
            <Text style={styles.dealBtnText}>Deal Hand</Text>
          </Pressable>
        )}
        {showingResult && (
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color={COLORS.goldDim} />
            <Text style={styles.waitingText}>Next hand...</Text>
          </View>
        )}
      </View>
      <View style={styles.scoreStrip}>
        <View style={styles.scoreStripItem}><Text style={styles.scoreStripLabel}>Wins</Text><Text style={styles.scoreStripValue}>{handsWon}</Text></View>
        <View style={styles.scoreStripDivider} />
        <View style={styles.scoreStripItem}><Text style={styles.scoreStripLabel}>Earned</Text><Text style={[styles.scoreStripValue, styles.scoreStripGold]}>+{totalChipsEarned}</Text></View>
        <View style={styles.scoreStripDivider} />
        <View style={styles.scoreStripItem}><Text style={styles.scoreStripLabel}>Buy-in</Text><Text style={[styles.scoreStripValue, styles.scoreStripRed]}>-{BUY_IN}</Text></View>
      </View>
    </SafeAreaView>
  );
}

const BG = '#1a0e06';
const ACCENT = '#c96a1a';
const TEXT_COLOR = '#f5e6d3';
const BORDER_COLOR = '#3d2a1a';
const WIN_GREEN = '#2ecc71';
const LOSS_RED = '#c0392b';
const TIE_BLUE = '#4fc3f7';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rs(16), paddingHorizontal: rs(24) },
  loadingText: { color: TEXT_COLOR, fontSize: rf(18), fontWeight: '600' },
  loadingSubtext: { color: COLORS.textMuted, fontSize: rf(14) },
  errorText: { color: LOSS_RED, fontSize: rf(16), textAlign: 'center', fontWeight: '600', marginBottom: rs(16) },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(16), paddingVertical: rv(10), borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  backBtn: { paddingVertical: rv(6), paddingHorizontal: rs(12), borderRadius: rs(8), backgroundColor: BORDER_COLOR },
  backBtnText: { color: TEXT_COLOR, fontSize: rf(14), fontWeight: '500' },
  modeLabel: { color: ACCENT, fontSize: rf(16), fontWeight: '700', letterSpacing: 0.5 },
  timerBadge: { paddingVertical: rv(4), paddingHorizontal: rs(12), borderRadius: rs(20), backgroundColor: BORDER_COLOR, borderWidth: 1, borderColor: ACCENT },
  timerBadgeDanger: { backgroundColor: '#3d0a0a', borderColor: LOSS_RED },
  timerText: { color: ACCENT, fontSize: rf(16), fontWeight: '700' },
  timerTextDanger: { color: LOSS_RED },
  progressContainer: { alignItems: 'center', paddingVertical: rv(16), gap: rv(10) },
  handLabel: { color: TEXT_COLOR, fontSize: rf(20), fontWeight: '700' },
  progressTrack: { flexDirection: 'row', gap: rs(12) },
  progressDot: { width: rs(18), height: rs(18), borderRadius: rs(9), backgroundColor: BORDER_COLOR, borderWidth: 1.5, borderColor: '#5a3a1a' },
  progressDotActive: { borderColor: ACCENT, backgroundColor: '#3d1a06' },
  progressDotWin: { backgroundColor: WIN_GREEN, borderColor: WIN_GREEN },
  progressDotLoss: { backgroundColor: LOSS_RED, borderColor: LOSS_RED },
  progressDotTie: { backgroundColor: TIE_BLUE, borderColor: TIE_BLUE },
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rv(24), paddingHorizontal: rs(24) },
  tableGraphic: { alignItems: 'center', justifyContent: 'center' },
  tableOuter: { width: rs(200), height: rs(200), borderRadius: rs(100), backgroundColor: '#0f1f0a', borderWidth: 4, borderColor: BORDER_COLOR, alignItems: 'center', justifyContent: 'center' },
  tableInner: { alignItems: 'center', gap: rv(8) },
  tableEmoji: { fontSize: rf(48) },
  tableText: { color: COLORS.textMuted, fontSize: rf(13), textAlign: 'center' },
  resultCard: { alignItems: 'center', justifyContent: 'center', borderRadius: rs(20), paddingVertical: rv(28), paddingHorizontal: rs(48), borderWidth: 2, gap: rv(10) },
  resultCardWin: { backgroundColor: '#0a2e14', borderColor: WIN_GREEN },
  resultCardLoss: { backgroundColor: '#2e0a0a', borderColor: LOSS_RED },
  resultCardTie: { backgroundColor: '#0a1a2e', borderColor: TIE_BLUE },
  resultIcon: { color: TEXT_COLOR, fontSize: rf(32), fontWeight: '900', letterSpacing: 2 },
  resultLabel: { color: TEXT_COLOR, fontSize: rf(18), fontWeight: '700', textAlign: 'center' },
  dealBtn: { backgroundColor: ACCENT, paddingVertical: rv(16), paddingHorizontal: rs(56), borderRadius: rs(14) },
  dealBtnPressed: { opacity: 0.8 },
  dealBtnText: { color: '#fff', fontSize: rf(20), fontWeight: '800', letterSpacing: 0.5 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10) },
  waitingText: { color: COLORS.textMuted, fontSize: rf(14) },
  scoreStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: rv(12), paddingHorizontal: rs(16), backgroundColor: '#110a04' },
  scoreStripItem: { flex: 1, alignItems: 'center', gap: rv(2) },
  scoreStripDivider: { width: 1, backgroundColor: BORDER_COLOR, marginVertical: rv(4) },
  scoreStripLabel: { color: COLORS.textMuted, fontSize: rf(11), fontWeight: '500' },
  scoreStripValue: { color: TEXT_COLOR, fontSize: rf(18), fontWeight: '700' },
  scoreStripGold: { color: COLORS.gold },
  scoreStripRed: { color: LOSS_RED },
  endScroll: { alignItems: 'center', paddingHorizontal: rs(24), paddingTop: rv(32), paddingBottom: rv(40), gap: rv(20) },
  endTitle: { color: TEXT_COLOR, fontSize: rf(28), fontWeight: '800', textAlign: 'center' },
  endSubtitle: { color: COLORS.textMuted, fontSize: rf(14), textAlign: 'center' },
  scoreCard: { width: '100%', backgroundColor: '#110a04', borderRadius: rs(16), borderWidth: 1, borderColor: BORDER_COLOR, paddingVertical: rv(8), paddingHorizontal: rs(20) },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rv(12) },
  scoreDivider: { height: 1, backgroundColor: BORDER_COLOR },
  scoreLabel: { color: COLORS.textMuted, fontSize: rf(14) },
  scoreValue: { color: TEXT_COLOR, fontSize: rf(18), fontWeight: '700' },
  scoreValueGold: { color: COLORS.gold },
  scoreValueRed: { color: LOSS_RED },
  netLabel: { color: TEXT_COLOR, fontSize: rf(15), fontWeight: '700' },
  netValue: { fontSize: rf(22), fontWeight: '900' },
  historyContainer: { width: '100%', gap: rv(8) },
  historyTitle: { color: TEXT_COLOR, fontSize: rf(16), fontWeight: '700', marginBottom: rv(4) },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#110a04', borderRadius: rs(10), paddingVertical: rv(10), paddingHorizontal: rs(16), borderWidth: 1, borderColor: BORDER_COLOR },
  historyHandLabel: { color: COLORS.textMuted, fontSize: rf(14), fontWeight: '500' },
  historyBadge: { paddingVertical: rv(4), paddingHorizontal: rs(12), borderRadius: rs(20) },
  badgeWin: { backgroundColor: '#0a2e14', borderWidth: 1, borderColor: WIN_GREEN },
  badgeLoss: { backgroundColor: '#2e0a0a', borderWidth: 1, borderColor: LOSS_RED },
  badgeTie: { backgroundColor: '#0a1a2e', borderWidth: 1, borderColor: TIE_BLUE },
  historyBadgeText: { color: TEXT_COLOR, fontSize: rf(13), fontWeight: '600' },
  btnPrimary: { width: '100%', backgroundColor: ACCENT, paddingVertical: rv(16), borderRadius: rs(14), alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: rf(18), fontWeight: '800' },
  btnSecondary: { width: '100%', paddingVertical: rv(14), borderRadius: rs(14), alignItems: 'center', borderWidth: 1.5, borderColor: BORDER_COLOR },
  btnSecondaryText: { color: TEXT_COLOR, fontSize: rf(16), fontWeight: '600' },
});
