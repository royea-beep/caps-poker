import { getSupabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentEntry {
  id: string;
  room_code: string;
  status: 'waiting' | 'active' | 'completed';
  max_players: number;
  current_players: number;
  bracket: TournamentBracket | null;
  winner_name: string | null;
  created_at: string;
  buy_in?: number;
  prize_pool?: string;
}

export interface TournamentBracket {
  matches: BracketMatch[];
  champion: string | null;
  prizes: {
    first: { type: string; id?: string; amount?: number };
    second?: { type: string; id?: string; amount?: number };
  };
}

export interface BracketMatch {
  id: string;
  round: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  score: string | null;
}

// ─── Room Code ────────────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = '0123456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// ─── Bracket Generator ────────────────────────────────────────────────────────

export function generateBracket(players: string[], maxPlayers: 4 | 8): TournamentBracket {
  const matches: BracketMatch[] = [];

  if (maxPlayers === 4) {
    // Semi-finals: round 1
    matches.push({
      id: 'sf_0',
      round: 1,
      player1: players[0] ?? null,
      player2: players[1] ?? null,
      winner: null,
      score: null,
    });
    matches.push({
      id: 'sf_1',
      round: 1,
      player1: players[2] ?? null,
      player2: players[3] ?? null,
      winner: null,
      score: null,
    });
    // Final: round 2
    matches.push({
      id: 'final',
      round: 2,
      player1: null,
      player2: null,
      winner: null,
      score: null,
    });
  } else {
    // Quarter-finals: round 1
    for (let i = 0; i < 4; i++) {
      matches.push({
        id: `qf_${i}`,
        round: 1,
        player1: players[i * 2] ?? null,
        player2: players[i * 2 + 1] ?? null,
        winner: null,
        score: null,
      });
    }
    // Semi-finals: round 2
    matches.push({ id: 'sf_0', round: 2, player1: null, player2: null, winner: null, score: null });
    matches.push({ id: 'sf_1', round: 2, player1: null, player2: null, winner: null, score: null });
    // Final: round 3
    matches.push({ id: 'final', round: 3, player1: null, player2: null, winner: null, score: null });
  }

  return {
    matches,
    champion: null,
    prizes: {
      first: { type: 'chips', amount: (players.length * 200) },
      second: { type: 'chips', amount: 0 },
    },
  };
}

// ─── List Active Tournaments ──────────────────────────────────────────────────

export async function listActiveTournaments(): Promise<TournamentEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, room_code, status, max_players, current_players, bracket, winner_name, created_at, buy_in, prize_pool')
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[tournament] listActiveTournaments error:', error.message);
      return [];
    }

    return (data ?? []) as TournamentEntry[];
  } catch (err) {
    console.warn('[tournament] listActiveTournaments exception:', err);
    return [];
  }
}

// ─── Create Quick Tournament ──────────────────────────────────────────────────

export async function createQuickTournament(
  hostName: string,
  maxPlayers: 4 | 8,
): Promise<TournamentEntry | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const room_code = generateRoomCode();
  const buy_in = 200;
  const prize_pool = `${buy_in * maxPlayers} chips`;

  const initialBracket = generateBracket([], maxPlayers);

  try {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        room_code,
        status: 'waiting',
        max_players: maxPlayers,
        current_players: 1,
        bracket: initialBracket,
        winner_name: null,
        buy_in,
        prize_pool,
        host_name: hostName,
      })
      .select()
      .single();

    if (error) {
      console.warn('[tournament] createQuickTournament error:', error.message);
      return null;
    }

    return data as TournamentEntry;
  } catch (err) {
    console.warn('[tournament] createQuickTournament exception:', err);
    return null;
  }
}

// ─── Join Tournament ──────────────────────────────────────────────────────────

export async function joinTournament(
  tournamentId: string,
  playerName: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'No connection' };

  try {
    // Fetch current tournament
    const { data: tournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('id, status, max_players, current_players, buy_in')
      .eq('id', tournamentId)
      .single();

    if (fetchError || !tournament) {
      return { success: false, error: fetchError?.message ?? 'Tournament not found' };
    }

    if (tournament.status !== 'waiting') {
      return { success: false, error: 'Tournament already started' };
    }

    if (tournament.current_players >= tournament.max_players) {
      return { success: false, error: 'Tournament is full' };
    }

    // Increment player count
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ current_players: tournament.current_players + 1 })
      .eq('id', tournamentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Create sit_and_go_players row to track this player's seat
    const { error: playerError } = await supabase
      .from('sit_and_go_players')
      .insert({
        session_id: tournamentId,
        player_name: playerName,
        chips: 1000,
        is_active: true,
        position: tournament.current_players,
      });

    if (playerError) {
      console.warn('[tournament] joinTournament player insert error:', playerError.message);
      // Non-fatal — player count was incremented successfully
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ─── Report Match Result ──────────────────────────────────────────────────────

export async function reportMatchResult(
  tournamentId: string,
  matchId: string,
  winnerName: string,
  score: string,
): Promise<{ nextMatch: BracketMatch | null; isChampion: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { nextMatch: null, isChampion: false };

  try {
    const { data: tournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('bracket, max_players')
      .eq('id', tournamentId)
      .single();

    if (fetchError || !tournament?.bracket) {
      console.warn('[tournament] reportMatchResult fetch error:', fetchError?.message);
      return { nextMatch: null, isChampion: false };
    }

    const bracket: TournamentBracket = tournament.bracket as TournamentBracket;
    const matches = [...bracket.matches];

    // Update the current match
    const matchIndex = matches.findIndex((m) => m.id === matchId);
    if (matchIndex === -1) return { nextMatch: null, isChampion: false };

    matches[matchIndex] = { ...matches[matchIndex], winner: winnerName, score };

    // Check if this was the final
    const updatedMatch = matches[matchIndex];
    if (updatedMatch.id === 'final') {
      const updatedBracket: TournamentBracket = {
        ...bracket,
        matches,
        champion: winnerName,
      };

      await supabase
        .from('tournaments')
        .update({ bracket: updatedBracket, status: 'completed', winner_name: winnerName })
        .eq('id', tournamentId);

      return { nextMatch: null, isChampion: true };
    }

    // Advance winner to next round
    const completedRound = updatedMatch.round;
    const roundMatches = matches.filter((m) => m.round === completedRound);
    const allRoundDone = roundMatches.every((m) => m.winner !== null);

    if (allRoundDone) {
      // Seed winners into next round matches
      const nextRound = completedRound + 1;
      const nextRoundMatches = matches.filter((m) => m.round === nextRound);
      const winners = roundMatches.map((m) => m.winner as string);

      for (let i = 0; i < nextRoundMatches.length; i++) {
        const nextIdx = matches.findIndex((m) => m.id === nextRoundMatches[i].id);
        if (nextIdx !== -1) {
          matches[nextIdx] = {
            ...matches[nextIdx],
            player1: winners[i * 2] ?? null,
            player2: winners[i * 2 + 1] ?? null,
          };
        }
      }
    }

    const updatedBracket: TournamentBracket = { ...bracket, matches };

    await supabase
      .from('tournaments')
      .update({ bracket: updatedBracket })
      .eq('id', tournamentId);

    // Find the next match for this winner
    const nextMatch = matches.find(
      (m) => (m.player1 === winnerName || m.player2 === winnerName) && m.winner === null,
    ) ?? null;

    return { nextMatch, isChampion: false };
  } catch (err) {
    console.warn('[tournament] reportMatchResult exception:', err);
    return { nextMatch: null, isChampion: false };
  }
}
