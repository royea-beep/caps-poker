import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

interface BoardSummary {
  winner: 'player' | 'bot' | 'tie';
  playerHand: string;
  botHand: string;
}

export default function SummaryScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const params = useLocalSearchParams<{
    results: string;
    netChips: string;
    isComplete: string;
    completeBonusAmount: string;
    potPerBoard: string;
  }>();

  let boardResults: BoardSummary[] = [];
  try {
    const parsed = params.results ? JSON.parse(params.results) : [];
    boardResults = Array.isArray(parsed) ? parsed : [];
  } catch {
    boardResults = [];
  }
  const netChips = parseInt(params.netChips || '0', 10) || 0;
  const potPerBoard = parseInt(params.potPerBoard || '25', 10) || 25;
  // netChips is already the net result (winnings minus amount paid in)
  const profit = netChips;
  const isComplete = params.isComplete === 'true';
  const completeBonusAmount = parseInt(params.completeBonusAmount || '0', 10) || 0;

  const playerWins = boardResults.filter((r) => r.winner === 'player').length;
  const botWins = boardResults.filter((r) => r.winner === 'bot').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>HAND RESULTS</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>YOU</Text>
            <Text style={[styles.scoreNum, { color: COLORS.success }]}>{playerWins}</Text>
          </View>
          <Text style={styles.scoreDivider}>—</Text>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>BOT</Text>
            <Text style={[styles.scoreNum, { color: COLORS.danger }]}>{botWins}</Text>
          </View>
        </View>

        {/* Board details */}
        <View style={styles.boardsList}>
          {boardResults.map((result, i) => (
            <View key={i} style={styles.boardRow}>
              <View style={styles.boardHeader}>
                <Text style={styles.boardLabel}>Board {i + 1}</Text>
                <View
                  style={[
                    styles.winnerTag,
                    result.winner === 'player'
                      ? styles.playerTag
                      : result.winner === 'bot'
                      ? styles.botTag
                      : styles.tieTag,
                  ]}
                >
                  <Text style={styles.winnerTagText}>
                    {result.winner === 'player' ? 'YOU' : result.winner === 'bot' ? 'BOT' : 'TIE'}
                  </Text>
                </View>
              </View>
              <View style={styles.handRow}>
                <Text style={[styles.handText, result.winner === 'player' && styles.handWinner]}>
                  You: {result.playerHand}
                </Text>
                <Text style={[styles.handText, result.winner === 'bot' && styles.handWinner]}>
                  Bot: {result.botHand}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Chips summary */}
        <View style={styles.chipsSummary}>
          {isComplete && (
            <View style={styles.completeRow}>
              <Text style={styles.completeLabel}>COMPLETE BONUS</Text>
              <Text style={styles.completeAmount}>+{completeBonusAmount} 🪙</Text>
            </View>
          )}
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Result</Text>
            <Text style={[styles.netAmount, profit >= 0 ? styles.profit : styles.loss]}>
              {profit >= 0 ? '+' : ''}{profit} 🪙
            </Text>
          </View>
        </View>

        <ChipsDisplay amount={chips} label="Current Balance" size="large" />

        <View style={styles.buttons}>
          <Button title="NEXT HAND" variant="gold" onPress={() => router.replace('/game')} />
          <Button title="HOME" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 6,
    marginTop: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  scoreNum: {
    fontSize: 48,
    fontWeight: '900',
  },
  scoreDivider: {
    color: COLORS.textSecondary,
    fontSize: 24,
    marginTop: 16,
  },
  boardsList: {
    width: '100%',
    gap: 8,
  },
  boardRow: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  boardLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  winnerTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playerTag: {
    backgroundColor: COLORS.success,
  },
  botTag: {
    backgroundColor: COLORS.danger,
  },
  tieTag: {
    backgroundColor: COLORS.goldDim,
  },
  winnerTagText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  handRow: {
    gap: 2,
  },
  handText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  handWinner: {
    color: COLORS.goldBright,
    fontWeight: '700',
  },
  chipsSummary: {
    width: '100%',
    gap: 8,
  },
  completeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  completeLabel: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  completeAmount: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  netLabel: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  netAmount: {
    fontSize: 24,
    fontWeight: '900',
  },
  profit: {
    color: COLORS.success,
  },
  loss: {
    color: COLORS.danger,
  },
  buttons: {
    width: '100%',
    gap: 10,
    marginTop: 'auto',
  },
});
