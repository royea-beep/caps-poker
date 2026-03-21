/**
 * ShareCard — offscreen view captured by react-native-view-shot for sharing.
 * Render with position: absolute, left: -9999 and capture via captureRef.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import CardComponent from './Card';
import { Card } from '../constants/gameConfig';
import { RevealBoardData } from '../types/gameTypes';
import { getRandomQuote } from '../constants/proQuotes';

const CARD_W = 52;
const CARD_H = 73;
const SHARE_WIDTH = 360;

interface SingleBoardShareCardProps {
  board: RevealBoardData;
  boardIndex: number;
  potAmount: number;
}

export function SingleBoardShareCard({ board, boardIndex, potAmount }: SingleBoardShareCardProps) {
  const quote = getRandomQuote('summary');
  const communityCards = [...(board.openCards ?? []), ...(board.closedCards ?? [])];
  const botCards = (board.allBotCards ?? [])[0] ?? board.allBotCards?.[0] ?? [];
  const chipResult = board.winner === 'player'
    ? `+${potAmount} chips`
    : board.winner === 'bot'
    ? `-${potAmount} chips`
    : '±0 chips';
  const resultText = board.winner === 'player' ? '✅ YOU WIN' : board.winner === 'bot' ? '❌ YOU LOSE' : '🤝 TIE';
  const resultColor = board.winner === 'player' ? '#FFD700' : board.winner === 'bot' ? '#ff4444' : '#888';

  return (
    <View style={styles.card}>
      {/* Header */}
      <Text style={styles.logo}>♠ CAPS POKER ♦</Text>
      <View style={styles.divider} />

      <Text style={styles.boardTitle}>Board {boardIndex + 1}</Text>

      {/* Community cards */}
      <Text style={styles.sectionLabel}>Community</Text>
      <View style={styles.cardsRow}>
        {communityCards.map((c, i) => (
          <CardComponent key={i} card={c} faceDown={false} cardWidth={CARD_W} cardHeight={CARD_H} />
        ))}
      </View>

      {/* Player hand */}
      <View style={styles.handRow}>
        <Text style={styles.sectionLabel}>You</Text>
        <Text style={styles.handNameWin}>{board.playerHandName}</Text>
      </View>
      <View style={styles.cardsRow}>
        {(board.playerCards ?? []).map((c, i) => (
          <CardComponent key={i} card={c} faceDown={false} cardWidth={CARD_W} cardHeight={CARD_H} />
        ))}
      </View>

      {/* Bot hand */}
      <View style={styles.handRow}>
        <Text style={styles.sectionLabel}>Opponent</Text>
        <Text style={styles.handNameDim}>{board.botHandName}</Text>
      </View>
      <View style={styles.cardsRow}>
        {botCards.map((c: Card, i: number) => (
          <CardComponent key={i} card={c} faceDown={false} cardWidth={CARD_W} cardHeight={CARD_H} />
        ))}
      </View>

      {/* Result */}
      <View style={styles.doubleDivider} />
      <View style={styles.resultRow}>
        <Text style={[styles.resultLabel, { color: resultColor }]}>{resultText}</Text>
        <Text style={styles.chipResult}>{chipResult}</Text>
      </View>
      <View style={styles.doubleDivider} />

      {/* Pro quote */}
      <Text style={styles.quoteLabel}>🤖 AI Pro Quote:</Text>
      <Text style={styles.quoteText}>"{quote.quote}"</Text>
      <Text style={styles.quoteAuthor}>— {quote.player}</Text>

      {/* Watermark */}
      <Text style={styles.watermark}>caps.ftable.co.il</Text>
    </View>
  );
}

interface FullGameShareCardProps {
  boards: RevealBoardData[];
  netChips: number;
  isComplete: boolean;
  completeBonusAmount: number;
  potPerBoard: number;
  numberOfPlayers: number;
}

export function FullGameShareCard({
  boards,
  netChips,
  isComplete,
  completeBonusAmount,
  potPerBoard,
  numberOfPlayers,
}: FullGameShareCardProps) {
  const quote = getRandomQuote(isComplete ? 'complete' : 'summary');
  const boardsWon = boards.filter((b) => b.winner === 'player').length;
  const potTotal = potPerBoard * numberOfPlayers;

  return (
    <View style={styles.card}>
      {/* Header */}
      <Text style={styles.logo}>♠ CAPS POKER ♦</Text>
      <View style={styles.divider} />

      {/* Boards summary */}
      {boards.map((board, i) => {
        const communityCards = [...(board.openCards ?? []), ...(board.closedCards ?? [])];
        const chipDelta = board.winner === 'player' ? `+${potTotal}` : board.winner === 'bot' ? `-${potTotal}` : '±0';
        const resultIcon = board.winner === 'player' ? '✅' : board.winner === 'bot' ? '❌' : '🤝';
        return (
          <View key={i} style={styles.compactBoardRow}>
            <Text style={styles.compactBoardLabel}>B{i + 1}:</Text>
            <View style={styles.compactCards}>
              {communityCards.slice(0, 5).map((c, ci) => (
                <CardComponent key={ci} card={c} faceDown={false} cardWidth={30} cardHeight={42} />
              ))}
            </View>
            <Text style={styles.compactHandName}>{board.playerHandName?.split(' ').map((w) => w[0]).join('')}</Text>
            <Text style={[styles.compactResult, { color: board.winner === 'player' ? '#FFD700' : board.winner === 'bot' ? '#ff4444' : '#888' }]}>
              {resultIcon} {chipDelta}
            </Text>
          </View>
        );
      })}

      {/* Net result */}
      <View style={styles.doubleDivider} />
      <View style={styles.resultRow}>
        <Text style={[styles.resultLabel, { color: netChips >= 0 ? '#FFD700' : '#ff4444' }]}>
          NET: {netChips >= 0 ? '+' : ''}{netChips}
        </Text>
        <Text style={styles.chipResult}>{boardsWon}/{boards.length} boards won</Text>
      </View>

      {/* Complete bonus */}
      {isComplete && completeBonusAmount > 0 && (
        <View style={styles.completeBanner}>
          <Text style={styles.completeText}>🏆 COMPLETE! +50% BONUS (+{completeBonusAmount})</Text>
        </View>
      )}
      <View style={styles.doubleDivider} />

      {/* Pro quote */}
      <Text style={styles.quoteText}>"{quote.quote}"</Text>
      <Text style={styles.quoteAuthor}>— {quote.player}</Text>

      {/* Watermark */}
      <Text style={styles.watermark}>caps.ftable.co.il</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_WIDTH,
    backgroundColor: '#0a0f1a',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  logo: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,215,0,0.3)',
    marginVertical: 4,
  },
  doubleDivider: {
    height: 2,
    backgroundColor: 'rgba(255,215,0,0.4)',
    marginVertical: 6,
  },
  boardTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  handNameWin: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  handNameDim: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chipResult: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  quoteLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  quoteText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  quoteAuthor: {
    color: 'rgba(255,215,0,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  watermark: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  completeBanner: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  completeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  // Compact board row (full-game card)
  compactBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  compactBoardLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    width: 20,
  },
  compactCards: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
  },
  compactHandName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  compactResult: {
    fontSize: 12,
    fontWeight: '800',
    width: 56,
    textAlign: 'right',
  },
});
