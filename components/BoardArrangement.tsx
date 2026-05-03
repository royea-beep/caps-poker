import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated from 'react-native-reanimated'; // needed for boardShakeStyles (Reanimated animated styles from game.tsx)
import Board from './Board';
import PlayerHand from './PlayerHand';
import ProQuoteBanner from './ProQuoteBanner';
import { BoardState } from '../utils/gameLogic';
import { Card, CARDS_PER_BOARD, COLORS } from '../constants/gameConfig';
import { rf, rs, rb, rv } from '../utils/responsive';
import { t } from '../utils/i18n';

const HINT_TEXTS = [
  '👆 Tap a card from your hand, then tap a board to place it',
  '🎯 Try to win ALL boards for the COMPLETE bonus!',
  '💡 Tip: Tap a placed card to remove it and try a different board',
];

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
}: BoardArrangementProps) {
  return (
    <>
      {/* Boards */}
      <View style={isWeb ? baStyles.boardsGrid : baStyles.boardsColumn}>
        {boards.map((board, i) => (
          <Animated.View
            key={i}
            style={[
              isWeb ? (boardCount === 3 ? baStyles.boardCellThird : baStyles.boardCellHalf) : baStyles.boardCellFull,
              isWeb && screenW < 500 && { paddingHorizontal: 2, paddingVertical: 2 },
              boardShakeStyles[i],
            ]}
          >
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
            />
          </Animated.View>
        ))}
      </View>

      {/* Fallback continue button — shows 3s after both ready if auto-nav failed */}
      {playerReady && allBotsReady && showContinueButton && (
        <Pressable
          style={baStyles.continueBtn}
          onPress={onContinue}
        >
          <Text style={baStyles.continueBtnText}>TAP TO CONTINUE →</Text>
        </Pressable>
      )}

      {/* Player hand */}
      {isArranging && (
        <PlayerHand
          cards={playerHand}
          selectedCardIds={selectedCardIds}
          onSelectCard={onSelectCard}
        />
      )}

      {/* Selection hint / board error */}
      {isArranging && (boardError || selectedCardIds.length > 0) && (
        <Text style={boardError ? baStyles.boardErrorText : baStyles.selectionHint}>
          {boardError
            ? boardError
            : `${selectedCardIds.length} card${selectedCardIds.length !== 1 ? 's' : ''} selected — tap a board`}
        </Text>
      )}

      {/* First-time hint bar (first 3 games only) */}
      {isArranging && !boardError && gamesPlayed < 3 && (
        <View style={baStyles.firstTimeHint}>
          <Text style={baStyles.firstTimeHintText}>{HINT_TEXTS[Math.min(gamesPlayed, 2)]}</Text>
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

      {/* WIN ALL bonus hint */}
      {isArranging && allBoardsFull && (
        <Text style={baStyles.winAllHint}>
          {t().winAll(potPerBoard * boardCount * numberOfPlayers + Math.round(potPerBoard * boardCount * 0.5))}
        </Text>
      )}

      {/* Floating action buttons */}
      {isArranging && (
        <View style={baStyles.floatingActions}>
          <Pressable
            style={({ pressed }) => [baStyles.floatingBtn, baStyles.undoBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
            onPress={onUndo}
            disabled={boards.every((b) => b.playerCards.length === 0)}
          >
            <Text style={[baStyles.floatingBtnText, baStyles.undoBtnText, boards.every((b) => b.playerCards.length === 0) && baStyles.floatingBtnDisabled]}>ביטול</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [baStyles.floatingBtn, baStyles.placeBtn, !allBoardsFull && baStyles.placeBtnDisabled, allBoardsFull && baStyles.placeBtnReady, pressed && allBoardsFull && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={onReady}
            disabled={!allBoardsFull}
          >
            <Text style={[baStyles.floatingBtnText, baStyles.placeBtnText]}>
              {allBoardsFull ? '✓ מוכן' : 'אישור'}
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
  boardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    alignContent: 'stretch',
    paddingHorizontal: Platform.OS === 'web' ? 6 : 8,
    paddingVertical: Platform.OS === 'web' ? 4 : 0,
    width: '100%',
    flex: 1,
  },
  boardCellFull: {
    flex: 1,
  },
  boardCellHalf: {
    width: '50%',
    minHeight: Platform.OS === 'web' ? 180 : undefined,
    paddingHorizontal: Platform.OS === 'web' ? 3 : 4,
    paddingVertical: Platform.OS === 'web' ? 3 : 4,
  },
  boardCellThird: {
    width: '33.33%',
    paddingHorizontal: rs(4),
    paddingVertical: 2,
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: rv(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(5),
    marginBottom: rs(2),
  },
  timeBankText: {
    color: 'rgba(201,168,76,0.85)',
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  winAllHint: {
    textAlign: 'center',
    color: 'rgba(255,215,0,0.7)',
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: rs(2),
    opacity: 0.85,
  },
  floatingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(12),
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    zIndex: 10,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
  },
  placeBtn: {
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  placeBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.7)',
  },
  placeBtnText: {
    color: '#FFFEF8',
  },
  continueBtn: {
    position: 'absolute',
    bottom: rs(100),
    alignSelf: 'center',
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    paddingVertical: rs(14),
    paddingHorizontal: rs(40),
    borderRadius: rv(24),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  continueBtnText: {
    color: '#FFFEF8',
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 2,
  },
});
