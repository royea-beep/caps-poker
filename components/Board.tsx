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
import { rf as rfBase, rs as rsBase, SCREEN_W as MODULE_SCREEN_W, SCREEN_H as MODULE_SCREEN_H } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { OBSIDIAN, OBSIDIAN_GEOM, boardIdentityGlow } from '../constants/obsidianTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { t, getLanguage } from '../utils/i18n';
import { trackAction } from '../utils/crash-evidence';
import { useGameColors } from '../utils/useGameColors';
import { getHandHint } from '../utils/handHint';
import { getTheme, ThemeTokens } from '../constants/visualThemes';
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
  /**
   * CD2 — is a card currently selected in hand? `isArrangement` is true for the WHOLE
   * placement phase, so keying the active slot state off it meant the "invitation" was
   * permanently on - and a signal that is always on carries no information. This one
   * changes as the player picks cards up and puts them down, which is the question they
   * actually have: "where can this go?"
   */
  hasSelection?: boolean;
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
  // VAMOS-UNIFY-CARD-SIZE 2026-06-17 — when present, this CARD_W is the hard
  // authority for commW (5 community cards) AND slotW (4 placed cards). Identical
  // to the hand's cardW. Cards-big aspect derives commH/slotH from cardW/0.72.
  universalCardW?: number;
  // GAME-SCREEN-FIT 2026-07-07 — real viewport, threaded from BoardArrangement's
  // single top-of-tree useWindowDimensions() (game.tsx). Deliberately NOT read via
  // Board's own useWindowDimensions() call — a 2026-05-22 fix (see below) already
  // found that recomputing dimensions on every Board render caused BOARD_HEIGHT +
  // card sizes to drift on focus/keyboard/resize events; a single stable source
  // threaded down as a prop avoids re-introducing that. Optional so legacy callers
  // (results, BoardReveal) that omit cellWidth/cellHeight keep the frozen default.
  screenW?: number;
  screenH?: number;
}

