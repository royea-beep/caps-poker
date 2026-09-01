// GameView — VAMOS-UNIFY-GAMEVIEW 2026-06-29.
// The shared placement-screen shell extracted VERBATIM from SOLO's portrait render
// (app/game.tsx). SOLO and MP both render THIS so the boards + hand + Auto-Place +
// action bar (all owned by BoardArrangement) are literally the same component
// fed the same props. The two screens differ ONLY in the slots:
//   - `header`     : the bot/opponent status strip inside the themed botSection View
//   - `topCenter`  : the top-center status (instruction pill / circular timer / waiting)
//   - `preChrome`  : SOLO's layout-debug readout + auto-place flash (rendered first)
//   - `chrome`     : per-screen extras after BoardReveal (SOLO tooltips/toasts;
//                    MP connection/chat) — already wired by each caller.
// and in the per-screen callbacks they pass through to BoardArrangement.
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FriendsBg } from './FriendsBg';
import { LinearGradient } from 'expo-linear-gradient';
import { LuxuryBackdrop } from './LuxuryBackdrop';
import { FELT_GRADIENT } from '../constants/paintThemes';
import { BoardArrangement } from './BoardArrangement';
import BoardReveal from './BoardReveal';
import { TimerBar } from './TimerController';
import { BoardState } from '../utils/gameLogic';
import { Card, COLORS } from '../constants/gameConfig';
import { rf as rfBase, rs as rsBase, rv as rvBase } from '../utils/responsive';

// The per-mode sizing the SOLO fit-search (useGameLayout) produces. GameView maps
// these onto the BoardArrangement props exactly as game.tsx did inline.
export interface GameLayout {
  UNIVERSAL_CARD_W: number;
  PLAYER_HAND_H: number;
  cellW: number;
  cellH: number;
  boardsZoneH: number;
  use2x2: boolean;
  handZoneH: number;
  handCardCap: number;
  communityScale: number;
  BOARD_CARD_H: number;
  boardsScroll: boolean;
  gridRows: number;
  gridCols: number;
  isWeb: boolean;
  boardCardH: number;
  boardCardCapDp: number;
}

export interface GameViewTheme {
  background: string;
  surface: string;
  boardBorder: string;
}

export interface GameViewReveal {
  // Structurally the inline pendingRevealBoards shape each screen builds; passed
  // straight through to <BoardReveal/> (whose RevealBoard[] both screens satisfy).
  boards: any[];
  onDone: () => void;
  revealSpeed?: 'fast' | 'normal' | 'cinematic';
  isFirstGame?: boolean;
  /** OTA-COSMETIC-FIXES — passed straight through to <BoardReveal/> to hide chip UI in practice. */
  isPractice?: boolean;
  /** The COMPLETE-bonus percentage THE SERVER used, forwarded verbatim to <BoardReveal/>. */
  completeBonusPercent?: number;
}

export interface GameViewProps {
  /** HINT-OVERLAP 2026-08-13 — forwarded to PlayerHand so game.tsx can position the first-run
   *  tip above the hand from its MEASURED window top rather than a derived height. */
  onMeasureHandTop?: (y: number) => void;
  // Frame + chrome
  theme: GameViewTheme;
  visualTheme: string | null;
  onBack: () => void;
  chips: number;
  header: React.ReactNode;
  topCenter: React.ReactNode;
  preChrome?: React.ReactNode;
  chrome?: React.ReactNode;
  // Optional override for the top-right of the header. SOLO leaves this undefined
  // (GameView renders the default chips pill). MP supplies its own row
  // (spectator badge + ConnectionStatus + chips) so its top-right is byte-identical.
  topRight?: React.ReactNode;
  // Optional in-flow notice rendered directly below the top bar (MP disconnect banner).
  belowTopBar?: React.ReactNode;

  // Thin timer progress bar below the status strip (only during countdown).
  showTimerBar: boolean;
  timerBarCountdown: number;
  timerBarTotal: number;
  timerBarColor: string;

  // Layout (from useGameLayout)
  layout: GameLayout;
  screenW: number;

  // BoardArrangement data
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
  potPerBoard: number;
  /** PRACTICE-CHIP-GATE-SWEEP — practice is XP-only; hides the header balance pill and BoardArrangement's WIN ALL chip banner. */
  isPractice?: boolean;
  countdownActive: boolean;
  countdown: number;
  timeBankUsed: boolean;
  gamesPlayed: number;
  playerReady: boolean;
  allBotsReady: boolean;
  showContinueButton: boolean;

