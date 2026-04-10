import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import ChipsDisplay from '../components/ChipsDisplay';
import CardComponent from '../components/Card';
import { useGameStore } from '../store/gameStore';
import { COLORS, getBoardCount, CARDS_PER_BOARD } from '../constants/gameConfig';
import { CARD_THEMES, CardThemeId } from '../constants/cardThemes';
import { simulateBatch, BatchSimulationResult, simulateHand, SimulationResult } from '../utils/simulate';

interface SimResultDisplay extends BatchSimulationResult {
  label: string;
}

interface HandLog {
  handNumber: number;
  playerCount: number;
  boardResults: { winner: number; playerHands: { rank: string }[] }[];
  chipDelta: number;
  runningTotal: number;
  isComplete: boolean;
  completeWinner: number | null;
}

export default function SimulateScreen() {
  const router = useRouter();

  // __DEV__ guard — redirect to home in production builds
  if (!__DEV__) {
    router.replace('/');
    return null;
  }

  const config = useGameStore((s) => s.config);
  const [results, setResults] = useState<SimResultDisplay[]>([]);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'batch' | 'auto' | 'cards'>('batch');
  const cardTheme = useGameStore((s) => s.cardTheme);
  const setCardTheme = useGameStore((s) => s.setCardTheme);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopRef = useRef(false);

  // Auto-play state
  const [autoHandCount, setAutoHandCount] = useState(5);
  const [autoPlayerCount, setAutoPlayerCount] = useState<2 | 3 | 4>(2);
  const [autoLogs, setAutoLogs] = useState<HandLog[]>([]);
  const [autoChips, setAutoChips] = useState(config.startingChips);
  const [autoStatus, setAutoStatus] = useState<string>('');

  // Clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
      stopRef.current = true;
    };
  }, []);

  const HAND_COUNT = 100;

  const trackTimeout = (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // ───────── BATCH MODE ─────────

  const runSimulation = useCallback(
    (playerCount: 2 | 3 | 4) => {
      setRunning(true);
      trackTimeout(() => {
        const result = simulateBatch(playerCount, HAND_COUNT, config);
        const display: SimResultDisplay = {
          ...result,
          label: `${playerCount}P`,
        };
        setResults((prev) => {
          const filtered = prev.filter((r) => r.playerCount !== playerCount);
          return [...filtered, display].sort((a, b) => a.playerCount - b.playerCount);
        });
        setRunning(false);
      }, 50);
    },
    [config]
  );

  const runAll = useCallback(() => {
    setRunning(true);
    setResults([]);
    trackTimeout(() => {
      const r2 = simulateBatch(2, HAND_COUNT, config);
      setResults([{ ...r2, label: '2P' }]);
      trackTimeout(() => {
        const r3 = simulateBatch(3, HAND_COUNT, config);
        setResults((prev) => [...prev, { ...r3, label: '3P' }]);
        trackTimeout(() => {
          const r4 = simulateBatch(4, HAND_COUNT, config);
          setResults((prev) => [...prev, { ...r4, label: '4P' }]);
          setRunning(false);
        }, 50);
      }, 50);
    }, 50);
  }, [config]);

  // ───────── AUTO-PLAY MODE ─────────

  const runAutoPlay = useCallback(() => {
    setRunning(true);
    setAutoLogs([]);
    stopRef.current = false;
    let chips = config.startingChips;
    setAutoChips(chips);

    const boardCount = getBoardCount(autoPlayerCount);
    const buyIn = config.potPerBoard * boardCount;

    const runNextHand = (handNum: number) => {
      if (stopRef.current || handNum > autoHandCount) {
        setRunning(false);
        setAutoStatus(stopRef.current ? 'Stopped' : `Done — ${handNum - 1} hands`);
        return;
      }

      // Check game over
      if (chips < buyIn) {
        setRunning(false);
        setAutoStatus(`GAME OVER after ${handNum - 1} hands — chips below buy-in (${chips} < ${buyIn})`);
        return;
      }

      setAutoStatus(`Hand ${handNum}/${autoHandCount}...`);

      trackTimeout(() => {
        const result = simulateHand(autoPlayerCount, config);

        // Player is index 0
        const chipDelta = result.chipDeltas[0];
        chips += chipDelta;

        const log: HandLog = {
          handNumber: handNum,
          playerCount: autoPlayerCount,
          boardResults: result.boards,
          chipDelta,
          runningTotal: chips,
          isComplete: result.completeWinner !== null,
          completeWinner: result.completeWinner,
        };

        setAutoLogs((prev) => [...prev, log]);
        setAutoChips(chips);

        // Next hand after brief delay
        trackTimeout(() => runNextHand(handNum + 1), 30);
      }, 30);
    };

    runNextHand(1);
  }, [config, autoPlayerCount, autoHandCount]);

  const stopAutoPlay = useCallback(() => {
    stopRef.current = true;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title={'\u2190 Back'}
          variant="ghost"
          onPress={() => router.back()}
          style={{ paddingVertical: 6, paddingHorizontal: 0 }}
        />
        <Text style={styles.title}>SIMULATION</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        <Button
          title="BATCH"
          variant={mode === 'batch' ? 'gold' : 'ghost'}
          onPress={() => setMode('batch')}
          style={styles.tabBtn}
        />
        <Button
          title="AUTO-PLAY"
          variant={mode === 'auto' ? 'gold' : 'ghost'}
          onPress={() => setMode('auto')}
          style={styles.tabBtn}
        />
        <Button
          title="\uD83C\uDCCF CARDS"
          variant={mode === 'cards' ? 'gold' : 'ghost'}
          onPress={() => setMode('cards')}
          style={styles.tabBtn}
        />
      </View>

      {mode === 'batch' ? (
        <>
          <View style={styles.buttons}>
            <Button
              title={`2P (${HAND_COUNT})`}
              variant="secondary"
              onPress={() => runSimulation(2)}
              disabled={running}
              style={styles.simBtn}
            />
            <Button
              title={`3P (${HAND_COUNT})`}
              variant="secondary"
              onPress={() => runSimulation(3)}
              disabled={running}
              style={styles.simBtn}
            />
            <Button
              title={`4P (${HAND_COUNT})`}
              variant="secondary"
              onPress={() => runSimulation(4)}
              disabled={running}
              style={styles.simBtn}
            />
          </View>

          <Button
            title={running ? 'Running...' : 'Run All'}
            variant="gold"
            onPress={runAll}
            disabled={running}
            loading={running}
          />

          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
            {results.map((r) => (
              <View key={r.playerCount} style={styles.resultCard}>
                <Text style={styles.resultTitle}>{r.label} — {r.handsRun} hands</Text>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Zero-sum</Text>
                  <Text style={[styles.resultValue, { color: r.zeroSumVerified ? COLORS.success : COLORS.danger }]}>
                    {r.zeroSumVerified ? 'VERIFIED' : 'FAILED'}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>COMPLETE rate</Text>
                  <Text style={styles.resultValue}>{r.completeRate.toFixed(1)}%</Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Duration</Text>
                  <Text style={styles.resultValue}>{r.totalDurationMs.toFixed(0)}ms</Text>
                </View>

                <Text style={styles.avgTitle}>Avg chips/hand:</Text>
                {r.avgChipDeltaPerHand.map((avg, i) => (
                  <View key={i} style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Player {i}</Text>
                    <Text style={[styles.resultValue, { color: avg >= 0 ? COLORS.success : COLORS.danger }]}>
                      {avg >= 0 ? '+' : ''}{avg.toFixed(1)}
                    </Text>
                  </View>
                ))}

                {r.errors.length > 0 && (
                  <View style={styles.errorsSection}>
                    <Text style={styles.errorsTitle}>Errors ({r.errors.length}):</Text>
                    {r.errors.slice(0, 5).map((e, i) => (
                      <Text key={i} style={styles.errorText}>{e}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {results.length === 0 && !running && (
              <Text style={styles.emptyText}>Run a simulation to see results</Text>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          {/* Auto-play config */}
          <View style={styles.autoConfig}>
            <Text style={styles.autoLabel}>Players:</Text>
            <View style={styles.buttons}>
              {([2, 3, 4] as const).map((pc) => (
                <Button
                  key={pc}
                  title={`${pc}P`}
                  variant={autoPlayerCount === pc ? 'gold' : 'secondary'}
                  onPress={() => setAutoPlayerCount(pc)}
                  disabled={running}
                  style={styles.simBtn}
                />
              ))}
            </View>

            <Text style={styles.autoLabel}>Hands:</Text>
            <View style={styles.buttons}>
              {[5, 10, 25, 50].map((n) => (
                <Button
                  key={n}
                  title={`${n}`}
                  variant={autoHandCount === n ? 'gold' : 'secondary'}
                  onPress={() => setAutoHandCount(n)}
                  disabled={running}
                  style={styles.simBtn}
                />
              ))}
            </View>
          </View>

          <View style={styles.autoActions}>
            {!running ? (
              <Button
                title="RUN SIMULATION"
                variant="gold"
                onPress={runAutoPlay}
              />
            ) : (
              <Button
                title="STOP"
                variant="secondary"
                onPress={stopAutoPlay}
              />
            )}
          </View>

          {/* Running chip total */}
          <View style={styles.autoChipsRow}>
            <ChipsDisplay amount={autoChips} label="Simulated Balance" />
            {autoStatus !== '' && (
              <Text style={styles.autoStatusText}>{autoStatus}</Text>
            )}
          </View>

          {/* Hand logs */}
          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
            {autoLogs.map((log) => (
              <View key={log.handNumber} style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultTitle}>
                    Hand {log.handNumber}
                    {log.isComplete ? ' \u2605 COMPLETE' : ''}
                  </Text>
                  <Text style={[
                    styles.chipDelta,
                    { color: log.chipDelta >= 0 ? COLORS.success : COLORS.danger },
                  ]}>
                    {log.chipDelta >= 0 ? '+' : ''}{log.chipDelta}
                  </Text>
                </View>

                {log.boardResults.map((br, bi) => (
                  <View key={bi} style={styles.boardRow}>
                    <Text style={styles.boardLabel}>
                      Board {bi + 1}:
                    </Text>
                    <Text style={[
                      styles.boardWinner,
                      {
                        color: br.winner === 0
                          ? COLORS.success
                          : br.winner === -1
                          ? COLORS.textSecondary
                          : COLORS.danger,
                      },
                    ]}>
                      {br.winner === 0 ? 'WIN' : br.winner === -1 ? 'TIE' : 'LOSS'}
                    </Text>
                    <Text style={styles.boardHand}>
                      {br.playerHands[0]?.rank || ''}
                    </Text>
                  </View>
                ))}

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Balance</Text>
                  <Text style={styles.resultValue}>{log.runningTotal}</Text>
                </View>
              </View>
            ))}

            {autoLogs.length === 0 && !running && (
              <Text style={styles.emptyText}>
                Configure players and hands, then tap RUN SIMULATION
              </Text>
            )}
          </ScrollView>
        </>
      )}

      {mode === 'cards' && (
        <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.cardPickerContent}>
          <Text style={styles.cardPickerTitle}>{'\uD83C\uDCCF'} בחר עיצוב קלף</Text>
          <Text style={styles.cardPickerSub}>הבחירה נשמרת ומשפיעה על כל הקלפים במשחק</Text>

          {(['v1', 'v2', 'v3'] as CardThemeId[]).map((themeId) => {
            const t = CARD_THEMES[themeId];
            const isActive = cardTheme === themeId;
            return (
              <Pressable
                key={themeId}
                onPress={() => setCardTheme(themeId)}
                style={[styles.themeCard, isActive && styles.themeCardActive]}
              >
                {/* Theme name + badge */}
                <View style={styles.themeHeader}>
                  <Text style={[styles.themeName, isActive && styles.themeNameActive]}>
                    {t.name}
                  </Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>

                {/* Card preview row: A♠ K♥ Q♦ J♣ + 2 face-down + 1 selected */}
                <View style={styles.cardPreviewRow}>
                  {/* Face-up cards */}
                  {[
                    { rank: 'A' as const, suit: 'spades' as const, id: `${themeId}-as` },
                    { rank: 'K' as const, suit: 'hearts' as const, id: `${themeId}-kh` },
                    { rank: 'Q' as const, suit: 'diamonds' as const, id: `${themeId}-qd` },
                    { rank: 'J' as const, suit: 'clubs' as const, id: `${themeId}-jc` },
                  ].map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      faceDown={false}
                      cardWidth={42}
                      cardHeight={60}
                      themeOverride={themeId}
                    />
                  ))}

                  {/* Face-down cards */}
                  <CardComponent faceDown cardWidth={42} cardHeight={60} themeOverride={themeId} />
                  <CardComponent faceDown cardWidth={42} cardHeight={60} themeOverride={themeId} />

                  {/* Selected card (highlighted) */}
                  <CardComponent
                    card={{ rank: 'A' as const, suit: 'hearts' as const, id: `${themeId}-sel` }}
                    faceDown={false}
                    highlighted
                    cardWidth={42}
                    cardHeight={60}
                    themeOverride={themeId}
                  />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  simBtn: {
    flex: 1,
    paddingVertical: 10,
  },
  resultsScroll: {
    flex: 1,
    marginTop: 8,
  },
  resultsContent: {
    gap: 8,
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  resultTitle: {
    color: COLORS.goldBright,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  resultLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  resultValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  avgTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
  },
  errorsSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 6,
  },
  errorsTitle: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  autoConfig: {
    gap: 4,
    marginBottom: 8,
  },
  autoLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  autoActions: {
    marginBottom: 8,
  },
  autoChipsRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  autoStatusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipDelta: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 1,
  },
  boardLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    width: 60,
  },
  boardWinner: {
    fontSize: 12,
    fontWeight: '800',
    width: 36,
  },
  boardHand: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  // ── Card Picker ──────────────────────────────────────────────────
  cardPickerContent: {
    gap: 16,
    paddingBottom: 40,
  },
  cardPickerTitle: {
    color: COLORS.goldBright,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
  },
  cardPickerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  themeCard: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  themeCardActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  themeNameActive: {
    color: COLORS.gold,
  },
  activeBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  cardPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
});