// S76-BOARD-ROUTING — `theme` is prop-threaded in because this sibling is rendered by
// Board but sits OUTSIDE its render scope, so it cannot see Board's getTheme() result.
// In-file, private component, no external contract → same risk class as the rest of this
// batch. (BoardArrangement stays deferred: cross-file = a public API change.)
function EmptySlotAnimated({ isArrangement, hasSelection, onPress, slotWidth, slotHeight, theme }: { isArrangement?: boolean; hasSelection?: boolean; onPress?: () => void; slotWidth: number; slotHeight: number; theme: ThemeTokens }) {
  // CG1 — TEMPORARY INSTRUMENT, NOT A CHANGE. Revert immediately after measuring.
  //
  // The slot read exactly 0.600 on 23/23 samples with KILL_Board disabled, and 0.6 is
  // ambiguous BY CONSTRUCTION: it is both this initial AND the value the effect's `else`
  // branch writes. So "the effect never ran" and "the effect ran and took the else branch"
  // are indistinguishable. 0.137 cannot occur naturally - it is not 0.6 (initial/else), not
  // 1 or 0.72 (the pulse endpoints), not 0.4 (the pre-CC floor), and appears nowhere in the
  // emptySlot styles. Whatever the slot reads now names which of the three cases is true.
  const pulseOpacity = useSharedValue(0.137);

  useEffect(() => {
    if (isArrangement) {
      // ⚠️ DEAD PATH. `KILL_Board` is a hardcoded `true` in utils/animationKill.ts ("all
      // repeating animations disabled - crash isolation"), so `if (!KILL_Board)` is `if
      // (false)` and NOTHING below ever runs. `pulseOpacity` keeps its useSharedValue(0.6)
      // initial value for the slot's entire life - which is exactly the constant 0.6 measured
      // on live.
      //
      // CC2 changed the floor here from 0.4 to 0.72 believing it was live. It was not, and the
      // greyscale figures reported that sprint were computed against a pulse floor that never
      // executes. The real numbers use the constant 0.6: resting outline 2.64x the table,
      // active 6.57x. FOURTH incident in this class - Board.handName, the landscape branch,
      // the dead header twin, and now this - and all four were gated by a hardcoded constant.
      //
      // Do NOT tune these numbers. Either flip KILL_Board (and find out why it was set) or
      // change the useSharedValue(0.6) initial, which is the value that actually renders.
      if (!KILL_Board) {
        // FINITE per iron rule
        pulseOpacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1000 }),
            withTiming(0.72, { duration: 1000 }),
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
      {/* S76-BOARD-ROUTING — colour overrides only; every geometry value (borderWidth,
          borderStyle, radius, margin, width/height) stays in the StyleSheet untouched. */}
      {/* CD2 — the ACTIVE state now keys on hasSelection, not isArrangement. It used to say
          "you are placing cards", which is true for the entire phase and therefore says
          nothing; it now says "this slot can take the card in your hand", which changes as
          the player picks up and puts down. The resting outline still says "a card belongs
          here" on its own. */}
      <Animated.View style={[styles.emptySlot, { borderColor: theme.boardSlotDash, backgroundColor: theme.boardSlotFill }, { width: slotWidth, height: slotHeight }, hasSelection && styles.dropTarget, hasSelection && { borderColor: theme.boardSlotDashActive, backgroundColor: theme.boardMintGhost }, animStyle]}>
        {false && <Text style={styles.plusText}>tap</Text>}
      </Animated.View>
    </Pressable>
  );
}

// S76-BOARD-ROUTING — `theme` prop-threaded for the same reason as EmptySlotAnimated:
// in-file sibling, outside Board's render scope.
function FloatingChips({ amount, winner, theme }: { amount: number; winner: 'player' | 'bot' | 'tie'; theme: ThemeTokens }) {
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
  // S76-BOARD-ROUTING — boardNeonRed / boardTextSecondary, NOT theme.loseColor or
  // theme.textSecondary. TRAPS: theme.textSecondary is MINT (#4FD6A8) on BOTH themes
  // while COLORS.textSecondary is grey (#9aa19b); and win/lose belongs to the
  // ACCESSIBILITY axis (useGameColors), never the theme axis.
  // '#FFD700' is now boardChipFloat (S76-BOARD-LITERALS): a NEW key, because #FFD700
  // is NOT boardGold's #c9a84c — routing it there would have changed classic.
  const color = winner === 'player' ? theme.boardChipFloat : winner === 'bot' ? theme.boardNeonRed : theme.boardTextSecondary;

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
  hasSelection,
  selected,
  flipDuration,
  cardHeight: cardHeightProp,
  isWinner,
  communityScale = 1.2,
  cellWidth,
  cellHeight,
  contentSafetyPad,
  boardCount,
  universalCardW,
  screenW: screenWProp,
  screenH: screenHProp,
}: BoardProps) {
  // C-fix 2026-05-22: lock dimensions to module-level constants (computed once at app
  // load in utils/responsive.ts). Was useWindowDimensions() — recomputed every render,
  // causing BOARD_HEIGHT + card sizes to drift on any focus/keyboard/resize event.
  // GAME-SCREEN-FIT 2026-07-07 — that fix traded a real per-render-drift bug for a
  // real narrow-viewport-on-web bug (this frozen fallback is always 393x852 on web;
  // telemetry confirms every narrow/short report is platform:web). Fix both: prefer
  // screenW/screenH threaded down as props from BoardArrangement's single stable
  // useWindowDimensions() call (game.tsx) — reactive to the true device, but with
  // only ONE subscription for the whole tree, not one per Board. Falls back to the
  // frozen module constant for legacy callers (results, BoardReveal) that don't pass
  // cellWidth/cellHeight and so don't pass these either.
  const screenW = screenWProp ?? MODULE_SCREEN_W;
  const screenH = screenHProp ?? MODULE_SCREEN_H;
  // Shadow the module-level rs/rf so every existing call below resolves against the
  // real screenW above instead of the frozen 393-baseline default.
  const rs = (v: number) => rsBase(v, screenW);
  const rf = (v: number, min?: number, max?: number) => rfBase(v, min, max, screenW);
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
  let commW: number;
  let commH: number;
  let cw: number;
  let ch: number;
  let slotH: number;
  let slotW: number;
  if (cellWidth && cellHeight) {
    // BOARD-DENSITY 2026-06-09 — shrink HEADER_H rs(20)->rs(16). The actual rendered
    // header strip height is now driven by measuredHeaderH (onHeaderLayout) below, not
    // a static estimate — NATIVE-LAYOUT-FIX 2026-07-08 bumped autoBtn's own minHeight
    // 14->18 for touch-target compliance (see autoBtn style), so the real measured
    // value is correspondingly a bit taller than the historical ~14dp this comment
    // used to describe. HIG 44pt tap target maintained via hitSlop on autoBtn.
    // VAMOS-CARDS-FIX 2026-06-16 — HEADER_H is MEASURED via onHeaderLayout when
    // available. Old rs(16) constant under-counted real rendered header on device
    // (BOARD pill + Auto-Place + Hebrew ascent + iOS shadow); cards overlapped at
    // bc=2. Fallback rs(22) (was rs(16)) until first onLayout fires.
    const HEADER_H = measuredHeaderH > 0 ? measuredHeaderH + rs(2) : rs(22);
    // GAME-SCREEN-FIT 2026-07-07 — these were PRD.board.* reads (frozen at module
    // load, same 393-baseline-on-web issue as elsewhere in this pass). PRD's own
    // values ARE just rs(2)/rs(4)/rs(2)/rs(3) per utils/prdTokens.ts — inlined here
    // as direct reactive rs() calls (via the local shadow above) instead.
    const PAD_V = rs(2); // was PRD.board.cellPadV
    const PAD_H = rs(4); // was PRD.board.cellPadH
    // PR-O 2026-06-07 Fix 2 — innerW must also subtract:
    //   * container.borderWidth (PRD.board.border) on each side
    //   * BoardArrangement cell wrapper paddingHorizontal (rs(2) each side)
    //   * Roye's breathing room (rs(6) each side) so cards never touch border
    const BORDER_W = rs(2); // was PRD.board.border
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
    // VAMOS-LEVER1-BC4 2026-06-16 — at bc=4 ONLY, split innerH 62/38 in favor of
    // the community row so flop/turn/river cards grow toward the width-cap. Slot
    // row gets the remainder (placed cards render smaller). STATIC — does NOT
    // resize when slots fill, to avoid jarring mid-placement layout shift. Tap
    // target is the whole board (Pressable at L474), so smaller slots do NOT
    // reduce tap usability. bc=2/3 keep the existing symmetric 50/50 split.
    const _rowsBudget = innerH - rowGap;
    const _commBudgetH = boardCount === 4
      ? Math.max(20, Math.floor(_rowsBudget * 0.62))
      : Math.max(20, Math.floor(_rowsBudget / 2));
    const _slotBudgetH = boardCount === 4
      ? Math.max(20, _rowsBudget - _commBudgetH)
      : _commBudgetH;
    // Community row: 5 cards + 4 gaps + separator + 2*sepMargin
    const sepW = rs(3); // was PRD.board.flopSeparatorW
    const sepMarginH = isLowBoard ? rs(2) : rs(2);
    const commGap = rs(3); // was: isLowBoard ? rs(3) : PRD.card.gap — both sides were already rs(3)
    const commWByWidth = Math.max(14, Math.floor((innerW - 4 * commGap - sepW - 2 * sepMarginH) / 5));
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
    // VAMOS-UNIFY-CARD-SIZE 2026-06-17 — when game.tsx supplies a universal
    // CARD_W (driven by the hand's 6-per-row constraint), use it as the hard
    // authority for BOTH community and slot cards. Aspect ratio applied
    // identically (CARD_H = CARD_W/0.72), preserving Cards-big look. Falls back
    // to the fitToBox math when not provided (legacy callers).
    // VAMOS-PLACED-CARD-CLIP-FIX 2026-06-21 — was: commH = slotH = round(W /
    // CARD_ASPECT), derived from width ONLY. On tight cells (bc=3 / bc=4 after
    // CARDS-NOSCROLL-V2's hand-zone trim) HEADER_H + 2*_uH + rowGap + 2*PAD_V
    // exceeded cellHeight, so the bottom row (the placed cards) overflowed a
    // cell with overflow:'hidden' and CLIPPED at the bottom on device.
    // Now: budget-aware clamp (Task A2). Honor the existing _commBudgetH /
    // _slotBudgetH (which encodes bc=4's Lever-1 62/38 community-bias) so the
    // placed row never exceeds its allotted vertical share. cardW is then
    // re-derived from the clamped height + CARD_ASPECT so the card stays
    // portrait — never wider than universalCardW (which would distort).
    if (universalCardW && universalCardW > 14) {
      const _uH = Math.round(universalCardW / CARD_ASPECT);
      const _commHClamped = Math.min(_uH, _commBudgetH);
      const _slotHClamped = Math.min(_uH, _slotBudgetH);
      commH = _commHClamped;
      slotH = _slotHClamped;
      // Keep within universalCardW so the row-width budget is respected too.
      commW = Math.min(universalCardW, Math.max(14, Math.floor(commH * ASPECT_MAX)));
      slotW = Math.min(universalCardW, Math.max(14, Math.floor(slotH * ASPECT_MAX)));
    }
    ch = slotH;
    cw = slotW;
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
        // S76-LITERALS/PANEL — fallback under the gradient. borderColor stays
        // boardAccent: per-board IDENTITY (PRD.board.accent), not a theme colour.
        { backgroundColor: theme.boardPanelFallback, borderColor: boardAccent },
        boardIdentityGlow(boardAccent),
        Platform.OS === 'web' && {
          background: `linear-gradient(165deg, ${theme.boardPanelTop} 0%, ${theme.boardPanelBottom} 100%)`,
          boxShadow: `0 0 18px ${boardAccent}66, 0 14px 32px rgba(0,0,0,0.62)`,
        } as any,
        // S76-BOARD-ROUTING — colour-only overrides. shadowColor is guarded to iOS to
        // mirror the StyleSheet's Platform.select exactly: Android uses `elevation` and
        // has NO shadowColor today, and RN DOES honour shadowColor on Android elevation
        // shadows, so an unguarded override would tint them = a real visual change.
        active && [styles.active, { borderColor: theme.boardGold }, Platform.OS === 'ios' && { shadowColor: theme.boardGold }],
        selected && [styles.selected, { borderColor: theme.boardGold }, Platform.OS === 'ios' && { shadowColor: theme.boardGold }],
        winner === 'player' && [styles.playerWon, { borderColor: theme.boardNeonGreen }],
        winner === 'bot' && [styles.botWon, { borderColor: theme.boardNeonRed }],
        active && pulseStyle,
        completePulseStyle,
        isWinner && winnerPulseStyle,
      ]}
    >
      {/* VAMOS-VISUAL-C-FINISH — true obsidian gradient on native (and web). Sits BEHIND
          the per-board identity glow on the container border, IN FRONT of nothing. The
          container's overflow:'hidden' + borderRadius clip the gradient cleanly. */}
      <LinearGradient
        // S76-LITERALS/PANEL — COLOURS ONLY. start/end/absoluteFillObject/
        // pointerEvents are untouched: this stays an absolute-fill backdrop that
        // cannot move or resize a single child. 2-stop shape preserved.
        colors={[theme.boardPanelTop, theme.boardPanelBottom]}
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
            <Text style={[styles.boardLabel, { color: boardAccent, borderColor: boardAccent }]} allowFontScaling={false}>{t().boardLabel(index + 1)}</Text>
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
                style={[styles.handName, styles.handNameShrink, winner === 'player' && styles.winnerHandName, { color: winner === 'player' ? theme.boardGoldLight : theme.boardTextMuted }]}
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
              style={[styles.autoBtn, { backgroundColor: theme.boardAutoBg, borderColor: theme.boardAutoBorder }]}
              onPress={onAutoFill}
              // NATIVE-LAYOUT-FIX 2026-07-08 — widened from {10,10} so the tap target
              // clears 44pt even at autoBtn's minWidth:20 floor (20+15+15=50), without
              // growing the chip's own measured height/width (see autoBtn style comment).
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              {/* VAMOS-VISUAL-C — mint bolt prefix for the quiet Auto-Place chip */}
              {/* VAMOS-FULL-POLISH B1 — i18n autoPlace already prefixes "⚡ ", so strip it
                  at the call site to keep ONE styled mint bolt (not ⚡⚡). Translators keep
                  the bolt in their string for non-CAPS surfaces; CAPS Board styles it. */}
              <Text style={[styles.autoBtnBolt, { color: theme.boardAutoBolt }]} allowFontScaling={false}>{'⚡'}</Text>
              {/* NATIVE-LAYOUT-FIX 2026-07-08 — minimumFontScale bumped 0.5->0.82: at the
                  new 11pt base, 0.5 could still shrink to 5.5pt for long translated
                  strings, defeating the floor. 0.82 keeps the effective floor ~9pt while
                  still allowing some shrink so long text doesn't clip the 105pt chip. */}
              <Text style={[styles.autoBtnText, { color: theme.boardAutoText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} allowFontScaling={false}>{t().autoPlace.replace(/^\s*⚡\s*/, '')}</Text>
            </Pressable>
          ) : (
            <View style={styles.potArea}>
              {winner && <FloatingChips amount={potAmount} winner={winner} theme={theme} />}
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
              {/* BW1 — stable anchor. This label reads "Bot 1", which also exists in
                  BoardResultCard, and is NOT the same control as BoardReveal's "🤖 Bot 1".
                  Text-matching between them caused two wrong findings. */}
              <Text testID="seat-label" style={[styles.rowLabel, { color: theme.boardTextDim }]}>{`${t().bot} ${botIdx + 1}`}</Text>
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
                    owner="bot"
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
              {/* BW1 — MP-ONLY. The branch below is gated on `revealed`, hardcoded false in
                  solo, so it never renders here. This anchor is what lets the two-device MP
                  pass measure it in a minute and close the deferred item. */}
              {revealed && (allBotHandNames?.[botIdx] || (botIdx === 0 && botHandName)) && (
                <Text
                  testID="board-hand-name"
                  style={[styles.handName, styles.handNameShrink, winner === 'bot' && styles.winnerHandName, { color: winner === 'bot' ? theme.boardGoldLight : theme.boardTextMuted }, { marginLeft: 4 }]}
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
          {/* VAMOS-VISUAL-C — separator now MINT (cohesive inner detail), no longer per-board identity */}
          <View style={[styles.communitySeparator, { backgroundColor: theme.accent }]} />
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

        {/* Player cards */}
        <View style={styles.cardRow} testID={`slot-row-${index}`}>
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
                  owner="player"
                  zone="board"
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
              <EmptySlotAnimated key={`player-empty-${i}`} isArrangement={isArrangement} hasSelection={hasSelection} onPress={onPress} slotWidth={slotW} slotHeight={slotH} theme={theme} />
            ))
          )}
          {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
            Array.from({ length: 4 - playerCards.length }).map((_, i) => (
              <EmptySlotAnimated key={`player-empty-fill-${i}`} isArrangement={isArrangement} hasSelection={hasSelection} onPress={onPress} slotWidth={slotW} slotHeight={slotH} theme={theme} />
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
                <Text style={[styles.hintText, { color: theme.boardTextMuted }]}>{hint}</Text>
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
                    <Text style={[styles.hintInfoIcon, { color: theme.boardHintIcon }]}>ⓘ</Text>
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

        {/* S76-BOARD-ROUTING — borderTopColor routed. backgroundColor DELIBERATELY untouched:
            it is useGameColors() = the ACCESSIBILITY axis (colorblind blue/orange). Routing
            it to theme would break colorblind mode (R1). tieBadge's mint = LITERALS batch. */}
        {winner && (
          <Animated.View style={[styles.winnerBadge, { borderTopColor: theme.boardMintHairline }, winner === 'player' ? { backgroundColor: gameColors.win } : winner === 'bot' ? { backgroundColor: gameColors.lose } : [styles.tieBadge, { backgroundColor: theme.boardTieBg }], bannerAnimStyle]}>
            <Text style={[styles.winnerText, { color: theme.boardCardInk }]}>
              {winner === 'player' ? 'WIN' : winner === 'bot' ? 'LOSE' : 'TIE'}
            </Text>
            {winner === 'player' && playerHandName ? (
              <Text style={[styles.bannerHandName, { color: theme.boardCardInk }]}>{playerHandName}</Text>
            ) : winner === 'bot' && botHandName ? (
              <Text style={[styles.bannerHandName, { color: theme.boardCardInk }]}>{botHandName}</Text>
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
    // PR-D study: board padding rsBase(6/5).
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
    // (rsBase(3)) — overlap is now geometrically impossible.
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: rsBase(4),
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
    // rode right up under the Auto-Place pill; the rsBase(3) gap is consumed by the
    // measured-HEADER_H sizing math too (header now reports its rendered height
    // including this margin), so it costs nothing in card size while guaranteeing
    // a visible separation strip between header chrome and play surface.
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rsBase(3),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rsBase(4),
    flex: 1,
  },
  boardFullBadge: {
    width: rsBase(16),
    height: rsBase(16),
    borderRadius: rsBase(8),
    backgroundColor: '#28A745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardFullText: {
    color: '#fff',
    fontSize: rfBase(9),
    fontWeight: '900',
  },
  boardLabel: {
    // VAMOS-VISUAL-C — minimal chip: thin identity-color border + identity-color text on dark
    // (color + borderColor are overridden inline to the per-board accent).
    // NATIVE-LAYOUT-FIX 2026-07-08 — rfBase(10) with no explicit min/max clamps to
    // [7.5, 12.5]; on a narrow device this could render well under the 11pt readability
    // floor. Explicit min=11 enforces the floor regardless of screenW.
    color: '#ffffff',
    fontSize: rfBase(10, 11),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: rsBase(7),
    paddingVertical: rsBase(1),
    borderRadius: OBSIDIAN_GEOM.tabRadius,
    overflow: 'hidden',
  },
  rowLabel: {
    color: COLORS.textDim,
    // BT2 — was rfBase(7). This is the "Bot 1 / Bot 2 / Bot 3" seat label and it rendered at
    // literally 7px, the smallest text in the app: in a competitive card game, WHO you are
    // playing was effectively invisible. Raised to the 13px identity floor from the type scale.
    //
    // The width had to move with it and that is not incidental: at rsBase(20) the box was 20dp
    // wide — about five characters at 7px — so raising the font alone would have clipped or
    // wrapped "Bot 1" and I would have reported a size that never rendered. This is the
    // container-constraint case: the fix is the box AND the size, not the size alone.
    fontSize: rfBase(13),
    fontWeight: '700',
    letterSpacing: 0.5,
    width: rsBase(34),
    textAlign: 'center',
  },
  potArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rsBase(4),
  },
  potRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rsBase(4),
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: rfBase(10),
    fontWeight: '700',
  },
  potDot: {
    width: rsBase(8),
    height: rsBase(8),
    borderRadius: rsBase(4),
    backgroundColor: COLORS.gold,
  },
  floatingChips: {
    fontSize: rfBase(11),
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
    paddingHorizontal: rsBase(6),
  },
  communitySeparator: {
    // VAMOS-BOARD-FILL 2026-06-15 — strengthened: 1.5 → 2 width, 0.68 → 0.80 opacity,
    // backgroundColor mintHairline → mint (no glow). Reads as a deliberate divider.
    width: 2,
    height: '60%',
    backgroundColor: OBSIDIAN.mint,
    opacity: 0.80,
    marginHorizontal: rsBase(5),
    alignSelf: 'center',
    borderRadius: 1,
  },
  communityLabelWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    paddingHorizontal: rsBase(8),
    paddingVertical: rsBase(2),
    borderRadius: rsBase(6),
    borderWidth: 0.5,
    borderColor: '#c9a84c',
    marginBottom: rsBase(3),
    marginLeft: rsBase(2),
  },
  communityLabelText: {
    fontSize: rfBase(8),
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
    borderWidth: rsBase(1.5),
    borderStyle: 'solid',
    backgroundColor: OBSIDIAN.mintGhost,
  },
  plusText: {
    color: '#c8a84b55',
    fontSize: rfBase(10),
    fontWeight: '700',
  },
  communityCardWrap: {
    alignItems: 'center',
  },
  faceDownWrap: {
    // PR-D study: face-down community cards = opacity 0.5 + dark bg
    opacity: 0.5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: rsBase(4),
  },
  cardLabel: {
    fontSize: rfBase(9),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: rsBase(2),
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  botTooltip: {
    position: 'absolute',
    top: -rsBase(22),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: rsBase(6),
    paddingHorizontal: rsBase(6),
    paddingVertical: rsBase(3),
    alignItems: 'center',
  },
  botTooltipText: {
    color: '#fff',
    fontSize: rfBase(9),
    fontWeight: '600',
  },
  handName: {
    color: COLORS.textMuted,
    // BT2 — was rfBase(8). The hand name ("Two Pair", "Flush") is the single most important
    // string on a poker board and it sat one step above the minimum. Raised to the 16px
    // primary-information level.
    //
    // ⚠️ MULTIPLAYER ONLY, AND UNVERIFIED. Corrected 2026-08-07: the render site is gated on
    // `revealed &&`, and `revealed` is hardcoded `false` at game.tsx:1245 and
    // BoardArrangement.tsx:260 — only multiplayer-game.tsx:1240 passes it dynamically. So this
    // style NEVER RENDERS IN SOLO PLAY. The 13px/10px reveal names I originally cited as proof
    // that this had shrunk were `HandBadge` (rf(13)/rf(10)), a different component entirely.
    // It does carry `adjustsFontSizeToFit` + `minimumFontScale={0.65}`, so in MP it renders at
    // most 16 and shrinks toward 10.4 in a tight row — but that has not been measured.
    fontSize: rfBase(16),
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
    marginLeft: rsBase(4),
    flexWrap: 'wrap',
    gap: rsBase(2),
    minHeight: rsBase(44),
    paddingVertical: rsBase(4),
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: rfBase(12),
    fontWeight: '600',
  },
  hintInfoBtn: {
    paddingHorizontal: rsBase(2),
  },
  hintInfoIcon: {
    color: 'rgba(201,168,76,0.7)',
    fontSize: rfBase(8),
    fontWeight: '700',
  },
  hintExplText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rfBase(7),
    fontWeight: '400',
    fontStyle: 'italic',
    marginLeft: rsBase(2),
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
    paddingVertical: rsBase(5),
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
    fontSize: rfBase(11),
    fontWeight: '900',
    letterSpacing: 2,
  },
  bannerHandName: {
    color: OBSIDIAN.cardInk,
    fontSize: rfBase(8),
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  autoBtn: {
    // VAMOS-VISUAL-C — quiet chip with mint bolt.
    // NATIVE-LAYOUT-FIX 2026-07-08 — the OLD minHeight (rsBase(14)) relied ENTIRELY on
    // the Pressable's vertical hitSlop (top/bottom 15) to reach the 44pt HIG floor
    // (14+15+15=44, exactly AT the boundary with zero margin), and had no minWidth at
    // all — for short/narrow translated labels the horizontal tap target (contentW +
    // hitSlop left/right 10+10) could fall under 44pt. Deliberately did NOT bump the
    // VISUAL minHeight/minWidth to 44 here: this chip sits inside the per-board header
    // row, and its rendered height feeds directly into onHeaderLayout's measuredHeaderH
    // -> HEADER_H -> innerH (see the cellWidth&&cellHeight branch above) — a 44pt-tall
    // visual chip would grow every board's header by ~25-30pt, eating exactly the
    // vertical room GAME-SCREEN-FIT/NATIVE-LAYOUT-FIX are trying to protect on
    // short/narrow screens. Kept the chip visually tiny; widened hitSlop instead so the
    // full 44x44 target is achieved via the (correctly HIG-sanctioned) invisible tap
    // area, not by growing the measured layout.
    minWidth: 20,
    maxWidth: rsBase(105),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: rsBase(3),
    paddingHorizontal: rsBase(6),
    paddingVertical: rsBase(1),
    minHeight: 18,
    justifyContent: 'center' as const,
    borderRadius: OBSIDIAN_GEOM.tabRadius,
    backgroundColor: OBSIDIAN.autoBg,
    borderWidth: 1,
    borderColor: OBSIDIAN.autoBorder,
    opacity: 1,
    zIndex: 10,
  },
  autoBtnText: {
    // NATIVE-LAYOUT-FIX 2026-07-08 — was rfBase(7), clamping to [5.25, 8.75] with NO
    // explicit min/max: well under the 11pt readability floor (this is the exact "7px
    // glyph" the task calls out). Hard 11pt floor, not scaled by rfBase, matching how
    // the 44pt touch target above is also a hard (non-scaled) floor.
    color: OBSIDIAN.autoText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  autoBtnBolt: {
    // NATIVE-LAYOUT-FIX 2026-07-08 — was rfBase(8); bumped to match autoBtnText's new
    // 11pt floor so the bolt glyph doesn't look tiny next to the now-larger label.
    color: OBSIDIAN.autoBolt,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
});
