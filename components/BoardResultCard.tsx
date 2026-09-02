/**
 * BoardResultCard — renders one board's result in the results screen.
 * ZERO Reanimated — uses only react-native Animated passed as props from parent.
 */
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Animated, ActionSheetIOS, Alert } from 'react-native';
// VAMOS-FIX-RESULTS-RENDER-2 2026-06-17 — StaticCard skips Animated init
// (flip + glow), interpolations, and the back face. Cards on the results
// screen are always revealed and never animate — saves ~1s of mount time
// for 36 cards on a mid phone (6× CPU throttle).
import StaticCard from './StaticCard';
import { Badge } from './Badge';
import { SingleBoardShareCard, StoryShareCard } from './ShareCard';
import { captureAndShare, saveHandForWebReplay, generateShareText, copyToClipboard, ShareData } from '../utils/shareHand';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSpecificHandName, getComparisonText } from '../utils/handNames';
import { t } from '../utils/i18n';
import type { Card } from '../constants/gameConfig';

export interface BoardRevealResult {
  winner: 'player' | 'bot' | 'tie';
  playerHandName: string;
  botHandName: string;
  allBotCards: any[][];
  botCards: any[];
  playerCards: any[];
  openCards: any[];
  closedCards: any[];
  playerHighlightIds: string[];
  botHighlightIds: string[];
  boardHighlightIds: string[];
  allBotHandNames?: string[];
  playerBestCards?: Card[];
  botBestCards?: Card[];
}

interface BoardResultCardProps {
  board: BoardRevealResult;
  boardIndex: number;
  pot: number;
  cardW: number;
  cardH: number;
  commCardW?: number;
  commCardH?: number;
  botCardW?: number;
  botCardH?: number;
  translateY: Animated.Value;
  winBorderColor: any; // Animated interpolation from parent
  winBadgeAnim: Animated.Value;
  shareData: ShareData;
  autoShareUrl: string | null;
  isComplete: boolean;
  completeBonusAmount: number;
  /** OTA-COSMETIC-FIXES — practice is XP-only, no chips actually move; hide the per-board ± chip delta. */
  isPractice?: boolean;
  /**
   * VAMOS-BOT-LABEL — labels for the opposing hands, one per entry in `allBotCards`.
   * Multiplayer opponents arrive through the SAME allBotCards array as bots, so without this
   * the row called a human "Bot". Omit for solo and the bot labels are used unchanged.
   */
  opponentLabels?: string[];
}

