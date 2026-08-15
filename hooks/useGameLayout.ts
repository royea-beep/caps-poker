// useGameLayout — extracted VERBATIM from app/game.tsx (lines 136–443) so SOLO and
// MP can share the exact same placement-screen sizing math. The body below is the
// original SOLO "fit-search"; only the surrounding function signature, the
// boardCardCapDp state/effect ownership, and the return aliasing are new. The math
// is byte-for-byte identical to what game.tsx computed inline.
import { useState, useEffect } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CARDS_PER_BOARD, CARD_SCALE, getCardDimensions } from '../constants/gameConfig';
import { rv as rvOld } from '../constants/deviceBreakpoints';
import { rh as rhBase, rs as rsBase } from '../utils/responsive';

// GAME-SCREEN-FIT 2026-07-07 — rh()/rs() (and PRD, which is itself built from them)
// scale against SCREEN_W/H captured ONCE at module load. On native that's the real
// device size, but on web utils/responsive.ts falls back to a hardcoded 393x852
// (documented there: Dimensions.get() at module scope crashes the SPA before the DOM
// is ready). Telemetry confirms every narrow/short report (320x553, 320x568, 360x640)
// is platform:web, so every rh()/rs() call in this hook was silently scaling against
// 393x852 regardless of the real viewport. game.tsx already gets a reactive
// screenW/screenH via useWindowDimensions() and passes them in as opts — this hook
// now threads them through every rh()/rs() call via local shadows below instead of
// the frozen module-level defaults, so a real 320pt-wide/553pt-tall browser viewport
// actually shrinks the layout instead of computing as if it were 393x852.
// Layout constants — PR-M aggressive vertical budget (2026-05-29).
// Top chrome (header + bot bar) collapsed to rh(56); FLOATING_ACTIONS to rs(56).
// Boards consume everything else so 3p vertical-stack stops clipping board 3.
const HINT_H = 22;                                  // selectionHint / boardError bar
const BOARD_CHROME = 28;                            // per-board chrome budget (was 40)

export interface UseGameLayoutOpts {
  screenW: number;
  screenH: number;
  insets: { top: number; bottom: number; left: number; right: number };
  boardCount: number;
  numberOfPlayers: 2 | 3 | 4;
}