  // BoardArrangement callbacks
  onSelectCard: (card: Card) => void;
  onBoardPress: (boardIndex: number) => void;
  onRemoveCard: (boardIndex: number, card: Card) => void;
  onAutoFill: (boardIndex: number) => void;
  onAutoFillAll?: () => void;
  onUndo: () => void;
  onReady: () => void;
  onTimeBank: () => void;
  onContinue: () => void;

  // Full-screen reveal (gated). null = not showing.
  reveal?: GameViewReveal | null;
}

export function GameView({
  theme,
  visualTheme,
  onBack,
  chips,
  header,
  topCenter,
  preChrome,
  chrome,
  topRight,
  belowTopBar,
  showTimerBar,
  timerBarCountdown,
  timerBarTotal,
  timerBarColor,
  layout,
  screenW,
  boards,
  boardShakeStyles,
  playerHand,
  onMeasureHandTop,
  selectedCardIds,
  isArranging,
  allBoardsFull,
  cardsRemaining,
  boardError,
  boardCount,
  numberOfPlayers,
  potPerBoard,
  isPractice,
  countdownActive,
  countdown,
  timeBankUsed,
  gamesPlayed,
  playerReady,
  allBotsReady,
  showContinueButton,
  onSelectCard,
  onBoardPress,
  onRemoveCard,
  onAutoFill,
  onAutoFillAll,
  onUndo,
  onReady,
  onTimeBank,
  onContinue,
  reveal,
}: GameViewProps) {
  // GAME-SCREEN-FIT / NATIVE-LAYOUT-FIX — shadow rs/rf/rv bound to the real reactive
  // screenW (see makeStyles comment above); rv/rs/rf all scale by width, not height, so
  // no useWindowDimensions() call is needed here beyond the screenW already passed in.
  const rs = (v: number) => rsBase(v, screenW);
  const rf = (v: number, min?: number, max?: number) => rfBase(v, min, max, screenW);
  const rv = (v: number) => rvBase(v, screenW);
  const styles = useMemo(() => makeStyles(rs, rf, rv), [screenW]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.background },
        Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #161922 70%)' } as any,
      ]}
    >
      {/* PANEL-FELT batch — MINIMAL dark felt gradient at the screen root, behind all content
          (absolute-fill, pointerEvents none = zero layout impact). The ~0.55-alpha board panels
          read this through the play area so it reads as a table, not a void. Plain two-stop linear
          gradient, NO blur (perf on older iPhones). Keyed by the resolved theme (null -> classic,
          matching getTheme). streetStencil dormant. This replaces the job of the now-null FriendsBg. */}
      <LinearGradient
        colors={FELT_GRADIENT[(visualTheme ?? 'classic') as 'classic' | 'fiveo' | 'streetStencil']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* GAME-UPGRADES step 3 (2026-09-01) — a MUTED LuxuryBackdrop over the theme felt: the same
          radial vignette + faint beam as the home, dimmed (glow 0.22 vs 0.55, beam halved) so the
          play surface reads as a table without competing with the reveal spotlight or the winner
          cue. overlayOnly keeps the theme's own FELT_GRADIENT above; pointerEvents none = zero
          layout impact (the 83px arc is untouched). Reveal re-measured: cue/field/greyscale hold. */}
      <LuxuryBackdrop muted overlayOnly />
      <FriendsBg />
      {preChrome}
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
        {/* Header bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave game"
            onPress={onBack}
            style={[styles.backButton, { minHeight: 44, minWidth: 44 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{'✕'}</Text>
          </Pressable>
          <View style={styles.topCenter}>
            {topCenter}
          </View>
          {topRight !== undefined ? (
            topRight
          ) : isPractice ? null : (
            <View style={styles.headerChips}>
              <Text style={styles.headerChipsEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰</Text>
              <Text style={styles.headerChipsAmount}>{chips.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {belowTopBar}

        {/* Status strip (bot / opponent) */}
        <View
          style={[styles.botSection, { backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.boardBorder }]}
          accessibilityLiveRegion="polite"
        >
          {header}
        </View>

        {/* Timer progress bar — thin bar below the status strip, only during countdown */}
        {showTimerBar && (
          <TimerBar countdown={timerBarCountdown} total={timerBarTotal} color={timerBarColor} />
        )}

        <BoardArrangement
        onMeasureHandTop={onMeasureHandTop}
          boards={boards}
          boardShakeStyles={boardShakeStyles}
          playerHand={playerHand}
          selectedCardIds={selectedCardIds}
          isArranging={isArranging}
          allBoardsFull={allBoardsFull}
          cardsRemaining={cardsRemaining}
          boardError={boardError}
          boardCount={boardCount}
          numberOfPlayers={numberOfPlayers}
          isPractice={isPractice}
          communityScale={layout.communityScale}
          BOARD_CARD_H={layout.BOARD_CARD_H}
          screenW={screenW}
          isWeb={layout.isWeb}
          countdownActive={countdownActive}
          countdown={countdown}
          timeBankUsed={timeBankUsed}
          gamesPlayed={gamesPlayed}
          playerReady={playerReady}
          allBotsReady={allBotsReady}
          showContinueButton={showContinueButton}
          onBoardPress={onBoardPress}
          onRemoveCard={onRemoveCard}
          onAutoFill={onAutoFill}
          onAutoFillAll={onAutoFillAll}
          onSelectCard={onSelectCard}
          onUndo={onUndo}
          onReady={onReady}
          onTimeBank={onTimeBank}
          onContinue={onContinue}
          potPerBoard={potPerBoard}
          boardsZoneH={layout.boardsZoneH}
          cellW={layout.cellW}
          cellH={layout.cellH}
          use2x2Grid={layout.use2x2}
          handZoneH={layout.handZoneH}
          maxHandCardH={layout.handCardCap}
          universalCardW={layout.UNIVERSAL_CARD_W}
        />
      </Animated.View>

      {reveal && (
        <BoardReveal
          boards={reveal.boards}
          onDone={reveal.onDone}
          revealSpeed={reveal.revealSpeed}
          isFirstGame={reveal.isFirstGame}
          isPractice={reveal.isPractice}
          completeBonusPercent={reveal.completeBonusPercent}
        />
      )}

      {chrome}
    </SafeAreaView>
  );
}

