import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  useWindowDimensions,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount, getCardsPerPlayer } from '../constants/gameConfig';
import {
  BoardState,
  initializeGameMulti,
  placeSingleBotCards,
  autoFillPlayerCards,
  calculateHandResultsMulti,
} from '../utils/gameLogic';
import { GamePhase } from '../types/gameTypes';
import { playSound } from '../utils/sounds';

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

interface SitAndGoPlayer {
  id: string;
  name: string;
  score: number;
  eliminated: boolean;
  isHuman: boolean;
}

type SitAndGoPhase =
  | 'entry'
  | 'lobby'
  | 'arranging'
  | 'waiting'
  | 'standings'
  | 'eliminated'
  | 'winner';

const TOTAL_PLAYERS = 6;
const TOTAL_ROUNDS = 5; // 6 players → 5 elimination rounds → 1 winner
const BOT_NAMES = ['Joey', 'Monica', 'Ross', 'Phoebe', 'Chandler'];
const COUNTDOWN_SECONDS = 30;
const ENTRY_FEE = 100;
const PRIZE_POOL = ENTRY_FEE * TOTAL_PLAYERS;
const PRIZE_1ST = Math.round(PRIZE_POOL * 0.6); // 360
const PRIZE_2ND = Math.round(PRIZE_POOL * 0.3); // 180
const PRIZE_3RD = Math.round(PRIZE_POOL * 0.1); // 60

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

