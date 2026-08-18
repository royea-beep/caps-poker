import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated'; // needed for boardShakeStyles (Reanimated animated styles from game.tsx)
import Board from './Board';
import BoardSurface from './BoardSurface';
import PlayerHand from './PlayerHand';
import { useGameStore } from '../store/gameStore';
import ProQuoteBanner from './ProQuoteBanner';
import { BoardState } from '../utils/gameLogic';
import { Card, CARDS_PER_BOARD, COLORS, getCompleteBonusPercent } from '../constants/gameConfig';
import { rf as rfBase, rs as rsBase, rb as rbBase, rv as rvBase } from '../utils/responsive';
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
  /** PRACTICE-CHIP-GATE-SWEEP — practice is XP-only; hides the "WIN ALL → +N" chip banner. */
  isPractice?: boolean;
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
  onAutoFillAll?: () => void;
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
  // FIT-ALL-BOARDS 2026-06-09 — cap so hand cards never exceed the board card height.
  maxHandCardH?: number;
  // VAMOS-UNIFY-CARD-SIZE 2026-06-17 — single CARD_W used by both board cards
  // and hand cards. When provided, Board uses it directly for commW/slotW; the
  // PlayerHand uses it for hand cardW. Strict size-unity instead of count-based.
  universalCardW?: number;
  /** HINT-OVERLAP 2026-08-13 — passed straight to PlayerHand so game.tsx can position the
   *  first-run tip above the hand from its MEASURED window top, not a derived height. */
  onMeasureHandTop?: (y: number) => void;
}

