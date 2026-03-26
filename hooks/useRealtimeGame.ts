/**
 * useRealtimeGame — lightweight Supabase channel hook for real-time game sync.
 * Wraps direct Supabase Realtime channels (vs the heavier RealtimeServer class).
 * Used for game state broadcast: deal → placement → reveal → results.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from '../utils/supabase';

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'placement'
  | 'all_ready'
  | 'opponent_reveal'
  | 'community_reveal'
  | 'results';

export interface RealtimeGameState {
  phase: GamePhase;
  boards: any[];
  placements: Record<string, any>;
  readyPlayers: string[];
  results: any | null;
  round: number;
}

export function useRealtimeGame(
  sessionId: string | null,
  playerName: string,
  isHost: boolean
) {
  const [gameState, setGameState] = useState<RealtimeGameState | null>(null);
  const [myHand, setMyHand] = useState<any[]>([]);
  const [opponentPlacements, setOpponentPlacements] = useState<Record<string, any>>({});
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionId) return;
    const sb = getSupabase();
    if (!sb) return;

    const ch = sb.channel(`caps:game:${sessionId}`, {
      config: { broadcast: { self: true } },
    });

    // Game state from host
    ch.on('broadcast', { event: 'game_state' }, ({ payload }: any) => {
      setGameState(payload as RealtimeGameState);
    });

    // Hand directed to this player
    ch.on('broadcast', { event: `hand:${playerName}` }, ({ payload }: any) => {
      setMyHand(payload.cards ?? []);
    });

    // Player ready signals
    ch.on('broadcast', { event: 'player_ready' }, ({ payload }: any) => {
      const name: string = payload.player ?? '';
      setReadyPlayers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    });

    // Placement reveal (after all ready)
    ch.on('broadcast', { event: 'reveal_placements' }, ({ payload }: any) => {
      setOpponentPlacements(payload.placements ?? {});
    });

    // Community card reveal (turn/river)
    ch.on('broadcast', { event: 'reveal_community' }, ({ payload }: any) => {
      setGameState((prev) => {
        if (!prev) return prev;
        const boards = [...prev.boards];
        if (boards[payload.boardIndex]) {
          boards[payload.boardIndex] = {
            ...boards[payload.boardIndex],
            revealedCount: payload.revealedCount ?? 0,
          };
        }
        return { ...prev, boards, phase: 'community_reveal' };
      });
    });

    // Results
    ch.on('broadcast', { event: 'game_results' }, ({ payload }: any) => {
      setGameState((prev) =>
        prev ? { ...prev, phase: 'results', results: payload } : prev
      );
    });

    ch.subscribe((status: string) => {
      setConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = ch;

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, playerName]);

  // HOST: Deal cards to all players
  const dealCards = useCallback(
    (hands: Record<string, any[]>, boards: any[]) => {
      if (!isHost || !channelRef.current) return;
      // Send each player their hand privately
      Object.entries(hands).forEach(([name, cards]) => {
        channelRef.current.send({
          type: 'broadcast',
          event: `hand:${name}`,
          payload: { cards },
        });
      });
      // Broadcast game state — boards with flop visible, turn/river masked
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_state',
        payload: {
          phase: 'placement',
          boards: boards.map((b: any) => ({
            ...b,
            community: (b.community ?? []).map((c: any, i: number) =>
              i < 3 ? c : { hidden: true }
            ),
          })),
          placements: {},
          readyPlayers: [],
          results: null,
          round: 1,
        } satisfies RealtimeGameState,
      });
    },
    [isHost]
  );

  // ALL PLAYERS: Send placement + ready signal
  const sendReady = useCallback(
    (placements: any) => {
      if (!channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_ready',
        payload: { player: playerName, placements },
      });
    },
    [playerName]
  );

  // HOST: Reveal all placements after all ready
  const revealAllPlacements = useCallback(
    (allPlacements: Record<string, any>) => {
      if (!isHost || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'reveal_placements',
        payload: { placements: allPlacements },
      });
    },
    [isHost]
  );

  // HOST: Reveal a single community card (turn or river)
  const revealCommunityCard = useCallback(
    (boardIndex: number, cardIndex: number, card: any) => {
      if (!isHost || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'reveal_community',
        payload: {
          boardIndex,
          cardIndex,
          card,
          revealedCount: cardIndex + 1,
        },
      });
    },
    [isHost]
  );

  // HOST: Broadcast final results
  const sendResults = useCallback(
    (results: any) => {
      if (!isHost || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_results',
        payload: results,
      });
    },
    [isHost]
  );

  // Request state restore after reconnection
  const requestStateRestore = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'request_state',
      payload: { player: playerName },
    });
  }, [playerName]);

  return {
    gameState,
    myHand,
    opponentPlacements,
    readyPlayers,
    connected,
    dealCards,
    sendReady,
    revealAllPlacements,
    revealCommunityCard,
    sendResults,
    requestStateRestore,
  };
}