export default function SitAndGoScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const playerName = useGameStore((s) => s.playerName);

  // Sit & Go state
  const [phase, setPhase] = useState<SitAndGoPhase>('entry');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [humanPrize, setHumanPrize] = useState(0);
  const [humanPlace, setHumanPlace] = useState(0);
  const [round, setRound] = useState(1);
  const [players, setPlayers] = useState<SitAndGoPlayer[]>([]);
  const [lobbyCount, setLobbyCount] = useState(1);
  const [eliminatedName, setEliminatedName] = useState<string | null>(null);

  // Room code state (multiplayer prep — UI only for now)
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showRoomPanel, setShowRoomPanel] = useState(false);

  // Game round state (reused from game.tsx pattern)
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

  // ─── Eliminate RPC (fire-and-forget) ────────────────────────────────────

  const callEliminateRpc = useCallback(async (sid: string | null) => {
    if (!sid) return;
    const sb = getSupabase();
    if (!sb) return;
    try {
      const dId = await getDeviceId();
      await sb.rpc('sng_eliminate', { p_device_id: dId, p_session_id: sid });
    } catch { /* silent — local state is source of truth */ }
  }, []);

  // ─── Lobby animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'lobby') return;

    // Initialize players
    const initial: SitAndGoPlayer[] = [
      { id: 'human', name: 'You', score: 0, eliminated: false, isHuman: true },
      ...BOT_NAMES.map((name, i) => ({
        id: `bot_${i}`,
        name,
        score: 0,
        eliminated: false,
        isHuman: false,
      })),
    ];
    setPlayers(initial);

    // Animate bots joining
    let count = 1;
    const interval = setInterval(() => {
      count++;
      setLobbyCount(count);
      if (count >= TOTAL_PLAYERS) {
        clearInterval(interval);
        // Auto-start after brief delay
        setTimeout(() => {
          if (!mountedRef.current) return;
          addChips(-ENTRY_FEE);
          // Wire join_sit_n_go_solo RPC (fire-and-forget — game starts regardless)
          void (async () => {
            const sb = getSupabase();
            if (sb) {
              try {
                const dId = await getDeviceId();
                const { data } = await sb.rpc('join_sit_n_go_solo', {
                  p_device_id: dId,
                  p_player_name: playerName || 'You',
                });
                const result = data as { session_id?: string } | null;
                if (result?.session_id && mountedRef.current) {
                  setSessionId(result.session_id);
                }
              } catch { /* silent */ }
            }
          })();
          startRound(initial, 1);
        }, 1000);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [phase]);

  // ─── Start a round ──────────────────────────────────────────────────────

  const startRound = useCallback((currentPlayers: SitAndGoPlayer[], roundNum: number) => {
    const alive = currentPlayers.filter((p) => !p.eliminated);
    // Use 2 players for the game mechanic (simpler — each round is player vs field)
    const numberOfPlayers = 2 as 2 | 3 | 4;
    const boardCount = getBoardCount(numberOfPlayers);
    const numberOfBots = numberOfPlayers - 1;

    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);

    const humanAlive = alive.find((p) => p.isHuman);
    if (!humanAlive) {
      // Human was eliminated — show game over
      setPhase('eliminated');
      return;
    }

    setBoards(initialBoards);
    setPlayerHand(pHand);
    setSelectedCardId(undefined);
    setPlayerReady(false);
    setBotsReady(new Array(numberOfBots).fill(false));
    setCountdown(COUNTDOWN_SECONDS);
    setCountdownActive(false);
    setRound(roundNum);
    setPhase('arranging');

    // Bot placement timers
    for (let botIdx = 0; botIdx < numberOfBots; botIdx++) {
      const delay = 5000 + Math.random() * 15000;
      const botCards = botHands[botIdx];
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        setBoards((prev) => placeSingleBotCards(botCards, prev, botIdx));
        setBotsReady((prev) => {
          const updated = [...prev];
          updated[botIdx] = true;
          if (!prev.some(Boolean)) {
            startCountdown();
          }
          return updated;
        });
      }, delay);
      timeoutsRef.current.push(timer);
    }
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

  // Auto-fill when countdown hits 0
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

  // ─── Evaluate round when all ready ──────────────────────────────────────

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  useEffect(() => {
    if (phase !== 'arranging' && phase !== 'waiting') return;
    if (!playerReady || !allBotsReady) return;

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Evaluate the round
    const numberOfPlayers = 2 as 2 | 3 | 4;
    const results = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);

    // Calculate player's board wins this round
    const playerBoardWins = results.boardResults.filter((r) => r.winner === 'player').length;
    const totalBoards = results.boardResults.length;

    // Update scores for all alive players
    setPlayers((prev) => {
      const alive = prev.filter((p) => !p.eliminated);
      return prev.map((p) => {
        if (p.eliminated) return p;
        if (p.isHuman) {
          return { ...p, score: p.score + playerBoardWins };
        }
        // Bots get random scores (simulating their matches)
        const botScore = Math.floor(Math.random() * (totalBoards + 1));
        return { ...p, score: p.score + botScore };
      });
    });

    // Show standings after a brief delay
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setPhase('standings');
      }
    }, 1500);
    timeoutsRef.current.push(timer);
  }, [playerReady, allBotsReady, phase]);

  // ─── Eliminate lowest scorer ────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    setPlayers((prev) => {
      const alive = prev.filter((p) => !p.eliminated);

      if (alive.length <= 2) {
        // Final showdown — determine 1st and 2nd place
        const sorted = [...alive].sort((a, b) => b.score - a.score);
        const first = sorted[0];
        const second = sorted[1];

        const humanFirst = first?.isHuman;
        const humanSecond = second?.isHuman;
        const prize = humanFirst ? PRIZE_1ST : humanSecond ? PRIZE_2ND : 0;
        const place = humanFirst ? 1 : humanSecond ? 2 : 0;

        if (prize > 0) {
          addChips(prize);
          setHumanPrize(prize);
          setHumanPlace(place);
          void callEliminateRpc(sessionId);
          setPhase('winner');
        } else {
          setPhase('eliminated');
        }
        return prev;
      }

      // Eliminate the lowest scorer this round
      const sorted = [...alive].sort((a, b) => a.score - b.score);
      const lowestPlayer = sorted[0];

      const updated = prev.map((p) =>
        p.id === lowestPlayer.id ? { ...p, eliminated: true } : p
      );

      setEliminatedName(lowestPlayer.name);

      const newAlive = updated.filter((p) => !p.eliminated);

      if (lowestPlayer.isHuman) {
        // Human eliminated — check if 3rd place prize applies
        const finishPlace = alive.length; // e.g. 3 alive → human finishes 3rd
        const prize = finishPlace === 3 ? PRIZE_3RD : 0;
        if (prize > 0) {
          addChips(prize);
          setHumanPrize(prize);
          setHumanPlace(3);
          void callEliminateRpc(sessionId);
        }
        setPhase('eliminated');
        return updated;
      }

      if (newAlive.length <= 1) {
        // Only human left — human wins 1st
        addChips(PRIZE_1ST);
        setHumanPrize(PRIZE_1ST);
        setHumanPlace(1);
        void callEliminateRpc(sessionId);
        setPhase('winner');
        return updated;
      }

      // Start next round
      const nextRound = round + 1;
      setTimeout(() => {
        if (mountedRef.current) {
          startRound(updated, nextRound);
        }
      }, 2000);

      return updated;
    });
  }, [round, startRound, addChips, sessionId, callEliminateRpc]);

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
      Alert.alert('Leave Sit & Go?', 'You will forfeit your entry fee.', [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => router.replace('/'),
        },
      ]);
    } else {
      router.replace('/');
    }
  }, [phase, router]);

  // ─── Render ─────────────────────────────────────────────────────────────

  // Entry phase — show mode info before starting
  if (phase === 'entry') {
    const canAfford = chips >= ENTRY_FEE;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Button title="BACK" variant="ghost" onPress={() => router.replace('/')} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.trophyEmoji}>🃏</Text>
          <Text style={styles.heading}>SIT & GO</Text>
          <Text style={styles.subheading}>SOLO VS BOTS</Text>

          <View style={styles.lobbyBox}>
            <Text style={styles.lobbyTitle}>Prize Structure</Text>
            {[
              { place: '🥇 1st', prize: PRIZE_1ST, label: '60%' },
              { place: '🥈 2nd', prize: PRIZE_2ND, label: '30%' },
              { place: '🥉 3rd', prize: PRIZE_3RD, label: '10%' },
            ].map(({ place, prize, label }) => (
              <View key={place} style={styles.lobbySlot}>
                <Text style={styles.lobbyName}>{place}</Text>
                <Text style={[styles.lobbyName, { color: COLORS.gold, marginLeft: 'auto' as any }]}>
                  {prize} chips ({label})
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subheading, { marginTop: 8 }]}>
            Entry Fee: {ENTRY_FEE} chips  |  6 Players
          </Text>

          {!canAfford && (
            <Text style={{ color: COLORS.danger, fontSize: 13, textAlign: 'center' }}>
              אין מספיק צ&apos;יפים — שחק כדי להרוויח
            </Text>
          )}

          <Button
            title={canAfford ? 'START SOLO GAME' : `Need ${ENTRY_FEE} chips`}
            variant="gold"
            disabled={!canAfford}
            onPress={() => { if (canAfford) setPhase('lobby'); }}
          />
          <Text style={styles.lobbyCounter}>{chips} chips available</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Lobby phase
  if (phase === 'lobby') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.heading}>SIT & GO</Text>
          <Text style={styles.subheading}>6 Players  |  Entry: {ENTRY_FEE} chips</Text>

          <View style={styles.lobbyBox}>
            <Text style={styles.lobbyTitle}>Filling bots...</Text>
            {Array.from({ length: TOTAL_PLAYERS }).map((_, i) => (
              <View key={i} style={styles.lobbySlot}>
                <View
                  style={[
                    styles.lobbyDot,
                    i < lobbyCount ? styles.lobbyDotFilled : null,
                  ]}
                />
                <Text style={[styles.lobbyName, i >= lobbyCount && styles.lobbyNameEmpty]}>
                  {i === 0
                    ? 'You'
                    : i < lobbyCount
                    ? BOT_NAMES[i - 1]
                    : 'Waiting...'}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.lobbyCounter}>{lobbyCount} / {TOTAL_PLAYERS}</Text>

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
              <Text style={styles.roomPanelSubtitle}>Online play coming soon — preview the room system</Text>

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
                    Alert.alert('Coming Soon', 'Online multiplayer is not available yet. Stay tuned!');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.comingSoonBadge}>ONLINE PLAY COMING SOON</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Winner phase (1st or 2nd place — both get prizes)
  if (phase === 'winner') {
    const placeLabel = humanPlace === 1 ? '🥇 1ST PLACE' : humanPlace === 2 ? '🥈 2ND PLACE' : '🏆 TOP 3';
    const placeEmoji = humanPlace === 1 ? '⭐' : humanPlace === 2 ? '🥈' : '🥉';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.trophyEmoji}>{placeEmoji}</Text>
          <Text style={styles.heading}>{humanPlace === 1 ? 'YOU WIN!' : 'GREAT GAME!'}</Text>
          <Text style={styles.subheading}>{placeLabel}  |  Solo vs Bots</Text>
          <ChipsDisplay amount={humanPrize} label="Prize Won" size="large" />

          <View style={styles.standingsList}>
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => {
                const prizeChips = i === 0 ? PRIZE_1ST : i === 1 ? PRIZE_2ND : i === 2 ? PRIZE_3RD : 0;
                const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '❌';
                return (
                  <View key={p.id} style={[styles.standingRow, i === 0 && styles.standingChampion]}>
                    <Text style={styles.standingRank}>{medalEmoji}</Text>
                    <Text style={[styles.standingName, p.isHuman && styles.standingNameYou]}>
                      {p.name}
                    </Text>
                    {prizeChips > 0 ? (
                      <Text style={[styles.standingScore, { color: COLORS.gold }]}>+{prizeChips}</Text>
                    ) : (
                      <Text style={styles.eliminatedTag}>OUT</Text>
                    )}
                  </View>
                );
              })}
          </View>

          <Button title="🎮 PLAY AGAIN" variant="gold" onPress={() => { setPhase('entry'); setSessionId(null); setHumanPrize(0); setHumanPlace(0); }} />
          <Button title="HOME" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  // Eliminated phase (4th–6th place, or 3rd with small prize)
  if (phase === 'eliminated') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.trophyEmoji}>{humanPrize > 0 ? '🥉' : '💀'}</Text>
          <Text style={styles.heading}>
            {humanPrize > 0 ? '3RD PLACE' : 'ELIMINATED'}
          </Text>
          <Text style={styles.subheading}>
            {humanPrize > 0 ? `+${humanPrize} chips prize` : 'Better luck next time!'}
          </Text>

          {humanPrize > 0 && (
            <ChipsDisplay amount={humanPrize} label="3rd Place Prize" size="large" />
          )}

          <View style={styles.standingsList}>
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => {
                const prizeChips = i === 0 ? PRIZE_1ST : i === 1 ? PRIZE_2ND : i === 2 ? PRIZE_3RD : 0;
                const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '❌';
                return (
                  <View key={p.id} style={[styles.standingRow, p.eliminated && styles.standingEliminated]}>
                    <Text style={styles.standingRank}>{medalEmoji}</Text>
                    <Text style={[styles.standingName, p.isHuman && styles.standingNameYou]}>
                      {p.name}
                    </Text>
                    {prizeChips > 0 ? (
                      <Text style={[styles.standingScore, { color: COLORS.gold }]}>+{prizeChips}</Text>
                    ) : (
                      <Text style={styles.eliminatedTag}>OUT</Text>
                    )}
                  </View>
                );
              })}
          </View>

          <Button title="🎮 PLAY AGAIN" variant="gold" onPress={() => { setPhase('entry'); setSessionId(null); setHumanPrize(0); setHumanPlace(0); }} />
          <Button title="HOME" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  // Standings phase (between rounds)
  if (phase === 'standings') {
    const alive = players.filter((p) => !p.eliminated);
    const sorted = [...alive].sort((a, b) => b.score - a.score);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.heading}>ROUND {round} RESULTS</Text>
          <Text style={styles.subheading}>
            {alive.length} players remaining  |  Lowest score eliminated
          </Text>

          <View style={styles.standingsList}>
            {sorted.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.standingRow,
                  i === sorted.length - 1 && styles.standingDanger,
                ]}
              >
                <Text style={styles.standingRank}>#{i + 1}</Text>
                <Text style={[styles.standingName, p.isHuman && styles.standingNameYou]}>
                  {p.name}
                </Text>
                <Text style={styles.standingScore}>{p.score} pts</Text>
                {i === sorted.length - 1 && (
                  <Text style={styles.eliminatedTag}>ELIM</Text>
                )}
              </View>
            ))}
          </View>

          <Button title="CONTINUE" variant="gold" onPress={handleContinue} />
          <Button title="LEAVE" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  // Arranging / Waiting phase — the actual card game
  const boardCount = getBoardCount(2);
  const timerColor = countdown > 20 ? '#4CAF50' : countdown > 10 ? '#FFC107' : '#e74c3c';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Button title="BACK" variant="ghost" onPress={handleBack} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
        <Text style={styles.roundLabel}>ROUND {round} / {TOTAL_ROUNDS}</Text>
        {countdownActive && (
          <Text style={[styles.timerText, { color: timerColor }]}>
            0:{countdown.toString().padStart(2, '0')}
          </Text>
        )}
      </View>

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
          <Text style={styles.waitingText}>Waiting for opponents...</Text>
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
    flex: 1,
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

  // Lobby
  lobbyBox: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  lobbyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  lobbySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lobbyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: 'transparent',
  },
  lobbyDotFilled: {
    backgroundColor: COLORS.gold,
  },
  lobbyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  lobbyNameEmpty: {
    color: COLORS.textDim,
    fontStyle: 'italic',
  },
  lobbyCounter: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 4,
  },

  // Standings
  standingsList: {
    width: '100%',
    gap: 8,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  standingDanger: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(192,57,43,0.1)',
  },
  standingEliminated: {
    opacity: 0.4,
  },
  standingRank: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gold,
    width: 32,
  },
  standingName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  standingNameYou: {
    color: COLORS.gold,
  },
  standingScore: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  eliminatedTag: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: 1,
  },

  // Game area
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roundLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 2,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
  standingChampion: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(201,168,76,0.08)',
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
});
