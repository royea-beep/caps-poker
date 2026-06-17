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
import { OBSIDIAN, OBSIDIAN_GEOM, boardIdentityGlow } from '../constants/obsidianTheme';
import { LinearGradient } from 'expo-linear-gradient';
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
  // PR-M 2026-05-29 — fit-to-cell. When parent passes cellWidth/cellHeight
  // (BoardArrangement does), Board derives card dimensions so every row fits
  // INSIDE the cell without overflow. Legacy callers (results, BoardReveal)
  // omit these and keep the original PRD token sizing.
  cellWidth?: number;
  cellHeight?: number;
  // 2026-06-08 — when true (3-board case), Board adds explicit paddingVertical:6
  // to contentCenter so the safety pad isn't absorbed by space-evenly distribution.
  // Guarantees ≥6dp top + ≥6dp bottom clearance for placed cards.
  contentSafetyPad?: boolean;
  // VAMOS-BOARD-FILL-2 2026-06-15 — plumb boardCount from BoardArrangement so Board
  // can raise the card cap at bc=2/3 (tall boards = vertical room to use). bc=4 path
  // unchanged.
  boardCount?: number;
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
  cellWidth,
  cellHeight,
  contentSafetyPad,
  boardCount,
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
    // VAMOS-PLACEMENT-POLISH-2 FIX 4 — dev: log rendered board width so Roye can
    // confirm hugging worked (board width < screen width, centered).
    if (__DEV__ && index === 0) {
      console.log('[board-0]', { renderedW: w, naturalW: undefined });
    }
  };
  // VAMOS-CARDS-FIX 2026-06-16 — measure rendered header height so cards never
  // overlap it (bc=2 overlap was caused by HEADER_H being a constant rs(16) guess
  // that under-counted real header on device: BOARD pill + Auto-Place pill +
  // Hebrew glyph ascent + iOS shadow). Falls back to rs(22) (was rs(16)) until the
  // first onLayout fires.
  const [measuredHeaderH, setMeasuredHeaderH] = useState(0);
  const onHeaderLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - measuredHeaderH) > 1) setMeasuredHeaderH(h);
  };
  // PR-M 2026-05-29 — fit-to-cell math. When cellWidth/cellHeight are given,
  // derive card dims so the 2 internal rows (community + player slots) plus the
  // compact header strip fit INSIDE the cell. Otherwise fall back to legacy PRD
  // tokens so results/BoardReveal callers stay pixel-identical.
  const CARD_ASPECT = 0.72; // w/h — narrow playing card
  // VAMOS-REDESIGN-CORE 2026-06-17 — STUB_W and sepMarginH lifted to outer scope
  // so the JSX (which renders outside the cellWidth/cellHeight live-path block)
  // can use the same constants as the sizing math.
  const STUB_W = rs(28);
  const sepMarginHOuter = rs(2);
  let commW: number;
  let commH: number;
  let cw: number;
  let ch: number;
  let slotH: number;
  let slotW: number;
  if (cellWidth && cellHeight) {
    // BOARD-DENSITY 2026-06-09 — shrink HEADER_H rs(20)ârs(16). The actual rendered
    // header strip is max(boardLabel ~12dp, autoBtn minHeight rs(14)) = ~14dp, plus
    // a 2dp safety. HIG 44pt tap target maintained via hitSlop on autoBtn.
    // VAMOS-CARDS-FIX 2026-06-16 — HEADER_H is MEASURED via onHeaderLayout when
    // available. Old rs(16) constant under-counted real rendered header on device
    // (BOARD pill + Auto-Place + Hebrew ascent + iOS shadow); cards overlapped at
    // bc=2. Fallback rs(22) (was rs(16)) until first onLayout fires.
    const HEADER_H = measuredHeaderH > 0 ? measuredHeaderH + rs(2) : rs(22);
    const PAD_V = PRD.board.cellPadV; // rs(2) after PR-M
    const PAD_H = PRD.board.cellPadH; // rs(4) after PR-M
    // PR-O 2026-06-07 Fix 2 — innerW must also subtract:
    //   * container.borderWidth (PRD.board.border) on each side
    //   * BoardArrangement cell wrapper paddingHorizontal (rs(2) each side)
    //   * Roye's breathing room (rs(6) each side) so cards never touch border
    const BORDER_W = PRD.board.border;       // rs(2)
    const CELL_WRAPPER_PAD_H = rs(2);        // BoardArrangement cell paddingHorizontal
    // VAMOS-BOARD-FILL-3 2026-06-15 — at bc=2/3 the cells are full-screen-wide (one
    // board per row), so the 5-card row is the natural width bottleneck. Tighten
    // BREATHING_H + commGap + sepMarginH inside the cardRow so cards can grow
    // UNIFORMLY (keeping strict 0.72 aspect, no distortion). Visible padding stays
    // > 20dp via the cell wrapper + container border + outer paddingH. bc=4 keeps
    // original tighter spacing (already tight).
    const isLowBoard = boardCount === 2 || boardCount === 3;
    const BREATHING_H = isLowBoard ? rs(2) : rs(6);
    const innerW = Math.max(40, cellWidth - 2 * PAD_H - 2 * BORDER_W - 2 * CELL_WRAPPER_PAD_H - 2 * BREATHING_H);
    const innerH = Math.max(40, cellHeight - HEADER_H - 2 * PAD_V);
    const rowGap = rs(2);
    const rowH = Math.max(20, Math.floor(innerH / 2) - rowGap);
    // PR-O 2026-06-07 Fix 1 — derive card HEIGHT from cell first, then width.
    // Was: width-first → commH = round(commW/0.72) → vertical slack at 4-board.
    // Now: cardH_byHeight = (innerH - rowGap)/2, cardW_fromHeight = h*0.72.
    // Final commW = min(commWByWidth, cardW_fromHeight) preserves aspect AND
    // lets contentCenter justifyContent:'space-evenly' distribute any slack.
    // VAMOS-REDESIGN-CORE 2026-06-17 — during ARRANGEMENT the slot row collapses
    // to a fixed compact DEAL-LANE band (LANE_H ≈ 28pt) instead of 4 full-size
    // empty card boxes. Community claims everything else → flop cards grow
    // dramatically at every bc. Lever 1's bc=4 62/38 split is superseded by this
    // (community ratio is now ~75/25). Outside arrangement (reveal/results) the
    // prior Lever 1 split is preserved so the reveal flow renders unchanged.
    const _rowsBudget = innerH - rowGap;
    const LANE_H = rs(28);
    const _commBudgetH = isArrangement
      ? Math.max(20, _rowsBudget - LANE_H)
      : boardCount === 4
        ? Math.max(20, Math.floor(_rowsBudget * 0.62))
        : Math.max(20, Math.floor(_rowsBudget / 2));
    const _slotBudgetH = isArrangement
      ? Math.max(20, LANE_H)
      : boardCount === 4
        ? Math.max(20, _rowsBudget - _commBudgetH)
        : _commBudgetH;
    // Community row: 5 cards + 4 gaps + separator + 2*sepMargin (REVEAL/results),
    // or 3 flop cards + 2 gaps + DECK-STUB + 2*stubMargin (ARRANGEMENT) where the
    // stub replaces the separator + 2 face-down boxes that the player can't read
    // anyway. Stub footprint ~rs(28) so the 3 flop cards inherit ~76pt of freed
    // horizontal — flop grows from a 5-card budget to a 3-card budget.
    const sepW = PRD.board.flopSeparatorW;
    const sepMarginH = isLowBoard ? rs(2) : rs(2);
    const commGap = isLowBoard ? rs(3) : PRD.card.gap;
    const commWByWidth = isArrangement
      ? Math.max(14, Math.floor((innerW - 2 * commGap - STUB_W - 2 * sepMarginH) / 3))
      : Math.max(14, Math.floor((innerW - 4 * commGap - sepW - 2 * sepMarginH) / 5));
    const slotWByWidth = Math.max(14, Math.floor((innerW - 3 * commGap) / 4));
    // VAMOS-CARDS-BIG 2026-06-16 — relaxed strict 0.72 aspect to bounded portrait
    // range [ASPECT_MIN=0.62, ASPECT_MAX=0.85] so cards GROW into whichever budget
    // axis was previously sitting unused:
    //   bc=4 (height-bound, surplus width) → cards grow WIDER toward aspect 0.85.
    //   bc=2 (width-bound,  surplus height) → cards grow TALLER toward aspect 0.62.
    //   bc=3 (often both within range)     → cards take both budgets fully.
    // Stays portrait (W/H < 1) so the deck still reads as playing cards. Lever 1's
    // community>slot intent at bc=4 is preserved via _commBudgetH / _slotBudgetH.
    const ASPECT_MAX = 0.85;
    const ASPECT_MIN = 0.62;
    const fitToBox = (widthCap: number, heightCap: number): { w: number; h: number } => {
      const ratio = widthCap / heightCap;
      if (ratio > ASPECT_MAX) {
        // Width budget exceeds the aspect ceiling — cap width, height takes full budget.
        return { w: Math.max(14, Math.floor(heightCap * ASPECT_MAX)), h: Math.max(20, heightCap) };
      }
      if (ratio < ASPECT_MIN) {
        // Height budget exceeds the aspect floor — cap height, width takes full budget.
        return { w: Math.max(14, widthCap), h: Math.max(20, Math.floor(widthCap / ASPECT_MIN)) };
      }
      // Both budgets are inside the aspect range — use them fully.
      return { w: Math.max(14, widthCap), h: Math.max(20, heightCap) };
    };
    const _comm = fitToBox(commWByWidth, _commBudgetH);
    const _slot = fitToBox(slotWByWidth, _slotBudgetH);
    commW = _comm.w;
    commH = _comm.h;
    slotW = _slot.w;
    slotH = _slot.h;
    ch = slotH;
    cw = slotW;
    // VAMOS-OTA-VERIFY 2026-06-16 — diagnostic: confirm the LIVE path executes at
    // bc=4 and Lever 1's 62/38 split is in the rendered numbers (not the fallback).
    // Index 0 only to avoid 4× log spam; gated to bc=4 since that's the verify case.
    if (__DEV__ && index === 0 && boardCount === 4) {
      // eslint-disable-next-line no-console
      console.log('[board-size]', { path: 'live', boardCount, innerW, innerH, _commBudgetH, _slotBudgetH, commW, commH, slotW, slotH });
    }
  } else {
    // Legacy path — PRD tokens.
    const _baseCommW = cardHeightProp ? Math.round(cardHeightProp * 0.7) : PRD.card.community.w;
    const _commRowConstants =
      4 * PRD.card.gap + PRD.board.flopSeparatorW + 2 * rs(6) + 2 * PRD.board.cellPadH;
    const _maxCommWFromWidth = measuredBoardW > 0
      ? Math.max(18, Math.floor((measuredBoardW - _commRowConstants) / 5))
      : _baseCommW;
    commW = Math.min(_baseCommW, _maxCommWFromWidth);
    const _baseCommH = cardHeightProp ? cardHeightProp : PRD.card.community.h;
    commH = commW < _baseCommW ? Math.round(commW / 0.7) : _baseCommH;
    ch    = cardHeightProp ?? (isArrangement ? PRD.card.slot.h : PRD.card.hand.h);
    cw    = cardHeightProp ? Math.round(cardHeightProp * 0.72) : (isArrangement ? PRD.card.slot.w : PRD.card.hand.w);
    slotH = isArrangement ? PRD.card.slot.h : ch;
    // VAMOS-OTA-VERIFY 2026-06-16 — diagnostic: tag the FALLBACK path so we can
    // see in headless logs which path actually fires at bc=4.
    if (__DEV__ && index === 0 && boardCount === 4) {
      // eslint-disable-next-line no-console
      console.log('[board-size]', { path: 'fallback', boardCount, commW, commH, slotW: undefined, slotH });
    }
    slotW = isArrangement ? PRD.card.slot.w : Math.round(slotH * 0.7);
  }

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
      testID={`board-${index}`}
      style={[
        styles.container,
        // VAMOS-VISUAL-C Option C — obsidian board surface + per-board identity glow.
        // VAMOS-BOARD-RESTORE 2026-06-14 — reverted FIX 4 (board hug content). In a
        // column-laid grid `flex` controls the MAIN AXIS = height; flex:0 collapsed
        // every board's height to ~0. Restored to layout-471 flex:1 full-cell.
        { backgroundColor: OBSIDIAN.bgFallback, borderColor: boardAccent },
        boardIdentityGlow(boardAccent),
        Platform.OS === 'web' && {
          background: `linear-gradient(165deg, ${OBSIDIAN.bgTop} 0%, ${OBSIDIAN.bgBottom} 100%)`,
          boxShadow: `0 0 18px ${boardAccent}66, 0 14px 32px rgba(0,0,0,0.62)`,
        } as any,
        active && styles.active,
        selected && styles.selected,
        winner === 'player' && styles.playerWon,
        winner === 'bot' && styles.botWon,
        active && pulseStyle,
        completePulseStyle,
        isWinner && winnerPulseStyle,
      ]}
    >
      {/* VAMOS-VISUAL-C-FINISH — true obsidian gradient on native (and web). Sits BEHIND
          the per-board identity glow on the container border, IN FRONT of nothing. The
          container's overflow:'hidden' + borderRadius clip the gradient cleanly. */}
      <LinearGradient
        colors={[OBSIDIAN.bgTop, OBSIDIAN.bgBottom]}
        // 165° in CSS = mostly top→bottom with a slight right→down skew. Approximate
        // with start at top-center-left and end at bottom-center-right.
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <Pressable onPress={onPress} style={styles.pressableInner}>
        {/* Header */}
        <View style={styles.header} onLayout={onHeaderLayout}>
          <View style={styles.headerLeft}>
            {/* VAMOS-VISUAL-C — minimal chip tab: thin identity-color border + identity-color text on dark, not a filled gold pill */}
            <Text style={[styles.boardLabel, { color: boardAccent, borderColor: boardAccent }]}>{t().boardLabel(index + 1)}</Text>
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
          {/* Build 465 — AUTO-PLACE in header as flex sibling of headerLeft.
              Header justifyContent='space-between' puts it at opposite physical
              end from BOARD-N pill on web + native, RTL or LTR. */}
          {isArrangement && playerCards.length === 0 && onAutoFill ? (
            <Pressable
              style={styles.autoBtn}
              onPress={onAutoFill}
              hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
            >
              {/* VAMOS-VISUAL-C — mint bolt prefix for the quiet Auto-Place chip */}
              {/* VAMOS-FULL-POLISH B1 — i18n autoPlace already prefixes "⚡ ", so strip it
                  at the call site to keep ONE styled mint bolt (not ⚡⚡). Translators keep
                  the bolt in their string for non-CAPS surfaces; CAPS Board styles it. */}
              <Text style={styles.autoBtnBolt}>{'⚡'}</Text>
              <Text style={styles.autoBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{t().autoPlace.replace(/^\s*⚡\s*/, '')}</Text>
            </Pressable>
          ) : (
            <View style={styles.potArea}>
              {winner && <FloatingChips amount={potAmount} winner={winner} />}
            </View>
          )}
        </View>

        {/* Bot card rows Â hidden during arrangement (board stays clean for player placement) */}
        {/* Build 465 — AUTO-PLACE was hoisted out of absolute positioning into
            the header above (flex sibling of headerLeft). This block removed. */}

        {/* PR-L Task B — center the content rows (bot rows, community label,
            community cards, player slots) vertically within the space below
            the header. Was relying on pressableInner's justifyContent:center
            with the header inline; that centered the entire stack including
            the header, leaving cards visually low with a maroon block above. */}
        {/* BOARD-DENSITY 2026-06-09 — removed `contentSafetyPad && paddingVertical: rs(6)`.
            That rs(6)×2 = 12dp inner padding double-counted the cellHâ’rs(12) outer-chrome
            safety already deducted in BoardArrangement.tsx:188, so contentCenter's
            justifyContent:'space-evenly' surfaced it as empty bands above/between/below the
            card rows on bc=3/4. Card-sizing math (innerH = cellHeight - HEADER_H - 2*PAD_V)
            now matches the real available height. */}
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

        {/* PR-M 2026-05-29 — Community label pill REMOVED. The 5-card row IS
            the community; the pill was redundant chrome eating rs(20+) of
            vertical budget per board. */}
        <View style={styles.cardRow} testID={`community-row-${index}`}>
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
          {/* VAMOS-REDESIGN-CORE 2026-06-17 — during arrangement the 2 face-down
              turn/river cards collapse to a single compact deck-stub pictogram
              (placeholder for "2 cards coming"). On reveal, this branch is no
              longer taken and the full closedCards render face-down → flip to
              face-up via the existing CardComponent flip animation. The reveal
              path is unchanged. */}
          {isArrangement && !revealed ? (
            <View style={[styles.deckStub, { height: commH, width: STUB_W, marginHorizontal: sepMarginHOuter }]} accessibilityLabel="Turn and River — revealed after Ready">
              <View style={[styles.deckStubBack, styles.deckStubBackRear]} />
              <View style={[styles.deckStubBack, styles.deckStubBackFront]} />
            </View>
          ) : (
            <>
              {/* VAMOS-VISUAL-C — separator now MINT (cohesive inner detail) */}
              <View style={[styles.communitySeparator, { backgroundColor: OBSIDIAN.mint }]} />
              {(closedCards ?? []).map((c) => (
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
                </View>
              ))}
            </>
          )}
        </View>

        {/* PR-E AUTO button hoisted above the contentCenter wrapper (PR-L Task B) */}

        {/* VAMOS-REDESIGN-CORE 2026-06-17 — during arrangement, the slot row is
            a compact DEAL-LANE band (fixed LANE_H ≈ 28pt). Empty positions
            render as subtle tick marks instead of 4 full-size empty boxes.
            Placed cards render at LANE_H height (small) — flop stays the hero.
            Tap-target is the whole board (Pressable at L474), so tap usability
            is unaffected. After reveal (isArrangement=false), the band collapses
            back to the legacy slot-row rendering for visual continuity. */}
        <View style={[styles.cardRow, isArrangement && styles.dealLane]} testID={`slot-row-${index}`}>
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
          ) : isArrangement ? (
            // Deal-lane: 4 tick-mark dots evenly spaced, no card boxes.
            Array.from({ length: 4 }).map((_, i) => (
              <View key={`tick-${i}`} style={styles.dealLaneTick} />
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} onPress={onPress} slotWidth={slotW} slotHeight={slotH} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <View key={`tick-fill-${i}`} style={styles.dealLaneTick} />
            ))
          }
          {/* PR-N 2026-06-02 — hand-strength hint suppressed during arrangement.
              It was rendering OUTSIDE the board bounds on narrow 3p cells and
              ate vertical budget for the placement row. Hint still appears on
              the reveal/results screens where there is room for it. */}
          {false && isArrangement && playerCards.length >= 2 && (() => {
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
    // VAMOS-VISUAL-C — obsidian surface, sharper radius (14 vs 18), 1px identity edge.
    // Outer drop shadow + identity glow applied inline at usage site so they can swap
    // shadowColor per board without a per-instance StyleSheet.
    flex: 1,
    backgroundColor: OBSIDIAN.bgFallback,
    borderRadius: OBSIDIAN_GEOM.boardRadius,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
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
  // VAMOS-CENTER-FIX 2026-06-15 — the rows were left-pushed in RTL because the HTML
  // root has dir='rtl' (utils/i18n.ts applyHtmlLocale), which inverts flexbox start
  // anchors in React Native Web. Force direction:'ltr' on contentCenter so the cards
  // are centered by Latin-orientation flex math regardless of app language.
  // alignItems:'center' centers each cardRow horizontally (sized to its intrinsic
  // children width). gap separates rows vertically.
  contentCenter: {
    flex: 1,
    // VAMOS-CARDS-BIG 2026-06-16 — top-align card rows so the community row sits
    // strictly below the (measured-and-padded) header strip. Was 'center', which
    // vertically centered the rows in the tall innerH at bc=2 and let big cards
    // ride up into the BOARD label / Auto-Place pill band. With flex-start the
    // first row anchors at contentCenter.top = header.bottom + header.marginBottom
    // (rs(3)) — overlap is now geometrically impossible.
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: rs(4),
    minHeight: 0,
    width: '100%',
    ...(Platform.OS === 'web' ? ({ direction: 'ltr' } as any) : null),
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
    // VAMOS-PLACEMENT-AUDIT 2026-06-16 — restored a small marginBottom (was 0
    // since BOARD-DENSITY 2026-06-09). At bc=2 the tall community cards visually
    // rode right up under the Auto-Place pill; the rs(3) gap is consumed by the
    // measured-HEADER_H sizing math too (header now reports its rendered height
    // including this margin), so it costs nothing in card size while guaranteeing
    // a visible separation strip between header chrome and play surface.
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(3),
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
    // VAMOS-VISUAL-C — minimal chip: thin identity-color border + identity-color text on dark
    // (color + borderColor are overridden inline to the per-board accent).
    color: '#ffffff',
    fontSize: rf(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: rs(7),
    paddingVertical: rs(1),
    borderRadius: OBSIDIAN_GEOM.tabRadius,
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
    // VAMOS-PLACEMENT-AUDIT 2026-06-16 — added `width: '100%'` so the row fills
    // the cell horizontally. Previously the row was CONTENT-sized; under a parent
    // with alignItems:'center' it appeared centered but its own bounding box was
    // narrow → the COMMUNITY row (5 cards + sep, wide) centered fine but the
    // SLOT row (4 small cards, narrow) hugged the middle visually, reading as
    // a left/right void on bc=3/4. With width:100% + justifyContent:'center'
    // the centering is deterministic and rows visually align across the cell.
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    gap: PRD.card.gap,
    paddingVertical: 0,
    paddingHorizontal: rs(6),
  },
  // VAMOS-REDESIGN-CORE 2026-06-17 — compact deck-stub pictogram for turn/river
  // during arrangement (replaces 2 full-size face-down cards + separator). Two
  // offset mint-tinted shapes inside hint at "cards within."
  deckStub: {
    borderRadius: rs(4),
    borderWidth: 1.5,
    borderColor: OBSIDIAN.mint,
    backgroundColor: OBSIDIAN.backBottom,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckStubBack: {
    position: 'absolute',
    width: '60%',
    height: '70%',
    backgroundColor: OBSIDIAN.mint,
    borderRadius: 2,
  },
  deckStubBackRear: {
    opacity: 0.22,
    transform: [{ rotate: '-7deg' }],
    top: '15%',
    left: '12%',
  },
  deckStubBackFront: {
    opacity: 0.4,
    transform: [{ rotate: '6deg' }],
    top: '15%',
    left: '28%',
  },
  // VAMOS-REDESIGN-CORE 2026-06-17 — deal-lane row treatment + tick marks
  // (replaces 4 full-size empty card slots). Subtle mint hairline above hints
  // at the table-edge feel; tick marks are quiet drop-position indicators.
  dealLane: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(79, 214, 168, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    paddingVertical: rs(4),
    gap: rs(20),
  },
  dealLaneTick: {
    width: rs(8),
    height: rs(2),
    borderRadius: 1,
    backgroundColor: 'rgba(79, 214, 168, 0.5)',
  },
  communitySeparator: {
    // VAMOS-BOARD-FILL 2026-06-15 — strengthened: 1.5 → 2 width, 0.68 → 0.80 opacity,
    // backgroundColor mintHairline → mint (no glow). Reads as a deliberate divider.
    width: 2,
    height: '60%',
    backgroundColor: OBSIDIAN.mint,
    opacity: 0.80,
    marginHorizontal: rs(5),
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
    // VAMOS-VISUAL-C — ghost target: mint dashed on near-transparent fill
    borderRadius: OBSIDIAN_GEOM.slotRadius,
    borderWidth: 1,
    borderColor: OBSIDIAN.slotDash,
    borderStyle: 'dashed',
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: OBSIDIAN.slotFill,
  },
  dropTarget: {
    // VAMOS-VISUAL-C — when a hand card is selected, slot brightens to solid mint
    borderColor: OBSIDIAN.slotDashActive,
    borderWidth: rs(1.5),
    borderStyle: 'solid',
    backgroundColor: OBSIDIAN.mintGhost,
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
    // VAMOS-VISUAL-C-FINISH — bottom corner radius matches OBSIDIAN_GEOM.boardRadius
    // (14) minus the 1px container border. Top edge gets a thin mint hairline so the
    // badge reads as part of the obsidian board, not a foreign gold bar.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: rs(5),
    borderBottomLeftRadius: OBSIDIAN_GEOM.boardRadius - 1,
    borderBottomRightRadius: OBSIDIAN_GEOM.boardRadius - 1,
    borderTopWidth: 1,
    borderTopColor: OBSIDIAN.mintHairline,
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
    // VAMOS-VISUAL-C-FINISH — was COLORS.goldDim (clashed). Mint at 92% reads neutral.
    backgroundColor: 'rgba(79,214,168,0.92)',
  },
  winnerText: {
    // VAMOS-VISUAL-C-FINISH — dark ink on green/red/mint stays high-contrast and
    // matches the obsidian palette (no gold text).
    color: OBSIDIAN.cardInk,
    fontSize: rf(11),
    fontWeight: '900',
    letterSpacing: 2,
  },
  bannerHandName: {
    color: OBSIDIAN.cardInk,
    fontSize: rf(8),
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  autoBtn: {
    // VAMOS-VISUAL-C — quiet chip with mint bolt. Layout/minHeight/hitSlop unchanged
    // so tap target stays >= 44pt HIG via the Pressable's hitSlop on the call site.
    maxWidth: rs(105),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: rs(3),
    paddingHorizontal: rs(6),
    paddingVertical: rs(1),
    minHeight: rs(14),
    justifyContent: 'center' as const,
    borderRadius: OBSIDIAN_GEOM.tabRadius,
    backgroundColor: OBSIDIAN.autoBg,
    borderWidth: 1,
    borderColor: OBSIDIAN.autoBorder,
    opacity: 1,
    zIndex: 10,
  },
  autoBtnText: {
    color: OBSIDIAN.autoText,
    fontSize: rf(7),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  autoBtnBolt: {
    color: OBSIDIAN.autoBolt,
    fontSize: rf(8),
    fontWeight: '900',
    lineHeight: rf(10),
  },
});
