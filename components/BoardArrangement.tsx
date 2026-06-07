import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated'; // needed for boardShakeStyles (Reanimated animated styles from game.tsx)
import Board from './Board';
import PlayerHand from './PlayerHand';
import ProQuoteBanner from './ProQuoteBanner';
import { BoardState } from '../utils/gameLogic';
import { Card, CARDS_PER_BOARD, COLORS } from '../constants/gameConfig';
import { rf, rs, rb, rv, SCREEN_H as MODULE_SCREEN_H } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';

// PR-K v7 — Module-top side-effect and nativeID/dataSet/inline styles ALL
// dropped by RNW (v6 diag confirmed: zero data-* attrs, zero #pr-k-* in DOM,
// no <style id="pr-k-styles"> injected). Going DOM-direct: a ref on the grid
// View + useLayoutEffect that imperatively sets style.cssText on the real
// host element after RNW renders. MutationObserver keeps the override alive
// across re-renders.

// 2026-05-23 zone fix #1+#2: explicit player-hand zone height + visible seam between
// boards and hand. Previously the hand was residual (whatever space was left after
// boards stacked), which on 4-board games at 320pt squeezed it to ~20px and gave no
// visual boundary. Now: handHeight is computed once at module load, with a 140px
// floor so 320pt phones still see a usable hand row.
// PR-O v3.1 — unified with PRD.zone.handMinH on BOTH platforms. The previous
// web-specific 0.17 hardcode was the root cause of the 200+dp dead gap
// regression: game.tsx boards-zone calc used PRD.zone.handMinH (0.42) but
// the handZone style used 0.17 → boards reserved space for a 354dp hand
// but the container was only 143dp, leaving 211dp of empty space.
const HAND_ZONE_HEIGHT = PRD.zone.handMinH;
import { t } from '../utils/i18n';

export interface BoardArrangementProps {
  boards: BoardState[];
  boardShakeStyles: any[];
  playerHand: Card[];
  selectedCardIds: string[];
  isArranging: boolean;
  allBoardsFull: boolean;
  cardsRemaining: number;
  boardError: string | null;
  boardCount: number;
  numberOfPlayers: number;
  communityScale: number;
  BOARD_CARD_H: number;
  screenW: number;
  isWeb: boolean;
  countdownActive: boolean;
  countdown: number;
  timeBankUsed: boolean;
  gamesPlayed: number;
  playerReady: boolean;
  allBotsReady: boolean;
  showContinueButton: boolean;
  onBoardPress: (boardIndex: number) => void;
  onRemoveCard: (boardIndex: number, card: Card) => void;
  onAutoFill: (boardIndex: number) => void;
  onSelectCard: (card: Card) => void;
  onUndo: () => void;
  onReady: () => void;
  onTimeBank: () => void;
  onContinue: () => void;
  potPerBoard: number;
  // PR-K v2 — numeric height of the boards zone (px) so cellH = zoneH/rows - gap.
  boardsZoneH: number;
  // PR-O scope-corrected — true ONLY for boardCount === 4 (2-player game).
  // Switches the grid from PR-M's vertical-stack (column) layout to a 1×N
  // horizontal row of tall+narrow cells with vertical community + slots.
  is1xN?: boolean;
}

