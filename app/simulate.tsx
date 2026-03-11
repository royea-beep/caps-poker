import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { simulateBatch, BatchSimulationResult } from '../utils/simulate';

interface SimResultDisplay extends BatchSimulationResult {
  label: string;
}

export default function SimulateScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const [results, setResults] = useState<SimResultDisplay[]>([]);
  const [running, setRunning] = useState(false);

  const HAND_COUNT = 100;

  const runSimulation = useCallback(
    (playerCount: 2 | 3 | 4) => {
      setRunning(true);
      // Use setTimeout to avoid blocking UI
      setTimeout(() => {
        const result = simulateBatch(playerCount, HAND_COUNT, config);
        const display: SimResultDisplay = {
          ...result,
          label: `${playerCount}P`,
        };
        setResults((prev) => {
          // Replace existing result for same player count or add new
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
    // Run sequentially with timeouts to keep UI responsive
    setTimeout(() => {
      const r2 = simulateBatch(2, HAND_COUNT, config);
      setResults([{ ...r2, label: '2P' }]);
      setTimeout(() => {
        const r3 = simulateBatch(3, HAND_COUNT, config);
        setResults((prev) => [...prev, { ...r3, label: '3P' }]);
        setTimeout(() => {
          const r4 = simulateBatch(4, HAND_COUNT, config);
          setResults((prev) => [...prev, { ...r4, label: '4P' }]);
          setRunning(false);
        }, 50);
      }, 50);
    }, 50);
  }, [config]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ paddingVertical: 6, paddingHorizontal: 0 }}
        />
        <Text style={styles.title}>SIMULATION</Text>
        <View style={{ width: 60 }} />
      </View>

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
    marginBottom: 16,
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  simBtn: {
    flex: 1,
    paddingVertical: 10,
  },
  resultsScroll: {
    flex: 1,
    marginTop: 16,
  },
  resultsContent: {
    gap: 12,
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  resultTitle: {
    color: COLORS.goldBright,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
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
});
