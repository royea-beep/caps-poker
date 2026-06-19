import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, InteractionManager } from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { analyzeEfficiency, EfficiencyResult } from '../utils/efficiencyAnalysis';

interface BoardData {
  playerCards: any[];
  openCards: any[];
  closedCards: any[];
}

interface EfficiencyCardProps {
  boards: BoardData[];
  screenW: number;
}

export function EfficiencyCard({ boards, screenW }: EfficiencyCardProps) {
  // VAMOS-FIX-RESULTS-EVAL 2026-06-17 — analyzeEfficiency calls evaluateOmahaHand
  // hundreds-to-thousands of times per game (was 20k for bc=2 = 4 boards). Even
  // with useMemo it ran SYNCHRONOUSLY on first mount and blocked the JS thread
  // ~12s on a throttled CPU. Defer via InteractionManager so the rest of the
  // results screen paints first; the efficiency card hydrates a moment later.
  const [efficiency, setEfficiency] = useState<EfficiencyResult | null>(null);
  useEffect(() => {
    if (boards.length === 0) {
      setEfficiency(null);
      return;
    }
    let cancelled = false;
    const ih = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      try {
        const result = analyzeEfficiency(
          boards.map((b) => b.playerCards),
          boards.map((b) => ({ openCards: b.openCards, closedCards: b.closedCards })),
        );
        if (!cancelled) setEfficiency(result);
      } catch {
        if (!cancelled) setEfficiency(null);
      }
    });
    return () => { cancelled = true; ih.cancel(); };
  }, [boards]);

  if (!efficiency) return null;

  return (
    <View style={{ width: '100%' }}>
      <View style={styles.efficiencyCard}>
        <Text style={styles.efficiencyTitle}>PLACEMENT EFFICIENCY</Text>
        <View style={styles.efficiencyScoreRow}>
          <Text style={styles.efficiencyEmoji}>{efficiency.gradeEmoji}</Text>
          <Text style={[
            styles.efficiencyPercent,
            { color: efficiency.percentage >= 90 ? '#4CAF50' : efficiency.percentage >= 75 ? '#c8a84b' : efficiency.percentage >= 60 ? '#FFC107' : COLORS.neonRed,
              fontSize: Math.min(36, Math.floor(screenW * 0.09)) },
          ]}>
            {efficiency.percentage}%
          </Text>
          <Text style={styles.efficiencyGrade}>{efficiency.grade}</Text>
        </View>
        {efficiency.percentage < 100 && (
          <View style={styles.optimalSection}>
            <Text style={styles.optimalTitle}>Best possible hand:</Text>
            {efficiency.optimalAssignment.map((boardCards: any[], i: number) => (
              <View key={i} style={styles.optimalRow}>
                <Text style={styles.optimalBoardLabel}>B{i + 1}</Text>
                <View style={styles.optimalCards}>
                  {boardCards.map((c: any) => (
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
  );
}

const styles = StyleSheet.create({
  efficiencyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(14),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(10),
  },
  efficiencyTitle: { color: COLORS.textMuted, fontSize: rf(11), fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  efficiencyScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(10) },
  efficiencyEmoji: { fontSize: rf(24) },
  efficiencyPercent: { fontSize: rf(36), fontWeight: '900' },
  efficiencyGrade: { color: COLORS.textMuted, fontSize: rf(14), fontWeight: '700' },
  optimalSection: { borderTopWidth: 1, borderTopColor: COLORS.boardBorder, paddingTop: rs(8), gap: rs(4) },
  optimalTitle: { color: COLORS.textMuted, fontSize: rf(10), fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  optimalRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  optimalBoardLabel: { color: '#c8a84b', fontSize: rf(11), fontWeight: '800', width: 22 },
  optimalCards: { flexDirection: 'row', gap: rs(4) },
  optimalCardText: { fontSize: rf(12), fontWeight: '700' },
  optimalHandName: { color: COLORS.textMuted, fontSize: rf(10), fontWeight: '600', flex: 1, textAlign: 'left' },
});
