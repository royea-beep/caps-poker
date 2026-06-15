import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, Animated as AnimatedRN, AppState } from 'react-native';
import { SCREEN_W as MODULE_SCREEN_W, SCREEN_H as MODULE_SCREEN_H } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { setCurrentScreen, trackAction } from '../utils/crash-evidence';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  FadeIn,
  cancelAnimation,
} from 'react-native-reanimated';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useGameStore } from '../store/gameStore';
import { getTheme } from '../constants/visualThemes';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount, CARD_SCALE, getCardDimensions } from '../constants/gameConfig';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { getMatchCost } from '../utils/economy';
import {
  BoardState,
  initializeGameMulti,
  placeSingleBotCards,
  autoFillPlayerCards,
  calculateHandResultsMulti,
} from '../utils/gameLogic';
import { GamePhase, RevealBoardData } from '../types/gameTypes';
import { playSound, startAmbient, stopAmbient } from '../utils/sounds';
import { track } from '../utils/analytics';
import { sortHand } from '../utils/sortHand';
import { CapsHooks } from '../utils/learning';
import { FriendsBg } from '../components/FriendsBg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markAppActive as markGameActive } from '@caps/debugger';
import { getSupabase } from '../utils/supabase';
import { debugLog } from '../components/DebugOverlay';
import { onGameStart, onGameEnd } from '../utils/crashDetector';
import { scheduleReengagement } from '../utils/notifications';
import { rv as rvOld } from '../constants/deviceBreakpoints';
import { rf, rh, rs, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import BoardReveal from '../components/BoardReveal';
import GuidedTooltip from '../components/GuidedTooltip';
import { TimerController, TimerBar } from '../components/TimerController';
import { BoardArrangement } from '../components/BoardArrangement';
import { useLevelStore } from '../stores/levelStore';

const GAMES_PLAYED_KEY = 'caps_games_played';
const GUIDED_FORCED_KEY = 'guidedModeForced';

// Tooltip text — inline EN/HE
const TIP = (en: string, he: string) => getLanguage() === 'he' ? he : en;
const TIPS = [
  () => TIP('These are your cards. Place 4 on each board.', 'אלה הקלפים שלך. תשים 4 על כל לוח.'),
  () => TIP('Tap a card, then tap an empty slot.', 'לחץ על קלף, ואז על מקום ריק.'),
  () => TIP('Nice! 3 more cards on this board.', 'יופי! עוד 3 קלפים על הלוח הזה.'),
  () => TIP('Hand strength shown here. Better hands win more!', 'עוצמת היד מוצגת כאן. ידיים טובות יותר מנצחות יותר!'),
  // Tip 5 (index 4) — 2-of-4 rule explainer. autoDismissMs=6000 in JSX.
  () => TIP(
    'The game picks your BEST 2 cards + 3 from the board automatically. You don\'t choose — the strongest combination wins!',
    'המשחק בוחר אוטומטית 2 קלפים הכי טובים שלך + 3 מהלוח. אתה לא צריך לבחור — השילוב הכי חזק מנצח!'
  ),
  () => TIP('All set! Tap READY to reveal.', 'הכל מוכן! לחץ READY כדי להציג.'),
];

// Log crash steps to Supabase so we know which step ran last before native kill
async function logStep(step: string, extra?: string) {
  debugLog(`[STEP] ${step}${extra ? ` — ${extra}` : ''}`);
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('bug_reports').insert({
      title: `[CRASH-STEP] ${step}`,
      description: extra ?? null,
      url: 'game/navigateToReveal',
      report_type: 'text',
    });
  } catch { /* silent — never block game flow */ }
}

// Lazy-load expo-haptics — not available on web
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not available (web) — haptics disabled
}

const haptic = (style: any) => {
  Haptics?.impactAsync?.(style)?.catch?.(() => {});
};
const hapticNotify = (type: any) => {
  Haptics?.notificationAsync?.(type)?.catch?.(() => {});
};

const COUNTDOWN_SECONDS = 30;

// Layout constants — PR-M aggressive vertical budget (2026-05-29).
// Top chrome (header + bot bar) collapsed to rh(56); FLOATING_ACTIONS to rs(56).
// Boards consume everything else so 3p vertical-stack stops clipping board 3.
const TOP_CHROME_H = PRD.zone.topChromeH;          // rh(56) — PR-M
const TOP_BAR_H = Math.round(TOP_CHROME_H * 36 / 56);  // ~36/56 = top button row
const BOT_STATUS_H = Math.round(TOP_CHROME_H * 20 / 56);// ~20/56 = bot pill row
const FLOATING_ACTIONS_H = PRD.zone.actionBarH;    // rs(56) — PR-M
const HINT_H = 22;                                  // selectionHint / boardError bar
const BOARD_CHROME = 28;                            // per-board chrome budget (was 40)

