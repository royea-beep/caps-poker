import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, Animated as AnimatedRN, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FriendsBg } from '../components/FriendsBg';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD, getCardDimensions, isMpBoardRevealEnabled } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { useGameTimer } from '../hooks/useGameTimer';
import { BoardRevealPayload, HandCompletePayload, CardsDealtPayload } from '../constants/networkConfig';
import { RevealBoardData } from '../types/gameTypes';
import { playSound, startAmbient, stopAmbient } from '../utils/sounds';
import { sortHand } from '../utils/sortHand';
import { WAITING_STATE_TIMEOUT_MS, SpectatorSnapshot } from '../utils/realtimeMultiplayer';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { getMatchCost } from '../utils/economy';
import { CapsHooks } from '../utils/learning';
import { track } from '../utils/analytics';
import { finishTable, touchRoomPlayer } from '../utils/lobbyApi';
import { recordClubGame, ClubGameResult } from '../utils/clubApi';
import { getDeviceId } from '../utils/leaderboard';
import { getSupabase } from '../utils/supabase';
import ChatBar, { ChatBubbles, ChatMessage, SendKind } from '../components/ChatOverlay';
import ConnectionStatus from '../components/ConnectionStatus';
import { ChatMsg } from '../utils/realtimeMultiplayer';
import { OpponentHeader } from '../components/OpponentHeader';
import { TimerController, TimerBar } from '../components/TimerController';
import { PRD } from '../utils/prdTokens';
import { rf, rh, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';
import { useGameLayout } from '../hooks/useGameLayout';
import { GameView } from '../components/GameView';
import { BoardState } from '../utils/gameLogic';

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

/**
 * If this was a CLUB table (store.clubCode set), submit the FULL roster of this room
 * to the club mini-league (BUG 4 fix). ANY alive client may call this with the same
 * roster — the server applies it exactly once via club_game_results(room_code PK), so
 * the league counts each room one time even with disconnects.
 *
 * The roster identifies each player by their realtime-presence device_id (which is
 * the same id touch_room_player / room_players use). Fire-and-forget; no-op for
 * public/private tables (clubCode null) or empty rosters.
 */
function maybeRecordClubGame(roster: ClubGameResult[]) {
  const { clubCode, roomCode } = useGameStore.getState();
  if (!clubCode || !roomCode || roster.length === 0) return;
  (async () => {
    try {
      track('club_game_ended', { club_code: clubCode, room_code: roomCode, roster_size: roster.length }, 'multiplayer-game');
      await recordClubGame(clubCode, roomCode, roster);
    } catch { /* fire-and-forget */ }
  })();
}

// S73 — placement is UNLIMITED until the FIRST player finishes (locks in / hits Ready). The
// moment someone finishes, every remaining player gets COUNTDOWN_SECS; the start is broadcast
// (READY_PRESSED) so all clients count the same window. On expiry a player's remaining cards
// auto-place and the hand reveals. There is NO from-the-start countdown any more.
const COUNTDOWN_SECS = 60;
// MP-PARITY-DEEP 2026-07-09 — same AsyncStorage key SOLO (app/game.tsx) reads.
const GAMES_PLAYED_KEY = 'caps_games_played';
// S73 — host-authoritative backstop, armed ONLY once the first player finishes (see
// startCountdown), sitting just ABOVE the countdown. It force-completes an unclean-disconnected
// client that can't run its own expiry auto-fill. Before anyone finishes it is NEVER armed, so a
// room where players are simply still arranging is never force-revealed (the reason the reveal
// used to fire ~1 min in while both were still placing).
const DEAL_CLOCK_MS = COUNTDOWN_SECS * 1000 + 15000; // 75s
// Keep the seat's room_players.last_seen fresh DURING the game (the waiting-room heartbeat
// in lobby/table stops at game start). Gives the server-side reaper a per-seat signal so a
// player who leaves goes stale within ~2 beats and a wedged 'playing' room can be reaped.
const INGAME_HEARTBEAT_MS = 20000;

// MP-LEAVE-RECOVERY (Issue C) 2026-06-30 — the deal-clock that force-resolves a wedged hand is
// HOST-only, so a non-host whose host vanishes had no resolve path and sat until the 120s server
// reaper (~135s observed). After the realtime layer's 10s presence grace (HOST_LOST_GRACE_MS)
// fires onHostLost, give the host this much additional time to return before cleanly cancelling
// the hand. 40s here ≈ 50s total absence — above WiFi-flicker / a couple of missed 20s
// heartbeats, comfortably under the 120s net. NOT instant: instant would reap live games.
const HOST_LEFT_RESOLVE_GRACE_S = 40;

// MP-RENDER-PARITY 2026-06-28 — match SOLO's PR-M layout budget. The hardcoded
// 44/24/68/26 constants here were the pre-unification budget that made boards +
// cards look noticeably different from /game. Now derived from the same PRD
// design tokens so a chrome retune on SOLO automatically lands on MP.
const TOP_CHROME_H = PRD.zone.topChromeH;                       // rh(56)
const TOP_BAR_H = Math.round(TOP_CHROME_H * 36 / 56);           // ~36/56 = top button row
const BOT_STATUS_H = Math.round(TOP_CHROME_H * 20 / 56);        // ~20/56 = opponent pill row
const FLOATING_ACTIONS_H = PRD.zone.actionBarH;                 // rs(56) — PR-M
const HINT_H = 22;                                              // selectionHint / boardError bar
const BOARD_CHROME = 28;                                        // per-board non-card overhead

// Timer pill size (matches SOLO's countdownSection)
const TIMER_SIZE = rs(40);

interface BoardDisplay {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  revealed: boolean;
}

function MultiplayerGameScreenInner() {
  const router = useRouter();
  const { height: SCREEN_H, width: SCREEN_W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // MP-RENDER-PARITY — use the same theme the SOLO screen uses, so MP picks up
  // FriendsBg + the visualTheme the player chose in settings (classic vs fiveo).
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);

  const params = useLocalSearchParams<{
    isHost: string;
    playerIndex: string;
    playerCount: string;
    yourCards: string;
    boards: string;
    rejoinPhase?: string;
  }>();

  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const storeRoomCode = useGameStore((s) => s.roomCode);
  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);
  const handSortMethod = useGameStore((s) => s.handSortMethod);

  const isHost = params.isHost === 'true';
  const playerIndex = parseInt(params.playerIndex || '0', 10);
  const playerCount = parseInt(params.playerCount || '2', 10);

  let yourCards: Card[] = [];
  try { yourCards = JSON.parse(params.yourCards || '[]'); } catch { yourCards = []; }

  let boardsParam: CardsDealtPayload['boards'] = [];
  try { boardsParam = JSON.parse(params.boards || '[]'); } catch { boardsParam = []; }

  const boardCount = boardsParam.length;

  // VAMOS-UNIFY-GAMEVIEW 2026-06-29 — MP now uses the EXACT SOLO fit-search sizing
  // via useGameLayout (the same hook game.tsx uses), then renders the shared
  // <GameView/> + <BoardArrangement/>. This replaces MP's prior ad-hoc
  // getCardDimensions sizing + its hand-duplicated <Board> map / <PlayerHand>.
  const _safePlayers = (playerCount === 2 || playerCount === 3 || playerCount === 4 ? playerCount : 2) as 2 | 3 | 4;
  const _L = useGameLayout({ screenW: SCREEN_W, screenH: SCREEN_H, insets, boardCount, numberOfPlayers: _safePlayers });
  // The legacy module-level chrome constants are no longer part of MP's sizing math
  // (useGameLayout owns it now), but keep the references silenced for the lint pass.
  void TOP_BAR_H; void BOT_STATUS_H; void FLOATING_ACTIONS_H; void HINT_H; void BOARD_CHROME;

  // State
  // MP-PARITY-DEEP 2026-07-09 — solo builds closedCards from the real (locally-known)
  // turn+river cards; MP only ever learns closedCardCount pre-reveal (server withholds
  // the actual cards to prevent peeking). Build face-down placeholders from the count so
  // Board.tsx's closedCards.map() renders the same 2 face-down slots solo shows — the
  // dummy suit/rank is never read since Card.tsx's renderBack() ignores them.
  const [boards, setBoards] = useState<BoardDisplay[]>(() =>
    boardsParam.map((b) => ({
      openCards: b.openCards,
      closedCards: Array.from({ length: b.closedCardCount }, (_, i) => ({
        suit: 'spades' as const,
        rank: 'A' as const,
        id: `closed-${b.boardIndex}-${i}`,
      })),
      playerCards: [],
      revealed: false,
    }))
  );
  // MP-PARITY-DEEP 2026-07-09 — SOLO sorts the dealt hand (utils/sortHand.ts,
  // handSortMethod preference) so ranks/pairs group visually; MP rendered raw deal
  // order. Sort once at the same point solo does — right after the deal.
  const [playerHand, setPlayerHand] = useState<Card[]>(() => sortHand(yourCards, handSortMethod));
  const playerHandRef = useRef(playerHand);
  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  const boardsRef = useRef(boards);
  useEffect(() => { boardsRef.current = boards; }, [boards]);
  // MP-PARITY-DEEP 2026-07-09 — SOLO gates its first-time hint (<1 game) and Pro-tip
  // banner (>=3 games) on the real AsyncStorage games-played counter; MP hardcoded 0,
  // which showed the "first time" hint on every single MP hand forever and made the
  // Pro-tip banner structurally unreachable. Default high (like SOLO) so both stay
  // hidden until the real count loads.
  const [gamesPlayed, setGamesPlayed] = useState(99);
  useEffect(() => {
    AsyncStorage.getItem(GAMES_PLAYED_KEY).then((v) => setGamesPlayed(parseInt(v ?? '0', 10))).catch(() => {});
  }, []);

  // MP-BOARDREVEAL 2026-06-28, SHIP-MP-REVEAL 2026-07-06 — gated reveal state. When
  // isMpBoardRevealEnabled() is true (client default true, remotely overridable via
  // app_config `mp_board_reveal_enabled` — see constants/gameConfig.ts), both host and
  // guest play the same <BoardReveal> SOLO uses before /results.
  const [showSafeReveal, setShowSafeReveal] = useState(false);
  const [pendingRevealBoards, setPendingRevealBoards] = useState<Array<{
    winner: 'player' | 'bot' | 'tie';
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

  // MP-MULTISELECT 2026-07-10 — mirror SOLO's multi-select (game.tsx:186): tap up to 4 hand
  // cards, then tap a board to place them all. Placement stays 100% local; only the final
  // arrangement syncs on Ready, so this is zero protocol/reveal impact.
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  // If rejoining after disconnect and already auto-readied, start in waiting (CAPS 12)
  const initialPhase = params.rejoinPhase === 'waiting' ? 'waiting' : 'arranging';
  const [phase, setPhase] = useState<'arranging' | 'waiting' | 'navigating'>(initialPhase);
  const [disconnectBanner, setDisconnectBanner] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  // Reconnect 15s window state
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Free time + countdown state
  // S73 — removed the from-the-start free-time countdown + the dead readyEnabled flag.
  const countdownStartedRef = useRef(false);
  // Guards the ready broadcast against double-send (timeout auto-fill vs manual ready,
  // and React updater double-invoke). One hand per screen mount, so no reset needed.
  const readySentRef = useRef(false);

  // --- Chat (internet MP only) ---
  const isInternetMP = typeof (mpServer as any)?.sendChat === 'function' || typeof (mpClient as any)?.sendChat === 'function';
  const isConnected = isInternetMP && (
    (mpServer !== null) ||
    (mpClient !== null && typeof (mpClient as any).isConnected === 'function'
      ? (mpClient as any).isConnected()
      : mpClient !== null)
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const myPlayerName = connectedPlayers.find((p) => p.seat === playerIndex)?.name ?? `Seat ${playerIndex + 1}`;
  const chatIdCounter = useRef(0);

  const addChatMessage = useCallback((msg: ChatMsg, isMe: boolean) => {
    const id = `chat-${Date.now()}-${chatIdCounter.current++}`;
    const newMsg: ChatMessage = { id, playerName: msg.playerName, text: msg.text, isMe, timestamp: msg.timestamp };
    setChatMessages((prev) => [...prev.slice(-20), newMsg]); // keep last 20 in memory
  }, []);

  const handleSendChat = useCallback((text: string, kind: SendKind = 'chat') => {
    // Echo locally (isMe). The broadcast carries our seat so receivers skip our own echo
    // and label everyone else correctly — names collide (all anon players are "Player").
    const msg: ChatMsg = { playerName: myPlayerName, text, timestamp: Date.now(), seat: playerIndex };
    addChatMessage(msg, true);
    if (isHost && (mpServer as any)?.sendChat) {
      (mpServer as any).sendChat(text, myPlayerName, playerIndex);
    } else if (!isHost && (mpClient as any)?.sendChat) {
      (mpClient as any).sendChat(text, myPlayerName, playerIndex);
    }
    // `kind` carries the actual emoji (so we can measure which emotes are used); chat is 'text'.
    track(kind === 'emote' ? 'emote_sent' : 'chat_sent', { kind: kind === 'emote' ? text : 'text', room_code: storeRoomCode, player_count: playerCount, role: isHost ? 'host' : 'guest' }, 'multiplayer-game');
  }, [myPlayerName, playerIndex, isHost, mpServer, mpClient, addChatMessage, storeRoomCode, playerCount]);

  // --- Time bank (1 use per hand) ---
  const [timeBankUsed, setTimeBankUsed] = useState(false);
  // MP-PARITY-DEEP 2026-07-09 — SOLO's D1 auto-place trail flash (game.tsx) fires the
  // instant the countdown auto-fills a stalled player's boards; MP had no equivalent,
  // so a timed-out MP hand went silent/still where SOLO gives clear visual feedback.
  const autoPlaceFlashAnim = useRef(new AnimatedRN.Value(0)).current;

  // Collected reveal data for guest
  const boardRevealsRef = useRef<Map<number, BoardRevealPayload>>(new Map());
  const mountedRef = useRef(true);
  // MP-LEAVE-RECOVERY — completedRef is set the moment a NORMAL completion begins
  // (host/guest reveal navigate, or reveal-modal done). The unmount handler uses it to
  // tell "the hand finished, keep the realtime session for /results + rematch" apart from
  // "the player bailed (back/home/route change), tear the session down so the OTHER player
  // sees the presence leave and is freed immediately".
  const completedRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dealClockRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    CapsHooks.gameStarted('online');
    // MP-PARITY-DEEP 2026-07-09 — SOLO starts/stops ambient bg audio per game.tsx's
    // mount effect; MP never did, making the table feel silent/dead by comparison.
    void startAmbient();
    return () => {
      mountedRef.current = false;
      void stopAmbient();
    };
  }, []);

  // Player names from connected players
  const playerNames = connectedPlayers
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.name);

  // Opponent info
  const opponentPlayer = connectedPlayers.find(p => p.seat !== playerIndex);
  const opponentName = opponentPlayer?.name ?? (playerNames.find((_, i) => i !== playerIndex) ?? 'Opponent');
  const opponentConnected = opponentPlayer?.connected !== false;

  // Cleanup reconnect timers on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
      if (reconnectAlertTimerRef.current) clearTimeout(reconnectAlertTimerRef.current);
    };
  }, []);

  const isArranging = phase === 'arranging';

  // --- Host: set up spectator channel + announce arranging phase ---
  useEffect(() => {
    if (!isHost || !isInternetMP || !mpServer || !storeRoomCode) return;
    const server = mpServer as any;
    if (typeof server.setupSpectatorChannel !== 'function') return;

    server.setupSpectatorChannel(storeRoomCode);
    server.onSpectatorCountChange((count: number) => {
      if (mountedRef.current) setSpectatorCount(count);
    });

    // Broadcast initial 'arranging' snapshot
    const clients = server.getClients?.() ?? [];
    const snapshot: SpectatorSnapshot = {
      phase: 'arranging',
      boardCount,
      players: clients.map((c: any) => ({ id: c.id, name: c.name, isReady: c.isReady })),
      communityCards: boardsParam.map((b: any) => b.openCards ?? []),
      spectatorCount: 0,
    };
    server.broadcastToSpectators(snapshot);
  }, [isHost, isInternetMP, mpServer, storeRoomCode, boardCount]);

  // --- Wire onChat for host ---
  // Skip our OWN message (seat match) — it was already echoed locally; everyone else is
  // not-me. Seat-based so it's correct even when all anon players share the name "Player".
  useEffect(() => {
    if (!isHost || !mpServer || !isInternetMP) return;
    mpServer.updateCallbacks({ onChat: (msg: ChatMsg) => { if (mountedRef.current && msg.seat !== playerIndex) addChatMessage(msg, false); } });
  }, [isHost, mpServer, isInternetMP, addChatMessage, playerIndex]);

  // --- Wire onChat for guest ---
  useEffect(() => {
    if (isHost || !mpClient || !isInternetMP) return;
    mpClient.updateCallbacks({ onChat: (msg: ChatMsg) => { if (mountedRef.current && msg.seat !== playerIndex) addChatMessage(msg, false); } });
  }, [isHost, mpClient, isInternetMP, addChatMessage, playerIndex]);

  // --- Host: wire server callbacks on mount ---
  useEffect(() => {
    if (!isHost || !mpServer) return;

    mpServer.updateCallbacks({
      onAllPlayersReady: () => {
        if (!mountedRef.current) return;

        const { boardResults, handResult } = mpServer.runRevealSequence(config);
        const serverBoards = mpServer.getBoards();
        const clientArray = mpServer.getClients().sort((a: any, b: any) => a.seat - b.seat);

        // Broadcast BOARD_REVEAL to guests
        for (let b = 0; b < boardResults.length; b++) {
          const br = boardResults[b];
          const playerHandsData = br.playerResults.map((pr: any, pi: number) => ({
            playerId: clientArray[pi]?.id || '',
            playerName: clientArray[pi]?.name || '',
            cards: serverBoards[b].playerCards[pi] || [],
            handRank: pr.name,
            score: pr.score,
          }));
          mpServer.sendBoardReveal(
            b,
            serverBoards[b].closedCards,
            playerHandsData,
            br.winnerIndex,
            br.winnerIndex >= 0 ? clientArray[br.winnerIndex]?.name || '' : 'Tie'
          );
        }

        // Broadcast HAND_COMPLETE to guests
        const handCompletePayload: HandCompletePayload = {
          boardResults: boardResults.map((br: any) => ({
            boardIndex: br.boardIndex,
            winnerIndex: br.winnerIndex,
            winnerName: br.winnerIndex >= 0 ? clientArray[br.winnerIndex]?.name || '' : 'Tie',
          })),
          chipDeltas: handResult.chipDeltas,
          playerNames: clientArray.map((c: any) => c.name),
          isComplete: handResult.completeWinner !== null,
          completeWinnerIndex: handResult.completeWinner,
          completeBonusAmount: handResult.completeBonusAmount,
        };
        mpServer.sendHandComplete(handCompletePayload);

        // Broadcast 'results' snapshot to spectators
        if (typeof (mpServer as any).broadcastToSpectators === 'function') {
          const spectatorResults: SpectatorSnapshot = {
            phase: 'results',
            boardCount: boardResults.length,
            players: clientArray.map((c: any) => ({ id: c.id, name: c.name, isReady: true })),
            communityCards: serverBoards.map((b: any) => b.openCards ?? []),
            revealedBoards: boardResults.map((br: any) => ({
              boardIndex: br.boardIndex,
              winnerName: br.winnerIndex >= 0 ? clientArray[br.winnerIndex]?.name || '' : 'Tie',
              playerHands: br.playerResults.map((pr: any, pi: number) => ({
                playerName: clientArray[pi]?.name || '',
                handRank: pr.name,
              })),
            })),
            spectatorCount: (mpServer as any).getSpectatorCount?.() ?? 0,
          };
          (mpServer as any).broadcastToSpectators(spectatorResults);
        }

        // Build RevealData for host and navigate
        buildRevealDataAndNavigate(boardResults, handResult, serverBoards, clientArray);
      },
    });
  }, [isHost, mpServer, config]);

  // --- Guest: wire client callbacks on mount ---
  useEffect(() => {
    if (isHost || !mpClient) return;

    mpClient.updateCallbacks({
      onBoardReveal: (data: BoardRevealPayload) => {
        if (!mountedRef.current) return;
        boardRevealsRef.current.set(data.boardIndex, data);
      },
      onHandComplete: (result: HandCompletePayload) => {
        if (!mountedRef.current) return;
        // MP-STABILITY 2026-07-06 (Problem 1) — HAND_COMPLETE is reliably delivered (ACK+retry),
        // but it can race ahead of one or more of this hand's BOARD_REVEAL messages, which now
        // carry their own independent ACK+retry and may still be in flight. Give them a bounded
        // grace period to land before falling back — instead of building immediately and locking
        // in a blank/tied board for any reveal that simply hadn't arrived yet.
        const boardsExpected = boardsRef.current.length;
        const tryBuild = (attemptsLeft: number) => {
          if (!mountedRef.current) return;
          if (boardRevealsRef.current.size >= boardsExpected || attemptsLeft <= 0) {
            buildGuestRevealDataAndNavigate(result);
            return;
          }
          setTimeout(() => tryBuild(attemptsLeft - 1), 150);
        };
        tryBuild(10); // ~1.5s max grace for in-flight BOARD_REVEAL retries to land
      },
    });
  }, [isHost, mpClient, playerIndex, playerCount, config, boardCount]);

  // --- Guest: detect host loss / connection loss (CAPS 10, rejoin option CAPS 12) ---
  useEffect(() => {
    if (isHost || !mpClient) return;
    const navigateToRejoin = () => {
      // Unified: rejoin returns to the Multiplayer Lobby (single MP system).
      useGameStore.getState().resetMultiplayer();
      router.replace('/lobby' as any);
    };

    const startReconnectWindow = (bannerMsg: string, onExpire: () => void, seconds = 15) => {
      if (!mountedRef.current) return;
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
      if (reconnectAlertTimerRef.current) clearTimeout(reconnectAlertTimerRef.current);
      setReconnectCountdown(seconds);
      setDisconnectBanner(bannerMsg);
      let secs = seconds;
      reconnectTimerRef.current = setInterval(() => {
        secs -= 1;
        if (!mountedRef.current) { clearInterval(reconnectTimerRef.current!); return; }
        setReconnectCountdown(secs);
        if (secs <= 0) {
          clearInterval(reconnectTimerRef.current!);
          reconnectTimerRef.current = null;
          setReconnectCountdown(null);
        }
      }, 1000);
      reconnectAlertTimerRef.current = setTimeout(onExpire, seconds * 1000);
    };

    const handleHostLost = () => {
      // MP-LEAVE-RECOVERY (Issue C) — the deal-clock that force-resolves a hand is HOST-only, so
      // before this fix a non-host whose host vanished sat until the 120s server reaper (~135s).
      // Give the host HOST_LEFT_RESOLVE_GRACE_S to return (the banner counts it down); if it
      // doesn't, resolve the hand cleanly. There is NO server-authoritative outcome — game_rooms
      // has no winner/board columns and the reaper settles no chips — so we must NOT fabricate a
      // result. Cancel with no chip change and return to the lobby. Navigate directly rather than
      // behind an Alert button, since Alert.alert is a no-op on web (the banner is the message).
      startReconnectWindow('Opponent left — ending hand in', () => {
        if (!mountedRef.current || completedRef.current) return;
        // Clear the WHOLE room roster, not just our own seat. The host that left would
        // otherwise leave an orphaned room_players row (the non-host's own teardown only
        // frees its own seat). finish_table sets status=finished AND deletes every roster
        // row for the room — idempotent and non-host callable (SECURITY DEFINER, room-code
        // only), so it also no-ops harmlessly if the server net already finished the room.
        if (storeRoomCode) void finishTable(storeRoomCode);
        useGameStore.getState().resetMultiplayer();
        router.replace('/lobby' as any);
      }, HOST_LEFT_RESOLVE_GRACE_S);
    };
    const handleDisconnected = () => {
      startReconnectWindow('Connection lost — rejoining?', () => {
        if (!mountedRef.current) return;
        Alert.alert(
          'Connection Lost',
          'Lost connection to the game room. You can try to rejoin.',
          [
            { text: 'Leave', style: 'cancel', onPress: () => { useGameStore.getState().resetMultiplayer(); router.replace('/'); } },
            { text: 'Rejoin', onPress: navigateToRejoin },
          ]
        );
      });
    };
    mpClient.updateCallbacks({ onHostLost: handleHostLost, onDisconnected: handleDisconnected });
  }, [isHost, mpClient, router, storeRoomCode]);

  // --- Host: detect channel disconnect (CAPS 10) ---
  useEffect(() => {
    if (!isHost || !mpServer) return;
    mpServer.updateCallbacks({
      onDisconnected: () => {
        if (!mountedRef.current) return;
        setDisconnectBanner('Connection lost');
        Alert.alert(
          'Connection Lost',
          'Lost connection to the game room.',
          [{ text: 'Leave', onPress: () => {
            useGameStore.getState().resetMultiplayer();
            router.replace('/');
          }}]
        );
      },
    });
  }, [isHost, mpServer, router]);

  // --- Waiting-state timeout (CAPS 10, rejoin option CAPS 12) ---
  useEffect(() => {
    if (phase !== 'waiting') return;
    const timeout = setTimeout(() => {
      if (!mountedRef.current || phase !== 'waiting') return;
      setDisconnectBanner('Waiting timed out');
      const buttons: any[] = [
        { text: 'Keep Waiting', style: 'cancel', onPress: () => setDisconnectBanner(null) },
        { text: 'Leave', style: 'destructive', onPress: () => {
          useGameStore.getState().resetMultiplayer();
          router.replace('/');
        }},
      ];
      if (!isHost && storeRoomCode) {
        buttons.push({ text: 'Rejoin', onPress: () => {
          useGameStore.getState().resetMultiplayer();
          router.replace('/lobby' as any);
        }});
      }
      Alert.alert('Waiting Timed Out', 'No response from other players. The game may have ended.', buttons);
    }, WAITING_STATE_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [phase, router, isHost, storeRoomCode]);

  // Host: build RevealData from server evaluation results
  const buildRevealDataAndNavigate = useCallback((
    boardResults: any[],
    handResult: any,
    serverBoards: any[],
    clientArray: any[]
  ) => {
    completedRef.current = true; // normal completion — keep the session alive for /results + rematch
    const myIdx = playerIndex;

    const revealBoards: RevealBoardData[] = boardResults.map((br: any, bi: number) => {
      const board = serverBoards[bi];
      const myResult = br.playerResults[myIdx];
      const otherCards: Card[][] = [];
      const otherHandNames: string[] = [];
      for (let p = 0; p < clientArray.length; p++) {
        if (p !== myIdx) {
          otherCards.push(board.playerCards[p] || []);
          otherHandNames.push(br.playerResults[p]?.name || '');
        }
      }

      const winner: 'player' | 'bot' | 'tie' =
        br.winnerIndex === myIdx ? 'player' :
        br.winnerIndex === -1 ? 'tie' : 'bot';

      return {
        openCards: board.openCards,
        closedCards: board.closedCards,
        playerCards: board.playerCards[myIdx] || [],
        allBotCards: otherCards,
        winner,
        playerHandName: myResult?.name || '',
        botHandName: br.winnerIndex >= 0 && br.winnerIndex !== myIdx
          ? br.playerResults[br.winnerIndex]?.name || '' : '',
        allBotHandNames: otherHandNames,
        playerHighlightIds: [],
        botHighlightIds: [],
        boardHighlightIds: [],
        potAmount: config.potPerBoard * clientArray.length,
      };
    });

    const myDelta = handResult.chipDeltas[myIdx];
    addChips(myDelta);
    if (ECONOMY_FLAGS.matchCostEnabled) {
      trackChipsSpent(getMatchCost(config.potPerBoard, boardCount));
    }

    setRevealData({
      boards: revealBoards,
      netChips: myDelta,
      playerChipsWon: myDelta + config.potPerBoard * boardCount,
      isComplete: handResult.completeWinner !== null,
      completeBonusAmount: handResult.completeBonusAmount,
      completeWinner: handResult.completeWinner !== null
        ? (handResult.completeWinner === myIdx ? 'player' : 'bot')
        : null,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers: clientArray.length,
      boardCount,
      // ECON-SW P1.1 (S62) — stable per-hand id for record_hand_net server-side dedup. Host
      // reveal fires once per hand (onAllPlayersReady) → stable across any results re-mount.
      handId: `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });

    CapsHooks.gameCompleted(myDelta + config.potPerBoard * boardCount, myDelta > 0, 0);
    track('mp_game_ended', {
      role: 'host',
      room_code: storeRoomCode,
      player_count: clientArray.length,
      board_count: boardCount,
      net_chips: myDelta,
      won: myDelta > 0,
      is_complete: handResult.completeWinner !== null,
    }, 'multiplayer-game');
    // Host owns the lobby room — mark it finished + clear its roster (kills the 'playing'
    // leak). No-op for legacy internet rooms (code not in game_rooms).
    if (storeRoomCode) void finishTable(storeRoomCode);
    // If this was a club table, submit the FULL roster to the club mini-league. We
    // identify each player by their realtime-presence id, which IS the device_id used
    // by room_players / touch_room_player. record_club_game is idempotent per room.
    const hostRoster: ClubGameResult[] = clientArray.map((c: any, i: number) => ({
      device_id: typeof c.id === 'string' ? c.id : null,
      user_id: null,
      won: (handResult.chipDeltas[i] ?? 0) > 0,
      net_chips: handResult.chipDeltas[i] ?? 0,
    }));
    maybeRecordClubGame(hostRoster);
    // Store opponentName for results screen "You beat {name}!" header
    const oppName = clientArray.find((c: any) => c.seat !== playerIndex)?.name ?? '';
    if (oppName) useGameStore.getState().setOpponentName(oppName);

    // MP-BOARDREVEAL — if the flag is on, play the same <BoardReveal> SOLO plays,
    // THEN navigate to /results in onRevealDone. Otherwise keep the jump-to-results
    // behavior so we can flip off live if 2-player desync feels weird.
    if (isMpBoardRevealEnabled()) {
      setPendingRevealBoards(adaptRevealBoardsForReveal(revealBoards));
      setShowSafeReveal(true);
      return;
    }
    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, config, boardCount, addChips, trackChipsSpent, setRevealData, router, storeRoomCode]);

  // Guest: build RevealData from BOARD_REVEAL + HAND_COMPLETE payloads
  const buildGuestRevealDataAndNavigate = useCallback((result: HandCompletePayload) => {
    completedRef.current = true; // normal completion — keep the session alive for /results + rematch
    const currentBoards = boardsRef.current;
    const reveals = boardRevealsRef.current;

    const revealBoards: RevealBoardData[] = currentBoards.map((board, bi) => {
      const reveal = reveals.get(bi);
      if (!reveal) {
        return {
          openCards: board.openCards,
          closedCards: [],
          playerCards: board.playerCards,
          allBotCards: [],
          winner: 'tie' as const,
          playerHandName: '',
          botHandName: '',
          allBotHandNames: [],
          playerHighlightIds: [],
          botHighlightIds: [],
          boardHighlightIds: [],
          potAmount: config.potPerBoard * playerCount,
        };
      }

      const myHand = reveal.playerHands[playerIndex];
      const otherCards: Card[][] = [];
      const otherHandNames: string[] = [];
      for (let p = 0; p < reveal.playerHands.length; p++) {
        if (p !== playerIndex) {
          otherCards.push(reveal.playerHands[p]?.cards || []);
          otherHandNames.push(reveal.playerHands[p]?.handRank || '');
        }
      }

      const winner: 'player' | 'bot' | 'tie' =
        reveal.winnerIndex === playerIndex ? 'player' :
        reveal.winnerIndex === -1 ? 'tie' : 'bot';

      return {
        openCards: board.openCards,
        closedCards: reveal.closedCards,
        playerCards: myHand?.cards || board.playerCards,
        allBotCards: otherCards,
        winner,
        playerHandName: myHand?.handRank || '',
        botHandName: reveal.winnerIndex >= 0 && reveal.winnerIndex !== playerIndex
          ? reveal.playerHands[reveal.winnerIndex]?.handRank || '' : '',
        allBotHandNames: otherHandNames,
        playerHighlightIds: [],
        botHighlightIds: [],
        boardHighlightIds: [],
        potAmount: config.potPerBoard * playerCount,
      };
    });

    const myDelta = result.chipDeltas[playerIndex] || 0;
    addChips(myDelta);
    if (ECONOMY_FLAGS.matchCostEnabled) {
      trackChipsSpent(getMatchCost(config.potPerBoard, boardCount));
    }

    const completeWinnerIsMe = result.completeWinnerIndex === playerIndex;

    setRevealData({
      boards: revealBoards,
      netChips: myDelta,
      playerChipsWon: myDelta + config.potPerBoard * boardCount,
      isComplete: result.isComplete,
      completeBonusAmount: result.completeBonusAmount,
      completeWinner: result.isComplete
        ? (completeWinnerIsMe ? 'player' : 'bot')
        : null,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers: playerCount,
      boardCount,
      // ECON-SW P1.1 (S62) — stable per-hand id for record_hand_net server-side dedup. Guest
      // reveal is HAND_COMPLETE-deduped (per network handId) → fires once per hand → stable
      // across any results re-mount.
      handId: `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });

    CapsHooks.gameCompleted(myDelta + config.potPerBoard * boardCount, myDelta > 0, 0);
    track('mp_game_ended', {
      role: 'guest',
      room_code: storeRoomCode,
      player_count: playerCount,
      board_count: boardCount,
      net_chips: myDelta,
      won: myDelta > 0,
      is_complete: result.isComplete,
    }, 'multiplayer-game');
    // If this was a club table, submit the FULL roster. Guest builds it from the
    // store's connectedPlayers (id = realtime presence key = device_id), seat-sorted,
    // then indexes chipDeltas by SORTED POSITION — same convention the host uses for
    // playerResults/clientArray. Realtime seats are contiguous in practice (the host
    // never removes disconnected clients from its Map), so position == seat number
    // today; using position keeps this correct even if that changes. Submitting from
    // every client is safe — record_club_game is idempotent on room_code.
    const seatOrdered = [...connectedPlayers].sort((a, b) => a.seat - b.seat);
    const guestRoster: ClubGameResult[] = seatOrdered.map((p, i) => {
      const net = result.chipDeltas[i] ?? 0;
      return {
        device_id: typeof p.id === 'string' ? p.id : null,
        user_id: null,
        won: net > 0,
        net_chips: net,
      };
    });
    maybeRecordClubGame(guestRoster);
    // Store opponentName for results screen "You beat {name}!" header
    const guestOppName = connectedPlayers.find(p => p.seat !== playerIndex)?.name ?? '';
    if (guestOppName) useGameStore.getState().setOpponentName(guestOppName);

    // MP-BOARDREVEAL — guest plays the reveal locally too (BOARD_REVEAL payloads
    // already arrived; boardRevealsRef is populated). Slight finish-time diff
    // between host and guest is fine — both land on the (static) /results.
    if (isMpBoardRevealEnabled()) {
      setPendingRevealBoards(adaptRevealBoardsForReveal(revealBoards));
      setShowSafeReveal(true);
      return;
    }
    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, playerCount, config, boardCount, addChips, trackChipsSpent, setRevealData, router, connectedPlayers, storeRoomCode]);

  // MP-BOARDREVEAL — adapter for the <BoardReveal> Modal. RevealBoardData has
  // allBotCards: Card[][] (per-opponent); BoardReveal expects botCards: Card[]
  // (the primary opponent) + optional allBotCards. We pass the first opponent
  // as botCards so the reveal renders correctly in 2P, and forward the full
  // multi-opponent list for 3P/4P.
  const adaptRevealBoardsForReveal = useCallback((src: RevealBoardData[]) => src.map((b) => ({
    winner: b.winner,
    playerHandName: b.playerHandName,
    botHandName: b.botHandName,
    allBotHandNames: b.allBotHandNames,
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: b.playerCards,
    botCards: b.allBotCards?.[0] ?? [],
    allBotCards: b.allBotCards,
    potAmount: b.potAmount,
    playerHighlightIds: b.playerHighlightIds,
    botHighlightIds: b.botHighlightIds,
    boardHighlightIds: b.boardHighlightIds,
  })), []);

  const onRevealDone = useCallback(() => {
    setShowSafeReveal(false);
    setPendingRevealBoards([]);
    setPhase('navigating');
    router.replace('/results');
  }, [router]);

  // Timer
  // MP-PARITY-DEEP 2026-07-09 — SOLO plays a buzzer + Heavy haptic + gold flash the
  // instant the countdown hits 0 (game.tsx:420-449); MP silently auto-filled with
  // no feedback at all. Mirror it here, once, exactly at expiry.
  const handleTimerExpire = useCallback(() => {
    playSound('buzzer');
    haptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    AnimatedRN.sequence([
      AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    autoFillAndReady();
  }, []);

  const timer = useGameTimer({
    initialSeconds: COUNTDOWN_SECS,
    onExpire: handleTimerExpire,
    autoStart: false,
  });

  // MP-PARITY-DEEP 2026-07-09 — SOLO's countdown escalation beeps at 10s/3s
  // (game.tsx:420); MP's countdown ran fully silent until expiry.
  useEffect(() => {
    if (!timer.isRunning) return;
    if (timer.timeLeft === 10 || timer.timeLeft === 3) playSound('timerLow');
  }, [timer.isRunning, timer.timeLeft]);

  // S73 — start the COUNTDOWN_SECS window the moment the FIRST player finishes (idempotent —
  // first caller wins). Triggered by handleReady locally + the READY_PRESSED broadcast on every
  // client, so all clients count the same window. Also arms the host backstop (see below).
  const startCountdown = useCallback(() => {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;
    timer.reset(COUNTDOWN_SECS);
    timer.start();
    // The first player just finished — arm the HOST-only backstop NOW (never before), just
    // above the countdown, to force-complete an unclean-disconnected client that can't run its
    // own expiry auto-fill. Cleared on hand completion / unmount by the mount effect cleanup.
    if (isHost && mpServer && !dealClockRef.current) {
      dealClockRef.current = setTimeout(() => {
        if (!mountedRef.current || completedRef.current) return;
        try { autoFillReadyRef.current?.(); } catch { /* ready host's own hand */ }
        try { (mpServer as any)?.forceReadyAllConnected?.(); } catch { /* force-complete the rest */ }
      }, DEAL_CLOCK_MS);
    }
  }, [timer, isHost, mpServer]);

  // --- Wire onReadyPressed (host receives from guests via rebroadcast, guests receive from host) ---
  useEffect(() => {
    if (!isHost || !mpServer) return;
    mpServer.updateCallbacks({ onReadyPressed: () => { if (mountedRef.current) startCountdown(); } });
  }, [isHost, mpServer, startCountdown]);

  useEffect(() => {
    if (isHost || !mpClient) return;
    mpClient.updateCallbacks({ onReadyPressed: () => { if (mountedRef.current) startCountdown(); } });
  }, [isHost, mpClient, startCountdown]);

  const handleTimeBank = useCallback(() => {
    if (timeBankUsed) return;
    setTimeBankUsed(true);
    timer.addTime(15);
    if (isInternetMP) {
      const payload = { playerName: myPlayerName };
      if (isHost && (mpServer as any)?.broadcastToAll) (mpServer as any).broadcastToAll('TIMEBANK', payload);
      else if (!isHost && (mpClient as any)?.send) (mpClient as any).send('TIMEBANK', payload);
    }
  }, [timeBankUsed, timer, myPlayerName, isHost, mpServer, mpClient, isInternetMP]);

  // Auto-fill remaining cards and send ready (placement-timer expiry / idle player).
  // VAMOS-MP-LOBBY 3D soft-lock fix: compute from REFS and BROADCAST OUTSIDE the
  // setState updater. The previous version did setHostReady/sendReady (a realtime
  // broadcast) AND side effects INSIDE a setBoards(prev => {...}) updater — React can
  // double-invoke that updater, firing the ready broadcast twice / from a transient
  // state. That double-invoke is the autoSim fill-race + the MP soft-lock. A
  // readySentRef makes the send idempotent so it can't race handleReady either.
  const autoFillAndReady = useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    const remaining = [...playerHandRef.current];
    const updated = boardsRef.current.map((board) => {
      const needed = CARDS_PER_BOARD - board.playerCards.length;
      if (needed > 0) {
        const toAdd = remaining.splice(0, needed);
        return { ...board, playerCards: [...board.playerCards, ...toAdd] };
      }
      return board;
    });
    // pure state updates (no side effects / broadcasts inside an updater)
    setBoards(updated);
    boardsRef.current = updated;
    setPlayerHand([]);
    setSelectedCardIds([]);
    setPhase('waiting');
    timer.stop();
    // broadcast exactly once, outside any updater
    const assignments = updated.map((b) => b.playerCards);
    if (isHost && mpServer) {
      mpServer.setHostReady(assignments);
    } else if (!isHost && mpClient) {
      mpClient.sendReady(assignments);
    }
  }, [timer, isHost, mpServer, mpClient]);

  // MP-LEAVE-RECOVERY — let the deal-clock call the latest autoFillAndReady without
  // listing it as an effect dep (which would restart the timer every render).
  const autoFillReadyRef = useRef(autoFillAndReady);
  useEffect(() => { autoFillReadyRef.current = autoFillAndReady; }, [autoFillAndReady]);

  // MP-LEAVE-RECOVERY — per-mount: (1) in-game heartbeat so the seat's last_seen stays fresh
  // while playing (the lobby/table heartbeat stops at game start), giving the server reaper a
  // signal; (2) HOST deal-clock that force-completes a hand that would otherwise wedge.
  useEffect(() => {
    const roomCode = storeRoomCode || null;
    let cancelled = false;
    (async () => {
      try {
        deviceIdRef.current = await getDeviceId().catch(() => null);
        try { userIdRef.current = (await getSupabase()?.auth.getUser())?.data?.user?.id ?? null; }
        catch { userIdRef.current = null; }
        if (cancelled) return;
        const beat = () => { if (roomCode) void touchRoomPlayer(roomCode, deviceIdRef.current, userIdRef.current); };
        beat(); // prime immediately
        heartbeatRef.current = setInterval(beat, INGAME_HEARTBEAT_MS);
      } catch { /* heartbeat is best-effort */ }
    })();

    // S73 — the host backstop is NO LONGER armed at mount. Placement is unlimited until the
    // first player finishes; the backstop is armed in startCountdown at that moment instead, so
    // a room where players are simply still arranging is never force-revealed.

    return () => {
      cancelled = true;
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (dealClockRef.current) { clearTimeout(dealClockRef.current); dealClockRef.current = null; }
    };
  }, [isHost, mpServer, storeRoomCode]);

  // MP-LEAVE-RECOVERY — BAIL detection (empty deps → cleanup runs ONLY on true unmount).
  // If the player leaves the game screen WITHOUT a normal completion (back / home / route
  // change / tab nav), tear the realtime session down so the OTHER player's host sees the
  // presence leave and is freed immediately. On a normal finish (completedRef) we keep
  // mpServer/mpClient alive so /results + rematch still work.
  useEffect(() => {
    return () => {
      if (!completedRef.current) {
        try { useGameStore.getState().resetMultiplayer(); } catch { /* best-effort teardown */ }
      }
    };
  }, []);

  // Card selection (same UX as game.tsx:741) — toggle in selectedCardIds, up to 4.
  const handleSelectCard = useCallback((card: Card) => {
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
      // At max (4) — replace the last selected with the new card
      return [...prev.slice(0, 3), card.id];
    });
  }, [isArranging]);

  // Place ALL selected cards on the board (or the first hand card if none selected).
  // Mirrors SOLO's handleBoardPress (game.tsx:773): compute cardsToPlace OUTSIDE the
  // setBoards updater and issue the three setState calls in the same synchronous handler
  // so React 18 batches them (no duplicate-card flicker, no side effects inside an updater).
  // MP removes placed cards from the hand on placement, so a selected card is always still
  // in the hand and never on another board — no cross-board re-validation needed.
  const handleBoardPress = useCallback((boardIndex: number) => {
    if (!isArranging) return;
    const currentHand = playerHandRef.current;
    if (currentHand.length === 0) return;

    const board = boardsRef.current[boardIndex];
    if (!board) return;

    const emptySlots = CARDS_PER_BOARD - board.playerCards.length;
    if (emptySlots <= 0) return; // board full — no-op

    const candidateCards: Card[] = selectedCardIds.length > 0
      ? selectedCardIds
          .map((id) => currentHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined)
      : currentHand.slice(0, 1);

    const cardsToPlace = candidateCards.slice(0, emptySlots);
    if (cardsToPlace.length === 0) return;

    haptic(Haptics?.ImpactFeedbackStyle?.Medium);
    playSound('cardPlace');
    const placedIds = new Set(cardsToPlace.map((c) => c.id));

    setBoards((prev) => {
      const prevBoard = prev[boardIndex];
      if (!prevBoard) return prev;
      // Re-validate slot count in the updater against a stale closure
      const slots = CARDS_PER_BOARD - prevBoard.playerCards.length;
      const validCards = cardsToPlace.slice(0, slots);
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
  }, [isArranging, selectedCardIds]);

  // Remove card from board
  const handleRemoveCardFromBoard = useCallback((boardIndex: number, card: Card) => {
    if (!isArranging) return;
    haptic(Haptics?.ImpactFeedbackStyle?.Light);
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
  }, [isArranging]);

  // Auto-place this board's empty slots from the player's hand (LOCAL ONLY — no
  // broadcast; MP only syncs the final assignments on Ready). Mirrors SOLO's
  // per-board Auto-Place. MP removes placed cards from the hand on placement, so a
  // card can never already be on another board — no cross-board re-validation needed.
  const handleAutoFillBoard = useCallback((boardIndex: number) => {
    if (!isArranging) return;
    const currentHand = playerHandRef.current;
    if (currentHand.length === 0) return;
    const board = boardsRef.current[boardIndex];
    if (!board || board.playerCards.length > 0) return;
    const slots = CARDS_PER_BOARD - board.playerCards.length;
    const cardsToPlace = currentHand.slice(0, slots);
    if (cardsToPlace.length === 0) return;
    haptic(Haptics?.ImpactFeedbackStyle?.Medium);
    playSound('cardPlace');
    const placedIds = new Set(cardsToPlace.map((c) => c.id));
    setBoards((prev) => {
      const prevBoard = prev[boardIndex];
      if (!prevBoard || prevBoard.playerCards.length > 0) return prev;
      const updated = [...prev];
      updated[boardIndex] = { ...prevBoard, playerCards: [...prevBoard.playerCards, ...cardsToPlace] };
      return updated;
    });
    setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
    setSelectedCardIds([]);
  }, [isArranging]);

  // Auto-place ALL empty boards from the hand in ONE batched update (no ready broadcast —
  // MP only syncs the final assignments on Ready). Mirrors SOLO's autoFillAllBoards and uses
  // refs so it never reads a stale closure mid-loop (a per-board loop would only fill board 0).
  const autoFillAllBoards = useCallback(() => {
    if (!isArranging) return;
    const hand = [...playerHandRef.current];
    if (hand.length === 0) return;
    let idx = 0;
    const placed = new Set<string>();
    const updated = boardsRef.current.map((b) => {
      const need = CARDS_PER_BOARD - b.playerCards.length;
      if (need <= 0) return b;
      const take = hand.slice(idx, idx + need);
      idx += need;
      take.forEach((c) => placed.add(c.id));
      return take.length ? { ...b, playerCards: [...b.playerCards, ...take] } : b;
    });
    if (placed.size === 0) return;
    haptic(Haptics?.ImpactFeedbackStyle?.Medium);
    playSound('cardPlace');
    setBoards(updated);
    setPlayerHand((h) => h.filter((c) => !placed.has(c.id)));
    setSelectedCardIds([]);
  }, [isArranging]);

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    if (readySentRef.current) return; // idempotent: don't double-send (race with auto-fill timeout)
    readySentRef.current = true;
    // AUTO-LEARN 2026-07-06 — multiplayer never tracked cards_placed at all (it has its
    // own handleReady/startCountdown, entirely separate from game.tsx's, and the event
    // was only ever wired into the solo/practice screen). Track it here too, guarded by
    // the same idempotent readySentRef so it fires exactly once per hand per player.
    track('cards_placed', { mode: 'multiplayer', isHost, numberOfPlayers: playerCount, boardCount }, 'multiplayer-game');
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    timer.stop();
    setSelectedCardIds([]);
    setPhase('waiting');

    const assignments = boards.map((b) => b.playerCards);
    if (isHost && mpServer) {
      mpServer.setHostReady(assignments);
    } else if (!isHost && mpClient) {
      mpClient.sendReady(assignments);
    }

    // Broadcast READY_PRESSED so all players start their countdown
    const payload = { playerName: myPlayerName };
    if (isHost && (mpServer as any)?.broadcastToAll) {
      (mpServer as any).broadcastToAll('READY_PRESSED', payload);
    } else if (!isHost && (mpClient as any)?.send) {
      (mpClient as any).send('READY_PRESSED', payload);
    }
    startCountdown();
  }, [allBoardsFull, timer, boards, isHost, mpServer, mpClient, myPlayerName, startCountdown]);

  const handleBack = useCallback(() => {
    const leave = () => {
      // Host abandoning a live table — finish it so it doesn't leak as 'playing'.
      if (isHost && storeRoomCode) void finishTable(storeRoomCode);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    };

    if (phase === 'arranging' || phase === 'waiting') {
      Alert.alert(
        'Leave Game?',
        'You will forfeit this hand if you leave.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leave },
        ]
      );
    } else {
      leave();
    }
  }, [phase, router, isHost, storeRoomCode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTimeLeft = timer.timeLeft;
  const timerColor = displayTimeLeft > 20
    ? COLORS.success
    : displayTimeLeft > 10
    ? COLORS.gold
    : COLORS.danger;

  const cardsRemaining = playerHand.length;

  const cardsToPlaceN = boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0);
  const otherPlayersN = Math.max(1, playerCount - 1);
  void formatTime; // legacy mm:ss formatter no longer rendered inline; TimerController owns it

  // VAMOS-UNIFY-GAMEVIEW 2026-06-29 — map MP's BoardDisplay rows into the BoardState
  // shape BoardArrangement expects (it reads board.allBotCards[0] || board.botCards).
  // During arrangement these are empty; the player-facing slots are all that render.
  const _baBoards: BoardState[] = boards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: b.playerCards,
    botCards: [],
    allBotCards: [[]],
    revealed: b.revealed,
  }));

  return (
    <GameView
      theme={theme}
      visualTheme={visualTheme}
      onBack={handleBack}
      chips={chips}
      screenW={SCREEN_W}
      layout={_L}
      boards={_baBoards}
      boardShakeStyles={[]}
      playerHand={playerHand}
      selectedCardIds={selectedCardIds}
      isArranging={isArranging}
      allBoardsFull={allBoardsFull}
      cardsRemaining={cardsRemaining}
      boardError={null}
      boardCount={boardCount}
      numberOfPlayers={_safePlayers}
      potPerBoard={config.potPerBoard * playerCount}
      countdownActive={timer.isRunning}
      countdown={displayTimeLeft}
      timeBankUsed={timeBankUsed}
      gamesPlayed={gamesPlayed}
      playerReady={false}
      allBotsReady={false}
      showContinueButton={false}
      showTimerBar={isArranging && timer.isRunning}
      timerBarCountdown={displayTimeLeft}
      timerBarTotal={COUNTDOWN_SECS}
      timerBarColor={timerColor}
      onSelectCard={handleSelectCard}
      onBoardPress={handleBoardPress}
      onRemoveCard={handleRemoveCardFromBoard}
      onAutoFill={handleAutoFillBoard}
      onAutoFillAll={autoFillAllBoards}
      onUndo={() => {}}
      onReady={handleReady}
      onTimeBank={handleTimeBank}
      onContinue={() => {}}
      preChrome={
        <AnimatedRN.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(201,168,76,0.18)', opacity: autoPlaceFlashAnim, zIndex: 99 }]}
        />
      }
      reveal={showSafeReveal ? { boards: pendingRevealBoards, onDone: onRevealDone, revealSpeed: config.revealSpeed } : null}
      topCenter={
        <>
          {isArranging && !timer.isRunning && (
            <Text style={styles.freePlayLabel} accessibilityLiveRegion="polite">
              {cardsRemaining === 0 ? t().allPlaced : t().arrangeCards(cardsRemaining)}
            </Text>
          )}
          {isArranging && timer.isRunning && (
            <View style={styles.countdownSection} accessibilityLiveRegion="polite">
              <TimerController
                countdown={displayTimeLeft}
                total={COUNTDOWN_SECS}
                isActive={true}
                firstFinisher={null}
                timerSize={TIMER_SIZE}
                timerColor={timerColor}
                timerPulsing={displayTimeLeft <= 10}
              />
            </View>
          )}
          {phase === 'waiting' && (
            <Text style={styles.waitingHeaderText} accessibilityLiveRegion="polite">{t().waitingForOthers(otherPlayersN)}</Text>
          )}
        </>
      }
      topRight={
        <View style={styles.topRight}>
          {isHost && isInternetMP && spectatorCount > 0 && (
            <Text style={styles.spectatorBadge}>👁 {spectatorCount}</Text>
          )}
          <ConnectionStatus connected={isConnected} />
          <View style={styles.headerChips}>
            <Text style={styles.headerChipsEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰</Text>
            <Text style={styles.headerChipsAmount}>{chips.toLocaleString()}</Text>
          </View>
        </View>
      }
      belowTopBar={
        disconnectBanner ? (
          <View style={styles.disconnectBanner}>
            <Text style={styles.disconnectText}>
              {reconnectCountdown !== null
                ? `⚠️ ${disconnectBanner} ${reconnectCountdown}s...`
                : `⚠️ ${disconnectBanner}`}
            </Text>
          </View>
        ) : null
      }
      header={
        isInternetMP && opponentName !== 'Opponent' ? (
          <View style={styles.opponentRow}>
            <Text style={[styles.vsLabel, { color: theme.textMuted }]}>vs</Text>
            <OpponentHeader
              name={opponentName}
              isOnline={opponentConnected}
              isThinking={phase === 'waiting' && opponentConnected}
            />
          </View>
        ) : (
          <Text style={[styles.modeText, { color: theme.textSecondary }]}>
            {playerCount}P {isHost ? 'HOST' : 'GUEST'} · {playerNames[playerIndex] || `Seat ${playerIndex + 1}`}
          </Text>
        )
      }
      chrome={
        <>
          {/* Chat bubbles — overflow up, never onto cards */}
          {isInternetMP && (
            <View style={styles.bubbleDock} pointerEvents="box-none">
              <ChatBubbles messages={chatMessages} />
            </View>
          )}

          {/* Waiting overlay */}
          {phase === 'waiting' && (
            <View style={styles.waitingOverlay}>
              <View style={[styles.waitingBox, { backgroundColor: theme.surface, borderColor: theme.boardBorder }]}>
                <Text style={[styles.waitingText, { color: theme.textSecondary }]}>{t().waitingForOthers(otherPlayersN)}</Text>
              </View>
            </View>
          )}

          {/* Emote/chat bar — dedicated IN-FLOW strip below the hand (never over cards) */}
          {isInternetMP && (
            <ChatBar
              myName={myPlayerName}
              onSend={handleSendChat}
            />
          )}
        </>
      }
    />
  );
}

