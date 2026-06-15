import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { rf, rs, rv, SCREEN_W as MODULE_SCREEN_W } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { t } from '../utils/i18n';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import { getDevice } from '../constants/deviceBreakpoints';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';
import { WEB_MAX_WIDTH } from './WebContainer';
import { getTheme } from '../constants/visualThemes';
import { useGameStore } from '../store/gameStore';
import { playSound } from '../utils/sounds';

interface PlayerHandProps {
  cards: Card[];
  selectedCardIds?: string[];
  onSelectCard: (card: Card) => void;
  // FIT-ALL-BOARDS 2026-06-09 — actual rendered hand-zone height. When omitted,
  // falls back to PRD.zone.handMinH for backwards-compat. Game screen passes the
  // boards-first remainder so hand cards size to fit the real container.
  handZoneH?: number;
  // Optional cap so hand cards never exceed board card height (boards-first rule).
  maxCardH?: number;
}

// Per-card animated slot — each mounts with its own deal animation
function AnimatedCardSlot({
  card,
  index,
  selIndex,
  onSelectCard,
  cardW,
  cardH,
}: {
  card: Card;
  index: number;
  selIndex: number;
  onSelectCard: (card: Card) => void;
  cardW: number;
  cardH: number;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }, (finished) => {
      if (finished && index % 4 === 0) runOnJS(playSound)('cardPlace');
    }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const isSelected = selIndex >= 0;
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => onSelectCard(card)}
        style={[styles.cardWrapper, isSelected && styles.selected]}
      >
        <CardComponent card={card} faceDown={false} cardWidth={cardW} cardHeight={cardH} />
        {isSelected && (
          <View style={styles.selBadge}>
            <Text style={styles.selBadgeText}>{selIndex + 1}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function PlayerHand({ cards, selectedCardIds = [], onSelectCard, handZoneH: handZoneHProp, maxCardH }: PlayerHandProps) {
  // C-fix 2026-05-22: lock to module-level SCREEN_W (computed once in responsive.ts).
  // Was useWindowDimensions() — re-fired on every focus/keyboard/resize event,
  // causing the 2-row hand layout to shift while the player was placing cards.
  const rawW = MODULE_SCREEN_W;
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const device = getDevice(SCREEN_W, 0);

  // PR-K v9 — hand zone capped at 2 rows on web so boards get vertical space.
  // Native keeps the legacy 2-or-4-row path below the breakpoint. The 4-row
  // (quad) path was pushing the hand to ~480px on 390 viewports, leaving 4
  // boards stacked vertically with no room to lay out as a 2×2 grid.
  const isWeb = Platform.OS === 'web';
  const useTwoRows = !isWeb || device.isMobileWeb;

  // VAMOS-HAND-FIT (2026-06-14) — measure-then-size architecture. cardW DERIVED
  // from the real rendered grid width (via onLayout below), not assumed.
  //
  // VAMOS-BOARD-FILL-2 (2026-06-15) — BUG FIX: onLayout reports the .grid View's
  // OUTER width (including its own 16dp paddingHorizontal), not the inner usable
  // content area. The prior math treated measuredRowW as if it were inner, eating
  // the SAFETY budget on top of the padding the rows already had to dodge. Result:
  // bc=4 hand sat near the screen edges despite SAFETY=14. Real fix: subtract
  // HAND_HORIZ_INSET*2 from the measured outer width to get the true rowW the rows
  // can use.
  const HAND_HORIZ_INSET = 16;
  const SAFETY_INSIDE_GRID = 14;
  const [measuredGridOuterW, setMeasuredGridOuterW] = useState(0);
  const fallbackGridOuterW = SCREEN_W;
  const gridOuterW = measuredGridOuterW > 0 ? measuredGridOuterW : fallbackGridOuterW;
  // rowW = the inner content area the rows actually render into.
  const rowW = Math.max(40, gridOuterW - 2 * HAND_HORIZ_INSET);
  const safeCards = cards ?? [];
  // BC4-STACK-REBALANCE 2026-06-09 — retire the >=13-cards quad-row (4x4) path.
  // The 4-player (bc=4) game has 16 cards; with cards capped at boardCardH and the
  // wider 2x8 layout we measured 8-across fits >= 320 width with margin. Going
  // 2x8 frees vertical space for the (now 1x4 stacked) boards. Other modes have
  // <=12 cards and were already 2-row.
  const useQuadRows = false;
  const cardsPerRow = useTwoRows ? Math.max(4, Math.ceil(safeCards.length / (useQuadRows ? 4 : 2))) : Math.max(1, safeCards.length);
  // cardWrapper: paddingHorizontal(4)*2 + borderWidth(2)*2 = 12px overhead per card
  const CARD_WRAPPER_OVERHEAD = rs(12);
  // VAMOS-HAND-FIT — gap starts at 2 for 8-across (vs rs(3) for ≤6-across). If even
  // the MIN_CARD_W floor would overflow rowW, the spec says: drop gap, then allow
  // cardW below the soft min. Fit always wins; cramped is recoverable, clipped is not.
  let CARD_GAP_DP = cardsPerRow >= 8 ? 2 : rs(3);
  const derive = (g: number) =>
    Math.floor((rowW - 2 * SAFETY_INSIDE_GRID - (cardsPerRow - 1) * g - cardsPerRow * CARD_WRAPPER_OVERHEAD) / cardsPerRow);
  let maxCardW = derive(CARD_GAP_DP);
  // Soft-min protection: if cards would be < 16dp at the chosen gap and we're
  // NOT already at gap=2, shrink the gap first. (8-across already starts at 2.)
  if (maxCardW < 16 && CARD_GAP_DP > 2) {
    CARD_GAP_DP = 2;
    maxCardW = derive(CARD_GAP_DP);
  }
  // Even after gap shrink: if still < 14, accept it. A 12-14dp card is readable;
  // a clipped card is not. Floor at 10 absolute (defensive — shouldn't trigger).
  maxCardW = Math.max(10, maxCardW);
  // PR-O 2026-06-07 Fix 3c — when quad rows are active, derive cardH from the
  // available hand zone height (handMinH - label - 3 row gaps) / 4. This
  // guarantees the 4th row fits inside the zone. cardW preserves Card.tsx's
  // 0.72 aspect implicitly. Outside quad mode the existing width-derived math
  // continues to drive sizing.
  const HAND_LABEL_H = rs(18);
  const HAND_LABEL_MB = rs(3);                       // labelRow.marginBottom
  const HAND_ROW_GAP = rs(3);
  const HAND_CONTAINER_PAD_V = rs(3);                // styles.container.paddingVertical (×2)
  const CARD_WRAPPER_BORDER_V = 2;                   // cardWrapper.borderWidth (×2 per row)
  // FIT-ALL-BOARDS 2026-06-09 — use the ACTUAL handZone height passed by the game
  // screen (boards-first remainder). The legacy PRD.zone.handMinH fallback (~341dp
  // at 852) caused cards to be sized for a 341dp zone but render in a 162/170/305dp
  // container â visibly "too-big" hand cards on bc=2/3 and overflow on bc=4.
  const handZoneH = handZoneHProp ?? PRD.zone.handMinH;
  // Shrink-fix iter 3 — the previous formula only subtracted label + 3 gaps,
  // leaving 25dp of hidden chrome (container.paddingVertical × 2 = 6, label
  // marginBottom = 3, cardWrapper.borderWidth × 2 × 4 rows = 16). At 4×4 grid
  // those 25dp pushed the 4th row past the action bar by 42dp on 390×844.
  const cardHForQuad = Math.floor(
    (handZoneH
      - HAND_LABEL_H
      - HAND_LABEL_MB
      - 3 * HAND_ROW_GAP
      - 2 * HAND_CONTAINER_PAD_V
      - 4 * 2 * CARD_WRAPPER_BORDER_V
    ) / 4
  );
  const cardWForQuad = Math.max(14, Math.round(cardHForQuad * 0.72));
  const cardW = (() => {
    if (useQuadRows) {
      // Width bounded by maxCardW so we never overflow horizontally on either platform.
      return Math.max(20, Math.min(cardWForQuad, maxCardW));
    }
    // VAMOS-HAND-FIT — maxCardW is now the derived-to-fit width. Cap at MAX_CARD_W
    // (38, matches bc=2 4-across). NO floor here — the absolute floor is inside
    // the derive() block above so fit always wins on narrow widths.
    if (!isWeb) return Math.min(38, maxCardW);
    // PR-K v9 web 2x8 path stays for partial hands (length < 13).
    if (device.isMobileWeb)  return Math.min(32, Math.max(22, maxCardW));
    if (device.isTabletWeb)  return Math.min(42, Math.max(32, maxCardW));
    return Math.min(56, Math.max(42, maxCardW));
  })();
  let cardH = Math.max(20, Math.round(cardW / 0.72));
  // FIT-ALL-BOARDS 2026-06-09 — boards-first rule. Hand cards must never exceed
  // the board card height; if they do, the boards visually shrink while the hand
  // looks oversized. Clamp here, then back-derive width so aspect stays at 0.72.
  let cardWFinal = cardW;
  if (maxCardH && cardH > maxCardH) {
    cardH = Math.max(20, maxCardH);
    cardWFinal = Math.max(14, Math.round(cardH * 0.72));
  }

  const rowSize = useQuadRows ? 4 : Math.ceil(safeCards.length / 2);
  const topRow = safeCards.slice(0, rowSize);
  const row2 = useQuadRows ? safeCards.slice(rowSize, rowSize * 2) : [];
  const row3 = useQuadRows ? safeCards.slice(rowSize * 2, rowSize * 3) : [];
  const bottomRow = safeCards.slice(useQuadRows ? rowSize * 3 : rowSize);

  const renderCard = (card: Card, globalIndex: number) => (
    <AnimatedCardSlot
      key={card.id}
      card={card}
      index={globalIndex}
      selIndex={selectedCardIds.indexOf(card.id)}
      onSelectCard={onSelectCard}
      cardW={cardWFinal}
      cardH={cardH}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.boardBorder }]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t().yourHand}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{safeCards.length}</Text>
        </View>
      </View>
      {safeCards.length > 0 ? (
        <View
          style={styles.grid}
          // VAMOS-HAND-FIT + BOARD-FILL-2 — measure-then-size. onLayout reports the
          // .grid View's OUTER width (incl. its 16dp paddingHorizontal). We store
          // the outer and derive rowW = outer − 32 above. Dev log prints both so
          // Roye can confirm the outer-vs-inner distinction at a glance.
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - measuredGridOuterW) > 1) setMeasuredGridOuterW(w);
            if (__DEV__) {
              const computedRowW = cardsPerRow * cardWFinal + (cardsPerRow - 1) * CARD_GAP_DP + cardsPerRow * CARD_WRAPPER_OVERHEAD;
              const innerRowW = Math.max(40, w - 2 * HAND_HORIZ_INSET);
              console.log('[hand-grid]', { gridOuterW: w, innerRowW, cardsPerRow, CARD_GAP_DP, cardW: cardWFinal, computedRowW, fits: computedRowW + 2 * SAFETY_INSIDE_GRID <= innerRowW });
            }
          }}
        >
          {useTwoRows ? (
            <>
              <View
                style={[styles.row, { gap: CARD_GAP_DP }]}
                onLayout={(e) => { if (__DEV__ && topRow.length >= 8) console.log('[hand-row-8x]', { rendered: e.nativeEvent.layout.width, cardW: cardWFinal, gap: CARD_GAP_DP }); }}
              >
                {topRow.map((card, i) => renderCard(card, i))}
              </View>
              {row2.length > 0 && (
                <View style={[styles.row, { gap: CARD_GAP_DP }]}>
                  {row2.map((card, i) => renderCard(card, rowSize + i))}
                </View>
              )}
              {row3.length > 0 && (
                <View style={[styles.row, { gap: CARD_GAP_DP }]}>
                  {row3.map((card, i) => renderCard(card, rowSize * 2 + i))}
                </View>
              )}
              {bottomRow.length > 0 && (
                <View style={[styles.row, { gap: CARD_GAP_DP }]}>
                  {bottomRow.map((card, i) => renderCard(card, (useQuadRows ? rowSize * 3 : rowSize) + i))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.webRow}>
              {safeCards.map((card, i) => renderCard(card, i))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>All cards placed!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: rs(3),
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: rs(12),
    marginBottom: rs(3),
    gap: rs(6),
  },
  label: {
    color: COLORS.neonBlue,
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  countBadge: {
    // VAMOS-THEME-PROPAGATION C1 — count pill mint (gold reserved for winning)
    width: rv(20),
    height: rv(20),
    borderRadius: rv(10),
    backgroundColor: COLORS.mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#000',
    fontSize: rf(10),
    fontWeight: '900',
  },
  grid: {
    // VAMOS-PLACEMENT-POLISH B1 (#1) — FIXED 16dp inset (not rs-scaled). rs(16)
    // collapses to ~13dp at 320 widths which was exactly when bc=4 needed more
    // not less. Mirrors HAND_HORIZ_INSET in the cardW math above.
    paddingHorizontal: 16,
    gap: rs(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(3),
  },
  webRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: rs(4),
  },
  cardWrapper: {
    borderRadius: rv(6),
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 1,
    paddingHorizontal: rs(4),
  },
  selected: {
    // VAMOS-THEME-PROPAGATION C1 — selected hand-card now MINT (gold reserved for
    // winning-card highlight only). Same lift+rotate, same halo intensity.
    borderColor: COLORS.mint,
    transform: [{ translateY: PRD.selection.liftY }, { rotate: '-3deg' }, { scale: 1.08 }],
    borderRadius: rv(6),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.mint,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: PRD.selection.haloOpacity,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      default: { boxShadow: '0 0 12px rgba(79,214,168,0.55)' },
    }),
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: rs(10),
  },
  emptyText: {
    color: COLORS.neonGreen,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  selBadge: {
    // VAMOS-THEME-PROPAGATION C1 — selection order pip mint
    position: 'absolute',
    top: -2,
    right: -2,
    width: rv(16),
    height: rv(16),
    borderRadius: rv(8),
    backgroundColor: COLORS.mint,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selBadgeText: {
    color: '#000',
    fontSize: rf(9),
    fontWeight: '900',
  },
});