export function useGameLayout(opts: UseGameLayoutOpts) {
  const { screenW, screenH: SCREEN_H, insets, boardCount, numberOfPlayers } = opts;
  const isLandscape = false; // S86: portrait-only — Iron Rule 2

  // GAME-SCREEN-FIT 2026-07-07 — shadow the module-level rh/rs with versions bound to
  // THIS render's real screenW/SCREEN_H (see import comment above). Every rh(N)/rs(N)
  // call below now resolves through these, not the frozen 393x852 default.
  const rs = (v: number) => rsBase(v, screenW);
  const rh = (v: number) => rhBase(v, SCREEN_H);

  // Layout constants — PR-M aggressive vertical budget (2026-05-29). Was PRD.zone.*
  // (itself frozen at module load); now computed with the reactive rh/rs above.
  // TOP-CHROME-H 2026-08-14 — was `rh(56)`, and the chrome RENDERS AT 90px. Measured on the
  // live build at 375, 393 and 1706, both engines: 90 on Chromium, 91-92 on WebKit, and
  // IDENTICAL at every width and height. The budget was ~34px short before a single card was
  // sized, and :276 `_availForBoardsAndHand` inherits it — so the fit-search was handing the
  // boards and hand room that does not exist. That is the ~90px deficit; the cards were never
  // too big.
  //
  // This file already records the same defect once: see the note at ~:91 — "Previous mismatch
  // (game.tsx 120, BoardArrangement 187) was the silent under-allocation that pushed board 3
  // placement slots off-screen on build 459." Fixed for the hand zone, left standing here.
  //
  // WHY A CONSTANT AND NOT rh(). The chrome genuinely does not scale: it is floored by the
  // 44px accessibility minimum on the leave button (measured h=44 top=4 at EVERY width) plus
  // fixed paddings. rh() varied it 53-56 across viewports while the real thing sat at 90 —
  // scaling a value that does not scale is what made it wrong. Written as the sum of its
  // measured parts so it is checkable rather than magic, and so the next reader can see which
  // part is the a11y floor and must not be trimmed.
  const A11Y_TOUCH_MIN = 44;        // leave-button floor, set deliberately 2026-08-10/11
  const TOP_BAR_PAD_V = 8;          // paddingTop 4 + paddingBottom 4 on the header row
  const BOT_STATUS_ROW = 28;        // "BOTS n/n ✓READY" strip, measured
  const CHROME_TO_BOARDS_GAP = 10;  // measured gap between the strip and board 0

  const TOP_BAR_H = A11Y_TOUCH_MIN + TOP_BAR_PAD_V;                 // 52, measured
  const BOT_STATUS_H = BOT_STATUS_ROW + CHROME_TO_BOARDS_GAP;       // 38, measured
  const TOP_CHROME_H = TOP_BAR_H + BOT_STATUS_H;                    // 90, measured
  // FLOATING-ACTIONS-H 2026-08-14 — was `rs(56)` = 56, and the reserved bottom chrome measures
  // 101. This is the term that BINDS: it is consumed at :229 inside the fit-search that
  // produces _MODE_BOARDS_CONTENT, which :327's Math.min then uses to set _boardsZoneH. The
  // earlier correction to _handMarginB (:299) was the same premise applied at :317 — downstream
  // of that clamp — which is why it was correct and moved nothing.
  //
  // MEASURED at 375 / 393 / 1706 / 1920, space below the hand:
  //   below hand      118   119   129   128
  //   gap (flex)       17    18    28    27
  //   below - gap     101   101   101   101   <- flat at every width
  // The gap is leftover space being ABSORBED, not reserved chrome; counting it would
  // double-book the slack. Rule 20: 101 does not scale, so it must not sit behind rs().
  //
  // Parts, so the next reader can check them: the ⚡ Auto-Place ALL row (33 at all four widths)
  // plus the Cancel/Confirm bar container (71), less the 3px by which they overlap.
  const AUTO_PLACE_ROW_H = 33;   // measured 375/393/1706/1920 — identical
  const ACTION_BAR_H = 71;       // Cancel/Confirm container incl. its bottom inset
  const AUTO_BAR_OVERLAP = 3;    // the two touch; do not count it twice
  const FLOATING_ACTIONS_H = AUTO_PLACE_ROW_H + ACTION_BAR_H - AUTO_BAR_OVERLAP;  // 101

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
  // Approximate by screen height bracket: smaller phones Â smaller cards Â shorter hand section
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
  // VAMOS-FILL-PER-MODE 2026-06-17 — per-mode card width. Each mode (bc=2/3/4)
  // gets the LARGEST W where total content (N boards + hand rows) fits the
  // available screen height. If even W=MIN_W overflows (bc=4 with 4 boards +
  // 16-card hand), W stays at MIN_W and BOARDS_SCROLL=true (only that mode
  // scrolls). Board card == hand card within each mode (the unification we
  // shipped earlier). NO dead gap in non-scroll modes because W is chosen so
  // content fills available height.
  const _HAND_INSET = 16;
  const _HAND_END_SAFETY = rs(20);
  const _HAND_GAP = rs(2);
  // VAMOS-CARDS-NOSCROLL-V2 2026-06-21 — trimmed hand-zone chrome so 3 and 4
  // boards fit on 390x844 / 393x852 WITHOUT scroll. The constants drive both
  // the fit-search predicate (handZoneH = handRows*cardH + (handRows-1)*ROW_GAP
  // + LABEL_H + 2*PADV) AND the maxHeight cap that BoardArrangement applies to
  // the hand container — so trimming them lets the search pick a wider card
  // AND physically reserves less space for the hand. Total savings vs prior:
  //   bc=2 (handRows=3): -rs(20) ≈ -20px  (closes the 24px gap at 390x844)
  //   bc=3/bc=4 (handRows=2): -rs(18) ≈ -18px (closes 18px / 16px / 9px gaps)
  // PlayerHand's inner ScrollView (V2) handles any genuinely-clipped row on
  // small screens so the bottom row is never lost.
  const _HAND_ROW_GAP_V = rs(2);  // was rs(4)
  // FOUR-BOARDS 2026-08-14 — the fourth wrong premise in this file, and the first one found by
  // measuring a configuration nobody had measured. The whole layout arc ran at 3 boards / 12
  // cards; Roye plays 2-player = 4 boards / 16 cards. At 12 cards this budget had slack and the
  // error hid. At 16 it clips the bottom hand row.
  //
  // MEASURED on the live build, 4 boards, Chromium, at three widths — the hand zone's chrome
  // around the card rows is IDENTICAL at every width:
  //
  //            375     393    1706
  //   budget   125     132     143     <- what this file reserved
  //   content  137.7   143.7   153.7   <- what the zone actually renders
  //   deficit   12.7    11.7    10.7
  //
  //   label marginTop      4    4    4
  //   label height        13   13   13
  //   label -> rows gap    6    6    6
  //   container padV     3.33 3.33 3.33  (x2)
  //
  // Nothing there scales, so per Rule 20 none of it may sit behind rs() — rs(14) + 2*rs(2) = 18
  // against a real 29.7 was under-counting by ~11 at EVERY width. Written as its measured parts,
  // rounded up so the budget can never again be the smaller number.
  const _HAND_LABEL_BLOCK_H = 23;      // marginTop 4 + label 13 + gap to first row 6 (was rs(14))
  const _HAND_CONTAINER_PADV = 3.5;    // measured 3.33, rounded UP (was rs(2) = 2)
  const _BOARD_CHROME_V = rs(18); // header strip + paddings + rowGap inside a cell (rs(20) was still 4pt over bc=3's edge; rs(18) lands bc=3 at 708 ≤ 710 → non-scroll)
  const _BOARD_INTER_GAP = rs(4);
  // VAMOS-LOBBY-MENU-CARDS-V1 2026-06-21 — lowered floor from rs(55) to rs(40)
  // so 4 boards (2P) + the 16-card hand fit on a 390x844 phone WITHOUT
  // scrolling. Rank+suit are still legible at rs(40)≈40dp width. Scroll
  // fallback from V1/V2 still protects smaller screens (375x667 / 320x568)
  // where even rs(40) can't fit everything.
  const _MIN_CARD_W = rs(40); // readable floor (was rs(55) before LOBBY-MENU-CARDS-V1)
  // VAMOS-FILL-FIX-WIDTHCAP 2026-06-17 — HARD cap by the board's flop-row fit
  // so cards can never grow wider than (boardInnerW - chrome) / 5. Without this
  // the bc=2 vertical-fill grew W to 75pt and the leftmost flop card clipped
  // outside the board frame. Conservative chrome estimates: outer cell margin
  // ~rs(28), inter-card gaps + separator + sepMargins ~rs(24).
  const _modeCellW = Math.max(rs(80), screenW - rs(12)); // gridCols=1 fixed
  const _modeInnerW = _modeCellW - rs(28);
  const _W_HORIZONTAL_FIT = Math.max(_MIN_CARD_W, Math.floor((_modeInnerW - rs(24)) / 5));
  const _MAX_CARD_W = Math.min(
    Math.floor((screenW - 2 * _HAND_INSET - _HAND_END_SAFETY) / 2),
    _W_HORIZONTAL_FIT
  );
  const _availTotal = (SCREEN_H - insets.top - insets.bottom)
    - TOP_BAR_H - BOT_STATUS_H - FLOATING_ACTIONS_H - HINT_H - rs(8);
  const _handSize = CARDS_PER_BOARD * boardCount; // 8 / 12 / 16
  const _evalFit = (W: number) => {
    const cardH = Math.round(W / 0.72);
    const perRow = Math.max(1, Math.floor(
      (screenW - 2 * _HAND_INSET - _HAND_END_SAFETY + _HAND_GAP) / (W + _HAND_GAP)
    ));
    const handRows = Math.max(1, Math.ceil(_handSize / perRow));
    const handZoneH = handRows * cardH + (handRows - 1) * _HAND_ROW_GAP_V
      + _HAND_LABEL_BLOCK_H + 2 * _HAND_CONTAINER_PADV;
    const cellH = 2 * cardH + _BOARD_CHROME_V;
    const boardsContent = boardCount * cellH + (boardCount - 1) * _BOARD_INTER_GAP;
    return { cardH, perRow, handRows, handZoneH, cellH, boardsContent };
  };
  // VAMOS-FIX-BC3-OVERLAP 2026-06-17 — SAFETY margin on the scroll classification.
  // A mode is non-scroll only if content + SAFETY ≤ available. A 2pt math margin
  // gets eaten by inset/measurement variance on real device → bc=3 was marked
  // non-scroll on paper but overflowed by ~35px on real render → board 3 hidden
  // behind hand zone. rs(24) safety covers the variance — bc=3 now correctly
  // scrolls.
  const _FIT_SAFETY = rs(24);
  let _chosenW = _MIN_CARD_W;
  let _BOARDS_SCROLL = false;
  for (let W = _MAX_CARD_W; W >= _MIN_CARD_W; W--) {
    const f = _evalFit(W);
    if (f.handZoneH + f.boardsContent + _FIT_SAFETY <= _availTotal) { _chosenW = W; break; }
  }
  if (_chosenW === _MIN_CARD_W) {
    const f = _evalFit(_MIN_CARD_W);
    if (f.handZoneH + f.boardsContent + _FIT_SAFETY > _availTotal) _BOARDS_SCROLL = true;
  }
  const _fit = _evalFit(_chosenW);
  const UNIVERSAL_CARD_W = _chosenW;
  const UNIVERSAL_CARD_H = _fit.cardH;
  const PLAYER_HAND_H = _fit.handZoneH;
  const _MODE_CELL_H = _fit.cellH;
  const _MODE_BOARDS_CONTENT = _fit.boardsContent;

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
  // LAST-29PX 2026-08-14 — was `rs(72) + insets.bottom + rs(8)` = 80 at 393, and the space
  // below the hand actually renders at 119. Measured live after the TOP_CHROME_H fix:
  //   hand bottom 733 -> gap 18 -> ⚡ Auto-Place row 33 -> action bar 71 -> viewport 852
  //   (Auto-Place and the bar overlap by 3, so 18 + 33 + 71 - 3 = 119)
  // Short by ~39px, which is MORE than the ~29px of board/hand overlap still on screen. So the
  // remaining collision is the same defect as the 90px one — a budget that does not believe
  // what renders — not genuine content pressure. Second wrong premise in the same file.
  //
  // BoardArrangement.tsx:354 already recorded this: "PRD.zone.actionBarH=rs(56) under-counted
  // the ...". It was patched locally in the consumer instead of corrected at the source, which
  // is why the hook kept allocating from a number nobody had re-measured.
  //
  // The two flat parts are flat for real reasons — the action bar and the Auto-Place row
  // measured identically at 393 and 1706 — so they are written as measured constants, while
  // the hand→Auto-Place gap does scale (18 at 393, 28 at 1706) and stays behind rs().
  // Same measured chrome as FLOATING_ACTIONS_H above, plus the flexible gap. NOTE: this term
  // is INERT — :327's Math.min discards whatever :317 computes. Kept correct rather than
  // deleted so it does not become a second wrong premise if the clamp ever stops binding.
  const _handMarginB = rs(18) + FLOATING_ACTIONS_H + insets.bottom;
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
  // VAMOS-FIX-HAND-CLIP 2026-06-17 — HAND gets full reservation FIRST; boards
  // take what remains and scroll if needed. Was: boards had floor _minBoardsZoneH
  // and could STEAL from the hand (bc=4 3-row hand clipped the bottom row on
  // device). Hand can NEVER be clipped now; boards just scroll a bit more.
  const _handZoneActualH = PLAYER_HAND_H;
  let _boardsZoneH = _availForBoardsAndHand - _handZoneActualH;
  // In non-scroll modes, cap boards at content (no dead band above hand).
  if (!_BOARDS_SCROLL) {
    _boardsZoneH = Math.min(_boardsZoneH, _MODE_BOARDS_CONTENT);
  }
  // Floor: boards viewport should be at least ~1 board tall. If somehow we go
  // below, the hand still wins — boards just scroll inside a tighter viewport.
  _boardsZoneH = Math.max(_boardsZoneH, rh(120));

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
  // VAMOS-SCROLL-V2 2026-06-17 — every board uses a FIXED cellH equal to the
  // bc=3 "good" size (boardsZoneH / 3) +5% breathing — NOT the bc=2 size (that
  // was the exaggerated previous attempt). At bc=2 both boards fit with slack;
  // at bc=3 all three fit; at bc=4 content overflows the viewport and the
  // BoardArrangement ScrollView scrolls to reach board 4. Cards-big sizing math
  // (aspect [0.62, 0.85], top-anchor, Lever 1, measured HEADER_H) is untouched.
  const _bc3CellH = Math.floor(_boardsZoneH / 3);
  const _goodCellH = Math.max(rh(140), Math.floor(_bc3CellH * 1.05));
  const _legacyCellH = Math.min(_packedCellH, _idealCellH);
  // VAMOS-FILL-PER-MODE 2026-06-17 — cellH derived from per-mode CARD_W so each
  // cell is exactly the size needed to render 2 card rows + chrome. This is the
  // sizing that pairs with the per-mode fill logic above.
  const _cellH = _MODE_CELL_H;
  void _legacyCellH;
  void _goodCellH;
  void _minBoardsZoneH;
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
  // ch*(communityScale + 0.7) + 4 <= boardSpace Â maxCh = floor((boardSpace-4)/(communityScale+0.7))
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

  return {
    UNIVERSAL_CARD_W,
    UNIVERSAL_CARD_H,
    PLAYER_HAND_H,
    cellW: _cellW,
    cellH: _cellH,
    boardsZoneH: _boardsZoneH,
    use2x2: _use2x2,
    handZoneH: _handZoneActualH,
    handCardCap: _handCardCap,
    communityScale,
    BOARD_CARD_H,
    boardsScroll: _BOARDS_SCROLL,
    gridRows: _gridRows,
    gridCols: _gridCols,
    isWeb,
    // Extra internals consumed by the SOLO layout-debug readout (game.tsx) so it
    // can keep printing the exact same diagnostics after the math moved here.
    boardCardH: _boardCardH,
    boardCardCapDp,
  };
}
