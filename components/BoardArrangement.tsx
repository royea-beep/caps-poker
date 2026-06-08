import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated'; // needed for boardShakeStyles (Reanimated animated styles from game.tsx)
import Board from './Board';
import PlayerHand from './PlayerHand';
import ProQuoteBanner from './ProQuoteBanner';
import { BoardState } from '../utils/gameLogic';
import { Card, CARDS_PER_BOARD, COLORS } from '../constants/gameConfig';
import { rf, rs, rb, rv } from '../utils/responsive';
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
// PR-O 2026-06-07 Fix 3b — unify HAND_ZONE_HEIGHT with PRD.zone.handMinH on BOTH
// platforms. The split web/native constants drifted out of sync from the
// PlayerHand 4×4 row budget; PlayerHand computes cardH from PRD.zone.handMinH
// directly, so any other zone height here = dead gap + clipped bottom row.
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
  // PR-M 2026-05-29 — strict per-cell dimensions computed in game.tsx so every
  // board fits the viewport with no overflow at any boardCount.
  cellW: number;
  cellH: number;
  // PR-N 2026-06-02 — 2x2 grid only at >=360pt widths for boardCount=4.
  use2x2Grid: boolean;
  // 2026-06-08 Fix — per-boardCount hand zone height (game.tsx owns the math).
  // Optional: when omitted, falls back to module-level HAND_ZONE_HEIGHT.
  handZoneH?: number;
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
  cellW,
  cellH,
  use2x2Grid,
  handZoneH,
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
          // PR-L Task A — 4p keeps row+wrap for the 2x2 grid; 2p/3p use plain
          // column so cells can flex:1 vertically and absorb the empty space
          // that opens up when the hand zone disappears in the ready state.
          // PR-N 2026-06-02 — 2x2 only when use2x2Grid (set by game.tsx for 4p+>=360pt).
          use2x2Grid
            ? { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', alignContent: 'flex-start' }
            : { flexDirection: 'column', flexWrap: 'nowrap' as 'nowrap', alignItems: 'stretch' },
          !isWeb && { paddingTop: insets.top * 0.5 + rs(4) },
        ]}
      >
        {boards.map((board, i) => {
          // PR-M 2026-05-29 — STRICT cell sizing. Replace flex:1 expansion (which
          // pushed board 3 off-screen in 3p mode) with deterministic height: cellH
          // and width: cellW computed once in game.tsx from SCREEN_H/_W minus chrome.
          //   boardCount=2 (4p): 2 rows x 1 col
          //   boardCount=3 (3p): 3 rows x 1 col
          //   boardCount=4 (2p): 2 rows x 2 cols
          const _widthPct = use2x2Grid ? '50%' : '100%';
          return (
            <View
              key={i}
              style={{
                width: _widthPct as any,
                height: cellH,
                maxWidth: _widthPct as any,
                paddingHorizontal: rs(2),
                paddingVertical: rs(2),
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
                  cellWidth={cellW}
                  cellHeight={boardCount === 3 ? Math.max(48, cellH - 12) : cellH}
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

      {/* PR-N 2026-06-02 — marginBottom slimmed to insets.bottom only. The previous
          rs(76) buffer above the floatingActions inflated total hand footprint to
          ~35% of SCREEN_H. Now handZone visual = HAND_ZONE_HEIGHT exactly, and the
          floatingActions absolute overlay sits below the handZone with its own
          padding for the iOS home indicator. */}
      {/* Shrink-fix iter 4 — PRD.zone.actionBarH=rs(56) under-counted the
          actually-rendered action-bar height (~71dp on 390 viewport because
          of inner padding + button minHeight + border). The 17dp residual
          overlap of hand row 4 into the action bar came from this mismatch.
          Bumped to rs(72) + rs(4) safety so the hand container's bottom
          sits cleanly above the action bar top. */}
      {isArranging && (
        <View style={[baStyles.handZone, { height: handZoneH ?? HAND_ZONE_HEIGHT, marginBottom: rs(72) + insets.bottom + rs(8) }]}>
          <PlayerHand
            cards={playerHand}
            selectedCardIds={selectedCardIds}
            onSelectCard={onSelectCard}
          />
        </View>
      )}

      {/* Selection hint / board error */}
      {isArranging && (boardError || selectedCardIds.length > 0) && (
        <Text style={boardError ? baStyles.boardErrorText : baStyles.selectionHint}>
          {boardError
            ? boardError
            : `${selectedCardIds.length} card${selectedCardIds.length !== 1 ? 's' : ''} selected — tap a board`}
        </Text>
      )}

      {/* PR-N 2026-06-02 — first-time hint trimmed from gamesPlayed<3 to gamesPlayed<1.
          The third-game tip (Tap a placed card to remove it) was permanently eating
          vertical budget for repeat players. First-game user still sees the orientation
          hint; everyone else gets the screen back. */}
      {isArranging && !boardError && gamesPlayed < 1 && (
        <View style={baStyles.firstTimeHint}>
          <Text style={baStyles.firstTimeHintText}>{t().hintTexts[Math.min(gamesPlayed, 2)]}</Text>
        </View>
      )}

      {/* Pro quote tip during arrangement — shown after 3 games */}
      {isArranging && !boardError && selectedCardIds.length === 0 && gamesPlayed >= 3 && (
        <ProQuoteBanner context="tutorial" />
      )}

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

      {/* Floating action buttons */}
      {isArranging && (
        <View style={[baStyles.floatingActions, { bottom: insets.bottom, paddingBottom: insets.bottom > 0 ? 0 : rs(8) }]}>
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
    // PR-D study: pinned absolute, solid bg, zIndex 100, height >= rs(72).
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(12),
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    minHeight: PRD.zone.actionBarH,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,40,0.35)',
    zIndex: 100,
    elevation: 12,
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
