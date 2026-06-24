import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD } from '../constants/gameConfig';
import { useGameTimer } from '../hooks/useGameTimer';
import { BoardRevealPayload, HandCompletePayload, CardsDealtPayload } from '../constants/networkConfig';
import { RevealBoardData } from '../types/gameTypes';
import { playSound } from '../utils/sounds';
import { WAITING_STATE_TIMEOUT_MS, SpectatorSnapshot } from '../utils/realtimeMultiplayer';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { getMatchCost } from '../utils/economy';
import { CapsHooks } from '../utils/learning';
import { track } from '../utils/analytics';
import { finishTable } from '../utils/lobbyApi';
import ChatOverlay, { ChatMessage } from '../components/ChatOverlay';
import ConnectionStatus from '../components/ConnectionStatus';
import { ChatMsg } from '../utils/realtimeMultiplayer';
import { OpponentHeader } from '../components/OpponentHeader';

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

const FREE_TIME_SECS = 30;
const COUNTDOWN_SECS = 30;

// Layout constants
const TOP_BAR_H = 44;
const MODE_BADGE_H = 24;
const FLOATING_ACTIONS_H = 68; // paddingVertical:10×2 + button paddingVertical:12×2 + text ≈ 68px
const HINT_H = 26;             // selectionHint / boardError bar
const BOARD_CHROME = 28;       // per-board non-card overhead: header + inner padding + row gaps

interface BoardDisplay {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  revealed: boolean;
}

