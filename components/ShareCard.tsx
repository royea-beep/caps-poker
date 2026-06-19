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
const STORY_W = 360;  // 360pt × 3x device = 1080px; aspect 9:16 = height 640
const STORY_H = 640;
const STORY_CARD_W = 90;
const STORY_CARD_H = 126;

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
      <Text style={styles.quoteText}>"{quote?.quote ?? ''}"</Text>
      <Text style={styles.quoteAuthor}>— {quote?.player ?? ''}</Text>

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
      <Text style={styles.quoteText}>"{quote?.quote ?? ''}"</Text>
      <Text style={styles.quoteAuthor}>— {quote?.player ?? ''}</Text>

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
    textAlign: 'left',
  },
  compactResult: {
    fontSize: 12,
    fontWeight: '800',
    width: 56,
    textAlign: 'left',
  },
});

// ─── Instagram Story (9:16) variants ─────────────────────────────────────────

interface StoryShareCardProps {
  board?: RevealBoardData;   // single board (or null for full game)
  boardIndex?: number;
  boards?: RevealBoardData[];
  netChips?: number;
  isComplete?: boolean;
  completeBonusAmount?: number;
  potAmount?: number;
  potPerBoard?: number;
  numberOfPlayers?: number;
}

export function StoryShareCard({
  board,
  boardIndex = 0,
  boards,
  netChips = 0,
  isComplete = false,
  completeBonusAmount = 0,
  potAmount = 0,
  potPerBoard = 0,
  numberOfPlayers = 2,
}: StoryShareCardProps) {
  const quote = getRandomQuote(isComplete ? 'complete' : 'summary');
  const isSingleBoard = !!board;

  if (isSingleBoard && board) {
    const communityCards = [...(board.openCards ?? []), ...(board.closedCards ?? [])];
    const botCards = (board.allBotCards ?? [])[0] ?? [];
    const resultText = board.winner === 'player' ? '✅ YOU WIN' : board.winner === 'bot' ? '❌ YOU LOSE' : '🤝 TIE';
    const chipDelta = board.winner === 'player' ? `+${potAmount}` : board.winner === 'bot' ? `-${potAmount}` : '±0';
    const resultColor = board.winner === 'player' ? '#FFD700' : board.winner === 'bot' ? '#ff4444' : '#888';

    return (
      <View style={storyStyles.card}>
        <Text style={storyStyles.logo}>♠ CAPS POKER ♦</Text>
        <View style={storyStyles.divider} />

        <Text style={storyStyles.boardTitle}>Board {boardIndex + 1}</Text>

        <Text style={storyStyles.sectionLabel}>Community</Text>
        <View style={storyStyles.cardsRow}>
          {communityCards.map((c, i) => (
            <CardComponent key={i} card={c} faceDown={false} cardWidth={STORY_CARD_W} cardHeight={STORY_CARD_H} />
          ))}
        </View>

        <View style={storyStyles.handBlock}>
          <Text style={storyStyles.sectionLabel}>Your Hand</Text>
          <View style={storyStyles.cardsRow}>
            {(board.playerCards ?? []).map((c, i) => (
              <CardComponent key={i} card={c} faceDown={false} cardWidth={STORY_CARD_W} cardHeight={STORY_CARD_H} />
            ))}
          </View>
          <Text style={[storyStyles.handName, board.winner === 'player' ? storyStyles.handNameWin : storyStyles.handNameDim]}>
            {board.playerHandName}
          </Text>
        </View>

        <View style={storyStyles.handBlock}>
          <Text style={storyStyles.sectionLabel}>Opponent</Text>
          <View style={storyStyles.cardsRow}>
            {botCards.map((c: Card, i: number) => (
              <CardComponent key={i} card={c} faceDown={false} cardWidth={STORY_CARD_W} cardHeight={STORY_CARD_H} />
            ))}
          </View>
          <Text style={[storyStyles.handName, storyStyles.handNameDim]}>{board.botHandName}</Text>
        </View>

        <View style={storyStyles.doubleDivider} />
        <Text style={[storyStyles.resultLabel, { color: resultColor }]}>{resultText}  {chipDelta}</Text>
        <View style={storyStyles.doubleDivider} />

        {isComplete && completeBonusAmount > 0 && (
          <Text style={storyStyles.completeLabel}>🏆 COMPLETE! +50% BONUS (+{completeBonusAmount})</Text>
        )}

        <Text style={storyStyles.quoteText}>"{quote?.quote ?? ''}"</Text>
        <Text style={storyStyles.quoteAuthor}>— {quote?.player ?? ''}</Text>

        <View style={storyStyles.ctaPill}>
          <Text style={storyStyles.ctaText}>Play CAPS Poker</Text>
          <Text style={storyStyles.ctaUrl}>caps.ftable.co.il</Text>
        </View>
      </View>
    );
  }

  // Full-game story
  const allBoards = boards ?? [];
  const boardsWon = allBoards.filter((b) => b.winner === 'player').length;
  const potTotal = potPerBoard * numberOfPlayers;

  return (
    <View style={storyStyles.card}>
      <Text style={storyStyles.logo}>♠ CAPS POKER ♦</Text>
      <View style={storyStyles.divider} />

      {allBoards.map((b, i) => {
        const communityCards = [...(b.openCards ?? []), ...(b.closedCards ?? [])];
        const chipDelta = b.winner === 'player' ? `+${potTotal}` : b.winner === 'bot' ? `-${potTotal}` : '±0';
        const icon = b.winner === 'player' ? '✅' : b.winner === 'bot' ? '❌' : '🤝';
        return (
          <View key={i} style={storyStyles.storyBoardRow}>
            <Text style={storyStyles.storyBoardLabel}>B{i + 1}:</Text>
            <View style={storyStyles.storyBoardCards}>
              {communityCards.slice(0, 5).map((c, ci) => (
                <CardComponent key={ci} card={c} faceDown={false} cardWidth={44} cardHeight={62} />
              ))}
            </View>
            <Text style={storyStyles.storyHandName}>{b.playerHandName?.split(' ').map((w) => w[0]).join('')}</Text>
            <Text style={[storyStyles.storyResult, { color: b.winner === 'player' ? '#FFD700' : b.winner === 'bot' ? '#ff4444' : '#888' }]}>
              {icon} {chipDelta}
            </Text>
          </View>
        );
      })}

      <View style={storyStyles.doubleDivider} />
      <Text style={[storyStyles.resultLabel, { color: netChips >= 0 ? '#FFD700' : '#ff4444' }]}>
        NET: {netChips >= 0 ? '+' : ''}{netChips}  ·  {boardsWon}/{allBoards.length} boards{isComplete ? '  ·  🏆' : ''}
      </Text>
      <View style={storyStyles.doubleDivider} />

      <Text style={storyStyles.quoteText}>"{quote?.quote ?? ''}"</Text>
      <Text style={storyStyles.quoteAuthor}>— {quote?.player ?? ''}</Text>

      <View style={storyStyles.ctaPill}>
        <Text style={storyStyles.ctaText}>Play CAPS Poker</Text>
        <Text style={storyStyles.ctaUrl}>caps.ftable.co.il</Text>
      </View>
    </View>
  );
}

const storyStyles = StyleSheet.create({
  card: {
    width: STORY_W,
    height: STORY_H,
    backgroundColor: '#080c14',
    borderRadius: 0,
    padding: 28,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 0,
  },
  logo: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,215,0,0.35)',
    marginVertical: 4,
  },
  doubleDivider: {
    width: '90%',
    height: 2,
    backgroundColor: 'rgba(255,215,0,0.4)',
    marginVertical: 6,
  },
  boardTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  handBlock: {
    alignItems: 'center',
    gap: 6,
  },
  handName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  handNameWin: { color: '#FFD700' },
  handNameDim: { color: 'rgba(255,255,255,0.3)' },
  resultLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  completeLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  quoteText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteAuthor: {
    color: 'rgba(255,215,0,0.6)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  ctaPill: {
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ctaUrl: {
    color: 'rgba(255,215,0,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  // Full game story
  storyBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  storyBoardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    width: 22,
  },
  storyBoardCards: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
  },
  storyHandName: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    width: 26,
    textAlign: 'left',
  },
  storyResult: {
    fontSize: 12,
    fontWeight: '800',
    width: 58,
    textAlign: 'left',
  },
});
