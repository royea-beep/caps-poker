import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '../utils/i18n';
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
import { EmptyState } from '../components/EmptyState';
import { HandHistoryPreview } from '../components/EmptyStatePreviews';
import { ScreenHeader } from '../components/ScreenHeader';
import { tallyBoards } from '../utils/boardTally';

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
  // Same binary-count-over-a-three-way-outcome as the results scoreboard: a tied board was in
  // neither number, so a 4-board hand with one tie listed as "3 - 0". utils/boardTally.ts.
  const tally = tallyBoards(hand.boards);
  /**
   * CLASS A + CLASS B, both in one line. This was `hand.netChips >= 0`, so a TIE (net 0) rendered
   * with the WIN border and a green "+0". Worse, the two lines directly above already compute the
   * authoritative answer from the boards and it was being thrown away -- the same shape as the
   * blank opponent hand.
   *
   * And the two ends disagreed: the client showed a net-zero hand as a WIN while the same hand was
   * written to hand_history as result='lost'. Measured in production: 127 of 243 rows are net-zero,
   * and of the 22 genuinely board-tied hands, 15 are stored 'lost' and 5 'won' -- the same outcome
   * recorded both ways. Storing a third value needs a CHECK-constraint change and a decision about
   * those rows, so it is reported; the DISPLAY is corrected here, from the boards, which are right.
   */
  const outcome: 'win' | 'loss' | 'tie' =
    playerWins > botWins ? 'win' : playerWins < botWins ? 'loss' : 'tie';
  const isWin = outcome === 'win';
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
        style={[styles.handCard, outcome === 'win' ? styles.handCardWin : outcome === 'loss' ? styles.handCardLose : styles.handCardTie]}
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
              {/* A row this dense cannot carry the full "3 WON · 1 TIED · 0 LOST" line, so the
                  missing board is named with the same '=' token the board rows below already use
                  for a tie. The expanded card spells it out in full. */}
              {tally.hasTie && <Text style={styles.scoreTied}> ={tally.tied}</Text>}
            </View>
            {bestHand ? (
              isBigHand
                ? <HandBadge handName={bestHand} size="small" />
                : <Text style={styles.handNameLabel}>{bestHand}</Text>
            ) : null}
          </View>
          <View style={styles.handRight}>
            <Text style={[styles.netChips, { color: outcome === 'win' ? COLORS.neonGreen : outcome === 'loss' ? COLORS.neonRed : COLORS.textDim }]}>
              {hand.netChips > 0 ? '+' : ''}{hand.netChips === 0 ? '±0' : hand.netChips}🪙
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

  // Counted from BOARDS, like the cards above. `netChips >= 0` counted every tie as a win, and
  // net-zero is over half of all recorded hands. A tie is in neither tab, so All is deliberately
  // NOT Wins + Losses -- that is the honest arithmetic, not a rounding error.
  const boardsWonOf = (h: HandRecord) => h.boards.filter((b) => b.winner === 'player').length;
  const boardsLostOf = (h: HandRecord) => h.boards.filter((b) => b.winner === 'bot').length;
  const wins = history.filter(h => boardsWonOf(h) > boardsLostOf(h));
  const losses = history.filter(h => boardsWonOf(h) < boardsLostOf(h));
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
      <ScreenHeader title="HAND HISTORY" />

      {/* Filter tabs */}
      {/* THE TABLIST THAT WAS MISSING. The three children below were given accessibilityRole="tab"
          to fix them being focusable-but-undeclared — correct as far as it went, but `tab` is one
          of the roles axe checks a PARENT for, and this View declared nothing. Result:
          aria-required-parent, impact CRITICAL, which is the single critical that has been failing
          the post-deploy WCAG gate and therefore SKIPPING BackstopJS entirely on every deploy since
          2026-08-23. Identical structure to app/leaderboard.tsx:151, which the same audit measures
          at crit=0 — so this is the shape already proven against this instrument, not a guess. */}
      <View style={styles.filterRow} accessibilityRole="tablist" accessibilityLabel="Filter hands">
        {(['all', 'wins', 'losses'] as FilterMode[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            // These three rendered as tabindex=0 divs with NO role: focusable by keyboard and
            // announced by a screen reader as plain text, with nothing to say they filter anything
            // or which one is currently applied. The loop had been PRINTING them as unexposed on
            // every run and never asserting on it, so the signal was there and unread.
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            accessibilityLabel={f === 'all' ? 'Show all hands' : f === 'wins' ? 'Show only wins' : 'Show only losses'}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? t().historyAll(history.length) : f === 'wins' ? t().historyWins(wins.length) : t().historyLosses(losses.length)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={[styles.emptyText, { marginTop: rs(40) }]}>Loading...</Text>
        ) : history.length === 0 ? (
          <EmptyState
            icon="🃏"
            title="No hands yet"
            subtitle="Your past hands will show here"
            ctaLabel="Play Now"
            onCta={() => router.replace('/game' as any)}
            preview={<HandHistoryPreview />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'wins' ? '🏆' : '😔'}
            title={`No ${filter === 'wins' ? 'wins' : 'losses'} yet`}
            subtitle={filter === 'wins' ? 'Win a hand to see it here.' : 'A loss-free streak — keep going!'}
          />
        ) : (
          <>
            {Object.entries(grouped).map(([date, hands]) => {
              const dayWins = hands.filter(h => boardsWonOf(h) > boardsLostOf(h)).length;
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
    backgroundColor: COLORS.mint + '22',
    borderColor: COLORS.mint,
  },
  filterTabText: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: COLORS.mintBright,
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
    color: COLORS.mint,
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
  // Neutral border for a tie -- neither the win treatment nor the loss treatment.
  handCardTie: { borderLeftColor: COLORS.textDim },
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
  scoreTied: { color: COLORS.textDim, fontSize: 13, fontWeight: '800' },
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
    color: COLORS.mint,
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
    color: COLORS.mintLight,
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
    backgroundColor: COLORS.mint,
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
    color: COLORS.mint,
    letterSpacing: 1.5,
  },
});