export function BoardArrangement({
  boards,
  boardShakeStyles,
  playerHand,
  selectedCardIds,
  isArranging,
  allBoardsFull,
  cardsRemaining,
  boardError,
  boardCount,
  numberOfPlayers,
  communityScale,
  BOARD_CARD_H,
  screenW,
  isWeb,
  countdownActive,
  countdown,
  timeBankUsed,
  gamesPlayed,
  playerReady,
  allBotsReady,
  showContinueButton,
  onBoardPress,
  onRemoveCard,
  onAutoFill,
  onSelectCard,
  onUndo,
  onReady,
  onTimeBank,
  onContinue,
  potPerBoard,
  boardsZoneH,
  is1xN = false,
}: BoardArrangementProps) {
  const insets = useSafeAreaInsets();

  return (
    <>
      {/*
        PR-K accepted limitation (2026-05-28):
        ------------------------------------------------------------------
        WEB renders boards VERTICAL-STACK, full-width. NATIVE renders 2×2.

        Why: react-native-web 0.21.2 silently drops `flexDirection:'row'` +
        `flexWrap:'wrap'` on this subtree regardless of how we express them
        (StyleSheet, inline override, both). 9 attempted bypasses across
        v4–v8 (inline override, raw <div> via createElement, nativeID +
        injected <style>, useRef + useLayoutEffect + MutationObserver,
        useCallback ref + RAF loop) all failed — RNW absorbs the wrapper
        and the boards leak up to a column-direction parent.

        Native (iOS/Android) uses the same JSX but goes through
        React Native's real renderer, which honors flex-wrap normally,
        so the 2×2 grid works there. The actual product ships on native.

        Leaving the row+wrap StyleSheet intact so native benefits.
      */}
      <View
        style={[
          baStyles.boardsGrid,
          // PR-O scope-corrected — only the 4-board case (2-player game) uses
          // a 1×N horizontal grid with tall+narrow cells. The 2- and 3-board
          // cases revert to PR-M's vertical-stack (column) behavior with full-
          // width cells and horizontal community + horizontal slot rows.
          is1xN
            ? { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'stretch', alignContent: 'stretch' }
            : { flexDirection: 'column', alignItems: 'stretch' },
          !isWeb && { paddingTop: insets.top * 0.5 + rs(4) },
        ]}
      >
        {boards.map((board, i) => {
          // 1×N: cellH = full boardsZoneH (single row of N narrow cells).
          // Vertical-stack: cellH = boardsZoneH / boardCount (one cell per row).
          const _cellH = is1xN
            ? Math.max(60, Math.floor(boardsZoneH) - rs(8))
            : Math.max(60, Math.floor(boardsZoneH / Math.max(1, boardCount)) - rs(8));
          const _widthPct = is1xN
            ? (`${Math.floor(100 / Math.max(1, boardCount))}%` as const)
            : ('100%' as const);
          return (
            <View
              key={i}
              style={{
                width: _widthPct as any,
                // 1×N: flex:1 + minHeight so cells absorb extra vertical space.
                // Vertical-stack: also flex:1 so cells absorb space when hand zone
                // disappears in the ready state (PR-L Task E behavior).
                flex: 1,
                minHeight: _cellH,
                maxWidth: _widthPct as any,
                paddingHorizontal: rs(3),
                paddingVertical: rs(3),
                overflow: 'hidden',
              }}
            >
              <Animated.View style={[{ flex: 1, width: '100%', height: '100%' }, boardShakeStyles[i]]}>
                <Board
                  index={i}
                  openCards={board.openCards}
                  closedCards={board.closedCards}
                  playerCards={board.playerCards}
                  botCards={board.allBotCards[0] || board.botCards}
                  allBotCards={board.allBotCards}
                  revealed={false}
                  active={false}
                  potAmount={potPerBoard * numberOfPlayers}
                  onPress={() => onBoardPress(i)}
                  onRemoveCard={(card) => onRemoveCard(i, card)}
                  onAutoFill={() => onAutoFill(i)}
                  isArrangement={isArranging}
                  selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
                  cardHeight={BOARD_CARD_H}
                  communityScale={communityScale}
                  verticalContent={is1xN}
                />
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* Fallback continue button — shows 3s after both ready if auto-nav failed */}
      {playerReady && allBotsReady && showContinueButton && (
        <Pressable
          style={baStyles.continueBtn}
          onPress={onContinue}
        >
          <Text style={baStyles.continueBtnText}>{t().tapToContinue}</Text>
        </Pressable>
      )}

      {/* Player hand — explicit zone (fix #1) + visible seam to boards above (fix #2).
          PR-O v3 — marginBottom was rs(76) (just actionBarH); fix #6 added a pill row
          above [Cancel, Confirm] which pushed the floating-actions zone to ~rs(100).
          Bumped so hand floats ABOVE the pill+bar stack with a tiny gap, not behind. */}
      {isArranging && (
        <View style={[baStyles.handZone, { marginBottom: rs(104) + insets.bottom }]}>
          <PlayerHand
            cards={playerHand}
            selectedCardIds={selectedCardIds}
            onSelectCard={onSelectCard}
          />
        </View>
      )}

      {/* PR-O — The "row above the action bar" (selection hint / board error /
          first-time hint / pro-quote banner) has been deleted to save a chrome
          row. board errors now surface only via the existing per-board shake +
          autoPlaceToast in game.tsx. Selection hints, first-time hints, and pro
          quotes are tutorial niceties that no longer compete for vertical space
          on small phones. */}

      {/* Time bank button — visible when countdown < 20s and not yet used */}
      {isArranging && countdownActive && countdown < 20 && !timeBankUsed && (
        <Pressable
          style={baStyles.timeBankBtn}
          onPress={onTimeBank}
        >
          <Text style={baStyles.timeBankText}>⏱ {t().timeBank}</Text>
        </Pressable>
      )}

      {/* PR-L Task G — WIN ALL banner moved to position:absolute ABOVE the
          button bar instead of normal-flow above it (it was visually rendering
          below the absolute-positioned button bar, looking like an
          afterthought). Now sits directly above buttons. */}
      {isArranging && allBoardsFull && (
        <View
          style={[
            baStyles.winAllBanner,
            { bottom: insets.bottom + PRD.zone.actionBarH + rs(4) },
          ]}
          pointerEvents="none"
        >
          <Text style={baStyles.winAllHint}>
            {t().winAll(potPerBoard * boardCount * numberOfPlayers + Math.round(potPerBoard * boardCount * 0.5))}
          </Text>
        </View>
      )}

      {/* Floating action buttons — PR-O regression #6 — pill is now its OWN
          row above the [Cancel, Confirm] row (was inline at index 1, looked
          like a 3rd button). Column layout: row 1 = pill (full-width label,
          non-interactive), row 2 = [Cancel, Confirm]. */}
      {isArranging && (
        <View style={[baStyles.floatingActions, { bottom: insets.bottom, paddingBottom: insets.bottom > 0 ? 0 : rs(8) }]}>
          <View style={baStyles.placePill} accessibilityLiveRegion="polite" pointerEvents="none">
            <Text style={baStyles.placePillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {cardsRemaining === 0 ? t().allPlaced : t().arrangeCards(cardsRemaining)}
            </Text>
          </View>
          <View style={baStyles.floatingButtonsRow}>
            <Pressable
              style={({ pressed }) => [baStyles.floatingBtn, baStyles.undoBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
              onPress={onUndo}
              disabled={boards.every((b) => b.playerCards.length === 0)}
            >
              <Text style={[baStyles.floatingBtnText, baStyles.undoBtnText, boards.every((b) => b.playerCards.length === 0) && baStyles.floatingBtnDisabled]}>{t().cancel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [baStyles.floatingBtn, baStyles.placeBtn, !allBoardsFull && baStyles.placeBtnDisabled, allBoardsFull && baStyles.placeBtnReady, pressed && allBoardsFull && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={onReady}
              disabled={!allBoardsFull}
            >
              <Text style={[baStyles.floatingBtnText, baStyles.placeBtnText]}>
                {allBoardsFull ? t().readyCheck : t().confirm}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

const baStyles = StyleSheet.create({
  boardsColumn: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: rs(16),
    gap: rs(4),
  },
  handZone: {
    // PR-D study: explicit hand-zone height + gold hairline above with horizontal
    // margin (rs(12)) so the separator reads as a divider, not a full border.
    height: HAND_ZONE_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
    marginHorizontal: PRD.zone.hairlineMarginH,
  },
  boardsGrid: {
    // PR-D study: 2x2 grid. NOTE: do NOT use container `gap` with `width: '50%'`
    // cells — RN computes 50% relative to content box, then adds gap, so total
    // becomes 100% + gap and the row wraps. Instead, each cell carries
    // padding = rs(3) and adjacent cells produce a visible gutter of rs(6).
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    alignContent: 'flex-start',
    paddingHorizontal: PRD.board.cellPadH,
    paddingVertical: PRD.board.cellPadV,
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  boardCellFull: {
    flex: 1,
  },
  boardCellHalf: {
    // PR-D study: 2x2 cells. Each cell takes exactly 50% width; the rs(3)
    // padding on each side produces the rs(6) gutter to the sibling cell.
    // PR-K: dropped minHeight floor so cell can shrink on small phones when
    // boardCount >= 4 needs 2 rows. height is set inline via boardCount check
    // (see boards.map above). overflow: hidden so Board content that's too tall
    // for the shrunken cell clips visually instead of pushing the layout.
    width: '50%',
    paddingHorizontal: rs(3),
    paddingVertical: rs(3),
    overflow: 'hidden',
  },
  boardCellThird: {
    width: '33.333%',
    minHeight: PRD.board.cellHCap,
    paddingHorizontal: rs(3),
    paddingVertical: rs(3),
  },
  selectionHint: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  firstTimeHint: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    alignItems: 'center',
    marginHorizontal: rs(4),
    borderRadius: rv(8),
  },
  firstTimeHintText: {
    color: '#FFFFFF',
    fontSize: rf(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  timeBankBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(5),
    marginBottom: rs(2),
  },
  timeBankText: {
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  winAllHint: {
    textAlign: 'center',
    color: COLORS.goldBright,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.95,
  },
  // PR-L Task G — wrapper for absolute-positioned WIN ALL banner.
  winAllBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(2),
    zIndex: 99, // below the action bar (100) so the bar's border still shows
  },
  floatingActions: {
    // PR-D study: pinned absolute, solid bg, zIndex 100.
    // PR-O regression #6 — flexDirection column so the label pill stacks
    // ABOVE the [Cancel, Confirm] row instead of rendering between them
    // like a 3rd button.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    gap: rs(6),
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,40,0.35)',
    zIndex: 100,
    elevation: 12,
  },
  // PR-O regression #6 — new row wrapper for the [Cancel, Confirm] pair.
  floatingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: rs(12),
    width: '100%',
  },
  // PR-O regression #6 — pill is now a label-row above the buttons. Flat
  // background, subtle border, small radius so it does NOT look like a CTA.
  placePill: {
    alignSelf: 'center',
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 0,
    borderRadius: rb(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  placePillText: {
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  floatingBtn: {
    paddingVertical: rs(14),
    paddingHorizontal: rs(28),
    minHeight: rs(52),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rb(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  undoBtn: {
    // PR-L Task F — balance with placeBtn (was no flex → undoBtn shrunk to
    // intrinsic text width while placeBtn took 100% via flex:1).
    flex: 1,
    backgroundColor: '#2A1A06',
    borderWidth: 1.5,
    borderColor: '#F5C842',
    alignItems: 'center',
  },
  placeBtn: {
    backgroundColor: COLORS.gold,
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  placeBtnDisabled: {
    backgroundColor: COLORS.goldDim,
    opacity: 0.6,
  },
  placeBtnReady: {
    backgroundColor: '#28A745',
    ...Platform.select({
      ios: {
        shadowColor: '#28A745',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
      default: {
        boxShadow: '0 4px 16px rgba(40,167,69,0.55)',
      } as any,
    }),
  },
  floatingBtnText: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  undoBtnText: {
    color: '#F5C842',
  },
  placeBtnText: {
    color: COLORS.background,
  },
  continueBtn: {
    position: 'absolute',
    bottom: rs(100),
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: rs(14),
    paddingHorizontal: rs(40),
    borderRadius: rv(24),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  continueBtnText: {
    color: COLORS.background,
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 2,
  },
});
