import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount } from '../constants/gameConfig';
import {
  BoardState,
  initializeGameMulti,
  placeSingleBotCards,
  autoFillPlayerCards,
  calculateHandResultsMulti,
} from '../utils/gameLogic';
import { playSound } from '../utils/sounds';
import TournamentLobby from '../components/TournamentLobby';

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // not available on web
}

const haptic = (style: any) => {
  Haptics?.impactAsync?.(style)?.catch?.(() => {});
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface TournamentPlayer {
  id: string;
  name: string;
  isHuman: boolean;
}

interface BracketMatch {
  id: string;
  player1: TournamentPlayer | null;
  player2: TournamentPlayer | null;
  winner: TournamentPlayer | null;
  roundLabel: string;
  score1: number;
  score2: number;
}

type TournamentPhase =
  | 'bracket'       // Showing bracket
  | 'arranging'     // Human playing a match
  | 'waiting'       // Waiting for bots to finish
  | 'match-result'  // Show match result
  | 'champion';     // Tournament won

const BOT_NAMES = ['Ace', 'Bluff', 'Chips', 'Dealer', 'Flush', 'River', 'Shark'];
const TOTAL_PLAYERS = 8;
const ENTRY_FEE = 200;
const PRIZE_POOL = ENTRY_FEE * TOTAL_PLAYERS;
const COUNTDOWN_SECONDS = 30;
const BEST_OF = 3; // best of 3 rounds per match
const WINS_NEEDED = 2;

// ─── Room Code Utils ─────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TournamentScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);

  // Mode toggle: 'local' = existing simulation, 'online' = Supabase lobby
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const playerName = useGameStore.getState().playerName || 'Player';

  // Room code state (multiplayer prep — UI only for now)
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showRoomPanel, setShowRoomPanel] = useState(false);

  // Tournament state
  const [phase, setPhase] = useState<TournamentPhase>('bracket');
  const [allPlayers, setAllPlayers] = useState<TournamentPlayer[]>([]);
  const [quarterFinals, setQuarterFinals] = useState<BracketMatch[]>([]);
  const [semiFinals, setSemiFinals] = useState<BracketMatch[]>([]);
  const [final, setFinal] = useState<BracketMatch | null>(null);
  const [currentMatch, setCurrentMatch] = useState<BracketMatch | null>(null);
  const [matchWins, setMatchWins] = useState<[number, number]>([0, 0]);
  const [matchRound, setMatchRound] = useState(1);
  const [lastRoundResult, setLastRoundResult] = useState<string | null>(null);

  // Game round state
  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(undefined);
  const [playerReady, setPlayerReady] = useState(false);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [countdownActive, setCountdownActive] = useState(false);

  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerHandRef = useRef(playerHand);
  const boardsRef = useRef(boards);

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ─── Initialize tournament bracket ──────────────────────────────────────

  useEffect(() => {
    // Create 8 players, shuffle, seed into bracket
    const players: TournamentPlayer[] = [
      { id: 'human', name: 'You', isHuman: true },
      ...BOT_NAMES.map((name, i) => ({
        id: `bot_${i}`,
        name,
        isHuman: false,
      })),
    ];

    // Shuffle for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setAllPlayers(shuffled);

    // Create quarter-final matches
    const qf: BracketMatch[] = [];
    for (let i = 0; i < 4; i++) {
      qf.push({
        id: `qf_${i}`,
        player1: shuffled[i * 2],
        player2: shuffled[i * 2 + 1],
        winner: null,
        roundLabel: 'Quarter-Final',
        score1: 0,
        score2: 0,
      });
    }
    setQuarterFinals(qf);

    // Deduct entry fee
    addChips(-ENTRY_FEE);
  }, []);

  // ─── Simulate a bot-vs-bot match ───────────────────────────────────────

  const simulateBotMatch = useCallback((match: BracketMatch): { winner: TournamentPlayer; s1: number; s2: number } => {
    // Random winner for bot-vs-bot, generate realistic best-of-3 scores
    const isP1 = Math.random() < 0.5;
    const winnerScore = WINS_NEEDED;
    const loserScore = Math.floor(Math.random() * WINS_NEEDED); // 0 or 1
    return {
      winner: isP1 ? match.player1! : match.player2!,
      s1: isP1 ? winnerScore : loserScore,
      s2: isP1 ? loserScore : winnerScore,
    };
  }, []);

  // ─── Start a match involving the human player ──────────────────────────

  const startHumanMatch = useCallback((match: BracketMatch) => {
    setCurrentMatch(match);
    setMatchWins([0, 0]);
    setMatchRound(1);
    setLastRoundResult(null);
    startMatchRound();
  }, []);

  const startMatchRound = useCallback(() => {
    const numberOfPlayers = 2 as 2 | 3 | 4;
    const numberOfBots = 1;

    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);

    setBoards(initialBoards);
    setPlayerHand(pHand);
    setSelectedCardId(undefined);
    setPlayerReady(false);
    setBotsReady([false]);
    setCountdown(COUNTDOWN_SECONDS);
    setCountdownActive(false);
    setPhase('arranging');

    // Bot placement
    const delay = 5000 + Math.random() * 15000;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setBoards((prev) => placeSingleBotCards(botHands[0], prev, 0));
      setBotsReady([true]);
      startCountdown();
    }, delay);
    timeoutsRef.current.push(timer);
  }, []);

  // ─── Countdown ──────────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;
    setCountdownActive(true);
    setCountdown(COUNTDOWN_SECONDS);

    countdownRef.current = setInterval(() => {
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

  // Auto-fill on countdown zero
  useEffect(() => {
    if (countdownActive && countdown === 0 && !playerReady) {
      setBoards((currentBoards) => {
        const shuffled = [...playerHandRef.current].sort(() => Math.random() - 0.5);
        const { boards: filledBoards, remainingHand } = autoFillPlayerCards(shuffled, currentBoards);
        setPlayerHand(remainingHand);
        return filledBoards;
      });
      setSelectedCardId(undefined);
      setPlayerReady(true);
      setPhase('waiting');
    }
  }, [countdownActive, countdown, playerReady]);

  // ─── Evaluate round ────────────────────────────────────────────────────

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  useEffect(() => {
    if (phase !== 'arranging' && phase !== 'waiting') return;
    if (!playerReady || !allBotsReady) return;

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    const numberOfPlayers = 2 as 2 | 3 | 4;
    const results = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);

    const playerBoardWins = results.boardResults.filter((r) => r.winner === 'player').length;
    const botBoardWins = results.boardResults.filter((r) => r.winner === 'bot').length;

    const roundWinner = playerBoardWins > botBoardWins ? 'player' : playerBoardWins < botBoardWins ? 'bot' : 'tie';

    setMatchWins((prev) => {
      const updated: [number, number] = [...prev];
      if (roundWinner === 'player') {
        updated[0]++;
        setLastRoundResult('You won this round!');
      } else if (roundWinner === 'bot') {
        updated[1]++;
        setLastRoundResult(`${currentMatch?.player2?.name || 'Opponent'} won this round.`);
      } else {
        setLastRoundResult('Round tied! Playing again...');
      }

      // Check if match is decided
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;

        if (updated[0] >= WINS_NEEDED) {
          // Human wins the match
          resolveMatch(currentMatch!, currentMatch!.player1!);
        } else if (updated[1] >= WINS_NEEDED) {
          // Opponent wins the match
          resolveMatch(currentMatch!, currentMatch!.player2!);
        } else {
          // Play another round
          setMatchRound((r) => r + 1);
          startMatchRound();
        }
      }, 2000);
      timeoutsRef.current.push(timer);

      return updated;
    });
  }, [playerReady, allBotsReady, phase]);

  // ─── Resolve a match and advance bracket ────────────────────────────────

  const resolveMatch = useCallback((match: BracketMatch, winner: TournamentPlayer) => {
    // Update the appropriate bracket round, including match scores
    const s1 = matchWins[0];
    const s2 = matchWins[1];
    if (match.id.startsWith('qf_')) {
      setQuarterFinals((prev) => {
        const updated = prev.map((m) =>
          m.id === match.id ? { ...m, winner, score1: s1, score2: s2 } : m
        );

        // Check if all quarter-finals are done
        const allDone = updated.every((m) => m.winner !== null);
        if (allDone) {
          // Create semi-finals
          const sf: BracketMatch[] = [
            {
              id: 'sf_0',
              player1: updated[0].winner,
              player2: updated[1].winner,
              winner: null,
              roundLabel: 'Semi-Final',
              score1: 0,
              score2: 0,
            },
            {
              id: 'sf_1',
              player1: updated[2].winner,
              player2: updated[3].winner,
              winner: null,
              roundLabel: 'Semi-Final',
              score1: 0,
              score2: 0,
            },
          ];
          setSemiFinals(sf);
        }

        return updated;
      });
    } else if (match.id.startsWith('sf_')) {
      setSemiFinals((prev) => {
        const updated = prev.map((m) =>
          m.id === match.id ? { ...m, winner, score1: s1, score2: s2 } : m
        );

        const allDone = updated.every((m) => m.winner !== null);
        if (allDone) {
          // Create final
          setFinal({
            id: 'final',
            player1: updated[0].winner,
            player2: updated[1].winner,
            winner: null,
            roundLabel: 'FINAL',
            score1: 0,
            score2: 0,
          });
        }

        return updated;
      });
    } else if (match.id === 'final') {
      setFinal((prev) => prev ? { ...prev, winner, score1: s1, score2: s2 } : null);
      if (winner.isHuman) {
        addChips(PRIZE_POOL);
      }
    }

    setPhase('match-result');
    setCurrentMatch({ ...match, winner });
  }, [addChips]);

  // ─── Advance to next match from bracket view ──────────────────────────

  const advanceFromBracket = useCallback(() => {
    // Find the next match that needs to be played
    // Quarter-finals first
    for (const qf of quarterFinals) {
      if (!qf.winner) {
        const humanInMatch = qf.player1?.isHuman || qf.player2?.isHuman;
        if (humanInMatch) {
          // Swap so human is always player1
          const match = qf.player1?.isHuman
            ? qf
            : { ...qf, player1: qf.player2, player2: qf.player1 };
          startHumanMatch(match);
          return;
        } else {
          // Simulate bot match
          const { winner, s1, s2 } = simulateBotMatch(qf);
          setQuarterFinals((prev) =>
            prev.map((m) => (m.id === qf.id ? { ...m, winner, score1: s1, score2: s2 } : m))
          );
          return;
        }
      }
    }

    // Semi-finals
    for (const sf of semiFinals) {
      if (!sf.winner) {
        const humanInMatch = sf.player1?.isHuman || sf.player2?.isHuman;
        if (humanInMatch) {
          const match = sf.player1?.isHuman
            ? sf
            : { ...sf, player1: sf.player2, player2: sf.player1 };
          startHumanMatch(match);
          return;
        } else {
          const { winner, s1, s2 } = simulateBotMatch(sf);
          setSemiFinals((prev) =>
            prev.map((m) => (m.id === sf.id ? { ...m, winner, score1: s1, score2: s2 } : m))
          );
          return;
        }
      }
    }

    // Final
    if (final && !final.winner) {
      const humanInMatch = final.player1?.isHuman || final.player2?.isHuman;
      if (humanInMatch) {
        const match = final.player1?.isHuman
          ? final
          : { ...final, player1: final.player2, player2: final.player1 };
        startHumanMatch(match);
      } else {
        const { winner, s1, s2 } = simulateBotMatch(final);
        setFinal((prev) => prev ? { ...prev, winner, score1: s1, score2: s2 } : null);
      }
    }
  }, [quarterFinals, semiFinals, final, startHumanMatch, simulateBotMatch]);

  // ─── Card interaction handlers ──────────────────────────────────────────

  const isArranging = phase === 'arranging' && !playerReady;

  const handleSelectCard = useCallback(
    (card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setSelectedCardId((prev) => (prev === card.id ? undefined : card.id));
    },
    [isArranging]
  );

  const handleBoardPress = useCallback(
    (boardIndex: number) => {
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
        setSelectedCardId(undefined);
        return updated;
      });
    },
    [isArranging, selectedCardId]
  );

  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
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
    },
    [isArranging]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    setSelectedCardId(undefined);
    setPlayerReady(true);
    setPhase('waiting');
    if (!countdownActive) {
      startCountdown();
    }
  }, [allBoardsFull, countdownActive, startCountdown]);

  const handleBack = useCallback(() => {
    if (phase === 'arranging' || phase === 'waiting') {
      Alert.alert('Leave Tournament?', 'You will forfeit your entry fee.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.replace('/') },
      ]);
    } else {
      router.replace('/');
    }
  }, [phase, router]);

  // ─── Render: Champion ───────────────────────────────────────────────────

  if (phase === 'champion' || (final?.winner)) {
    const champion = final?.winner;
    const isHumanChamp = champion?.isHuman;

    // Build full results list: champion, finalist, semi-finalists, quarter-finalists
    const resultsList: { name: string; round: string; isHuman: boolean; isChampion: boolean }[] = [];
    if (champion) {
      resultsList.push({ name: champion.name, round: 'Champion', isHuman: champion.isHuman, isChampion: true });
    }
    // Finalist (loser of final)
    if (final) {
      const finalist = final.winner?.id === final.player1?.id ? final.player2 : final.player1;
      if (finalist) resultsList.push({ name: finalist.name, round: 'Finalist', isHuman: finalist.isHuman, isChampion: false });
    }
    // Semi-final losers
    for (const sf of semiFinals) {
      if (sf.winner) {
        const loser = sf.winner.id === sf.player1?.id ? sf.player2 : sf.player1;
        if (loser) resultsList.push({ name: loser.name, round: 'Semi-Final', isHuman: loser.isHuman, isChampion: false });
      }
    }
    // Quarter-final losers
    for (const qf of quarterFinals) {
      if (qf.winner) {
        const loser = qf.winner.id === qf.player1?.id ? qf.player2 : qf.player1;
        if (loser) resultsList.push({ name: loser.name, round: 'Quarter-Final', isHuman: loser.isHuman, isChampion: false });
      }
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.centered}>
          <Text style={styles.trophyEmoji}>{'\uD83C\uDFC6'}</Text>
          <Text style={styles.heading}>
            {isHumanChamp ? 'CHAMPION!' : `${champion?.name || 'Bot'} WINS`}
          </Text>
          <Text style={styles.subheading}>
            {isHumanChamp
              ? 'You won the tournament!'
              : 'Better luck next time...'}
          </Text>

          {isHumanChamp && (
            <ChipsDisplay amount={PRIZE_POOL} label="Prize Pool Won" size="large" />
          )}

          {/* Full bracket visualization */}
          {renderBracket()}

          {/* Tournament results summary */}
          <View style={styles.resultsSummary}>
            <Text style={styles.resultsSummaryTitle}>TOURNAMENT RESULTS</Text>
            {resultsList.map((r, i) => (
              <View key={i} style={[styles.resultRow, r.isChampion && styles.resultRowChampion]}>
                <Text style={styles.resultRank}>
                  {r.isChampion ? '\uD83C\uDFC6' : `#${i + 1}`}
                </Text>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, r.isHuman && styles.resultNameYou, r.isChampion && styles.resultNameChampion]}>
                    {r.name}
                  </Text>
                  <Text style={styles.resultRound}>Eliminated: {r.isChampion ? 'Winner' : r.round}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button title="PLAY AGAIN" variant="gold" onPress={() => {
            // Reset all state and start fresh
            setPhase('bracket');
            setQuarterFinals([]);
            setSemiFinals([]);
            setFinal(null);
            setCurrentMatch(null);
            setMatchWins([0, 0]);
            setMatchRound(1);
            setLastRoundResult(null);
            // Re-trigger bracket initialization via key change would be ideal,
            // but we can re-run the init logic inline:
            const players: TournamentPlayer[] = [
              { id: 'human', name: 'You', isHuman: true },
              ...BOT_NAMES.map((name, i) => ({
                id: `bot_${i}`,
                name,
                isHuman: false,
              })),
            ];
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            setAllPlayers(shuffled);
            const qf: BracketMatch[] = [];
            for (let i = 0; i < 4; i++) {
              qf.push({
                id: `qf_${i}`,
                player1: shuffled[i * 2],
                player2: shuffled[i * 2 + 1],
                winner: null,
                roundLabel: 'Quarter-Final',
                score1: 0,
                score2: 0,
              });
            }
            setQuarterFinals(qf);
            addChips(-ENTRY_FEE);
          }} />
          <Button title="BACK TO HOME" variant="ghost" onPress={() => router.replace('/')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Render: Match result ──────────────────────────────────────────────

  if (phase === 'match-result') {
    const winner = currentMatch?.winner;
    const humanWon = winner?.isHuman;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.heading}>
            {humanWon ? 'YOU ADVANCE!' : 'DEFEATED'}
          </Text>
          <Text style={styles.subheading}>
            {currentMatch?.roundLabel} — {currentMatch?.player1?.name} vs {currentMatch?.player2?.name}
          </Text>
          <Text style={styles.matchScore}>
            {matchWins[0]} - {matchWins[1]}
          </Text>

          <Button
            title={humanWon ? 'VIEW BRACKET' : 'BACK TO HOME'}
            variant="gold"
            onPress={() => {
              if (humanWon) {
                setPhase('bracket');
              } else {
                router.replace('/');
              }
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: Bracket view ──────────────────────────────────────────────

  if (phase === 'bracket') {
    // Check if tournament is complete (human eliminated in an earlier round)
    const humanPlayer = allPlayers.find((p) => p.isHuman);
    const humanInQF = quarterFinals.some(
      (m) => m.player1?.isHuman || m.player2?.isHuman
    );
    const humanWonQF = quarterFinals.some(
      (m) => m.winner?.isHuman
    );
    const humanInSF = semiFinals.some(
      (m) => m.player1?.isHuman || m.player2?.isHuman
    );
    const humanWonSF = semiFinals.some(
      (m) => m.winner?.isHuman
    );

    // Check if human was eliminated
    const humanEliminated =
      (humanInQF && !humanWonQF && quarterFinals.some((m) => (m.player1?.isHuman || m.player2?.isHuman) && m.winner && !m.winner.isHuman)) ||
      (humanInSF && !humanWonSF && semiFinals.some((m) => (m.player1?.isHuman || m.player2?.isHuman) && m.winner && !m.winner.isHuman));

    // ─── Mode toggle (LOCAL / ONLINE) ──────────────────────────────────────
    const modeToggle = (
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'local' && styles.modeBtnActive]}
          onPress={() => setMode('local')}
          activeOpacity={0.75}
        >
          <Text style={[styles.modeBtnText, mode === 'local' && styles.modeBtnTextActive]}>
            LOCAL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'online' && styles.modeBtnActive]}
          onPress={() => setMode('online')}
          activeOpacity={0.75}
        >
          <Text style={[styles.modeBtnText, mode === 'online' && styles.modeBtnTextActive]}>
            ONLINE
          </Text>
        </TouchableOpacity>
      </View>
    );

    // ─── Online lobby view ──────────────────────────────────────────────────
    if (mode === 'online') {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.onlineHeader}>
            <Button
              title="BACK"
              variant="ghost"
              onPress={() => router.replace('/')}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            />
            <Text style={styles.onlineTitle}>TOURNAMENT</Text>
            <View style={{ width: 60 }} />
          </View>
          {modeToggle}
          <TournamentLobby
            playerName={playerName}
            onJoin={(tournamentId) => {
              // For now, joining transitions back to local bracket seeded with tournament id
              // Future: load real bracket from Supabase and render it here
              setMode('local');
              Alert.alert('Joined!', `Tournament ${tournamentId} joined. Starting local bracket preview.`);
            }}
          />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.centered}>
          <Text style={styles.heading}>TOURNAMENT</Text>
          <Text style={styles.subheading}>
            8 Players  |  Entry: {ENTRY_FEE} chips  |  Best of {BEST_OF}
          </Text>

          {modeToggle}

          {renderBracket()}

          {/* ─── Multiplayer Room Code Panel ─── */}
          {!showRoomPanel ? (
            <TouchableOpacity
              style={styles.multiplayerTeaser}
              onPress={() => setShowRoomPanel(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.teaserText}>Coming Soon: Play with Friends Online</Text>
              <Text style={styles.teaserSubtext}>Tap to preview room codes</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.roomPanel}>
              <Text style={styles.roomPanelTitle}>Multiplayer Rooms</Text>
              <Text style={styles.roomPanelSubtitle}>Online tournaments coming soon — preview the room system</Text>

              {/* Create Room */}
              <TouchableOpacity
                style={styles.roomButton}
                onPress={() => setRoomCode(generateRoomCode())}
                activeOpacity={0.7}
              >
                <Text style={styles.roomButtonText}>Create Room</Text>
              </TouchableOpacity>

              {roomCode && (
                <View style={styles.roomCodeDisplay}>
                  <Text style={styles.roomCodeLabel}>Your Room Code</Text>
                  <Text style={styles.roomCodeValue}>{roomCode}</Text>
                  <Text style={styles.roomCodeHint}>Share this code with friends</Text>
                </View>
              )}

              {/* Join Room */}
              <View style={styles.joinRow}>
                <TextInput
                  style={styles.joinInput}
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 6))}
                  placeholder="ROOM CODE"
                  placeholderTextColor={COLORS.textDim}
                  maxLength={6}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.joinButton, joinCode.length < 6 && styles.joinButtonDisabled]}
                  disabled={joinCode.length < 6}
                  onPress={() => {
                    Alert.alert('Coming Soon', 'Online multiplayer tournaments are not available yet. Stay tuned!');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.comingSoonBadge}>ONLINE PLAY COMING SOON</Text>
            </View>
          )}

          {humanEliminated ? (
            <Button title="BACK TO HOME" variant="gold" onPress={() => router.replace('/')} />
          ) : (
            <Button title="NEXT MATCH" variant="gold" onPress={advanceFromBracket} />
          )}

          <Button title="LEAVE" variant="ghost" onPress={() => router.replace('/')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Render helper: Bracket visualization ──────────────────────────────

  function renderBracket() {
    const renderMatchCard = (m: BracketMatch, extraStyle?: object) => (
      <View key={m.id} style={[styles.bracketMatch, extraStyle, m.winner && styles.bracketMatchDone]}>
        <Text style={[
          styles.bracketPlayer,
          m.winner?.id === m.player1?.id && styles.bracketWinner,
          m.player1?.isHuman && styles.bracketHuman,
          m.winner && m.winner.id !== m.player1?.id && styles.bracketLoser,
        ]}>
          {m.winner?.id === m.player1?.id ? '\u2713 ' : ''}{m.player1?.name || '?'}
        </Text>
        <Text style={styles.bracketVs}>{m.winner ? `${m.score1} - ${m.score2}` : 'vs'}</Text>
        <Text style={[
          styles.bracketPlayer,
          m.winner?.id === m.player2?.id && styles.bracketWinner,
          m.player2?.isHuman && styles.bracketHuman,
          m.winner && m.winner.id !== m.player2?.id && styles.bracketLoser,
        ]}>
          {m.winner?.id === m.player2?.id ? '\u2713 ' : ''}{m.player2?.name || '?'}
        </Text>
      </View>
    );

    return (
      <View style={styles.bracketContainer}>
        {/* Quarter-finals */}
        <View style={styles.bracketColumn}>
          <Text style={styles.bracketRoundLabel}>QF</Text>
          {quarterFinals.map((m) => renderMatchCard(m))}
        </View>

        {/* Semi-finals */}
        <View style={styles.bracketColumn}>
          <Text style={styles.bracketRoundLabel}>SF</Text>
          {semiFinals.length > 0 ? semiFinals.map((m) =>
            renderMatchCard(m, styles.bracketMatchLarge)
          ) : (
            <View style={styles.bracketMatchEmpty}>
              <Text style={styles.bracketEmptyText}>TBD</Text>
            </View>
          )}
        </View>

        {/* Final */}
        <View style={styles.bracketColumn}>
          <Text style={styles.bracketRoundLabel}>F</Text>
          {final ? renderMatchCard(final, styles.bracketMatchFinal) : (
            <View style={styles.bracketMatchEmpty}>
              <Text style={styles.bracketEmptyText}>TBD</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── Render: Arranging / Waiting ───────────────────────────────────────

  const timerColor = countdown > 20 ? '#4CAF50' : countdown > 10 ? '#FFC107' : '#e74c3c';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Button title="BACK" variant="ghost" onPress={handleBack} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
        <View style={styles.topBarCenter}>
          <Text style={styles.roundLabel}>
            {currentMatch?.roundLabel || 'Match'} — Round {matchRound}/{BEST_OF}
          </Text>
          <Text style={styles.matchScoreSmall}>
            You {matchWins[0]} - {matchWins[1]} {currentMatch?.player2?.name || 'Opponent'}
          </Text>
        </View>
        {countdownActive && (
          <Text style={[styles.timerText, { color: timerColor }]}>
            0:{countdown.toString().padStart(2, '0')}
          </Text>
        )}
      </View>

      {lastRoundResult && (
        <View style={styles.roundResultBanner}>
          <Text style={styles.roundResultText}>{lastRoundResult}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.gameArea}>
        {boards.map((board, i) => (
          <Board
            key={i}
            index={i}
            openCards={board.openCards}
            closedCards={board.closedCards}
            playerCards={board.playerCards}
            botCards={board.botCards}
            allBotCards={board.allBotCards}
            revealed={false}
            active={isArranging}
            potAmount={config.potPerBoard * 2}
            onPress={() => handleBoardPress(i)}
            onRemoveCard={(card: Card) => handleRemoveCardFromBoard(i, card)}
            isArrangement={isArranging}
            cardHeight={44}
          />
        ))}
      </ScrollView>

      <View style={styles.bottomArea}>
        <PlayerHand
          cards={playerHand}
          selectedCardIds={selectedCardId ? [selectedCardId] : []}
          onSelectCard={handleSelectCard}
        />

        {isArranging && (
          <Button
            title={allBoardsFull ? 'READY' : 'Place all cards'}
            variant={allBoardsFull ? 'gold' : 'ghost'}
            disabled={!allBoardsFull}
            onPress={handleReady}
          />
        )}

        {phase === 'waiting' && (
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 20,
  },
  heading: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 6,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
  },
  trophyEmoji: {
    fontSize: 64,
    textAlign: 'center',
  },
  matchScore: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 8,
    textAlign: 'center',
  },

  // Bracket
  bracketContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 16,
  },
  bracketColumn: {
    flex: 1,
    gap: 8,
    alignItems: 'center',
  },
  bracketRoundLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  bracketMatch: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    padding: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: 2,
  },
  bracketMatchLarge: {
    paddingVertical: 12,
    marginVertical: 16,
  },
  bracketMatchFinal: {
    paddingVertical: 16,
    borderColor: COLORS.gold,
    borderWidth: 2,
    marginVertical: 24,
  },
  bracketMatchEmpty: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    opacity: 0.4,
    marginVertical: 16,
  },
  bracketEmptyText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  bracketPlayer: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  bracketVs: {
    fontSize: 9,
    fontWeight: '400',
    color: COLORS.textDim,
  },
  bracketWinner: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  bracketHuman: {
    color: COLORS.goldLight,
  },

  // Game area
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topBarCenter: {
    alignItems: 'center',
    flex: 1,
  },
  roundLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  matchScoreSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  roundResultBanner: {
    backgroundColor: COLORS.feltLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  roundResultText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gold,
  },
  gameArea: {
    flexGrow: 1,
    padding: 12,
    gap: 8,
  },
  bottomArea: {
    padding: 12,
    gap: 12,
  },
  waitingText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  bracketMatchDone: {
    opacity: 0.85,
  },
  bracketLoser: {
    color: COLORS.textDim,
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },

  // Multiplayer teaser
  multiplayerTeaser: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    gap: 4,
  },
  teaserText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.goldLight,
    letterSpacing: 1,
  },
  teaserSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textDim,
  },

  // Room code panel
  roomPanel: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    padding: 16,
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  roomPanelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.goldLight,
    letterSpacing: 1,
  },
  roomPanelSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textDim,
    textAlign: 'center',
  },
  roomButton: {
    backgroundColor: COLORS.goldDim,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  roomButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
  },
  roomCodeDisplay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    gap: 4,
  },
  roomCodeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  roomCodeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  roomCodeHint: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textDim,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  joinButton: {
    backgroundColor: COLORS.goldDim,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.4,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  comingSoonBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldDim,
    letterSpacing: 3,
    marginTop: 4,
  },

  // Mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
    marginVertical: 8,
  },
  modeBtn: {
    paddingHorizontal: 28,
    paddingVertical: 9,
  },
  modeBtnActive: {
    backgroundColor: COLORS.gold,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    // PR-J: was COLORS.textDim (#5a4a30) on red bg ~1.3:1 — severe fail.
    // Use COLORS.text (#f0ead6) for ~9.5:1 — passes WCAG AA.
    color: COLORS.text,
    letterSpacing: 2,
  },
  modeBtnTextActive: {
    color: '#fff',
  },

  // Online header
  onlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  onlineTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
  },

  // Tournament results summary
  resultsSummary: {
    width: '100%',
    backgroundColor: COLORS.feltLight,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  resultsSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  resultRowChampion: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  resultRank: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gold,
    width: 32,
    textAlign: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  resultNameYou: {
    color: COLORS.goldLight,
  },
  resultNameChampion: {
    fontWeight: '900',
    color: COLORS.gold,
  },
  resultRound: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textDim,
  },
});