// Shared topBar / status-strip styles, copied VERBATIM from SOLO (game.tsx). Inner
// status content keeps its own per-screen styles via the slots.
// GAME-SCREEN-FIT / NATIVE-LAYOUT-FIX 2026-07-07/08 — this was a plain StyleSheet.create
// object, so every rs()/rf()/rv() call inside it resolved against the frozen module-load
// SCREEN_W (393 fallback on web; on native, whatever width Dimensions.get() reported the
// instant this module first loaded — never updates on iPad Split View / Slide Over resize,
// or if the app launches mid-transition before its final size settles). This is the actual
// live render path for the game screen's header (app/game.tsx's own SafeAreaView/topBar is
// dead code — isLandscape is hardcoded false, so it always renders <GameView> instead).
// Converted to a function of the reactive screenW (already a prop, sourced from game.tsx's
// useWindowDimensions()) built once per render via useMemo, so header sizing reacts to the
// real device instead of whatever the frozen snapshot happened to capture at launch.
function makeStyles(rs: (v: number) => number, rf: (v: number, min?: number, max?: number) => number, rv: (v: number) => number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: rs(12),
      paddingVertical: rs(4),
      zIndex: 10,
    },
    backButton: {
      width: rs(36),
      height: rs(36),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 18,
      ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    backText: {
      color: COLORS.textSecondary,
      fontSize: rf(16),
      fontWeight: '600',
    },
    topCenter: {
      alignItems: 'center',
    },
    headerChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(4),
      backgroundColor: 'rgba(79,214,168,0.12)',
      borderRadius: rv(12),
      paddingVertical: rs(4),
      paddingHorizontal: rs(10),
      borderWidth: 1,
      borderColor: 'rgba(79,214,168,0.25)',
    },
    headerChipsEmoji: {
      fontSize: rf(14),
      lineHeight: rf(18),
    },
    headerChipsAmount: {
      color: COLORS.mint,
      fontSize: rf(14),
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    botSection: {
      paddingVertical: rs(4),
      paddingHorizontal: rs(12),
      zIndex: 10,
    },
  });
}