export default function MultiplayerGameScreen() {
  const router = useRouter();
  const { height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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

  const isHost = params.isHost === 'true';
  const playerIndex = parseInt(params.playerIndex || '0', 10);
  const playerCount = parseInt(params.playerCount || '2', 10);

  let yourCards: Card[] = [];
  try { yourCards = JSON.parse(params.yourCards || '[]'); } catch { yourCards = []; }

  let boardsParam: CardsDealtPayload['boards'] = [];
  try { boardsParam = JSON.parse(params.boards || '[]'); } catch { boardsParam = []; }

  const boardCount = boardsParam.length;

  // Dynamic card sizing (same formula as game.tsx)
  const PLAYER_HAND_H = SCREEN_H < 700 ? 115 : SCREEN_H < 800 ? 128 : 140;
  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const boardSpace = (safeH - TOP_BAR_H - MODE_BADGE_H - PLAYER_HAND_H - FLOATING_ACTIONS_H - HINT_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  const BOARD_CARD_H = Math.max(28, Math.min(82, Math.floor(boardSpace / 2)));

  // State
  const [boards, setBoards] = useState<BoardDisplay[]>(() =>
    boardsParam.map((b) => ({
      openCards: b.openCards,
      closedCards: [],
      playerCards: [],
      revealed: false,
    }))
  );
  const [playerHand, setPlayerHand] = useState<Card[]>(yourCards);
  const playerHandRef = useRef(playerHand);
  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  const boardsRef = useRef(boards);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
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
  const [freeTimeLeft, setFreeTimeLeft] = useState(FREE_TIME_SECS);
  const [readyEnabled, setReadyEnabled] = useState(false);
  const countdownStartedRef = useRef(false);
  // Guards the ready broadcast against double-send (timeout auto-fill vs manual ready,
  // and React updater double-invoke). One hand per screen mount, so no reset needed.
  const readySentRef = useRef(false);
  const freeTimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleSendChat = useCallback((text: string) => {
    const msg: ChatMsg = { playerName: myPlayerName, text, timestamp: Date.now() };
    addChatMessage(msg, true);
    if (isHost && (mpServer as any)?.sendChat) {
      (mpServer as any).sendChat(text, myPlayerName);
    } else if (!isHost && (mpClient as any)?.sendChat) {
      (mpClient as any).sendChat(text, myPlayerName);
    }
  }, [myPlayerName, isHost, mpServer, mpClient, addChatMessage]);

  // --- Time bank (1 use per hand) ---
  const [timeBankUsed, setTimeBankUsed] = useState(false);

  // Collected reveal data for guest
  const boardRevealsRef = useRef<Map<number, BoardRevealPayload>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    CapsHooks.gameStarted('online');
    return () => { mountedRef.current = false; };
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
  useEffect(() => {
    if (!isHost || !mpServer || !isInternetMP) return;
    mpServer.updateCallbacks({ onChat: (msg: ChatMsg) => { if (mountedRef.current) addChatMessage(msg, false); } });
  }, [isHost, mpServer, isInternetMP, addChatMessage]);

  // --- Wire onChat for guest ---
  useEffect(() => {
    if (isHost || !mpClient || !isInternetMP) return;
    mpClient.updateCallbacks({ onChat: (msg: ChatMsg) => { if (mountedRef.current) addChatMessage(msg, msg.playerName === myPlayerName); } });
  }, [isHost, mpClient, isInternetMP, addChatMessage, myPlayerName]);

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
        buildGuestRevealDataAndNavigate(result);
      },
    });
  }, [isHost, mpClient, playerIndex, playerCount, config, boardCount]);

  // --- Guest: detect host loss / connection loss (CAPS 10, rejoin option CAPS 12) ---
  useEffect(() => {
    if (isHost || !mpClient) return;
    const navigateToRejoin = () => {
      const code = storeRoomCode;
      useGameStore.getState().resetMultiplayer();
      router.replace({ pathname: '/lobby/internet-join', params: code ? { prefillCode: code } : {} } as any);
    };

    const startReconnectWindow = (bannerMsg: string, onExpire: () => void) => {
      if (!mountedRef.current) return;
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
      if (reconnectAlertTimerRef.current) clearTimeout(reconnectAlertTimerRef.current);
      setReconnectCountdown(15);
      setDisconnectBanner(bannerMsg);
      let secs = 15;
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
      reconnectAlertTimerRef.current = setTimeout(onExpire, 15000);
    };

    const handleHostLost = () => {
      startReconnectWindow('Host disconnected — leaving in', () => {
        if (!mountedRef.current) return;
        Alert.alert(
          'Host Disconnected',
          'The host has left the game.',
          [{ text: 'Leave', onPress: () => { useGameStore.getState().resetMultiplayer(); router.replace('/'); } }]
        );
      });
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
          const code = storeRoomCode;
          useGameStore.getState().resetMultiplayer();
          router.replace({ pathname: '/lobby/internet-join', params: { prefillCode: code } } as any);
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
    // Store opponentName for results screen "You beat {name}!" header
    const oppName = clientArray.find((c: any) => c.seat !== playerIndex)?.name ?? '';
    if (oppName) useGameStore.getState().setOpponentName(oppName);
    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, config, boardCount, addChips, trackChipsSpent, setRevealData, router, storeRoomCode]);

  // Guest: build RevealData from BOARD_REVEAL + HAND_COMPLETE payloads
  const buildGuestRevealDataAndNavigate = useCallback((result: HandCompletePayload) => {
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
    // Store opponentName for results screen "You beat {name}!" header
    const guestOppName = connectedPlayers.find(p => p.seat !== playerIndex)?.name ?? '';
    if (guestOppName) useGameStore.getState().setOpponentName(guestOppName);
    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, playerCount, config, boardCount, addChips, trackChipsSpent, setRevealData, router, connectedPlayers, storeRoomCode]);

  // Timer
  const handleTimerExpire = useCallback(() => {
    autoFillAndReady();
  }, []);

  const timer = useGameTimer({
    initialSeconds: COUNTDOWN_SECS,
    onExpire: handleTimerExpire,
    autoStart: false,
  });

  // Start 30s countdown (idempotent — first caller wins)
  const startCountdown = useCallback(() => {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;
    timer.reset(COUNTDOWN_SECS);
    timer.start();
  }, [timer]);

  // Free time countdown on mount — 30s before READY button appears
  useEffect(() => {
    freeTimeIntervalRef.current = setInterval(() => {
      setFreeTimeLeft((prev) => {
        if (prev <= 1) {
          if (freeTimeIntervalRef.current) clearInterval(freeTimeIntervalRef.current);
          setReadyEnabled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (freeTimeIntervalRef.current) clearInterval(freeTimeIntervalRef.current);
    };
  }, []);

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
    setSelectedCardId(null);
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

  // Card selection (same UX as game.tsx)
  const handleSelectCard = useCallback((card: Card) => {
    if (!isArranging) return;
    haptic(Haptics?.ImpactFeedbackStyle?.Light);
    playSound('cardSelect');
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }, [isArranging]);

  // Place card on board
  const handleBoardPress = useCallback((boardIndex: number) => {
    if (!isArranging) return;
    const currentHand = playerHandRef.current;
    if (currentHand.length === 0) return;

    const cardToPlace = selectedCardId
      ? currentHand.find((c) => c.id === selectedCardId)
      : currentHand[0];
    if (!cardToPlace) return;

    setBoards((prev) => {
      const board = prev[boardIndex];
      if (!board || board.playerCards.length >= CARDS_PER_BOARD) return prev;
      haptic(Haptics?.ImpactFeedbackStyle?.Medium);
      playSound('cardPlace');
      const updated = [...prev];
      updated[boardIndex] = {
        ...board,
        playerCards: [...board.playerCards, cardToPlace],
      };
      setPlayerHand((hand) => hand.filter((c) => c.id !== cardToPlace.id));
      setSelectedCardId(null);
      return updated;
    });
  }, [isArranging, selectedCardId]);

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

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    if (readySentRef.current) return; // idempotent: don't double-send (race with auto-fill timeout)
    readySentRef.current = true;
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    timer.stop();
    setSelectedCardId(null);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topInfo}>
          {isArranging && !timer.isRunning && freeTimeLeft > 0 && (
            <View style={[styles.timerContainer, { borderColor: COLORS.success }]}>
              <Text style={[styles.timerText, { color: COLORS.success }]}>
                Free {freeTimeLeft}s
              </Text>
            </View>
          )}
          {isArranging && timer.isRunning && (
            <View style={[
              styles.timerContainer,
              { borderColor: timerColor },
              displayTimeLeft <= 15 && styles.timerUrgent,
            ]}>
              <Text style={[styles.timerText, { color: timerColor }]}>
                {formatTime(displayTimeLeft)}
              </Text>
            </View>
          )}
          {phase === 'waiting' && (
            <Text style={styles.statusText}>WAITING...</Text>
          )}
        </View>
        <View style={styles.topRight}>
          {isHost && isInternetMP && spectatorCount > 0 && (
            <Text style={styles.spectatorBadge}>👁 {spectatorCount}</Text>
          )}
          <ConnectionStatus connected={isConnected} />
          <ChipsDisplay amount={chips} />
        </View>
      </View>

      {/* Disconnect / reconnect banner */}
      {disconnectBanner && (
        <View style={styles.disconnectBanner}>
          <Text style={styles.disconnectText}>
            {reconnectCountdown !== null
              ? `⚠️ ${disconnectBanner} ${reconnectCountdown}s...`
              : `⚠️ ${disconnectBanner}`}
          </Text>
        </View>
      )}

      {/* Mode badge: opponent header (internet MP) or plain text (WiFi) */}
      <View style={styles.modeBadge}>
        {isInternetMP && opponentName !== 'Opponent' ? (
          <View style={styles.opponentRow}>
            <Text style={styles.vsLabel}>vs</Text>
            <OpponentHeader
              name={opponentName}
              isOnline={opponentConnected}
              isThinking={phase === 'waiting' && opponentConnected}
            />
          </View>
        ) : (
          <Text style={styles.modeText}>
            {playerCount}P {isHost ? 'HOST' : 'GUEST'} | {playerNames[playerIndex] || `Seat ${playerIndex + 1}`}
          </Text>
        )}
      </View>

      {/* Boards — stacked vertically (same as game.tsx) */}
      <View style={styles.boardsColumn}>
        {boards.map((board, i) => (
          <Board
            key={i}
            index={i}
            openCards={board.openCards}
            closedCards={board.closedCards}
            playerCards={board.playerCards}
            botCards={[]}
            revealed={board.revealed}
            active={false}
            potAmount={config.potPerBoard * playerCount}
            onPress={() => handleBoardPress(i)}
            onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
            isArrangement={isArranging}
            selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
            cardHeight={BOARD_CARD_H}
          />
        ))}
      </View>

      {/* Player hand — face-up at bottom */}
      {isArranging && (
        <PlayerHand
          cards={playerHand}
          selectedCardIds={selectedCardId ? [selectedCardId] : []}
          onSelectCard={handleSelectCard}
        />
      )}

      {/* Time bank button — visible when countdown running and < 20s left */}
      {isArranging && timer.isRunning && displayTimeLeft < 20 && !timeBankUsed && (
        <Pressable style={styles.timeBankBtn} onPress={handleTimeBank}>
          <Text style={styles.timeBankText}>⏱ +15s</Text>
        </Pressable>
      )}

      {/* Ready button — only after free time ends */}
      {isArranging && readyEnabled && (
        <View style={styles.readySection}>
          <Button
            title={allBoardsFull ? 'READY' : `Place ${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} more cards`}
            variant="gold"
            disabled={!allBoardsFull}
            onPress={handleReady}
          />
        </View>
      )}

      {/* Waiting overlay */}
      {phase === 'waiting' && (
        <View style={styles.waitingOverlay}>
          <View style={styles.waitingBox}>
            <Text style={styles.waitingText}>Waiting for other players...</Text>
          </View>
        </View>
      )}

      {/* Chat overlay — internet MP only */}
      {isInternetMP && (
        <ChatOverlay
          myName={myPlayerName}
          messages={chatMessages}
          onSend={handleSendChat}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },
  topInfo: {
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spectatorBadge: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  timerContainer: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  timerUrgent: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.neonRed + '26',
  },
  timerText: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  modeBadge: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  modeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  boardsColumn: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 16,
    gap: 4,
  },
  timeBankBtn: {
    alignSelf: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  timeBankText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  readySection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  waitingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'center',
    backgroundColor: COLORS.background + 'CC',
  },
  waitingBox: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectBanner: {
    backgroundColor: COLORS.neonRed + '33',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neonRed,
  },
  disconnectText: {
    color: COLORS.neonRed,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  vsLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
