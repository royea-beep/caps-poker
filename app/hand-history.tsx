import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { rv, rf, rs } from '../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
// no Reanimated — iron rule: history screen = zero Reanimated
import { Button } from '../components/Button';
import { COLORS, Card } from '../constants/gameConfig';
import { getHandHistory, clearHandHistory, HandRecord, HandBoardRecord } from '../utils/handHistory';
import { FullGameShareCard } from '../components/ShareCard';
import { captureAndShare, generateShareText, ShareData } from '../utils/shareHand';
import { RevealBoardData } from '../types/gameTypes';
import { HAND_RANK, BIG_HANDS } from '../utils/handColors';
import { HandBadge } from '../components/HandBadge';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function formatCard(card: { rank: string; suit: string }): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit] || '?'}`;
}

function isRedSuit(suit: string): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/** Best hand name across all boards (highest HAND_RANK wins) */
function getBestHandName(hand: HandRecord): string {
  let best = '';
  let bestRank = -1;
  for (const b of hand.boards) {
    const r = HAND_RANK[b.playerHandName] ?? 0;
    if (r > bestRank) { bestRank = r; best = b.playerHandName; }
  }
  return best;
}

/** Session date header label */
function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short' });
}

function handRecordToShareData(hand: HandRecord): ShareData {
  const boards: RevealBoardData[] = hand.boards.map((b, i) => {
    const toCard = (c: { rank: string; suit: string }, idx: number): Card =>
      ({ id: `h-${i}-${idx}`, rank: c.rank as Card['rank'], suit: c.suit as Card['suit'] });
    const community = b.communityCards.map(toCard);
    return {
      openCards: community.slice(0, 3),
      closedCards: community.slice(3),
      playerCards: b.playerCards.map(toCard),
      allBotCards: b.botCards.length > 0 ? [b.botCards.map(toCard)] : [],
      allBotHandNames: b.botHandName ? [b.botHandName] : [],
      playerHandName: b.playerHandName,
      botHandName: b.botHandName,
      winner: b.winner as RevealBoardData['winner'],
      playerHighlightIds: [],
      botHighlightIds: [],
      boardHighlightIds: [],
      potAmount: hand.potPerBoard * hand.numberOfPlayers,
    };
  });
  const playerWins = hand.boards.filter((b) => b.winner === 'player').length;
  return {
    boards,
    netChips: hand.netChips,
    isComplete: hand.isComplete,
    completeBonusAmount: hand.completeBonusAmount,
    boardsWon: playerWins,
    totalBoards: hand.boardCount,
    potPerBoard: hand.potPerBoard,
    numberOfPlayers: hand.numberOfPlayers,
  };
}

function HandCard({ hand, index, onReplay }: { hand: HandRecord; index: number; onReplay: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<any>(null);
  const playerWins = hand.boards.filter((b) => b.winner === 'player').length;
  const botWins = hand.boards.filter((b) => b.winner === 'bot').length;
  const isWin = hand.netChips >= 0;
  const bestHand = getBestHandName(hand);
  const isBigHand = BIG_HANDS.includes(bestHand);

  const handleShare = useCallback(async () => {
    setSharing(true);
    await new Promise((r) => setTimeout(r, 150));
    const sd = handRecordToShareData(hand);
    const text = generateShareText(sd);
    await captureAndShare(shareRef, text);
    setSharing(false);
  }, [hand]);

  return (
    <View>
      <TouchableOpacity
        style={[styles.handCard, isWin ? styles.handCardWin : styles.handCardLose]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {/* Summary row */}
        <View style={styles.handSummary}>
          <View style={styles.handLeft}>
            <Text style={styles.handTime}>{formatTime(hand.timestamp)}</Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreText, { color: COLORS.neonGreen }]}>{playerWins}</Text>
              <Text style={styles.scoreDash}> - </Text>
              <Text style={[styles.scoreText, { color: COLORS.neonRed }]}>{botWins}</Text>
            </View>
            {bestHand ? (
              isBigHand
                ? <HandBadge handName={bestHand} size="small" />
                : <Text style={styles.handNameLabel}>{bestHand}</Text>
            ) : null}
          </View>
          <View style={styles.handRight}>
            <Text style={[styles.netChips, { color: isWin ? COLORS.neonGreen : COLORS.neonRed }]}>
              {isWin ? '+' : ''}{hand.netChips}🪙
            </Text>
            {hand.isComplete && hand.completeBonusAmount > 0 && (
              <Text style={styles.bonusTag}>+{hand.completeBonusAmount} bonus</Text>
            )}
          </View>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleShare(); }}
              style={styles.historyShareBtn}
              disabled={sharing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.historyShareBtnText}>{sharing ? '…' : '📸'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.expandArrow}>{expanded ? '\u25B2' : '\u25BC'}</Text>
        </View>

        {/* Offscreen share card */}
        {Platform.OS !== 'web' && (
          <View ref={shareRef} style={styles.offscreen} pointerEvents="none">
            <FullGameShareCard
              boards={handRecordToShareData(hand).boards}
              netChips={hand.netChips}
              isComplete={hand.isComplete}
              completeBonusAmount={hand.completeBonusAmount}
              potPerBoard={hand.potPerBoard}
              numberOfPlayers={hand.numberOfPlayers}
            />
          </View>
        )}

        {/* Expanded board details */}
        {expanded && (
          <View style={styles.boardsDetail}>
            {hand.boards.map((board, i) => (
              <BoardDetail key={i} board={board} />
            ))}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {hand.boardCount} boards | {hand.numberOfPlayers} players | {hand.potPerBoard}/board
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replayBtn}
              onPress={(e) => { e.stopPropagation(); onReplay(hand.id); }}
              activeOpacity={0.7}
            >
              <Text style={styles.replayBtnText}>▶ REPLAY HAND</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function BoardDetail({ board }: { board: HandBoardRecord }) {
  const winColor = board.winner === 'player' ? COLORS.neonGreen : board.winner === 'bot' ? COLORS.neonRed : COLORS.textDim;
  const winLabel = board.winner === 'player' ? 'WIN' : board.winner === 'bot' ? 'LOSS' : 'TIE';

  return (
    <View style={styles.boardDetail}>
      <View style={styles.boardDetailHeader}>
        <Text style={styles.boardDetailLabel}>Board {board.boardIndex + 1}</Text>
        <Text style={[styles.boardDetailBadge, { color: winColor }]}>{winLabel}</Text>
      </View>

      {/* Community cards */}
      <View style={styles.cardRow}>
        <Text style={styles.cardRowLabel}>Board</Text>
        <View style={styles.cardsInline}>
          {board.communityCards.map((c, i) => (
            <Text key={i} style={[styles.cardText, isRedSuit(c.suit) && styles.cardTextRed]}>
              {formatCard(c)}
            </Text>
          ))}
        </View>
      </View>

      {/* Player hand */}
      <View style={styles.cardRow}>
        <Text style={[styles.cardRowLabel, board.winner === 'player' && { color: COLORS.neonGreen }]}>You</Text>
        <View style={styles.cardsInline}>
          {board.playerCards.map((c, i) => (
            <Text key={i} style={[styles.cardText, isRedSuit(c.suit) && styles.cardTextRed]}>
              {formatCard(c)}
            </Text>
          ))}
        </View>
        <Text style={[styles.handNameText, board.winner === 'player' && styles.handNameWin]}>
          {board.playerHandName}
        </Text>
      </View>

      {/* Bot hand */}
      {board.botCards.length > 0 && (
        <View style={styles.cardRow}>
          <Text style={[styles.cardRowLabel, board.winner === 'bot' && { color: COLORS.neonRed }]}>Bot</Text>
          <View style={styles.cardsInline}>
            {board.botCards.map((c, i) => (
              <Text key={i} style={[styles.cardText, isRedSuit(c.suit) && styles.cardTextRed]}>
                {formatCard(c)}
              </Text>
            ))}
          </View>
          <Text style={[styles.handNameText, board.winner === 'bot' && styles.handNameWin]}>
            {board.botHandName}
          </Text>
        </View>
      )}
    </View>
  );
}

type FilterMode = 'all' | 'wins' | 'losses';

export default function HandHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<HandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    getHandHistory().then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, []);

  const wins = history.filter(h => h.netChips >= 0);
  const losses = history.filter(h => h.netChips < 0);
  const filtered = filter === 'all' ? history : filter === 'wins' ? wins : losses;

  // Group by date
  const grouped = filtered.reduce((acc, hand) => {
    const date = new Date(hand.timestamp).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(hand);
    return acc;
  }, {} as Record<string, HandRecord[]>);

  const handleClear = useCallback(() => {
    Alert.alert('Clear History', 'Remove all hand records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearHandHistory();
          setHistory([]);
        },
      },
    ]);
  }, []);

  const handleReplay = useCallback((id: string) => {
    router.push(`/replay?id=${id}` as any);
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Button title="← Back" variant="ghost" onPress={() => router.back()} style={{ paddingVertical: 6 }} />
        <Text style={styles.title}>HAND HISTORY</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'wins', 'losses'] as FilterMode[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? `הכל (${history.length})` : f === 'wins' ? `ניצחונות (${wins.length})` : `הפסדים (${losses.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={[styles.emptyText, { marginTop: rs(40) }]}>Loading...</Text>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🃏</Text>
            <Text style={styles.emptyText}>אין ידות שוחקו עדיין</Text>
            <Text style={styles.emptySubtext}>שחק את המשחק הראשון שלך כדי לראות היסטוריה!</Text>
            <TouchableOpacity style={styles.emptyPlayBtn} onPress={() => router.replace('/' as any)}>
              <Text style={styles.emptyPlayBtnText}>▶ שחק עכשיו</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{filter === 'wins' ? '🏆' : '😔'}</Text>
            <Text style={styles.emptyText}>אין {filter === 'wins' ? 'ניצחונות' : 'הפסדים'} עדיין</Text>
          </View>
        ) : (
          <>
            {Object.entries(grouped).map(([date, hands]) => {
              const dayWins = hands.filter(h => h.netChips >= 0).length;
              const dayChips = hands.reduce((s, h) => s + h.netChips, 0);
              return (
                <View key={date}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionDate}>{formatSessionDate(date)}</Text>
                    <Text style={styles.sessionStats}>
                      {dayWins}W/{hands.length - dayWins}L{'  '}
                      <Text style={{ color: dayChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }}>
                        {dayChips >= 0 ? '+' : ''}{dayChips}🪙
                      </Text>
                    </Text>
                  </View>
                  {hands.map((hand, i) => (
                    <HandCard key={hand.id} hand={hand} index={i} onReplay={handleReplay} />
                  ))}
                </View>
              );
            })}
            <View style={styles.clearSection}>
              <Button title="CLEAR HISTORY" variant="ghost" onPress={handleClear} />
            </View>
          </>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const MAX_DISPLAY = 50;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  title: {
    fontSize: rf(18),
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    gap: rs(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  filterTab: {
    flex: 1,
    paddingVertical: rs(7),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.gold + '22',
    borderColor: COLORS.gold,
  },
  filterTabText: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: COLORS.goldBright,
  },
  scrollContent: {
    padding: rs(12),
    paddingBottom: rs(32),
    gap: rs(8),
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: rs(6),
    marginTop: rs(4),
  },
  sessionDate: {
    color: COLORS.textSecondary,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  sessionStats: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '600',
  },
  handNameLabel: {
    fontSize: rf(10),
    color: COLORS.gold,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: rs(2),
  },

  // Hand card
  handCard: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  handCardWin: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.neonGreen,
  },
  handCardLose: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.neonRed,
  },
  handSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  handLeft: {
    flex: 1,
    gap: rs(2),
  },
  handTime: {
    fontSize: rf(11),
    color: COLORS.textDim,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: rf(18),
    fontWeight: '900',
  },
  scoreDash: {
    fontSize: rf(14),
    color: COLORS.textDim,
    fontWeight: '600',
  },
  handRight: {
    alignItems: 'flex-end',
    gap: rs(2),
    marginRight: rs(8),
  },
  netChips: {
    fontSize: rf(20),
    fontWeight: '900',
  },
  bonusTag: {
    fontSize: rf(10),
    color: COLORS.gold,
    fontWeight: '700',
  },
  expandArrow: {
    fontSize: rf(10),
    color: COLORS.textDim,
  },

  // Expanded board details
  boardsDetail: {
    marginTop: rs(10),
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
    paddingTop: rs(10),
    gap: rs(10),
  },
  boardDetail: {
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(8),
    padding: rs(8),
    gap: rs(4),
  },
  boardDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(2),
  },
  boardDetailLabel: {
    fontSize: rf(11),
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  boardDetailBadge: {
    fontSize: rf(11),
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  cardRowLabel: {
    fontSize: rf(9),
    fontWeight: '700',
    color: COLORS.textDim,
    width: rv(32),
    letterSpacing: 1,
  },
  cardsInline: {
    flexDirection: 'row',
    gap: rs(4),
  },
  cardText: {
    fontSize: rf(12),
    fontWeight: '700',
    color: '#f0dfc0',
  },
  cardTextRed: {
    color: '#c0392b',
  },
  handNameText: {
    fontSize: rf(9),
    fontWeight: '600',
    color: COLORS.textMuted,
    marginLeft: rs(4),
  },
  handNameWin: {
    color: COLORS.goldLight,
    fontWeight: '800',
  },
  metaRow: {
    alignItems: 'center',
    marginTop: rs(2),
  },
  metaText: {
    fontSize: rf(10),
    color: COLORS.textDim,
    fontWeight: '500',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(60),
    gap: rs(8),
  },
  emptyIcon: {
    fontSize: rf(48),
    color: COLORS.textDim,
    marginBottom: rs(8),
  },
  emptyText: {
    fontSize: rf(16),
    color: COLORS.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: rf(13),
    color: COLORS.textDim,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: rs(32),
  },
  emptyPlayBtn: {
    marginTop: rs(12),
    backgroundColor: COLORS.gold,
    paddingHorizontal: rs(28),
    paddingVertical: rs(12),
    borderRadius: rv(10),
  },
  emptyPlayBtnText: {
    color: COLORS.background,
    fontSize: rf(14),
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Footer
  clearSection: {
    marginTop: rs(4),
  },
  footer: {
    height: rs(16),
  },

  // Share
  historyShareBtn: {
    padding: rs(4),
    marginRight: rs(8),
  },
  historyShareBtnText: {
    fontSize: rf(18),
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    opacity: 0,
    zIndex: -1,
  },
  replayBtn: {
    marginTop: rs(8),
    alignSelf: 'center',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: rv(8),
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
  },
  replayBtnText: {
    fontSize: rf(12),
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
});