/**
 * MP-RENDER-PARITY 2026-06-28 — ErrorBoundary wrap matches SOLO's pattern (game.tsx
 * line 2020). Crashes in placement/wait UI now hit the boundary instead of tearing
 * down the realtime/lobby chain above.
 */
export default function MultiplayerGameScreen() {
  return (
    <ErrorBoundary>
      <MultiplayerGameScreenInner />
    </ErrorBoundary>
  );
}

// MP-RENDER-PARITY 2026-06-28 — styles now mirror SOLO's PR-M tokens (rs/rv/rf,
// PRD.zone, themed bot/opponent strip, inline headerChips, mint READY button).
// Background, surface, and border colors are applied INLINE via the theme prop
// so visualTheme changes light up MP without a re-style here.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme.background
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
  },
  backButton: {
    width: rs(36),
    height: rs(36),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rv(8),
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
  // Mint instruction pill — mirrors SOLO's freePlayLabel ("PLACE N CARDS").
  freePlayLabel: {
    color: COLORS.mint,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.45)',
    paddingHorizontal: rs(10),
    paddingVertical: 3,
    borderRadius: rv(10),
    overflow: 'hidden',
    textTransform: 'uppercase' as any,
  },
  waitingHeaderText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
    fontWeight: '600',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  spectatorBadge: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(12),
    fontWeight: '600',
  },
  // Inline chips pill (matches SOLO's headerChips: mint bg/border).
  headerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.45)',
    paddingHorizontal: rs(8),
    paddingVertical: 3,
    borderRadius: rv(10),
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
  // Opponent strip — same vertical budget + bg/border treatment as SOLO's botSection.
  botSection: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    zIndex: 10,
  },
  modeText: {
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Reserved band for chat toasts so they never reach the boards (overflow spills up).
  bubbleDock: {
    height: rh(34),
    justifyContent: 'flex-end',
    paddingHorizontal: rs(12),
    overflow: 'visible',
  },
  boardsColumn: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: rs(16),
    gap: rs(4),
  },
  timeBankBtn: {
    alignSelf: 'center',
    marginBottom: rs(4),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(6),
  },
  timeBankText: {
    color: COLORS.gold,
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Inline READY button — themed, replaces the imported <Button variant="gold">.
  readySection: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
  },
  readyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(12),
    paddingHorizontal: rs(24),
  },
  readyBtnDisabled: {
    opacity: 0.4,
  },
  readyBtnText: {
    fontSize: rf(16),
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase' as any,
  },
  waitingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: rs(20),
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  waitingBox: {
    // backgroundColor + borderColor applied inline via theme
    paddingHorizontal: rs(24),
    paddingVertical: rs(12),
    borderRadius: rv(10),
    borderWidth: 1,
  },
  waitingText: {
    fontSize: rf(16),
    fontWeight: '600',
  },
  disconnectBanner: {
    backgroundColor: COLORS.neonRed + '33',
    paddingVertical: rs(6),
    paddingHorizontal: rs(12),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neonRed,
  },
  disconnectText: {
    color: COLORS.neonRed,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    paddingHorizontal: rs(8),
  },
  vsLabel: {
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },
});
