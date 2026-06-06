// v-red-boards
import React, { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import CardComponent from './Card';
import { Badge } from './Badge';
import HandNameOverlay from './HandNameOverlay';
import { Card, COLORS, CARDS_PER_BOARD, BOARD_COLORS } from '../constants/gameConfig';
import { rv } from '../constants/deviceBreakpoints';
import { rf, rs, SCREEN_W as MODULE_SCREEN_W, SCREEN_H as MODULE_SCREEN_H } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { t, getLanguage } from '../utils/i18n';
import { trackAction } from '../utils/crash-evidence';
import { useGameColors } from '../utils/useGameColors';
import { getHandHint } from '../utils/handHint';
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';
import { KILL_Board } from '../utils/animationKill';

// Hand hint explanations — always available (not just first game)
const HINT_EXPLANATIONS: Record<string, { en: string; he: string }> = {
  'High Card':       { en: 'No special combination yet',          he: 'אין צירוף עדיין' },
  'Pair':            { en: 'Two cards of the same rank',          he: 'שני קלפים זהים' },
  'Two Pair':        { en: 'Two different pairs',                 he: 'שני זוגות שונים' },
  'Trips':           { en: 'Three cards of the same rank',        he: 'שלושה קלפים זהים' },
  'Straight':        { en: 'Five cards in a row',                 he: 'חמישה קלפים ברצף' },
  'Flush':           { en: 'Five cards of the same suit',         he: 'חמישה קלפים מאותו צבע' },
  'Full House':      { en: 'Three of a kind + a pair',            he: 'שלישייה + זוג' },
  'Four of a Kind':  { en: 'Four cards of the same rank',         he: 'ארבעה קלפים זהים' },
  'Straight Flush':  { en: 'Straight + Flush combined',           he: 'רצף + צבע' },
  'Flush Draw':      { en: 'One card away from a Flush',          he: 'קלף אחד לצבע' },
  'Straight Draw':   { en: 'One card away from a Straight',       he: 'קלף אחד לרצף' },
  'Str+Flush Draw':  { en: 'Drawing to both Straight and Flush',  he: 'קרוב גם לרצף וגם לצבע' },
};

interface BoardProps {
  index: number;
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  allBotCards?: Card[][];
  revealed: boolean;
  active: boolean;
  potAmount: number;
  winner?: 'player' | 'bot' | 'tie';
  playerHighlightIds?: string[];
  botHighlightIds?: string[];
  boardHighlightIds?: string[];
  playerHandName?: string;
  botHandName?: string;
  allBotHandNames?: string[];
  onPress?: () => void;
  onRemoveCard?: (card: Card) => void;
  onAutoFill?: () => void;
  isArrangement?: boolean;
  selected?: boolean;
  flipDuration?: number;
  cardHeight?: number;
  isWinner?: boolean;
  communityScale?: number;
  // PR-O scope-corrected — when true (only 4-board / 2-player case), render
  // community cards as a vertical stack (3 face-up / horizontal divider / 2
  // face-down) and player slots as a vertical column. Default false = PR-M's
  // horizontal community row + horizontal slot row.
  verticalContent?: boolean;
}

function EmptySlotAnimated({ isArrangement, onPress, slotWidth, slotHeight }: { isArrangement?: boolean; onPress?: () => void; slotWidth: number; slotHeight: number }) {
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (isArrangement) {
      if (!KILL_Board) {
        // FINITE per iron rule
        pulseOpacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1000 }),
            withTiming(0.4, { duration: 1000 }),
          ),
          200,
          true,
        );
      }
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(0.6, { duration: 200 });
    }
    return () => { cancelAnimation(pulseOpacity); };
  }, [isArrangement]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.emptySlot, { width: slotWidth, height: slotHeight }, isArrangement && styles.dropTarget, animStyle]}>
        {false && <Text style={styles.plusText}>tap</Text>}
      </Animated.View>
    </Pressable>
  );
}