function GameScreenInner() {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand, demo } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string; demo?: string }>();
  // C-fix 2026-05-22: lock dimensions at module load (responsive.ts) instead of
  // useWindowDimensions(). Game is portrait-locked, so live-resize subscription is
  // not needed and was the source of card-size jitter during keyboard/focus events.
  const SCREEN_H = MODULE_SCREEN_H;
  const screenW = MODULE_SCREEN_W;
  const insets = useSafeAreaInsets();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const playerLevel = useLevelStore((s: any) => s.level) ?? 1;
  const storeOrientation = useGameStore((s) => s.orientation);
  const handSortMethod = useGameStore((s) => s.handSortMethod);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const isLandscape = false; // S86: portrait-only — Iron Rule 2
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);

  const numberOfPlayers = config.numberOfPlayers as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // FIT-ALL-BOARDS 2026-06-09 — Settings-controlled max board card height.
  // Persisted in AsyncStorage under 'max_board_card_h_dp'. Default rh(70) gives
  // ~70dp on the iPhone 15/16 base viewport (852pt height). User can adjust in
  // Settings within the [50, 100] range (dp at base). Re-checked on AppState
  // changes so toggling the setting mid-session takes effect without a restart.
  const BOARD_CARD_CAP_DEFAULT = rh(70);
  const BOARD_CARD_CAP_MIN = rh(50);
  const BOARD_CARD_CAP_MAX = rh(100);
  const [boardCardCapDp, setBoardCardCapDp] = useState<number>(BOARD_CARD_CAP_DEFAULT);
  useEffect(() => {
    let alive = true;
    const recheck = () => {
      AsyncStorage.getItem('max_board_card_h_dp')
        .then((v) => {
          if (!alive) return;
          const n = v ? parseFloat(v) : NaN;
          if (Number.isFinite(n) && n >= BOARD_CARD_CAP_MIN && n <= BOARD_CARD_CAP_MAX) {
            setBoardCardCapDp(n);
          } else {
            setBoardCardCapDp(BOARD_CARD_CAP_DEFAULT);
          }
        })
        .catch(() => {});
    };
    recheck();
    const sub = AppState.addEventListener('change', recheck);
    const t1 = setTimeout(recheck, 1500);
    const t2 = setTimeout(recheck, 4000);
    return () => { alive = false; sub.remove(); clearTimeout(t1); clearTimeout(t2); };
  }, [BOARD_CARD_CAP_DEFAULT, BOARD_CARD_CAP_MIN, BOARD_CARD_CAP_MAX]);

  // Player hand: 2 rows of cards + label. Card height ≈ round(min(36,max(28,availW/8)) * 1.4)
  // Approximate by screen height bracket: smaller phones Â smaller cards Â shorter hand section
  // PR-K v9 — web reserves more so hand has its 2-row footprint; boards get the rest.
  // PR-N 2026-06-02 — anchor PLAYER_HAND_H to PRD.zone.handMinH directly so the JS
  // boards-zone math matches what BoardArrangement actually renders for the handZone.
  // Previous mismatch (game.tsx 120, BoardArrangement 187) was the silent under-allocation
  // that pushed Board 3 placement slots off-screen on build 459. handMinH is now
  // max(rh(100), 0.16*SCREEN_H) and capped above by handMaxH = 0.28*SCREEN_H.
  // 2026-06-08 Fix — per-boardCount hand-zone height.
  // Previously PLAYER_HAND_H = global PRD.zone.handMinH (337dp on 844 viewport),
  // sized for the 2p worst case (16-card 4×4 grid). 4p mode only has 8 cards
  // (2 rows × 4 cols, ~168dp content) — leaving 172dp of dead space inside the
  // outer hand zone. Roye device review of build 465 flagged this dead band
  // below the hand.
  //
  // Fix: shrink hand zone per-boardCount.
  // - boardCount === 2 (4p): 8 cards, 2 rows × 4 cols, ~168dp content → 170dp.
  // - boardCount === 3 (3p): 12 cards, 2 rows × 6 cols, ~168dp content → 175dp
  //   (slight extra for 2x6 wrapping; freed ~162dp moves to boards).
  // - boardCount === 4 (2p): keeps existing 4×4 worst case until next pass.
  // 3-board placed-card clearance pass: lower 3p hand from 175 -> 162 so
  // boards-zone grows ~13dp. Each cell ends up ~164dp tall. Then BoardArrangement
  // hints Board with cellHeight - 12 (safety pad), Board math sizes cards into
  // 152dp inner so placed cards have ~6dp clearance above + below the gold border.
  // 4-board (boardCount===4 / 2-player / 2×2 grid + 4×4 hand) — 290dp was 7dp
  // SHORT (initial math missed cardWrapper.borderWidth 2*2=4dp/row × 4 rows = 16dp
  // and grid.gap 2dp × 3 = 6dp). Real minimum: 4*62 + 18(label) + 3(label-mb) +
  // 6(container-padV) + 6(row gaps) + 16(cardWrapper borders) = 297dp.
  // Bumped to 305dp (8dp buffer). Boards-zone shrinks 15dp → cell h drops
  // from ~188 to ~181 (still 25dp+ clearance, well above 6dp target).
  // Wrap each tuned literal (designed against 844-height viewport) in rh() so
  // it scales proportionally on shorter (568/667) and taller (932) screens.
  // BC4-STACK-REBALANCE 2026-06-09 — bc=4 (2-player) was rh(305) for the 16-card
  // 4x4 hand grid. New design switches bc=4 to 1x4 vertical board stack + 2-row
  // hand (8x2). Lower hand height pushes the freed vertical room into the boards
  // zone. rh(125) gives â¥5dp margin at 320 (worst case: hand cardH 23 + chrome
  // 31 = 54 content vs 83 zone) and accommodates the 2x8 layout up to 430 width.
  const PLAYER_HAND_H = boardCount === 2
    ? rh(170)
    : boardCount === 3
      ? rh(162)
      : boardCount === 4
        ? rh(125)
        : Math.min(PRD.zone.handMinH, PRD.zone.handMaxH);

  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - FLOATING_ACTIONS_H - HINT_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  // Mobile web card height scales with board count — more boards = tighter = needs clarity boost
  // Mobile web card height: width-aware so 5 community cards fit in 2-column board grid.
  // Board column overhead (reduced padding in BoardArrangement + Board) approx 26px.
  // cardRow: 5 cards + 4 gaps(6) + separator(7) = 31px overhead inside card row.
  const _boardColW = Math.max(80, Math.floor(screenW / 2) - 26);
  const _maxMobileWebCw = Math.max(18, Math.floor((_boardColW - 31) / 5));
  const _maxMobileWebCh = Math.round(_maxMobileWebCw / 0.72);
  // PR-K — 2x2 layout means each cell only gets half the vertical space.
  // Tighten the per-card height when 4 boards share a 2x2 grid so the
  // community-cards row + 4 player-slot rows still fit inside the smaller cell.
  // Compute the available cell height from SCREEN_H and shrink BOARD_CARD_H to
  // (cellH - board-chrome) / (communityScale + 4 * slotRatio + padding).
  // slotRatio ≈ 0.7 (Board renders 4 player slots vertically per board).
  // Fall back to the existing width-driven cap when the height calc would be larger.
  // PR-M 2026-05-29 — per-boardCount grid math anchored to ACTUAL chrome cost.
  //   boardCount=2 (4p): 2 rows x 1 col
  //   boardCount=3 (3p): 3 rows x 1 col
  //   boardCount=4 (2p): 2 rows x 2 cols
  //
  // Previous formula subtracted FLOATING_ACTIONS_H AND used a tight chrome
  // estimate that did not match the rendered topBar/botSection padding +
  // borders + the handZone marginBottom (which reserves the action bar
  // overlay). Web verification at 320x3p showed board 3 clipping ~40px
  // because of the gap. New formula: action bar is reserved by hand
  // marginBottom (rs(76)), and we add a conservative rs(28) safety buffer
  // for invisible chrome (border lines, Animated.View entering wrappers).
  // PR-N 2026-06-02 — 4-board (2P) 2x2 grid only when the projected per-cell
  // width is wide enough for the 4-slot placement row (Card.tsx 44pt floor
  // for non-community cards). 4 slots * 44 + 3 gaps * 3 + 8 cell padding = 193.
  // Below that, drop to 4-row vertical stack so slots never clip.
  // Wrap layout literals in rs() so the grid math scales with viewport width.
  // The breakpoint (>= 180) is a logical-pixel slot-floor threshold, not a token.
  const _gridGap = rs(4);
  const _gridSidePadIfWide = rs(8);
  const _projectedCellW2x2 = Math.floor((screenW - _gridSidePadIfWide - _gridGap) / 2);
  // BC4-STACK-REBALANCE 2026-06-09 — bc=4 now uses the 1x4 full-width stack like
  // bc=2/3, matching the user-requested visual consistency. _use2x2 retained for
  // type-stability but always false; PR-N's half-width 2x2 path is retired.
  const _use2x2 = false;
  const _gridRows = boardCount;
  const _gridCols = 1;
  void _projectedCellW2x2; // referenced only for the retired 2x2 size gate; keep computed for potential reinstatement
  // FIT-ALL-BOARDS 2026-06-09 — _handMarginB was rs(60) but BoardArrangement.tsx:219
  // actually applies `(rs(72) + insets.bottom + rs(8)) + (bc=4 ? rs(40) : 0)` —
  // ~54–94dp larger than the estimate. The discrepancy made _boardsZoneH believe
  // it had ~94dp more room than the real boardsGrid container, causing cellH to
  // overflow and `boardsGrid overflow:'hidden'` to silently clip boards 3/4 on bc=4
  // and the bottom of board 3 on bc=3. Re-align with the actual literal:
  // BC4-STACK-REBALANCE 2026-06-09 — the bc=4 +rs(40) extra was added when bc=4
  // used a 4x4 hand grid that needed to be pushed above the action bar. The new
  // 2x8 hand is short enough not to need it; drop the special case.
  const _handMarginB = rs(72) + insets.bottom + rs(8);
  const _chromeSafety = rs(28); // padding/borders/FadeIn wrapper overhead
  const _gridSidePad = _gridSidePadIfWide;

  // FIT-ALL-BOARDS 2026-06-09 — boards-first allocation. Compute the minimum
  // boards-zone height needed to fit `_gridRows` board cells, each carrying:
  //   chrome per cell (header + paddings + borders + cell wrapper padV) ≈ rs(34)
  //   + 2 card rows of MIN_BOARD_CARD_H (so the smallest readable layout fits)
  //   + rowGap rs(2)
  // If the boards-zone derived from PLAYER_HAND_H is below this floor, REDUCE the
  // hand zone instead of clamping the boards-zone (the old Math.max(rh(180), …)
  // floor faked extra boards-zone height that the parent flex container did NOT
  // actually have, leading to clipped boards). Boards have priority.
  const MIN_BOARD_CARD_H = rh(22); // tight readable minimum (~22dp@852, scales)
  const CELL_CHROME_V = rs(34);    // HEADER_H rs(16) + 2*PAD_V rs(4) + container border rs(4) + cell wrapper padV rs(4) + pressableInner padV rs(4) + rowGap rs(2)
  const _minCellH = 2 * MIN_BOARD_CARD_H + CELL_CHROME_V;
  const _minBoardsZoneH = _gridRows * _minCellH + (_gridRows - 1) * _gridGap + rs(8); // +rs(8) safety
  const _availForBoardsAndHand = safeH - TOP_BAR_H - BOT_STATUS_H - _handMarginB - HINT_H - _chromeSafety;
  // Step 1: tentative boards-zone using the preferred PLAYER_HAND_H.
  let _boardsZoneH = _availForBoardsAndHand - PLAYER_HAND_H;
  // Step 2: if boards-zone fell below the minimum, give boards priority — shrink hand.
  if (_boardsZoneH < _minBoardsZoneH) _boardsZoneH = _minBoardsZoneH;
  // Step 3: the hand zone is whatever remains.
  const _handZoneActualH = Math.max(rh(80), _availForBoardsAndHand - _boardsZoneH);

  // Packed cellH — what each cell would get if cells filled the full boards zone.
  const _packedCellH = Math.max(rh(48), Math.floor((_boardsZoneH - (_gridRows - 1) * _gridGap) / _gridRows) - rs(4));
  const _cellW = Math.max(rs(80), Math.floor((screenW - _gridSidePad - (_gridCols - 1) * _gridGap) / _gridCols));
  const _boardChromeH = rh(32); // board label + flop separator + intra-row padding
  const _rowsPerBoard = 1 + 0.7 * 4; // 1 community row scaled + 4 slot rows scaled

  // VISUAL-POLISH 2026-06-09 — board card height + SNUG cell height.
  // Step 1: derive the board card height the packed cell could hold, clamped by
  // the Settings cap (`max_board_card_h_dp`, default rh(70), range [rh(50), rh(100)]).
  // Step 2: idealCellH = chrome + 2*boardCardH (what the cell actually needs to
  // render the two card rows with snug chrome). When cap binds (bc=2 on most
  // devices), idealCellH < packedCellH and the cell SHRINKS — the leftover
  // becomes inter-board spacing via boardsGrid's justifyContent:'space-evenly'
  // (no more 8-10dp internal dead band above/below cards).
  const _maxBoardCardSetting = boardCardCapDp;
  const _cellHeightPropForPacked =
    boardCount === 3 || boardCount === 4
      ? Math.max(rs(48), _packedCellH - rs(12))
      : _packedCellH;
  const _packedInnerH = Math.max(40, _cellHeightPropForPacked - rs(16) - 2 * rs(2));
  const _fitBoardCardH = Math.max(rh(22), Math.floor((_packedInnerH - rs(2)) / 2));
  const _boardCardH = Math.min(_fitBoardCardH, _maxBoardCardSetting);
  // Ideal cellH that snugly fits exactly 2*_boardCardH + chrome. The bc=3/4 path
  // accounts for the rs(12) outer chrome compensated by BoardArrangement.tsx:188.
  const _idealCellH =
    2 * _boardCardH
    + rs(16)            // HEADER_H
    + 2 * rs(2)         // PAD_V
    + rs(2)             // rowGap
    + (boardCount === 3 || boardCount === 4 ? rs(12) : 0) // bc=3/4 outer chrome that the prop subtraction will reclaim
    + rs(4);            // safety
  const _cellH = Math.min(_packedCellH, _idealCellH);
  const _maxCellCardH = Math.max(18, Math.floor((_cellH - _boardChromeH) / _rowsPerBoard));
  const _handCardCap = _boardCardH;
  const mobileWebCardH = Math.min(
    CARD_SCALE[numberOfPlayers]?.cardHeight ?? 60,
    _maxMobileWebCh,
    boardCount >= 4 ? _maxCellCardH : 9999,
  );
  const nativeCardDims = getCardDimensions(screenW, numberOfPlayers);
  const communityScale = nativeCardDims.communityScale;
  // Cap native card height so both card rows (community + player/slots) fit in boardSpace.
  // During arrangement: commH = ch*communityScale, slotH = ch*0.7, plus 4pt cardRow padding.
  // ch*(communityScale + 0.7) + 4 <= boardSpace Â maxCh = floor((boardSpace-4)/(communityScale+0.7))
  // Landscape uses a 2-column grid with more height per row — no cap needed there.
  const CARD_ROW_PAD = 4;
  const maxNativeCardH = Math.max(28, Math.floor((boardSpace - CARD_ROW_PAD) / (communityScale + 0.7)));
  const nativeCardH = isLandscape
    ? nativeCardDims.cardHeight
    : Math.min(nativeCardDims.cardHeight, maxNativeCardH);
  const BOARD_CARD_H = rvOld(
    screenW,
    mobileWebCardH,              // mobile web (iPhone Safari) — board-count aware
    72,                          // tablet web
    100,                         // desktop web
    nativeCardH,                 // native — height-capped so AUTO button is always visible
  );
  const isWeb = Platform.OS === 'web';

  const [gamesPlayed, setGamesPlayed] = useState(99); // default high so hint is hidden until loaded
  const [isFirstGame, setIsFirstGame] = useState(false);
  const [tooltipStep, setTooltipStep] = useState(0); // 0 = none shown yet, 1-5 = current tip index
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const boardErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-board shake animations (max 4 boards)
  const shake0 = useSharedValue(0);
  const shake1 = useSharedValue(0);
  const shake2 = useSharedValue(0);
  const shake3 = useSharedValue(0);
  const shakeStyle0 = useAnimatedStyle(() => ({ transform: [{ translateX: shake0.value }] }));
  const shakeStyle1 = useAnimatedStyle(() => ({ transform: [{ translateX: shake1.value }] }));
  const shakeStyle2 = useAnimatedStyle(() => ({ transform: [{ translateX: shake2.value }] }));
  const shakeStyle3 = useAnimatedStyle(() => ({ transform: [{ translateX: shake3.value }] }));
  const boardShakes = [shake0, shake1, shake2, shake3];
  const boardShakeStyles = [shakeStyle0, shakeStyle1, shakeStyle2, shakeStyle3];
  const [phase, setPhase] = useState<GamePhase>({ type: 'arranging', timeLeft: 0 });
  const [playerReady, setPlayerReady] = useState(false);
  // D1: auto-place trail — flash when cards are auto-placed on timeout
  const autoPlaceFlashAnim = useRef(new AnimatedRN.Value(0)).current;
  const [timeBankUsed, setTimeBankUsed] = useState(false);

  // New timer logic: no timer at start, 30s countdown when first player finishes
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [firstFinisher, setFirstFinisher] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playerHandRef = useRef(playerHand);
  const boardsRef = useRef(boards);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [autoPlaceToastVisible, setAutoPlaceToastVisible] = useState(false);
  const [showSafeReveal, setShowSafeReveal] = useState(false);
  const [pendingRevealBoards, setPendingRevealBoards] = useState<Array<{
    winner: 'player'|'bot'|'tie';
    playerHandName: string;
    botHandName: string;
    allBotHandNames: string[];
    openCards: Card[];
    closedCards: Card[];
    playerCards: Card[];
    botCards: Card[];
    allBotCards: Card[][];
    potAmount: number;
    playerHighlightIds: string[];
    botHighlightIds: string[];
    boardHighlightIds: string[];
  }>>([]);
  // BUILD467-VERIFY / FIT-ALL-BOARDS / BC4-STACK-REBALANCE / VISUAL-POLISH:
  // layout debug readout. Build 470 confirmed the readout RENDERS when forced on;
  // re-gated here so the overlay is OFF by default and only appears when the
  // Settings â "Debug overlay" toggle (-> AsyncStorage `debug_overlay_enabled`)
  // is true. The AppState 'change' listener + 3 staggered re-checks below pick up
  // toggle changes without requiring the user to back out + re-enter the game.
  const LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC = false;
  const [layoutDebugVisible, setLayoutDebugVisible] = useState<boolean>(LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC);
  useEffect(() => {
    if (LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC) return; // unconditional
    let alive = true;
    const recheck = () => {
      AsyncStorage.getItem('debug_overlay_enabled')
        .then((v) => { if (alive) setLayoutDebugVisible(v === 'true'); })
        .catch(() => {});
    };
    recheck();
    const sub = AppState.addEventListener('change', recheck);
    const t1 = setTimeout(recheck, 1500);
    const t2 = setTimeout(recheck, 3500);
    const t3 = setTimeout(recheck, 6000);
    return () => { alive = false; sub.remove(); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC]);

  const precalculatedResultsRef = useRef<ReturnType<typeof calculateHandResultsMulti> | null>(null);
  const hasNavigatedRef = useRef(false);
  const playerReadyRef = useRef(false);
  // FIX 4: double-tap guard on deal button — prevents two handleReady calls before setState re-renders
  const isDealingRef = useRef(false);
  const botsReadyCountRef = useRef(0);
  const adaptiveDifficultyRef = useRef<string>(config.botDifficulty ?? 'easy');

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]); // no cleanup needed — sync ref update
  useEffect(() => { boardsRef.current = boards; }, [boards]); // no cleanup needed — sync ref update

  const isArranging = phase.type === 'arranging' && !playerReady;

  // ÂÂ Guided first game tooltips ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ
  const advanceTooltip = useCallback(() => {
    setTooltipVisible(false);
    // Tip 2 auto-shows 300ms after tip 1 dismissed — handled by step watcher below
  }, []);

  // Tip 1 — cards dealt (step 0 Â 1)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 0 || playerHand.length === 0) return;
    const id = setTimeout(() => { setTooltipStep(1); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, playerHand.length]);

  // Tip 2 — auto after tip 1 dismissed (step 1 Â 2, tooltipVisible just became false)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 1 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(2); setTooltipVisible(true); }, 300);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 3 — first card placed (step 2 Â 3)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 2) return;
    const anyCardPlaced = boards.some((b) => b.playerCards.length >= 1);
    if (!anyCardPlaced) return;
    const id = setTimeout(() => { setTooltipStep(3); setTooltipVisible(true); }, 200);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 4 — first board full (step 3 Â 4)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 3) return;
    const hasFullBoard = boards.some((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!hasFullBoard) return;
    const id = setTimeout(() => { setTooltipStep(4); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 5 — auto after tip 4 dismissed (step 4 Â 5): 2-of-4 rule explainer
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 4 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(5); setTooltipVisible(true); }, 400);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 6 — all boards full (step 5 Â 6): ready to submit
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 5) return;
    const allFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!allFull) return;
    const id = setTimeout(() => { setTooltipStep(6); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);
  // ÂÂ End guided tooltips ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ

  // Start 30s countdown
  const startCountdown = useCallback((finisherName: string) => {
    if (countdownRef.current) return; // already running
    setFirstFinisher(finisherName);
    setCountdownActive(true);
    setCountdown(COUNTDOWN_SECONDS);
    playSound('timerLow');
    track('cards_placed', {}, 'game');

    countdownRef.current = setInterval(() => {
      // Guard: component may have unmounted between ticks (iOS New Architecture)
      if (!mountedRef.current) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        return;
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Pre-calculate results in background as soon as countdown starts (first finisher done)
  // By the time both are ready, results are already computed Â zero-wait navigation
  // IMPORTANT: must guard BOTH bot cards AND player cards — pre-calc fires when the first
  // finisher triggers the countdown. If bot finishes first, playerCards is still empty Â
  // evaluator returns "High Card" for every player hand (the S48 stale result bug).
  useEffect(() => {
    if (!countdownActive) return;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        const botsDone = boardsRef.current.every((b) =>
          b.allBotCards.every((bc) => bc.length >= CARDS_PER_BOARD)
        );
        const playerDone = boardsRef.current.every((b) =>
          b.playerCards.length >= CARDS_PER_BOARD
        );
        if (!botsDone || !playerDone) {
          debugLog('[GAME] pre-calc skipped — cards not fully placed yet, will calc fresh on navigate');
          return;
        }
        precalculatedResultsRef.current = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);
        debugLog('[GAME] pre-calculation done during countdown');
      } catch (e) {
        debugLog(`[GAME] pre-calculation failed — will recalculate on navigate: ${e}`, 'warn');
        precalculatedResultsRef.current = null;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [countdownActive]);

  // Countdown sound escalation: timerLow at 10s (from startCountdown), per-second at 5Â1, timerLow at 0
  // no cleanup needed — fire-and-forget sound/haptic calls, no subscriptions
  useEffect(() => {
    if (!countdownActive) return;
    // Per-second ticks from 5s down to 1s (escalating urgency)
    if (countdown === 10 || countdown === 3) playSound('timerLow'); // Only 2 beeps, not 5
    // Time up: play buzzer sound
    if (countdown === 0) {
      playSound('buzzer');
      haptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    }
  }, [countdownActive, countdown]);

  // When countdown hits 0 — auto-place remaining cards and navigate directly
  // no cleanup needed — one-time state transition, no subscriptions or timers
  useEffect(() => {
    if (countdownActive && countdown === 0 && !playerReady) {
      track('arrangement_timeout', {
        player_count: numberOfPlayers,
        board_count: boardCount,
        cards_remaining: playerHandRef.current.length,
      }, 'game');
      const shuffled = [...playerHandRef.current].sort(() => Math.random() - 0.5);
      const { boards: filledBoards, remainingHand } = autoFillPlayerCards(shuffled, boardsRef.current);
      setBoards(filledBoards);
      setPlayerHand(remainingHand);
      setSelectedCardIds([]);
      setPlayerReady(true);
      setPhase({ type: 'waiting_for_bot' });
      playerReadyRef.current = true;
      // D1: auto-place trail flash
      AnimatedRN.sequence([
        AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      // Navigate directly with the filled boards
      doNavigateRef.current(filledBoards);
    }
  }, [countdownActive, countdown, playerReady]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    debugLog(`game.tsx mounted — ${numberOfPlayers}p ${boardCount} boards`);
    setCurrentScreen('Game')
    onGameStart().catch(() => {});
    void startAmbient();
    return () => {
      mountedRef.current = false;
      debugLog('game.tsx unmounting');
      onGameEnd().catch(() => {});
      void stopAmbient();
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (boardErrorTimer.current) {
        clearTimeout(boardErrorTimer.current);
        boardErrorTimer.current = null;
      }
    };
  }, []);

  // Load games-played counter + guided mode flag
  // no cleanup needed — one-time AsyncStorage read, promise resolves after unmount harmlessly
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(GAMES_PLAYED_KEY),
      AsyncStorage.getItem(GUIDED_FORCED_KEY),
    ]).then(([gamesVal, guidedVal]) => {
      const played = parseInt(gamesVal ?? '0', 10);
      setGamesPlayed(played);
      const guided = played === 0 || guidedVal === 'true';
      setIsFirstGame(guided);
      if (guided && guidedVal === 'true') {
        // Clear forced flag — won't fire again unless Tutorial replayed
        AsyncStorage.removeItem(GUIDED_FORCED_KEY).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Initialize game
  // no cleanup needed — bot timers are pushed to timeoutsRef.current, cleared by the central cleanup effect above
  useEffect(() => {
    // Fetch adaptive bot difficulty (fire-and-forget — ref is read by bot timers below)
    void (async () => {
      try {
        const { getDeviceId: gdi } = await import('../utils/leaderboard');
        const deviceId = await gdi();
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.rpc('get_bot_difficulty', { p_device_id: deviceId });
        if (data) adaptiveDifficultyRef.current = data as string;
      } catch {}
    })();

    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);
    setBoards(initialBoards);
    setPlayerHand(sortHand(pHand, handSortMethod));
    setBotsReady(new Array(numberOfBots).fill(false));
    botsReadyCountRef.current = 0;
    playerReadyRef.current = false;
    isDealingRef.current = false;
    hasNavigatedRef.current = false;
    CapsHooks.gameStarted('solo');
    track('hand_dealt', { player_count: numberOfPlayers, board_count: boardCount }, 'game');

    // Deduct buy-in
    const buyIn = getMatchCost(config.potPerBoard, boardCount);
    addChips(-buyIn);
    if (ECONOMY_FLAGS.matchCostEnabled) {
      trackChipsSpent(buyIn);
    }

    // Bot timers — when first bot finishes, it triggers the countdown
    for (let botIdx = 0; botIdx < numberOfBots; botIdx++) {
      const delay = config.botSpeedMin + Math.random() * (config.botSpeedMax - config.botSpeedMin);
      const botCards = botHands[botIdx];
      const botTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        setBoards((prev) => placeSingleBotCards(botCards, prev, botIdx, adaptiveDifficultyRef.current as import('../utils/botStrategy').BotDifficulty));
        setBotsReady((prev) => {
          const updated = [...prev];
          updated[botIdx] = true;
          const anyPrevReady = prev.some(Boolean);
          // Solo: bots never start countdown â player has free thinking time
          return updated;
        });
        // If player already pressed READY and all bots are now done — navigate directly
        botsReadyCountRef.current++;
        if (playerReadyRef.current && botsReadyCountRef.current >= numberOfBots) {
          doNavigateRef.current(boardsRef.current);
        }
      }, delay);
      timeoutsRef.current.push(botTimer);
    }
  }, []);

  // Navigate to reveal — DIRECT (no InteractionManager, no async chain)
  // Called as soon as both player and all bots are ready.
  const doNavigate = useCallback((currentBoards: BoardState[]) => {
    debugLog('1 doNavigate called');
    if (hasNavigatedRef.current || !mountedRef.current) { debugLog('1.1 already navigated or unmounted — abort'); return; }
    debugLog('2 hasNavigatedRef=true');
    hasNavigatedRef.current = true;

    void logStep('doNavigate_start');

    debugLog('3 clearing countdown interval');
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    debugLog('4 calculateHandResultsMulti START');
    void logStep('A:start_calculate');

    let results;
    try {
      if (precalculatedResultsRef.current) {
        debugLog('4.1 using pre-calculated results');
        results = precalculatedResultsRef.current;
        precalculatedResultsRef.current = null;
      } else {
        debugLog('4.2 calculating fresh');
        results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);
      }
    } catch (e) {
      debugLog(`4E calculateHandResultsMulti CRASHED: ${String(e)}`, 'error');
      void logStep('CRASH:A', String(e));
      router.replace('/');
      return;
    }

    debugLog(`5 calculate DONE: won=${results.playerChipsWon} isComplete=${results.isComplete}`);
    void logStep('B:calculate_done', `boards=${currentBoards.length} won=${results.playerChipsWon}`);

    debugLog('6 building revealBoards');
    const revealBoards: RevealBoardData[] = currentBoards.map((board, i) => {
      debugLog(`6.${i + 1} board ${i}: ${results.boardResults[i]?.winner ?? 'tie'}`);
      const result = results.boardResults[i];
      return {
        openCards: board.openCards,
        closedCards: board.closedCards,
        playerCards: board.playerCards,
        allBotCards: board.allBotCards,
        winner: result ? result.winner : ('tie' as const),
        playerHandName: result?.playerResult.name || '',
        botHandName: result?.botResult.name || '',
        allBotHandNames: results.allBotResults[i]?.map((br) => br.name) || [],
        playerHighlightIds: result ? result.playerResult.playerCardsUsed.map((c) => c.id) : [],
        botHighlightIds: result ? result.botResult.playerCardsUsed.map((c) => c.id) : [],
        boardHighlightIds: result ? [
          ...result.playerResult.boardCardsUsed.map((c) => c.id),
          ...result.botResult.boardCardsUsed.map((c) => c.id),
        ] : [],
        potAmount: config.potPerBoard * numberOfPlayers,
      };
    });

    debugLog(`7 revealBoards done: ${revealBoards.length} boards`);
    void logStep('C:revealBoards_built');

    debugLog(`8 addChips: ${results.playerChipsWon}`);
    addChips(results.playerChipsWon);
    void scheduleReengagement(); // re-engagement notification after each game
    debugLog('9 addChips done');
    void logStep('D:addChips_done');

    debugLog('10 setRevealData START');
    setRevealData({
      boards: revealBoards,
      netChips: results.playerChipsWon - config.potPerBoard * boardCount,
      playerChipsWon: results.playerChipsWon,
      isComplete: results.isComplete,
      completeBonusAmount: results.completeBonusAmount,
      completeWinner: results.completeWinner,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers,
      boardCount,
    });
    debugLog('11 setRevealData DONE');
    void logStep('E:setRevealData_done');

    // A3: track last COMPLETE for home screen share banner
    if (results.isComplete) {
      AsyncStorage.setItem('last_was_complete', 'true').catch(() => {});
    }
    debugLog('12 CapsHooks.gameCompleted');
    CapsHooks.gameCompleted(results.playerChipsWon, results.playerChipsWon > 0, 0);
    debugLog('13 AsyncStorage update');
    AsyncStorage.getItem(GAMES_PLAYED_KEY).then(val => {
      const count = parseInt(val ?? '0', 10);
      AsyncStorage.setItem(GAMES_PLAYED_KEY, String(count + 1)).catch(() => {});
    }).catch(() => {});

    // Cancel all shake animations before navigation — prevents worklet overlap during transition
    cancelAnimation(shake0); shake0.value = 0;
    cancelAnimation(shake1); shake1.value = 0;
    cancelAnimation(shake2); shake2.value = 0;
    cancelAnimation(shake3); shake3.value = 0;

    // Mark game active before navigating to results — dirty shutdown detector
    debugLog('🎮 setting game active flag (dirty shutdown detector)');
    void markGameActive();

    // Show safe reveal overlay before navigating (skip in auto-sim to avoid delays)
    debugLog('14 showSafeReveal path — setting overlay');
    if (autoSim !== 'true') {
      const revealSummary = revealBoards.map((b) => ({
        winner: b.winner ?? 'tie' as const,
        playerHandName: b.playerHandName ?? '',
        botHandName: b.botHandName ?? '',
        allBotHandNames: b.allBotHandNames ?? [],
        openCards: b.openCards,
        closedCards: b.closedCards,
        playerCards: b.playerCards,
        botCards: (b.allBotCards?.[0]) ?? [],
        allBotCards: b.allBotCards ?? [],
        potAmount: b.potAmount,
        playerHighlightIds: b.playerHighlightIds ?? [],
        botHighlightIds: b.botHighlightIds ?? [],
        boardHighlightIds: b.boardHighlightIds ?? [],
      }));
      setPendingRevealBoards(revealSummary);
      setShowSafeReveal(true);
      return; // navigation happens from onRevealDone
    }

    debugLog('14 router.replace /results START');
    void logStep('F:before_router_replace');
    try {
      router.replace('/results' as any);
      debugLog('15 router.replace DONE');
      void logStep('G:router_replace_called');
    } catch (e) {
      debugLog(`14E router.replace CRASHED: ${String(e)}`, 'error');
      try { router.push('/results' as any); } catch { /* ignore */ }
    }
  }, [config, numberOfPlayers, boardCount, setRevealData, addChips, router, autoSim]);

  // Keep doNavigate in a ref so bot timers always call the latest version
  const doNavigateRef = useRef(doNavigate);
  useEffect(() => { doNavigateRef.current = doNavigate; }, [doNavigate]); // no cleanup needed — sync ref update

  const onRevealDone = useCallback(() => {
    debugLog('15 onRevealDone called - clearing overlay');
    setShowSafeReveal(false);
    setPendingRevealBoards([]);
    debugLog('16 navigating to results');
    void logStep('F:before_router_replace');
    // S111 bug#477: always navigate immediately — never block with Alert
    // daily reward is surfaced on results screen (streak badge) and index on next visit
    try {
      router.replace('/results' as any);
    } catch (e) {
      try { router.push('/results' as any); } catch {}
    }
  }, [router]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  // Tap card in hand Â toggle in selectedCardIds (up to 4)
  const handleSelectCard = useCallback(
    (card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setSelectedCardIds((prev) => {
        if (prev.includes(card.id)) {
          // Deselect
          return prev.filter((id) => id !== card.id);
        }
        if (prev.length < 4) {
          return [...prev, card.id];
        }
        // At max (4) — replace the last selected with new card
        return [...prev.slice(0, 3), card.id];
      });
    },
    [isArranging]
  );

  // Returns true if card is already placed on ANY board — cross-board duplicate guard
  const isCardOnAnyBoard = useCallback(
    (cardId: string, currentBoards: BoardState[]) =>
      currentBoards.some((b) => b.playerCards.some((pc) => pc.id === cardId)),
    []
  );

  // Tap board Â place all selectedCardIds (or first hand card if none selected)
  // FIX: compute cardsToPlace outside setBoards updater; call setPlayerHand separately
  // in same event handler so React batches all three setState calls together, eliminating
  // the intermediate render where a card appears in both the board and the hand.
  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;

      // Read board from current closure — safe since boards is a dep of this callback
      const board = boards[boardIndex];
      if (!board) return;

      const emptySlots = CARDS_PER_BOARD - board.playerCards.length;
      if (emptySlots <= 0) {
        // Board full — shake + error
        const sv = boardShakes[boardIndex];
        if (sv) {
          sv.value = withSequence(
            withTiming(-6, { duration: 55 }),
            withTiming(6, { duration: 55 }),
            withTiming(-4, { duration: 55 }),
            withTiming(0, { duration: 55 }),
          );
        }
        if (boardErrorTimer.current) clearTimeout(boardErrorTimer.current);
        setBoardError(t().boardFull);
        boardErrorTimer.current = setTimeout(() => setBoardError(null), 1500);
        return;
      }

      // Determine which cards to place, excluding any already on any board
      const candidateCards: Card[] = selectedCardIds.length > 0
        ? selectedCardIds
            .map((id) => currentHand.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined)
        : currentHand.slice(0, 1);

      const cardsToPlace = candidateCards
        .filter((c) => !isCardOnAnyBoard(c.id, boards))
        .slice(0, emptySlots);

      if (cardsToPlace.length === 0) return;

      haptic(Haptics?.ImpactFeedbackStyle?.Medium);
      playSound('cardPlace');
      const placedIds = new Set(cardsToPlace.map((c) => c.id));

      // All three setState calls are in the same synchronous event handler —
      // React 18 batches them into one render, preventing duplicate-card flicker
      setBoards((prev) => {
        const prevBoard = prev[boardIndex];
        if (!prevBoard) return prev;
        // Re-validate in updater: guard against stale closure AND cross-board duplicates
        const slots = CARDS_PER_BOARD - prevBoard.playerCards.length;
        const validCards = cardsToPlace.filter((c) =>
          !prev.some((b) => b.playerCards.some((pc) => pc.id === c.id))
        ).slice(0, slots);
        if (validCards.length === 0) return prev;
        const updated = [...prev];
        updated[boardIndex] = {
          ...prevBoard,
          playerCards: [...prevBoard.playerCards, ...validCards],
        };
        return updated;
      });
      setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
      setSelectedCardIds([]);
    },
    [isArranging, selectedCardIds, boards, isCardOnAnyBoard]
  );

  // Tap placed card Â remove from board
  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setBoards((prev) => {
        if (!prev[boardIndex]) return prev;
        const updated = [...prev];
        updated[boardIndex] = {
          ...prev[boardIndex],
          playerCards: prev[boardIndex].playerCards.filter((c) => c.id !== card.id),
        };
        return updated;
      });
      setPlayerHand((prev) => [...prev, card]);
    },
    [isArranging]
  );

  // AUTO fill — place first N available hand cards into an empty board
  // FIX: same batched setState approach as handleBoardPress + cross-board duplicate guard
  const handleAutoFill = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;
      const board = boards[boardIndex];
      if (!board || board.playerCards.length > 0) return;
      const slots = CARDS_PER_BOARD - board.playerCards.length;
      // Only place cards not already on any board
      const cardsToPlace = currentHand
        .filter((c) => !isCardOnAnyBoard(c.id, boards))
        .slice(0, slots);
      if (cardsToPlace.length === 0) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Medium);
      playSound('cardPlace');
      const placedIds = new Set(cardsToPlace.map((c) => c.id));
      setBoards((prev) => {
        const prevBoard = prev[boardIndex];
        if (!prevBoard || prevBoard.playerCards.length > 0) return prev;
        // Re-validate cross-board in updater
        const validCards = cardsToPlace.filter((c) =>
          !prev.some((b) => b.playerCards.some((pc) => pc.id === c.id))
        );
        if (validCards.length === 0) return prev;
        const updated = [...prev];
        updated[boardIndex] = { ...prevBoard, playerCards: [...prevBoard.playerCards, ...validCards] };
        return updated;
      });
      setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
      setSelectedCardIds([]);
    },
    [isArranging, boards, isCardOnAnyBoard]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    // FIX 4: debounce — prevent double-tap crash (two rapid presses before state update)
    if (isDealingRef.current) { debugLog('H0 handleReady DEBOUNCED - already dealing'); return; }
    isDealingRef.current = true;
    trackAction('deal_pressed');
    // Heatmap (D7)
    import('../utils/heatmap').then(({ trackEvent }) => {
      import('../utils/leaderboard').then(({ getDeviceId }) => {
        getDeviceId().then(id => trackEvent('game', 'deal_pressed', id)).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
    debugLog('H1 handleReady called');
    if (!allBoardsFull) { isDealingRef.current = false; debugLog('H1.1 NOT allBoardsFull — abort'); return; }
    debugLog(`H2 boards: ${boards.map(b => `${b.playerCards.length}/4`).join(' ')}`);
    void logStep('handleReady_pressed');
    debugLog('H3 hapticNotify');
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    debugLog('H4 playSound');
    playSound('cardSelect');
    debugLog('H5 setSelectedCardIds([])');
    setSelectedCardIds([]);
    debugLog('H6 setPlayerReady(true)');
    setPlayerReady(true);
    debugLog('H7 setPhase(waiting_for_bot)');
    setPhase({ type: 'waiting_for_bot' });
    debugLog('H8 playerReadyRef=true');
    playerReadyRef.current = true;
    debugLog(`H9 countdownActive=${countdownActive}`);
    if (!countdownActive) { debugLog('H9.1 startCountdown'); startCountdown('You'); }
    debugLog(`H10 botsReady=${botsReadyCountRef.current}/${numberOfBots}`);
    if (botsReadyCountRef.current >= numberOfBots) {
      debugLog('H10.1 all bots done — calling doNavigate');
      if (boardsRef.current && boardsRef.current.length > 0) {
        doNavigateRef.current(boardsRef.current);
      } else {
        debugLog('H10.1E boardsRef is empty — aborting doNavigate', 'error');
        isDealingRef.current = false;
      }
    } else {
      debugLog('H10.2 bots still running — waiting');
    }
  }, [allBoardsFull, boards, countdownActive, startCountdown, numberOfBots]);

  // Demo deep-link (caps-poker://game?demo=1): auto-fill all 4 boards + auto-ready,
  // so the iOS simulator auto-tour (ios-simulator-smoke.yml) can capture the full
  // game flow without an XCUITest target. Same shape as autoSim, simpler params.
  useEffect(() => {
    if (demo !== '1') return;
    debugLog('demo deep-link: auto-fill in 2s, ready in 4s');
    const t1 = setTimeout(() => {
      for (let i = 0; i < boardCount; i++) handleAutoFill(i);
    }, 2000);
    const t2 = setTimeout(() => { handleReady(); }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [demo]);

  // Auto-sim: auto-fill all boards + press Ready (debug marathon mode)
  useEffect(() => {
    if (autoSim !== 'true') return;
    const simCount = parseInt(autoSimCount ?? '1', 10);
    const currentHand = parseInt(currentSimHand ?? '1', 10);
    debugLog(`🤖 AUTO-SIM: hand ${currentHand}/${simCount} — auto-fill in 1.5s`);
    const t1 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: filling all boards');
      for (let i = 0; i < boardCount; i++) handleAutoFill(i);
    }, 1500);
    const t2 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: pressing READY');
      handleReady();
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [autoSim]);

  const handleBack = useCallback(() => {
    const leave = () => {
      router.replace('/');
    };

    // On web, Alert.alert uses window.confirm which is unreliable — navigate directly
    if (Platform.OS === 'web') {
      leave();
      return;
    }

    if (isArranging || phase.type === 'waiting_for_bot') {
      Alert.alert(
        t().leaveGame.title,
        t().leaveGame.body,
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leave },
        ]
      );
    } else {
      leave();
    }
  }, [isArranging, phase.type, router]);

  // Timer display
  const timerColor = countdown > 20
    ? '#4CAF50'
    : countdown > 10
    ? '#FFC107'
    : '#e74c3c';
  const timerPulsing = countdown <= 10 && countdown > 0;

  const readyBotCount = botsReady.filter(Boolean).length;
  const cardsRemaining = playerHand.length;
  const TIMER_SIZE = timerPulsing ? rv(64) : rv(52);

  // ÂÂ Landscape / widescreen layout ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ
  if (isLandscape) {
    return (
      <SafeAreaView style={[styles.container, landscapeStyles.root, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
        <FriendsBg />
        {/* watermark removed from game screen */}
        {/* LEFT — Your hand */}
        <View style={[landscapeStyles.leftPanel, visualTheme === 'fiveo' && { backgroundColor: theme.surface }]}>
          <View style={landscapeStyles.panelTitleRow}>
            <Text style={landscapeStyles.panelAvatarText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{playerAvatar}</Text>
            <Text style={landscapeStyles.panelTitle} accessibilityRole="header">{playerDisplayName.toUpperCase()}</Text>
          </View>
          {isArranging && (
            <PlayerHand
              cards={playerHand}
              selectedCardIds={selectedCardIds}
              onSelectCard={handleSelectCard}
            />
          )}
          {isArranging && (boardError || selectedCardIds.length > 0) && (
            <Text style={boardError ? styles.boardErrorText : styles.selectionHint} accessibilityLiveRegion={boardError ? 'assertive' : 'polite'}>
              {boardError
                ? boardError
                : `${selectedCardIds.length} selected`}
            </Text>
          )}
          {isArranging && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo last card placement"
              accessibilityState={{ disabled: boards.every((b) => b.playerCards.length === 0) }}
              style={[styles.floatingBtn, styles.undoBtn, { marginTop: 8 }]}
              onPress={() => {
                for (let i = boards.length - 1; i >= 0; i--) {
                  if (boards[i].playerCards.length > 0) {
                    const last = boards[i].playerCards[boards[i].playerCards.length - 1];
                    handleRemoveCardFromBoard(i, last);
                    break;
                  }
                }
              }}
              disabled={boards.every((b) => b.playerCards.length === 0)}
            >
              <Text style={[styles.floatingBtnText, boards.every((b) => b.playerCards.length === 0) && styles.floatingBtnDisabled]}>{t().undo}</Text>
            </Pressable>
          )}
        </View>

        {/* CENTER — boards grid */}
        <View style={landscapeStyles.centerPanel}>
          {/* Mini top bar */}
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Leave game" onPress={handleBack} style={[styles.backButton, { minHeight: 44, minWidth: 44 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{'\u2715'}</Text>
            </Pressable>
            <View style={styles.topCenter}>
              {countdownActive && isArranging && (
                <TimerController countdown={countdown} total={COUNTDOWN_SECONDS} isActive={countdownActive && isArranging} firstFinisher={firstFinisher} timerSize={timerPulsing ? 54 : 44} timerColor={timerColor} timerPulsing={timerPulsing} />
              )}
              {!countdownActive && isArranging && (
                <Text style={styles.freePlayLabel}>Arrange freely</Text>
              )}
              {playerReady && !allBotsReady && (
                <Text style={styles.waitingText} accessibilityLiveRegion="polite">{t().waitingForBots(numberOfBots)}</Text>
              )}
            </View>
            <View style={styles.headerChips}>
              <Text style={styles.headerChipsEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰</Text>
              <Text style={styles.headerChipsAmount}>{(chips ?? 0).toLocaleString()}</Text>
            </View>
          </View>

          {/* Boards — 2 columns */}
          <View style={[landscapeStyles.boardsGrid]}>
            {(boards ?? []).map((board, i) => (
              <Animated.View key={i} style={[landscapeStyles.boardCell, boardShakeStyles[i]]}>
                <Board
                  index={i}
                  openCards={board.openCards}
                  closedCards={board.closedCards}
                  playerCards={board.playerCards}
                  botCards={board.allBotCards[0] || board.botCards}
                  allBotCards={board.allBotCards}
                  revealed={false}
                  active={false}
                  potAmount={config.potPerBoard * numberOfPlayers}
                  onPress={() => handleBoardPress(i)}
                  onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
                  onAutoFill={() => handleAutoFill(i)}
                  isArrangement={isArranging}
                  selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
                  cardHeight={BOARD_CARD_H}
                  communityScale={communityScale}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* RIGHT — bot + ready */}
        <View style={[landscapeStyles.rightPanel, visualTheme === 'fiveo' && { backgroundColor: theme.surface }]}>
          <Text
            style={landscapeStyles.panelTitle}
            accessibilityRole="header"
            accessibilityLanguage="he"
            accessibilityLabel={numberOfBots === 1 ? t().botSingular : t().botPlural(readyBotCount, numberOfBots)}
          >
            {numberOfBots === 1 ? `🤖 ${t().botSingular}` : t().botEmojiPlural(readyBotCount, numberOfBots)}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill, { marginTop: 4 }]} accessibilityLiveRegion="polite">
            <Text
              style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText, { textAlign: 'center' }]}
              accessibilityLabel={allBotsReady ? t().ready : `Bots thinking, ${readyBotCount} of ${numberOfBots} ready`}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
            >
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
          {isArranging && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allBoardsFull ? t().a11yReadyReveal : t().a11yPlaceRemaining}
              accessibilityState={{ disabled: !allBoardsFull }}
              style={[styles.floatingBtn, styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled, allBoardsFull && styles.placeBtnReady, landscapeStyles.readyBtn]}
              onPress={handleReady}
              disabled={!allBoardsFull}
            >
              <Text style={[styles.floatingBtnText, styles.placeBtnText]}>
                {allBoardsFull ? t().ready : t().placeN(cardsRemaining)}
              </Text>
            </Pressable>
          )}
          {playerReady && allBotsReady && showContinueButton && (
            <Pressable accessibilityRole="button" accessibilityLabel="Continue to results" style={[styles.continueBtn, { position: 'relative', bottom: 0 }]} onPress={() => doNavigateRef.current(boardsRef.current)}>
              <Text style={styles.continueBtnText} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={t().continueArrow.replace(" →", "")}>{t().continueArrow}</Text>
            </Pressable>
          )}
        </View>
      {showSafeReveal && (
        <BoardReveal boards={pendingRevealBoards} onDone={onRevealDone} revealSpeed={config.revealSpeed} />
      )}
      </SafeAreaView>
    );
  }
  // ÂÂ End landscape layout ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
      <FriendsBg />
      {/* BUILD467-VERIFY layout debug readout — gated by AsyncStorage debug_overlay_enabled */}
      {layoutDebugVisible && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 4,
            right: 4,
            zIndex: 99998,
            backgroundColor: 'rgba(0,0,0,0.78)',
            borderColor: 'rgba(0,255,0,0.45)',
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 4,
            maxWidth: 180,
          }}
        >
          <Text style={{ color: '#00ff00', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {`B471 dim ${screenW}x${SCREEN_H}`}{'\n'}
            {`bc=${boardCount} hand=${_handZoneActualH}/${PLAYER_HAND_H}`}{'\n'}
            {`cell=${_cellW}x${_cellH} grid=${_gridCols}x${_gridRows}`}{'\n'}
            {`bCardH=${_boardCardH} cap=${boardCardCapDp}`}
          </Text>
        </View>
      )}
      {/* watermark removed from game screen */}
      {/* D1: auto-place trail flash overlay */}
      <AnimatedRN.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(201,168,76,0.18)', opacity: autoPlaceFlashAnim, zIndex: 99 }]}
      />
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave game" onPress={handleBack} style={[styles.backButton, { minHeight: 44, minWidth: 44 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topCenter}>
          {countdownActive && isArranging && (
            <View style={styles.countdownSection} accessibilityLiveRegion="polite">
              <TimerController
                countdown={countdown}
                total={COUNTDOWN_SECONDS}
                isActive={true}
                firstFinisher={firstFinisher}
                timerSize={TIMER_SIZE}
                timerColor={timerColor}
                timerPulsing={timerPulsing}
              />
              <Text style={styles.countdownLabel}>{firstFinisher ? t().botFinished : ''}</Text>
            </View>
          )}
          {!countdownActive && isArranging && (
            <Text style={styles.freePlayLabel}>
              {cardsRemaining === 0 ? t().allPlaced : t().arrangeCards(cardsRemaining)}
            </Text>
          )}
          {playerReady && !allBotsReady && (
            <Text style={styles.waitingText} accessibilityLiveRegion="polite">
              {t().waitingForBots(numberOfBots)}
            </Text>
          )}
          {playerReady && allBotsReady && !showContinueButton && !showSafeReveal && (
            <Text style={styles.calculatingText} accessibilityLiveRegion="polite">Calculating results...</Text>
          )}
        </View>
        <View style={styles.headerChips}>
          <Text style={styles.headerChipsEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰</Text>
          <Text style={styles.headerChipsAmount}>{chips.toLocaleString()}</Text>
        </View>
      </View>

      {/* Bot status bar */}
      <View style={[styles.botSection, { backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.boardBorder }]} accessibilityLiveRegion="polite">
        <View style={styles.botStatusRow}>
          <Text style={styles.botEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">🤖</Text>
          <Text style={styles.botNameLabel} accessibilityLanguage="he">
            {numberOfBots === 1 ? `${t().botSingular} 1` : t().botPlural(readyBotCount, numberOfBots)}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill]}>
            <Text
              style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText]}
              accessibilityLabel={allBotsReady ? t().ready : `Bots thinking, ${readyBotCount} of ${numberOfBots} ready`}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
            >
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
        </View>
      </View>

      {/* Timer progress bar — thin bar below bot section, only during countdown */}
      {countdownActive && isArranging && (
        <TimerBar countdown={countdown} total={COUNTDOWN_SECONDS} color={timerColor} />
      )}

      <BoardArrangement
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
        communityScale={communityScale}
        BOARD_CARD_H={BOARD_CARD_H}
        screenW={screenW}
        isWeb={isWeb}
        countdownActive={countdownActive}
        countdown={countdown}
        timeBankUsed={timeBankUsed}
        gamesPlayed={gamesPlayed}
        playerReady={playerReady}
        allBotsReady={allBotsReady}
        showContinueButton={showContinueButton}
        onBoardPress={handleBoardPress}
        onRemoveCard={handleRemoveCardFromBoard}
        onAutoFill={handleAutoFill}
        onSelectCard={handleSelectCard}
        onUndo={() => {
          for (let i = boards.length - 1; i >= 0; i--) {
            if (boards[i].playerCards.length > 0) {
              const lastCard = boards[i].playerCards[boards[i].playerCards.length - 1];
              handleRemoveCardFromBoard(i, lastCard);
              break;
            }
          }
        }}
        onReady={handleReady}
        onTimeBank={() => {
          setTimeBankUsed(true);
          setCountdown((prev) => prev + 15);
        }}
        onContinue={() => {
          debugLog('[GAME] fallback button pressed — calling doNavigate manually');
          doNavigateRef.current(boardsRef.current);
        }}
        potPerBoard={config.potPerBoard}
        boardsZoneH={_boardsZoneH}
        cellW={_cellW}
        cellH={_cellH}
        use2x2Grid={_use2x2}
        handZoneH={_handZoneActualH}
        maxHandCardH={_handCardCap}
      />
      </Animated.View>
      {showSafeReveal && (
        <BoardReveal
          boards={pendingRevealBoards}
          onDone={onRevealDone}
          revealSpeed={config.revealSpeed}
          isFirstGame={isFirstGame}
        />
      )}

      {/* Guided first-game tooltips (tips 1Â6) — non-blocking */}
      {/* Tutorial dim overlay — steps 1-2 only, focuses attention, non-blocking */}
      {isFirstGame && tooltipVisible && (tooltipStep === 1 || tooltipStep === 2) && (
        <View
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 40, alignItems: 'center', justifyContent: tooltipStep === 1 ? 'flex-end' : 'flex-start', paddingBottom: tooltipStep === 1 ? rs(200) : 0, paddingTop: tooltipStep === 2 ? rs(80) : 0 }}
          pointerEvents="none"
        >
          <Text
            style={{ color: '#c9a84c', fontSize: rs(32), opacity: 0.9 }}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          >
            {tooltipStep === 1 ? '↓' : '↑'}
          </Text>
        </View>
      )}

      {/* Guided first-game tooltips (tips 1–6) — non-blocking */}
      {isFirstGame && tooltipVisible && tooltipStep >= 1 && tooltipStep <= 6 && (
        <GuidedTooltip
          text={TIPS[tooltipStep - 1]?.() ?? ''}
          visible={tooltipVisible}
          onDismiss={advanceTooltip}
          position={tooltipStep <= 2 ? 'bottom' : tooltipStep === 5 ? 'center' : tooltipStep === 6 ? 'top' : 'bottom'}
          autoDismissMs={tooltipStep === 5 ? 6000 : 5000}
        />
      )}

      {/* S113: Auto-place toast */}
      {autoPlaceToastVisible && (
        <View style={styles.autoPlaceToast} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.autoPlaceToastText} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={t().timeUpAutoplaced.replace("⏱ ", "")}>{t().timeUpAutoplaced}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fiveoWatermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Platform.select({
      default: { userSelect: 'none' } as any,
    }),
  },
  fiveoWatermarkText: {
    fontSize: rf(52),
    fontWeight: '900',
    letterSpacing: 8,
    color: 'rgba(255,120,120,0.10)',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
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
  countdownSection: {
    alignItems: 'center',
    gap: 2,
  },
  countdownLabel: {
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber #FFC107 → mint
    color: COLORS.mint,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },
  freePlayLabel: {
    // VAMOS-BOARD-FILL 2026-06-15 — the "PLACE N CARDS" / "מקם N קלפים" header status
    // pill. Was the gray pill Roye flagged ("prior pass restyled placeBtn by mistake"
    // — that was the Confirm button, not THIS pill). Now mint to match top chrome.
    color: COLORS.mint,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rv(12),
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.30)',
    overflow: 'hidden',
    textTransform: 'uppercase' as any,
  },
  headerChips: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 3 — money/balance pill: gold rgba bg/border → mint
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
    // VAMOS-PLACEMENT-POLISH-2 FIX 3 — amount text gold → mint
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
  botStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
  },
  botEmoji: {
    fontSize: rf(14),
  },
  botNameLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as any,
  },
  botStatusPill: {
    paddingHorizontal: rs(8),
    paddingVertical: 2,
    borderRadius: rv(10),
  },
  botReadyPill: {
    backgroundColor: 'rgba(40,167,69,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(40,167,69,0.5)',
  },
  botThinkingPill: {
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber → mint ghost
    backgroundColor: 'rgba(79,214,168,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.4)',
  },
  botStatusText: {
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 1,
  },
  botReadyText: {
    color: '#28A745',
  },
  botThinkingText: {
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber → mint
    color: COLORS.mint,
  },
  botLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
    fontWeight: '600',
  },
  calculatingText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 1,
  },
  selectionHint: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  floatingBtn: {
    paddingVertical: 0,
    paddingHorizontal: rs(16),
    height: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
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
    // VAMOS-PLACEMENT-POLISH B2 (#2) — Cancel/Undo restyled as a SECONDARY in-theme
    // action: mint-outline on transparent. Matches mint primary, no clashing gold.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.mint,
  },
  placeBtn: {
    // VAMOS-PLACEMENT-POLISH B2 (#2) — primary CTA is now MINT solid (was '#C5A028'
    // gold literal). Disabled state cascades via placeBtnDisabled opacity.
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
    // VAMOS-PLACEMENT-POLISH B2 (#2) — solid muted mint instead of opacity over gold.
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
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  placeBtnText: {
    color: '#0A0A12',
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
  autoPlaceToast: {
    position: 'absolute',
    bottom: rs(60),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderRadius: rs(16),
    zIndex: 999,
  },
  autoPlaceToastText: {
    fontSize: rf(12),
    color: '#fff',
    fontWeight: '500',
  },
});

const landscapeStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
  },
  leftPanel: {
    width: '22%',
    paddingHorizontal: rs(8),
    paddingVertical: rs(8),
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.boardBorder,
    gap: rs(6),
  },
  centerPanel: {
    flex: 1,
    flexDirection: 'column',
  },
  boardsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: rs(6),
    gap: rs(4),
  },
  boardCell: {
    width: '49%',
    flex: undefined,
    minHeight: 120,
  },
  rightPanel: {
    width: '18%',
    paddingHorizontal: rs(8),
    paddingVertical: rs(8),
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.boardBorder,
    gap: rs(8),
  },
  panelTitle: {
    color: COLORS.gold,
    fontSize: rf(10),
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(4),
  },
  panelAvatarText: {
    fontSize: rf(14),
  },
  panelLvl: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rf(9),
    fontWeight: '500',
  },
  readyBtn: {
    marginTop: 'auto' as any,
    width: '100%',
    paddingHorizontal: rs(8),
    alignItems: 'center',
  },
});


export default function GameScreen() {
  return (
    <ErrorBoundary>
      <GameScreenInner />
    </ErrorBoundary>
  );
}