export function BoardArrangement({
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
  isPractice,
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
  onAutoFillAll,
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
  maxHandCardH,
  universalCardW,
}: BoardArrangementProps) {
  const insets = useSafeAreaInsets();

  // PARTIAL-PLACEMENT COLLISION — measured, not inferred. In the partial-placement state (some
  // cards down, so Cancel/Confirm has appeared while "Auto-Place ALL" is still on screen) the
  // Auto-Place pill lies ACROSS the tops of both action buttons: 10px of overlap at 320 wide, and
  // exactly 0px — touching — at 390.
  //
  // Cause: this offset was rs(56) + rs(4), i.e. PRD.zone.actionBarH. The comment at the handZone
  // below already records that rs(56) UNDER-COUNTS the rendered action bar (~71dp at 390, because
  // of inner padding + button minHeight + border) and the handZone was bumped to rs(72) + rs(8)
  // for exactly that reason. The Auto-Place bar never got the same correction — one geometry
  // written down twice, and only one copy fixed.
  //
  // And a scaled constant cannot express it anyway: the action row measures ~60dp above the
  // viewport bottom at BOTH 320 and 390 (its height comes from an unscaled touch-target minHeight
  // plus rsBase padding), while rs() shrinks with width — rs(60) is 60 at 390 but 49 at 320. That
  // is the whole 10px. Hence a FLOOR: scale up on roomy screens, never below what the row
  // actually occupies.
  //
  // ACTION_BAR_CLEARANCE is now the single source for both the Auto-Place bar and the handZone
  // lift above it, so the two cannot drift apart again. (Defined just below, once `rs` exists.)

  // GAME-SCREEN-FIT 2026-07-07 — screenW is already a reactive prop from game.tsx;
  // screenH isn't passed down today, and Board needs it for its own rh()-equivalent
  // math. Adding one more useWindowDimensions() subscription here (BoardArrangement
  // renders once per game screen, not once per Board) is cheap and keeps game.tsx as
  // the only OTHER place already doing this — no change to game.tsx needed.
  const { height: screenH } = useWindowDimensions();

  // GAME-SCREEN-FIT 2026-07-07 — rf/rs/rb/rv scale against SCREEN_W frozen at module
  // load (393 on web, since Dimensions.get() at module scope crashes the SPA before
  // the DOM is ready — see utils/responsive.ts). Telemetry shows every narrow/short
  // report (320x553, 320x568, 360x640) is platform:web, so these were silently
  // computing against 393pt regardless of the real viewport. screenW is already a
  // reactive prop (game.tsx's useWindowDimensions()); shadow the imports so every
  // existing rs()/rf()/rb()/rv() call below becomes reactive with no other changes.
  // CA2 — the surface needs the resolved theme so its felt matches the root felt exactly.
  // Read here rather than inside BoardSurface so that component stays presentational.
  const visualTheme = useGameStore((s) => s.visualTheme);

  const rs = (v: number) => rsBase(v, screenW);
  const rf = (v: number, min?: number, max?: number) => rfBase(v, min, max, screenW);
  const rb = (v: number) => rbBase(v, screenW);
  const rv = (v: number) => rvBase(v, screenW);

  // See the PARTIAL-PLACEMENT COLLISION note above. Declared here because `rs` is block-scoped to
  // this component and only exists from this line down.
  // ACTION_BAR_CLEARANCE and AUTO_BAR_H DELETED 2026-08-15 (BUILD-OPTION-A). Both described the
  // absolute Auto-Place bar — its offset from the viewport bottom and its height — and both had
  // zero consumers once that bar moved into the hand header. The 8dp bar gap they produced is
  // unchanged for the Cancel/Confirm bar, which never read them. Removed rather than left
  // unused: an unconsumed constant that still looks authoritative is how this file ended up
  // with three copies of one wrong number.

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
      {/* VAMOS-LAYOUT-MEASURE-V1 2026-06-21 — boards region is now flex-measured.
          Was a fixed-height ScrollView pegged to boardsZoneH computed from a stale
          SCREEN_H snapshot minus ~10 estimated chrome constants — wrong on any
          device where the real chrome differed from the estimates (boards 2-4
          unreachable + dead band above action bar). The boards region now lives
          inside a `flex: 1` View, the ScrollView itself is `flex: 1`, so it fills
          whatever the parent flex column leaves between top bar / bot status /
          hand zone. Content taller than the region → scrolls; content shorter →
          top-aligned, no dead gap above the hand. The old comment claimed
          flex:1 collapses the ScrollView — that was only true when the parent had
          no measured height; here the wrapping flex parent gives it one. */}
      {/* VAMOS-LAYOUT-MEASURE-V2 2026-06-21 — minHeight floor protects the boards
          region on SHORT screens (iPhone SE 2022 = 375x667, the older 320x568).
          V1 inverted the V0 failure: boards got `flex: 1` and were starved when
          the hand's fixed height ate most of the viewport. The minHeight here
          guarantees a usable scroll viewport (~2 board cells) on every device;
          on tall screens flex: 1 still lets the region grow. Sized from the
          live cellH so it tracks the same readability math, not a hardcoded px.
          RESPONSIVE-FIX 2026-07-06 — capped at `boardsZoneH` (the space
          useGameLayout already determined is truly available after hand/chrome).
          Uncapped, a bc=4 (2P, 4 boards) game on a NARROW+SHORT real device (320-375pt,
          exactly the class this comment calls out) could demand "2 cells" of height
          that EXCEEDS boardsZoneH — pushing the whole flex column past safeH with no
          outer-level scroll to reach it (game.tsx has no top-level ScrollView by
          design; only this region scrolls internally). Confirmed live: tester screenshot
          showed only Board 1+2 of 4, boards 3/4 unreachable. Capping guarantees this
          region's FRAME never exceeds the space the layout engine says exists, so the
          internal ScrollView below is always the one that scrolls — never the page. */}
      <View style={{ flex: 1, alignSelf: 'stretch', minHeight: Math.min(Math.round(2 * cellH + rs(4)), boardsZoneH) }}>
        {/* CA2 — THE PLAYING SURFACE. Wrapped INSIDE this View rather than replacing it: this
            container carries the minHeight/flex contract a previous sprint fixed (the boards
            region's frame must never exceed the space the layout engine says exists, so the
            ScrollView is always the thing that scrolls, never the page). Swapping it out would
            re-open that bug for a cosmetic reason. */}
        <BoardSurface visualTheme={visualTheme} screenW={screenW}>
        <ScrollView
          style={{ flex: 1 }}
          // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — clean column-stack contentContainer
          // with NO flex, NO flexWrap, NO overflow (inheriting baStyles.boardsGrid
          // would have collapsed boards 3/4 into a hidden second column).
          // VAMOS-LAYOUT-MEASURE-V2 2026-06-21 — flexGrow:1 + justifyContent:center
          // so on TALL screens with few boards (e.g. bc=2 on 932dp) the stack
          // centers in the viewport instead of pinning to the top with a dead
          // gap above the hand. When content overflows the viewport, flex layout
          // stacks from the top naturally and scroll still works.
          contentContainerStyle={[
            {
              flexGrow: 1,
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'center',
              paddingHorizontal: rs(4),
              paddingVertical: rs(2),
            },
            !isWeb && { paddingTop: insets.top * 0.5 + rs(4) },
          ]}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          bounces={true}
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
            // VAMOS-BOARD-NOCLIP-ROBUST 2026-06-21 — was `height: cellH` +
            // `overflow: 'hidden'`: deliberately clipped any board content that
            // rendered taller than the model predicted. Web QA never reproduced
            // it but two device reports confirmed placed cards still got cut on
            // real iOS. The fix can't rely on more web-verified clamps that the
            // device beats. Switched to `minHeight: cellH` + removed overflow so
            // the cell GROWS to fit whatever Board actually renders. Boards are
            // stacked in a flex column with `marginBottom` gap, so a grown cell
            // pushes the next board down (never overlap). If the total stack
            // exceeds the boards region the V2 ScrollView scrolls; clipping is
            // impossible by construction.
            <View
              key={i}
              style={{
                width: _widthPct as any,
                minHeight: cellH,
                maxWidth: _widthPct as any,
                paddingHorizontal: rs(2),
                paddingVertical: rs(2),
                marginBottom: i < boards.length - 1 ? rs(4) : 0,
              }}
            >
              <Animated.View style={[{ width: '100%' }, boardShakeStyles[i]]}>
                <Board
                  index={i}
                  hasSelection={selectedCardIds.length > 0}
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
                  // VAMOS-SCROLL-V2 2026-06-17 — every board uses the same cellH
                  // regardless of boardCount (was: cellH - rs(12) at bc=3/4 to
                  // squeeze the 4-board stack). The scrollable viewport now
                  // replaces the cram-stack, so no bc-specific shrink needed.
                  cellHeight={cellH}
                  contentSafetyPad={false}
                  /* VAMOS-BOARD-FILL-2 — plumb boardCount so Board can raise the card cap at bc=2/3 */
                  boardCount={boardCount}
                  /* VAMOS-UNIFY-CARD-SIZE 2026-06-17 — universal CARD_W from game.tsx */
                  universalCardW={universalCardW}
                  /* GAME-SCREEN-FIT 2026-07-07 — real viewport, single source at the top of
                     the tree (game.tsx's useWindowDimensions()), threaded down so Board's
                     internal rs()/rf() budgets react to the true device instead of the
                     frozen 393x852-on-web default. */
                  screenW={screenW}
                  screenH={screenH}
                />
              </Animated.View>
            </View>
          );
        })}
        </ScrollView>
        </BoardSurface>
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
      {/* VAMOS-LAYOUT-MEASURE-V2 2026-06-21 — hand zone YIELDS on short screens.
          Was a hard `height: handZoneH` which won the flex column fight on
          short screens (375x667 / 320x568) and starved the boards region to
          ~135px / ~0px. Now `maxHeight: handZoneH` + flexShrink: 1 + minHeight: 0
          lets the boards' minHeight floor be honored. If the hand would clip
          (more cards than the shrunken zone can show), PlayerHand's internal
          ScrollView (inside PlayerHand) handles overflow so the bottom row is
          never clipped. On tall screens nothing changes — the hand fits at
          its preferred height. */}
      {isArranging && (
        <View
          style={[
            baStyles.handZone,
            {
              maxHeight: handZoneH ?? HAND_ZONE_HEIGHT,
              flexShrink: 1,
              minHeight: 0,
              // A1-REDO — lift the WHOLE handZone up rs(24) when the "Auto-Place ALL"
              // overlay (autoAllBar, absolute at insets.bottom + rs(60), ~rs(31) tall)
              // is shown, so the hand's last visible row clears it. This moves the
              // CONTAINER, so the row rises regardless of whether the hand overflows —
              // unlike the removed paddingBottom (which added space BELOW top-anchored
              // overflowing content and never moved the visible cards). Overlap is
              // rs(11) and insets-independent (button + this margin both scale with
              // insets), so rs(24) clears it with ~rs(13) breathing room on web AND
              // native. Cost: the boards region (flex:1) gives up ≤rs(24) on roomy
              // screens; on tight screens the hand flexShrinks instead — both keep the
              // last row clear.
              // BUILD-OPTION-A 2026-08-15 — the rs(24) lift and the ACTION_BAR_CLEARANCE +
              // AUTO_BAR_H floor are RETIRED. Both existed for one reason: to hold the hand's
              // last row clear of the absolute Auto-Place bar that floated below this panel.
              // That bar is gone — the control is inside this panel's header now — so the
              // compensation has nothing left to compensate for. Keeping it would reserve ~28dp
              // of empty space under the hand forever, which is Rule 20's corollary: a constant
              // that outlives the defect it was written for becomes the next wrong premise.
              // The branch collapses to the plain bottom-chrome reservation, which is what the
              // no-Auto-Place case already used.
              marginBottom: rs(72) + insets.bottom + rs(8),
            },
          ]}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <PlayerHand
          onMeasureTop={onMeasureHandTop}
              cards={playerHand}
              selectedCardIds={selectedCardIds}
              onSelectCard={onSelectCard}
              handZoneH={handZoneH ?? HAND_ZONE_HEIGHT}
              maxCardH={maxHandCardH}
              universalCardW={universalCardW}
              onAutoFillAll={!allBoardsFull && onAutoFillAll ? onAutoFillAll : undefined}
            />
          </ScrollView>
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
      {isArranging && allBoardsFull && !isPractice && (
        <View
          style={[
            baStyles.winAllBanner,
            { bottom: insets.bottom + rs(56) + rs(4) },
          ]}
          pointerEvents="none"
        >
          <Text style={baStyles.winAllHint}>
            {/* VAMOS S-BATCH — bonus part now matches the live math: % of the TOTAL pot,
                scaled by board count (was hardcoded 0.5 of ONE player's buy-in). */}
            {/* NET, NOT GROSS. The label is `WIN ALL → +${n} 🟡` (i18n.ts:396) — a leading + and a
                coin, so it is a claim about what the player GAINS. The pot and the bonus were being
                shown without subtracting the player's OWN ante, which they put in and therefore do
                not gain. Measured against a live 4P sweep (room 2LYE): gross 200 + bonus 50 = 250
                on screen while the server credited the sweeper +200 — the gap was exactly the
                ante, 25 x 2 boards. Every other chip figure in the game (chips_delta, hand_net,
                the /results summary) is net; this was the odd one out.
                Shared by SOLO and MULTIPLAYER, so both paths are corrected here. */}
            {t().winAll(
              potPerBoard * boardCount * numberOfPlayers
              + Math.floor((potPerBoard * boardCount * numberOfPlayers * getCompleteBonusPercent(boardCount, 50)) / 100)
              - potPerBoard * boardCount
            )}
          </Text>
        </View>
      )}

      {/* Auto-Place ALL — one-tap fill of every empty board. The per-board ⚡ chips on each
          Board header stay; this is an additive convenience. Sits in the winAllBanner slot
          (above the action bar), shown only while boards still have empty slots. */}
      {/* autoAllBar DELETED 2026-08-15 (BUILD-OPTION-A). It was an absolute overlay pinned to
          the viewport bottom, which left the pill floating alone in a bare band between two
          navy panels — belonging to neither, and the thing Roye photographed three times. The
          control now lives in the hand panel's own header row (PlayerHand), right-aligned,
          mirroring the per-board `Auto-Place` chip. Deleted rather than hidden: an orphaned
          overlay is how this file accumulated three copies of one wrong constant. */}

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
          {/* BW1 — THE ACTUAL ACTION BUTTON. Four elements render the text "✓ READY"; the other
              three are status. Mistaking the header chip for this button produced the "primary
              action is 10px" finding. Anchor here, never match on the text. */}
          <Pressable
            testID="ready-button"
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
    paddingHorizontal: rsBase(16),
    gap: rsBase(4),
  },
  handZone: {
    // PR-D study: explicit hand-zone height + gold hairline above with horizontal
    // margin (rsBase(12)) so the separator reads as a divider, not a full border.
    height: HAND_ZONE_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
    marginHorizontal: PRD.zone.hairlineMarginH,
  },
  boardsGrid: {
    // PR-D study: 2x2 grid. NOTE: do NOT use container `gap` with `width: '50%'`
    // cells — RN computes 50% relative to content box, then adds gap, so total
    // becomes 100% + gap and the row wraps. Instead, each cell carries
    // padding = rsBase(3) and adjacent cells produce a visible gutter of rsBase(6).
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
    // PR-D study: 2x2 cells. Each cell takes exactly 50% width; the rsBase(3)
    // padding on each side produces the rsBase(6) gutter to the sibling cell.
    // PR-K: dropped minHeight floor so cell can shrink on small phones when
    // boardCount >= 4 needs 2 rows. height is set inline via boardCount check
    // (see boards.map above). overflow: hidden so Board content that's too tall
    // for the shrunken cell clips visually instead of pushing the layout.
    width: '50%',
    paddingHorizontal: rsBase(3),
    paddingVertical: rsBase(3),
    overflow: 'hidden',
  },
  boardCellThird: {
    width: '33.333%',
    minHeight: PRD.board.cellHCap,
    paddingHorizontal: rsBase(3),
    paddingVertical: rsBase(3),
  },
  selectionHint: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: rfBase(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rsBase(4),
  },
  firstTimeHint: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: rsBase(4),
    paddingHorizontal: rsBase(12),
    alignItems: 'center',
    marginHorizontal: rsBase(4),
    borderRadius: rvBase(8),
  },
  firstTimeHintText: {
    color: '#FFFFFF',
    fontSize: rfBase(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: rfBase(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rsBase(4),
  },
  timeBankBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rvBase(16),
    paddingHorizontal: rsBase(16),
    paddingVertical: rsBase(5),
    marginBottom: rsBase(2),
  },
  timeBankText: {
    color: COLORS.gold,
    fontSize: rfBase(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  winAllHint: {
    textAlign: 'center',
    color: COLORS.goldBright,
    fontSize: rfBase(11),
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
    paddingHorizontal: rsBase(16),
    paddingVertical: rsBase(2),
    zIndex: 99, // below the action bar (100) so the bar's border still shows
  },
  floatingActions: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 2 — border-top hairline gold → mint
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rsBase(12),
    paddingHorizontal: rsBase(20),
    paddingVertical: rsBase(10),
    minHeight: PRD.zone.actionBarH,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(79,214,168,0.30)',
    zIndex: 100,
    elevation: 12,
  },
  floatingBtn: {
    paddingVertical: rsBase(14),
    paddingHorizontal: rsBase(28),
    minHeight: rsBase(52),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rbBase(12),
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
    // VAMOS-PLACEMENT-POLISH-2 FIX 2 — THIS is the bottom Cancel button (BoardArrangement
    // is where the placement commit bar lives — NOT game.tsx undoBtn which is a
    // different element). Was gold-on-dark-brown clash; now mint outline on neutral
    // dark fill so it pairs with the mint Confirm.
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: COLORS.mint,
    alignItems: 'center',
  },
  placeBtn: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 6 — "PLACE N CARDS" / "CONFIRM" pill: gold → mint solid
    backgroundColor: COLORS.mint,
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.mint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  placeBtnDisabled: {
    // VAMOS-PLACEMENT-POLISH-2 — solid muted mint (not COLORS.goldDim opacity hack)
    backgroundColor: 'rgba(79,214,168,0.35)',
    opacity: 1,
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
    fontSize: rfBase(16),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  // autoAllBar / autoAllBtn / autoAllText / autoAllBolt DELETED 2026-08-15 (BUILD-OPTION-A).
  // The chip now lives in PlayerHand's header row, styled to match the per-board control
  // (radius 6, padding 1px 6px, font 11/800 mint) rather than the old radius-20 floating pill.
  undoBtnText: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 2 — gold #F5C842 → mint
    color: COLORS.mint,
  },
  placeBtnText: {
    color: COLORS.background,
  },
  continueBtn: {
    position: 'absolute',
    bottom: rsBase(100),
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: rsBase(14),
    paddingHorizontal: rsBase(40),
    borderRadius: rvBase(24),
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
    fontSize: rfBase(16),
    fontWeight: '900',
    letterSpacing: 2,
  },
});