function FloatingChips({ amount, winner }: { amount: number; winner: 'player' | 'bot' | 'tie' }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(-40, { duration: 1200 });
    opacity.value = withDelay(700, withTiming(0, { duration: 500 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const text = winner === 'tie' ? '\u00b10' : winner === 'player' ? `+${amount}` : `-${amount}`;
  const color = winner === 'player' ? '#FFD700' : winner === 'bot' ? COLORS.neonRed : COLORS.textSecondary;

  return (
    <Animated.Text style={[styles.floatingChips, { color }, animStyle]}>
      {text}
    </Animated.Text>
  );
}

export default function Board({
  index,
  openCards,
  closedCards,
  playerCards,
  botCards,
  revealed,
  active,
  potAmount,
  winner,
  playerHighlightIds = [],
  botHighlightIds = [],
  boardHighlightIds = [],
  playerHandName,
  botHandName,
  allBotCards,
  allBotHandNames,
  onPress,
  onRemoveCard,
  onAutoFill,
  isArrangement,
  selected,
  flipDuration,
  cardHeight: cardHeightProp,
  isWinner,
  communityScale = 1.2,
  verticalContent = false,
}: BoardProps) {
  // C-fix 2026-05-22: lock dimensions to module-level constants (computed once at app
  // load in utils/responsive.ts). Was useWindowDimensions() — recomputed every render,
  // causing BOARD_HEIGHT + card sizes to drift on any focus/keyboard/resize event.
  const screenW = MODULE_SCREEN_W;
  const screenH = MODULE_SCREEN_H;
  // 2026-05-23 zone fix #3: cap at 130px so 4-board games on 320pt devices don't
  // squeeze the player hand to zero. screenH * 0.19 = 162 @ 852, 108 @ 568 — cap
  // bites only on tall devices, leaving 320pt-class layouts unchanged.
  const BOARD_HEIGHT = Math.min(Math.floor(screenH * 0.19), 130); // S82: fixed board height Â never jumps when bot places cards
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const gameColors = useGameColors();
  const [hintInfoVisible, setHintInfoVisible] = useState(false);
  const hintInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [botTooltipVisible, setBotTooltipVisible] = useState(false);
  const botTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // PR-D study tokens (caps-design-study) — explicit responsive dims.
  // community: rs(28)x rs(40), slot: rs(34)x rs(48), hand: rs(46)x rs(65).
  // cardHeightProp wins so legacy callers (BoardReveal, results) keep working.
  //
  // PR-L Task C — width-aware community card cap.
  // Measure the actual rendered board width via onLayout, then cap commW so
  // 5 community cards + 4 inter-card gaps + separator + separator margins +
  // pressableInner horizontal padding all fit. This guards against narrow
  // 4p cells where the default cardHeight*0.7 would otherwise overflow.
  const [measuredBoardW, setMeasuredBoardW] = useState(0);
  const onBoardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredBoardW) > 1) setMeasuredBoardW(w);
  };
  const _baseCommW = cardHeightProp ? Math.round(cardHeightProp * 0.7) : PRD.card.community.w;
  const _commRowConstants =
    4 * PRD.card.gap +           // 4 flex gaps between 6 children
    PRD.board.flopSeparatorW +   // separator width
    2 * rs(6) +                  // separator marginHorizontal
    2 * PRD.board.cellPadH;      // pressableInner padding
  const _maxCommWFromWidth = measuredBoardW > 0
    ? Math.max(18, Math.floor((measuredBoardW - _commRowConstants) / 5))
    : _baseCommW;
  const commW = Math.min(_baseCommW, _maxCommWFromWidth);
  const _baseCommH = cardHeightProp ? cardHeightProp : PRD.card.community.h;
  // Keep aspect ratio when commW is shrunken — community card aspect is w/h ≈ 0.7.
  const commH = commW < _baseCommW ? Math.round(commW / 0.7) : _baseCommH;
  const ch    = cardHeightProp ?? (isArrangement ? PRD.card.slot.h : PRD.card.hand.h);
  const cw    = cardHeightProp ? Math.round(cardHeightProp * 0.72) : (isArrangement ? PRD.card.slot.w : PRD.card.hand.w);
  const slotH = isArrangement ? PRD.card.slot.h : ch;
  const slotW = isArrangement ? PRD.card.slot.w : Math.round(slotH * 0.7);

  const pulseValue = useSharedValue(0.4);

  useEffect(() => {
    if (active) {
      if (!KILL_Board) {
        // FINITE per iron rule
        pulseValue.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 800 }),
            withTiming(0.4, { duration: 800 }),
          ),
          200,
          true,
        );
      }
    } else {
      cancelAnimation(pulseValue);
      pulseValue.value = withTiming(0, { duration: 200 });
    }
    return () => { cancelAnimation(pulseValue); };
  }, [active]);

  const pulseStyle = useAnimatedStyle(() => {
    if (pulseValue.value === 0) {
      return {};
    }
    return {
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: pulseValue.value * 0.6,
      shadowRadius: pulseValue.value * 10,
      elevation: pulseValue.value * 8,
    };
  });

  // Board-complete pulse: single green flash when board becomes full during arrangement
  const boardFull = isArrangement && playerCards.length === CARDS_PER_BOARD;
  const prevBoardFull = useRef(false);
  const completePulse = useSharedValue(0);

  useEffect(() => {
    if (boardFull && !prevBoardFull.current) {
      completePulse.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 500 }),
      );
    }
    prevBoardFull.current = !!boardFull;
  }, [boardFull]);

  const completePulseStyle = useAnimatedStyle(() => {
    if (completePulse.value === 0) return {};
    return {
      borderColor: COLORS.boardFull,
      shadowColor: COLORS.neonGreen,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: completePulse.value * 0.8,
      shadowRadius: completePulse.value * 12,
      elevation: completePulse.value * 10,
    };
  });

  // WIN banner Â animate in when winner is set
  const bannerProgress = useSharedValue(0);
  useEffect(() => {
    if (winner) {
      bannerProgress.value = withDelay(350, withTiming(1, { duration: 350 }));
    } else {
      bannerProgress.value = 0;
    }
  }, [winner]);

  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerProgress.value,
    transform: [{ scale: 0.7 + bannerProgress.value * 0.3 }],
  }));

  // Winner gold pulse Â 2s repeating glow when isWinner is true
  const winnerPulse = useSharedValue(0);
  useEffect(() => {
    if (isWinner) {
      if (!KILL_Board) {
        // FINITE per iron rule
        winnerPulse.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1000 }),
            withTiming(0.3, { duration: 1000 }),
          ),
          200,
          false,
        );
      }
    } else {
      cancelAnimation(winnerPulse);
      winnerPulse.value = withTiming(0, { duration: 200 });
    }
    return () => { cancelAnimation(winnerPulse); };
  }, [isWinner]);

  const winnerPulseStyle = useAnimatedStyle(() => {
    if (winnerPulse.value === 0) return {};
    return {
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: winnerPulse.value * 0.8,
      shadowRadius: winnerPulse.value * 14,
      elevation: winnerPulse.value * 10,
    };
  });

  // Track layout dimensions for crash diagnostics Â fires once per board mount
  useEffect(() => {
    if (index === 0) {
      // Only log for board 0 to avoid 4ÃÂ noise; board sizes are all identical
      trackAction(`layout:cw=${cw}h=${ch}sw=${slotW}sh=${slotH}scr=${screenW}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build bot card sets: use allBotCards if provided, otherwise fall back to single botCards
  const safeBotCards = botCards ?? [];
  const botCardSets = allBotCards && allBotCards.some((bc) => bc.length > 0) ? allBotCards : safeBotCards.length > 0 ? [safeBotCards] : [];
  const multiBot = botCardSets.length > 1;

  // PR-D study: per-board accent (B1 yellow, B2 blue, B3 green, B4 orange)
  const boardAccent = PRD.board.accent[index % PRD.board.accent.length] ?? BOARD_COLORS[index % BOARD_COLORS.length];

  return (
    <Animated.View
      onLayout={onBoardLayout}
      style={[
        styles.container,
        { backgroundColor: theme.boardBg, borderColor: boardAccent }, // PR-E: removed fixed BOARD_HEIGHT — Board now fills its 2x2 grid cell
        Platform.OS === 'web' && visualTheme === 'fiveo' && { boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.6)' } as any,
        active && styles.active,
        selected && styles.selected,
        winner === 'player' && styles.playerWon,
        winner === 'bot' && styles.botWon,
        active && pulseStyle,
        completePulseStyle,
        isWinner && winnerPulseStyle,
      ]}
    >
      <Pressable onPress={onPress} style={styles.pressableInner}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.boardLabel, { backgroundColor: boardAccent }]}>{t().boardLabel(index + 1)}</Text>
            {isArrangement && boardFull && (
              <View style={styles.boardFullBadge}>
                <Text style={styles.boardFullText}>✓</Text>
              </View>
            )}
            {winner && (
              <Badge
                label={winner === 'player' ? 'W' : winner === 'bot' ? 'L' : 'T'}
                variant={winner === 'player' ? 'win' : winner === 'bot' ? 'lose' : 'tie'}
                small
              />
            )}
            {revealed && playerHandName && (
              // PR-L Task D — narrow boards (2p/3p horizontal cols) clipped
              // mid-word ("Straigh…", "Pai…"). Add numberOfLines + adjustsFontSizeToFit
              // + flexShrink so the text fits whatever width is left.
              <Text
                style={[styles.handName, styles.handNameShrink, winner === 'player' && styles.winnerHandName]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {playerHandName}
              </Text>
            )}
          </View>
          <View style={styles.potArea}>
            {winner && <FloatingChips amount={potAmount} winner={winner} />}
          </View>
        </View>

        {/* Bot card rows Â hidden during arrangement (board stays clean for player placement) */}
        {/* PR-L Task B — hoist AUTO button BEFORE the contentCenter wrapper
            so its absolute positioning (top:rs(3) right:rs(3)) still anchors
            to the board rather than to the centered content wrapper. */}
        {isArrangement && playerCards.length === 0 && onAutoFill && (
          <Pressable style={styles.autoBtn} onPress={onAutoFill}>
            <Text style={styles.autoBtnText}>{t().autoPlace}</Text>
          </Pressable>
        )}

        {/* PR-L Task B — center the content rows (bot rows, community label,
            community cards, player slots) vertically within the space below
            the header. Was relying on pressableInner's justifyContent:center
            with the header inline; that centered the entire stack including
            the header, leaving cards visually low with a maroon block above. */}
        <View style={styles.contentCenter}>

        {!isArrangement && (botCardSets ?? []).map((botCardSet, botIdx) =>
          (botCardSet ?? []).length > 0 ? (
            <View key={`bot-${botIdx}`} style={styles.cardRow}>
              <Text style={styles.rowLabel}>{`${t().bot} ${botIdx + 1}`}</Text>
              {(botCardSet ?? []).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={!revealed ? () => {
                    if (botTooltipTimer.current) clearTimeout(botTooltipTimer.current);
                    setBotTooltipVisible(true);
                    botTooltipTimer.current = setTimeout(() => setBotTooltipVisible(false), 2000);
                  } : undefined}
                >
                  <CardComponent
                    card={c}
                    faceDown={!revealed}
                    cardWidth={cw}
                    cardHeight={ch}
                    highlighted={botIdx === 0 && revealed && botHighlightIds.includes(c.id)}
                    dimmed={botIdx === 0 && revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
                    flipDuration={flipDuration}
                  />
                </Pressable>
              ))}
              {!revealed && botTooltipVisible && (
                <View style={styles.botTooltip}>
                  <Text style={styles.botTooltipText}>Revealed after River</Text>
                </View>
              )}
              {revealed && (allBotHandNames?.[botIdx] || (botIdx === 0 && botHandName)) && (
                <Text
                  style={[styles.handName, styles.handNameShrink, winner === 'bot' && styles.winnerHandName, { marginLeft: 4 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {allBotHandNames?.[botIdx] || botHandName}
                </Text>
              )}
            </View>
          ) : null
        )}

        {/* Community cards: flop + turn/river (slightly larger for readability) */}
        {/* A3: COMMUNITY label - gold pill for visual hierarchy */}
        <View style={styles.communityLabelWrap}>
          <Text style={styles.communityLabelText}>{t().community}</Text>
        </View>
        {/* PR-O scope-corrected — vertical stack only when verticalContent=true
            (4-board case). Default behavior is PR-M's horizontal community row:
            3 face-up + vertical gold separator + 2 face-down, side by side. */}
        <View style={verticalContent ? styles.cardCol : styles.cardRow}>
          {(openCards ?? []).map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              cardWidth={commW}
              cardHeight={commH}
              isCommunityCard
              highlighted={revealed && boardHighlightIds.includes(c.id)}
              dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
            />
          ))}
          <View style={[verticalContent ? styles.communitySeparatorH : styles.communitySeparator, { backgroundColor: boardAccent }]} />
          {(closedCards ?? []).map((c, i) => (
            <View key={c.id} style={[styles.communityCardWrap, !revealed && styles.faceDownWrap]}>
              <CardComponent
                card={c}
                faceDown={!revealed}
                cardWidth={commW}
                cardHeight={commH}
                isCommunityCard
                highlighted={revealed && boardHighlightIds.includes(c.id)}
                dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
                flipDuration={flipDuration}
              />
              {false && (
                <Text style={styles.cardLabel}>{i === 0 ? 'Turn' : 'River'}</Text>
              )}
            </View>
          ))}
        </View>

        {/* PR-E AUTO button hoisted above the contentCenter wrapper (PR-L Task B) */}

        {/* Player cards — PR-O scope-corrected — vertical stack only when
            verticalContent=true. Default = PR-M horizontal slot row. */}
        <View style={verticalContent ? styles.cardCol : styles.cardRow}>
          {playerCards.length > 0 ? (
            playerCards.map((c) => (
              // ALWAYS wrap in Pressable (same key, same component type across renders).
              // When isArrangement is false, onPress is undefined = non-interactive.
              // Previously alternated between <Pressable> and <CardComponent> at the same key,
              // which caused React 19 to call CardComponent's render against Pressable's hook
              // state Â "Rendered fewer hooks than expected" crash (CR-T6CB / CR-6PSY).
              <Pressable key={c.id} onPress={isArrangement && onRemoveCard ? () => onRemoveCard(c) : undefined}>
                <CardComponent
                  card={c}
                  faceDown={false}
                  cardWidth={cw}
                  cardHeight={ch}
                  highlighted={revealed && playerHighlightIds.includes(c.id)}
                  dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
                />
              </Pressable>
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={slotW} slotHeight={slotH} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-fill-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={slotW} slotHeight={slotH} />
            ))
          }
          {isArrangement && playerCards.length >= 2 && (() => {
            const hint = getHandHint(playerCards);
            const expl = HINT_EXPLANATIONS[hint];
            const isHE = getLanguage() === 'he';
            const explText = expl ? (isHE ? expl.he : expl.en) : '';
            return (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>{hint}</Text>
                {expl && (
                  <Pressable
                    onPress={() => {
                      if (hintInfoTimer.current) clearTimeout(hintInfoTimer.current);
                      setHintInfoVisible(v => {
                        if (!v) {
                          hintInfoTimer.current = setTimeout(() => setHintInfoVisible(false), 3000);
                        }
                        return !v;
                      });
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.hintInfoBtn}
                  >
                    <Text style={styles.hintInfoIcon}>ⓘ</Text>
                  </Pressable>
                )}
                {hintInfoVisible && explText ? (
                  <Text style={styles.hintExplText}>{explText}</Text>
                ) : null}
              </View>
            );
          })()}
          {revealed && playerHandName && (
            <HandNameOverlay handName={playerHandName} isWinner={winner === 'player'} />
          )}
        </View>
        </View>{/* /contentCenter — PR-L Task B */}

        {winner && (
          <Animated.View style={[styles.winnerBadge, winner === 'player' ? { backgroundColor: gameColors.win } : winner === 'bot' ? { backgroundColor: gameColors.lose } : styles.tieBadge, bannerAnimStyle]}>
            <Text style={styles.winnerText}>
              {winner === 'player' ? 'WIN' : winner === 'bot' ? 'LOSE' : 'TIE'}
            </Text>
            {winner === 'player' && playerHandName ? (
              <Text style={styles.bannerHandName}>{playerHandName}</Text>
            ) : winner === 'bot' && botHandName ? (
              <Text style={styles.bannerHandName}>{botHandName}</Text>
            ) : null}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.boardBg,
    borderRadius: rs(18),
    borderWidth: PRD.board.border,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
      default: {
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      } as any,
    }),
  },
  pressableInner: {
    // PR-D study: board padding rs(6/5).
    // PR-L Task B — justifyContent now lives on the inner contentCenter wrapper.
    // pressableInner just stacks header + contentCenter; contentCenter is
    // flex:1 + justifyContent:center, so the header stays at top and the
    // content rows center in the remaining vertical space.
    flex: 1,
    paddingHorizontal: PRD.board.cellPadH,
    paddingVertical: PRD.board.cellPadV,
    overflow: 'hidden',
  },
  // PR-L Task B — wrapper for the centered content rows.
  contentCenter: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  active: {
    borderColor: COLORS.gold,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  selected: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  playerWon: {
    borderColor: COLORS.neonGreen,
  },
  botWon: {
    borderColor: COLORS.neonRed,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(2),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    flex: 1,
  },
  boardFullBadge: {
    width: rs(16),
    height: rs(16),
    borderRadius: rs(8),
    backgroundColor: '#28A745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardFullText: {
    color: '#fff',
    fontSize: rf(9),
    fontWeight: '900',
  },
  boardLabel: {
    color: '#0a0a0a',
    fontSize: rf(10),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: '#c8a84b',
    paddingHorizontal: rs(6),
    paddingVertical: rs(1),
    borderRadius: 6,
    overflow: 'hidden',
  },
  rowLabel: {
    color: COLORS.textDim,
    fontSize: rf(7),
    fontWeight: '700',
    letterSpacing: 0.5,
    width: rs(20),
    textAlign: 'center',
  },
  potArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  potRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: rf(10),
    fontWeight: '700',
  },
  potDot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
    backgroundColor: COLORS.gold,
  },
  floatingChips: {
    fontSize: rf(11),
    fontWeight: '800',
    position: 'absolute',
    right: -4,
    top: -2,
  },
  cardRow: {
    // PR-D study: card gap = rs(3)
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: PRD.card.gap,
    paddingVertical: 1,
  },
  // PR-O — vertical stack for community + slots inside 1xN tall+narrow cells.
  cardCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: PRD.card.gap,
    paddingHorizontal: 1,
  },
  communitySeparator: {
    // PR-D study: 3px gold separator between flop and turn/river
    width: PRD.board.flopSeparatorW,
    height: '80%',
    backgroundColor: COLORS.gold,
    opacity: 0.55,
    marginHorizontal: rs(6),
    alignSelf: 'center',
    borderRadius: 1,
  },
  // PR-O — horizontal divider for vertical-stack community: full-width thin line.
  communitySeparatorH: {
    height: PRD.board.flopSeparatorW,
    width: '80%',
    backgroundColor: COLORS.gold,
    opacity: 0.55,
    marginVertical: rs(2),
    alignSelf: 'center',
    borderRadius: 1,
  },
  communityLabelWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
    borderRadius: rs(6),
    borderWidth: 0.5,
    borderColor: '#c9a84c',
    marginBottom: rs(3),
    marginLeft: rs(2),
  },
  communityLabelText: {
    fontSize: rf(8),
    fontWeight: '800',
    letterSpacing: 2,
    color: '#c9a84c',
  },
  emptySlot: {
    // PR-D study: dashed rgba(255,255,255,0.18) on dark bg
    borderRadius: rs(8),
    borderWidth: rs(1.5),
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dropTarget: {
    // PR-D study: when a hand card is selected, slots switch to solid
    // gold-bright + bg rgba(245,200,66,0.08) — "place me here" affordance.
    borderColor: '#F5C842',
    borderWidth: rs(2),
    borderStyle: 'solid',
    backgroundColor: 'rgba(245,200,66,0.08)',
  },
  plusText: {
    color: '#c8a84b55',
    fontSize: rf(10),
    fontWeight: '700',
  },
  communityCardWrap: {
    alignItems: 'center',
  },
  faceDownWrap: {
    // PR-D study: face-down community cards = opacity 0.5 + dark bg
    opacity: 0.5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: rs(4),
  },
  cardLabel: {
    fontSize: rf(9),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: rs(2),
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  botTooltip: {
    position: 'absolute',
    top: -rs(22),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: rs(6),
    paddingHorizontal: rs(6),
    paddingVertical: rs(3),
    alignItems: 'center',
  },
  botTooltipText: {
    color: '#fff',
    fontSize: rf(9),
    fontWeight: '600',
  },
  handName: {
    color: COLORS.textMuted,
    fontSize: rf(8),
    fontWeight: '600',
  },
  // PR-L Task D — let the rank text shrink within the header row.
  handNameShrink: {
    flexShrink: 1,
    flexGrow: 0,
    minWidth: 0,
  },
  winnerHandName: {
    color: COLORS.goldLight,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: rs(4),
    flexWrap: 'wrap',
    gap: rs(2),
    minHeight: rs(44),
    paddingVertical: rs(4),
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '600',
  },
  hintInfoBtn: {
    paddingHorizontal: rs(2),
  },
  hintInfoIcon: {
    color: 'rgba(201,168,76,0.7)',
    fontSize: rf(8),
    fontWeight: '700',
  },
  hintExplText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rf(7),
    fontWeight: '400',
    fontStyle: 'italic',
    marginLeft: rs(2),
    flexShrink: 1,
  },
  winnerBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: rs(5),
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  playerBadge: {
    backgroundColor: COLORS.neonGreen,
  },
  botBadge: {
    backgroundColor: COLORS.neonRed,
  },
  tieBadge: {
    backgroundColor: COLORS.goldDim,
  },
  winnerText: {
    color: COLORS.background,
    fontSize: rf(11),
    fontWeight: '900',
    letterSpacing: 2,
  },
  bannerHandName: {
    color: COLORS.background,
    fontSize: rf(8),
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  autoBtn: {
    // PR-E: position absolute in top-right of board container so it never
    // competes with the 4-slot cardRow at narrow 2x2 cell widths.
    position: 'absolute',
    top: rs(3),
    right: rs(3),
    paddingHorizontal: rs(6),
    paddingVertical: rs(2),
    minHeight: rs(20),
    justifyContent: 'center' as const,
    borderRadius: rs(6),
    backgroundColor: 'rgba(26,26,46,0.85)',
    borderWidth: 1,
    borderColor: '#C5A028',
    opacity: 1,
    zIndex: 10,
  },
  autoBtnText: {
    color: '#e8c96a',
    fontSize: rf(8),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