// VAMOS-FIX-RESULTS-RENDER 2026-06-17 — memo'd. Renders up to 9 cards per
// board × N boards. Was re-rendering on every parent state change (chip
// roll-up = 20 ticks, achievement toasts, login prompt). Memo bails out
// when props haven't changed; parent must pass stable shareData/winBorderColor.
export const BoardResultCard = React.memo(function BoardResultCard({
  board, boardIndex, pot, cardW, cardH, translateY,
  commCardW, commCardH, botCardW, botCardH,
  winBorderColor, winBadgeAnim, shareData, autoShareUrl,
  isComplete, completeBonusAmount, isPractice, opponentLabels,
}: BoardResultCardProps) {
  const cW = commCardW ?? cardW;
  const cH = commCardH ?? cardH;
  const bW = botCardW ?? cardW;
  const bH = botCardH ?? cardH;
  const boardShareRef = useRef<any>(null);
  const boardStoryRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  const chipResult = board.winner === 'player' ? `+${pot}` : board.winner === 'bot' ? `-${pot}` : '\u00b10';
  const chipColor = board.winner === 'player' ? COLORS.neonGreen : board.winner === 'bot' ? COLORS.neonRed : COLORS.textDim;
  const multiBot = (board.allBotCards ?? []).length > 1;
  // VAMOS-HAND-LABELS-ENGLISH 2026-06-17 \u2014 rank-specific English labels
  // derived from precomputed best-5 cards; no evaluator on the render path.
  const comparisonText = getComparisonText(
    board.playerHandName, board.botHandName, board.winner,
    'en', board.playerBestCards, board.botBestCards,
  );
  const playerHandDisplay = getSpecificHandName(board.playerHandName, board.playerBestCards);
  const botHandDisplay = getSpecificHandName(board.botHandName, board.botBestCards);

  const doShare = async (ref: React.RefObject<any>) => {
    setSharing(true);
    await new Promise((r) => setTimeout(r, 150));
    const url = autoShareUrl ?? (await saveHandForWebReplay(shareData).catch(() => null))?.url ?? null;
    const text = generateShareText(shareData, url, isPractice);
    await captureAndShare(ref, text);
    setSharing(false);
  };

  const doCopy = async () => {
    const url = autoShareUrl ?? (await saveHandForWebReplay(shareData).catch(() => null))?.url ?? null;
    if (url) { await copyToClipboard(url); Alert.alert(t().linkCopied, url); }
  };

  const handleShare = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t().cancel, t().shareImage, t().shareStory, t().copyReplayLink], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) doShare(boardShareRef);
          else if (i === 2) doShare(boardStoryRef);
          else if (i === 3) doCopy();
        }
      );
    } else {
      Alert.alert(t().shareHand, undefined, [
        { text: t().shareImage, onPress: () => doShare(boardShareRef) },
        { text: t().shareStory, onPress: () => doShare(boardStoryRef) },
        { text: t().copyReplayLink, onPress: doCopy },
        { text: t().cancel, style: 'cancel' },
      ]);
    }
  };

  return (
    <Animated.View style={{ width: '100%', transform: [{ translateY }] }}>
      <View style={[
        styles.boardCard,
        board.winner === 'player' && styles.boardCardWin,
        board.winner === 'bot' && styles.boardCardLose,
      ]}>
        {/* Win glow overlay */}
        {board.winner === 'player' && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: 10, borderWidth: 2, borderColor: winBorderColor }]}
          />
        )}

        {/* Header */}
        <View style={styles.boardHeader}>
          <View style={styles.boardHeaderLeft}>
            <Text style={styles.boardLabel}>{t().boardLabel(boardIndex + 1)}</Text>
            {board.winner === 'player' ? (
              <Animated.View style={{ transform: [{ scale: winBadgeAnim }] }}>
                <Badge label={t().winShort} variant="win" small />
              </Animated.View>
            ) : (
              <Badge label={board.winner === 'bot' ? t().lossShort : t().tieShort} variant={board.winner === 'bot' ? 'lose' : 'tie'} small />
            )}
          </View>
          <View style={styles.boardHeaderRight}>
            {/* OTA-COSMETIC-FIXES 2026-07-09 — practice never moves real chips; showing
                a per-board ±N chip delta there is misleading, not just redundant. */}
            {!isPractice && <Text style={[styles.chipAmount, { color: chipColor }]}>{chipResult}</Text>}
            {Platform.OS !== 'web' && (
              <Pressable onPress={handleShare} style={styles.shareBtn} disabled={sharing}>
                <Text style={styles.shareBtnText}>{sharing ? '...' : '📸'}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Offscreen share cards */}
        {Platform.OS !== 'web' && (
          <>
            <View ref={boardShareRef} style={styles.offscreen} pointerEvents="none">
              <SingleBoardShareCard board={board as any} boardIndex={boardIndex} potAmount={pot} isPractice={isPractice} />
            </View>
            <View ref={boardStoryRef} style={styles.offscreen} pointerEvents="none">
              <StoryShareCard board={board as any} boardIndex={boardIndex} potAmount={pot} isComplete={isComplete} completeBonusAmount={completeBonusAmount} isPractice={isPractice} />
            </View>
          </>
        )}

        {/* Bot hand rows */}
        {(board.allBotCards ?? []).map((botCards, botIdx) =>
          botCards && botCards.length > 0 ? (
            <View key={`bot-${botIdx}`} style={styles.handRowVertical}>
              <Text style={[styles.handLabel, board.winner === 'bot' && styles.handLabelLose]}>
                {/* VAMOS-BOT-LABEL — never call a human "Bot". A supplied label always wins;
                    the bot wording is only the solo default. */}
                {opponentLabels?.[botIdx] ?? (multiBot ? `${t().bot} ${botIdx + 1}` : t().bot)}
              </Text>
              <View style={styles.cardsRow}>
                {botCards.map((c: any) => (
                  <StaticCard
                    key={c.id}
                    card={c}
                    cardWidth={bW}
                    cardHeight={bH}
                    highlighted={botIdx === 0 && (board.botHighlightIds ?? []).includes(c.id)}
                    dimmed={botIdx === 0 && !(board.botHighlightIds ?? []).includes(c.id) && (board.botHighlightIds ?? []).length > 0}
                  />
                ))}
                <Text style={[styles.handName, board.winner === 'bot' && styles.handNameWin]}>
                  {botIdx === 0
                    ? botHandDisplay
                    : ((board.allBotHandNames ?? [])[botIdx] || board.botHandName)}
                </Text>
              </View>
            </View>
          ) : null
        )}

        {/* Community cards */}
        <View style={styles.cardsRow}>
          {(board.openCards ?? []).map((c: any) => (
            <StaticCard key={c.id} card={c} cardWidth={cW} cardHeight={cH}
              highlighted={(board.boardHighlightIds ?? []).includes(c.id)}
              dimmed={!(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
            />
          ))}
          <View style={styles.cardSeparator} />
          {(board.closedCards ?? []).map((c: any) => (
            <StaticCard key={c.id} card={c} cardWidth={cW} cardHeight={cH}
              highlighted={(board.boardHighlightIds ?? []).includes(c.id)}
              dimmed={!(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
            />
          ))}
        </View>

        {/* Player hand row */}
        <View style={styles.handRowVertical}>
          <Text style={[styles.handLabel, board.winner === 'player' && styles.handLabelWin]}>{t().equityYou}</Text>
          <View style={styles.cardsRow}>
            {(board.playerCards ?? []).map((c: any) => (
              <StaticCard key={c.id} card={c} cardWidth={cardW} cardHeight={cardH}
                highlighted={(board.playerHighlightIds ?? []).includes(c.id)}
                dimmed={!(board.playerHighlightIds ?? []).includes(c.id) && (board.playerHighlightIds ?? []).length > 0}
              />
            ))}
            <Text style={[styles.handName, board.winner === 'player' && styles.handNameWin]}>
              {playerHandDisplay}
            </Text>
          </View>
        </View>

        {/* Comparison text: "Three of a Kind beats One Pair" */}
        <View style={styles.comparisonRow}>
          <Text style={[
            styles.comparisonText,
            board.winner === 'player' ? styles.comparisonWin : board.winner === 'bot' ? styles.comparisonLose : styles.comparisonTie,
          ]}>
            {comparisonText}
          </Text>
          {(board.playerHighlightIds ?? []).length > 0 && (
            <Text style={styles.bestSelectedLabel}>
              {t().bestHandFrom9}
            </Text>
          )}
        </View>

        {/* Result label */}
        <View style={styles.boardResultRow}>
          <Text style={[
            styles.boardResultLabel,
            board.winner === 'player' ? styles.boardResultWin : board.winner === 'bot' ? styles.boardResultLose : styles.boardResultTie,
          ]}>
            {board.winner === 'player' ? t().youWin : board.winner === 'bot' ? t().youLose : t().tie}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  boardCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(4),
  },
  boardCardWin: {
    borderColor: 'rgba(255,215,0,0.4)',
    borderLeftColor: '#FFD700',
    borderLeftWidth: 3,
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  boardCardLose: {
    borderColor: COLORS.neonRed,
    ...Platform.select({
      ios: { shadowColor: COLORS.neonRed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  boardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  boardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  boardLabel: { color: COLORS.textMuted, fontSize: rf(12), fontWeight: '800', letterSpacing: 1.5 },
  chipAmount: { fontSize: rf(15), fontWeight: '900' },
  // THE MISSING ANCESTOR. handName (:191) is rendered INSIDE this row, not as a sibling of it,
  // so making handName and handRowVertical shrinkable was never enough — this row sat between
  // them at content size and floored the whole chain. A flex row floors at its content unless
  // it gets minWidth:0 too, which is the same lesson as the settings overflow, one level deeper.
  // flexWrap so the longest names drop to a second line UNDER the cards rather than being
  // truncated: "Full House, Threes over Queens" is information a player wants at the end of a
  // hand, so wrapping beats an ellipsis here.
  cardsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2, minWidth: 0, flexShrink: 1, flexWrap: 'wrap' },
  cardSeparator: { width: 4 },
  // minWidth:0 so the handName child can actually shrink — a flex row floors at its content
  // size by default, which left "Three of a Kind, Fives" 5px past a 320px edge even after the
  // child was made shrinkable.
  handRowVertical: { flexDirection: 'row', alignItems: 'center', gap: rs(6), minWidth: 0, flexShrink: 1 },
  // Audited on /results 2026-08-10: this rendered at 9px ("YOU", "Bot"). rf(v) clamps to
  // [v*0.75, v*1.25] so rf(9) can floor at 7 — well under a legible minimum for copy.
  handLabel: { color: COLORS.textDim, fontSize: rf(10, 10), fontWeight: '700', letterSpacing: 1, width: 30 },
  handLabelWin: { color: COLORS.neonGreen },
  handLabelLose: { color: COLORS.neonRed },
  // Two defects here, both measured on /results at 320px:
  //  - 9px copy, same clamp as handLabel above.
  //  - NO flex bound beside a fixed-width sibling, so long hand names ran OFF SCREEN:
  //    "Full House, Kings over Sixes" at x 228..353 and "Two Pair, Nines and Fours" at
  //    x 226..331, both past a 320px edge and unreadable at any scroll position.
  // flexShrink needs minWidth:0 to do anything — without it the box floors at content size
  // and the shrink is a no-op (the lesson from the settings overflow).
  handName: { color: COLORS.textMuted, fontSize: rf(10, 10), fontWeight: '600', marginLeft: rs(4), flex: 1, flexShrink: 1, minWidth: 0 },
  handNameWin: { color: COLORS.goldLight, fontWeight: '800' },
  shareBtn: { paddingHorizontal: rs(8), paddingVertical: 3, borderRadius: rv(8), backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  shareBtnText: { fontSize: rf(13) },
  offscreen: { position: 'absolute', left: -9999, top: 0, opacity: 0, zIndex: -1 },
  boardResultRow: { alignItems: 'center', paddingTop: rs(6), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: rs(4) },
  boardResultLabel: { fontSize: rf(13), fontWeight: '800', letterSpacing: 1 },
  boardResultWin: { color: '#FFD700' },
  boardResultLose: { color: COLORS.neonRed },
  boardResultTie: { color: COLORS.textMuted },
  comparisonRow: { alignItems: 'center', gap: rs(2), paddingVertical: rs(4) },
  comparisonText: { fontSize: rf(11), fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  comparisonWin: { color: COLORS.neonGreen },
  comparisonLose: { color: COLORS.neonRed },
  comparisonTie: { color: COLORS.textDim },
  // VAMOS-CONTRAST 2026-08-16 — was #8B6914, measured 3.45:1 on its backdrop: below WCAG AA for
  // body text. #e8c96a measures 10.86:1 and already carries field-level meaning here. Deliberately
  // NOT #FFD700 — that now means "you won", and a caption must not shout in the winner colour.
  // The other two #8B6914 sites are untouched: the chip-store badge is a BACKGROUND (different
  // rule) and the player-count selector border is a non-text UI component at 3.89:1, which clears
  // the 3:1 that applies to it.
  bestSelectedLabel: { fontSize: rf(10, 10), color: '#e8c96a', fontWeight: '600', letterSpacing: 0.5 },
});
